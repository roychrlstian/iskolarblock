import {
  extractIdWithGemini,
  extractCorWithGemini,
  extractCogWithGemini,
  type IdFields,
  type CORFields,
  type COGFields,
} from "./gemini-text-cleanup";
import {
  extractIdWithGroq,
  extractCorWithGroq,
  extractCogWithGroq,
} from "./groq-text-cleanup";

export type Provider = "gemini" | "groq";

export interface ExtractionResult<T> {
  data: T;
  provider: Provider;
}

/**
 * Attempts Gemini first; on any failure falls back to Groq if configured.
 * Returns both the extracted data and which provider succeeded.
 */
async function withFallback<T>(
  gemini: () => Promise<T>,
  groq: () => Promise<T>,
): Promise<ExtractionResult<T>> {
  // Try Gemini first (primary)
  try {
    const data = await gemini();
    return { data, provider: "gemini" };
  } catch (geminiErr) {
    // If Groq isn't configured, re-throw the Gemini error
    if (!process.env.GROQ_API_KEY) throw geminiErr;

    // Attempt Groq fallback
    try {
      const data = await groq();
      return { data, provider: "groq" };
    } catch (_groqErr) {
      // Both providers failed — throw the original Gemini error
      // since it's the primary and the user likely configured it
      throw geminiErr;
    }
  }
}

export async function extractId(
  ocrText: string,
): Promise<ExtractionResult<IdFields>> {
  return withFallback(
    () => extractIdWithGemini(ocrText),
    () => extractIdWithGroq(ocrText),
  );
}

export async function extractCor(
  ocrText: string,
  applicantName?: string,
): Promise<ExtractionResult<CORFields>> {
  return withFallback(
    () => extractCorWithGemini(ocrText, applicantName),
    () => extractCorWithGroq(ocrText, applicantName),
  );
}

export async function extractCog(
  ocrText: string,
  applicantName?: string,
): Promise<ExtractionResult<COGFields>> {
  return withFallback(
    () => extractCogWithGemini(ocrText, applicantName),
    () => extractCogWithGroq(ocrText, applicantName),
  );
}
