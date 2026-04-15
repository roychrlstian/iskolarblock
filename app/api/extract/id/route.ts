import { NextRequest, NextResponse } from "next/server";
import { extractId } from "@/lib/services/extraction-with-fallback";
import type { IdFields } from "@/lib/services/gemini-text-cleanup";

export interface IDExtractionResponse {
  last_name: string | null;
  first_name: string | null;
  middle_name: string | null;
  date_of_birth: string | null;
  place_of_birth: string | null;
  age: string | null;
  sex: string | null;
  residential_address: string | null;
  citizenship: string | null;
  contact_no: string | null;
  religion: string | null;
  course_or_strand: string | null;
  year_level: string | null;
}

interface RequestBody {
  ocrText: string;
  ocrConfidence?: number;
}

function toResponse(fields: IdFields): IDExtractionResponse {
  return {
    last_name: fields.last_name,
    first_name: fields.first_name,
    middle_name: fields.middle_name,
    date_of_birth: fields.date_of_birth,
    place_of_birth: fields.place_of_birth,
    age: fields.age,
    sex: fields.sex,
    residential_address: fields.residential_address,
    citizenship: fields.citizenship,
    contact_no: fields.contact_no,
    religion: fields.religion,
    course_or_strand: fields.course_or_strand,
    year_level: fields.year_level,
  };
}

export async function POST(request: NextRequest) {
  try {
    let body: RequestBody;
    try {
      body = (await request.json()) as RequestBody;
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { ocrText, ocrConfidence } = body;

    if (!ocrText || typeof ocrText !== "string") {
      return NextResponse.json(
        { error: "OCR text is required and must be a string" },
        { status: 400 }
      );
    }

    if (ocrText.trim().length === 0) {
      return NextResponse.json(
        { error: "OCR text cannot be empty" },
        { status: 400 }
      );
    }

    if (ocrText.length > 50000) {
      return NextResponse.json(
        { error: "OCR text is too long (max 50,000 characters)" },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY_ID && !process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: "Extraction service not configured" },
        { status: 503 }
      );
    }

    const { data: fields, provider } = await extractId(ocrText);

    if (!fields.Id) {
      return NextResponse.json(
        {
          error:
            "Invalid file type: Uploaded file is not a valid ID document",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ...toResponse(fields),
      ocrConfidence: typeof ocrConfidence === "number" ? Math.round(ocrConfidence) : undefined,
      provider,
    });
  } catch (error) {
    console.error("Unexpected error in extract-id API:", error);
    const anyErr = error as unknown as { status?: number; statusText?: string };
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    if (anyErr?.status === 429 || errorMessage.includes("429 Too Many Requests")) {
      return NextResponse.json(
        {
          error: "AI extraction quota exceeded",
          details:
            "All configured AI providers are out of quota. Check Gemini billing or add a GROQ_API_KEY fallback.",
        },
        { status: 429 }
      );
    }
    return NextResponse.json(
      {
        error: "An unexpected error occurred while processing your request",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
