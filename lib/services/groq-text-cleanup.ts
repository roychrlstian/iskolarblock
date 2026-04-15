import Groq from "groq-sdk";
import {
  IdFieldsSchema,
  CORFieldsSchema,
  COGFieldsSchema,
  type IdFields,
  type CORFields,
  type COGFields,
} from "./gemini-text-cleanup";

const DEFAULT_MODEL = "llama-3.3-70b-versatile";

function getClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured");
  return new Groq({ apiKey });
}

// ---------------------------------------------------------------------------
// JSON Schema definitions for Groq structured output (OpenAI-compatible)
// ---------------------------------------------------------------------------

const idJsonSchema = {
  name: "id_extraction",
  strict: true,
  schema: {
    type: "object" as const,
    properties: {
      Id: { type: "boolean" },
      last_name: { type: ["string", "null"] },
      first_name: { type: ["string", "null"] },
      middle_name: { type: ["string", "null"] },
      date_of_birth: { type: ["string", "null"] },
      place_of_birth: { type: ["string", "null"] },
      age: { type: ["string", "null"] },
      sex: { type: ["string", "null"] },
      residential_address: { type: ["string", "null"] },
      citizenship: { type: ["string", "null"] },
      contact_no: { type: ["string", "null"] },
      religion: { type: ["string", "null"] },
      course_or_strand: { type: ["string", "null"] },
      year_level: { type: ["string", "null"] },
    },
    required: [
      "Id", "last_name", "first_name", "middle_name", "date_of_birth",
      "place_of_birth", "age", "sex", "residential_address", "citizenship",
      "contact_no", "religion", "course_or_strand", "year_level",
    ],
    additionalProperties: false,
  },
};

const corJsonSchema = {
  name: "cor_extraction",
  strict: true,
  schema: {
    type: "object" as const,
    properties: {
      "Certificate of Registration": { type: "boolean" },
      "Match name": { type: "boolean" },
      school: { type: ["string", "null"] },
      school_year: { type: ["string", "null"] },
      semester: { type: ["string", "null"] },
      course: { type: ["string", "null"] },
      name: { type: ["string", "null"] },
      total_units: { type: ["number", "null"] },
    },
    required: [
      "Certificate of Registration", "Match name", "school",
      "school_year", "semester", "course", "name", "total_units",
    ],
    additionalProperties: false,
  },
};

const cogJsonSchema = {
  name: "cog_extraction",
  strict: true,
  schema: {
    type: "object" as const,
    properties: {
      "Certificate of Grades": { type: "boolean" },
      "Match name": { type: "boolean" },
      school: { type: ["string", "null"] },
      school_year: { type: ["string", "null"] },
      semester: { type: ["string", "null"] },
      course: { type: ["string", "null"] },
      name: { type: ["string", "null"] },
      total_gwa: { type: ["number", "null"] },
      total_units: { type: ["number", "null"] },
      subjects: {
        oneOf: [
          {
            type: "array",
            items: {
              type: "object",
              properties: {
                code: { type: "string" },
                description: { type: "string" },
                units: { type: "number" },
                grade: { type: "string" },
              },
              required: ["code", "description", "units", "grade"],
              additionalProperties: false,
            },
          },
          { type: "null" },
        ],
      },
    },
    required: [
      "Certificate of Grades", "Match name", "school", "school_year",
      "semester", "course", "name", "total_gwa", "total_units", "subjects",
    ],
    additionalProperties: false,
  },
};

// ---------------------------------------------------------------------------
// Prompt helpers (reuse same text as Gemini prompts)
// ---------------------------------------------------------------------------

const COMMON_INSTRUCTIONS = `
You are a document-data-extraction assistant. You receive raw OCR text that may
contain noise, garbled characters, or formatting artefacts. Your job is to
extract the requested fields as clean, correctly-cased values. Apply these rules:
- Fix common OCR confusions (0<->O, 1<->l, rn<->m, etc.).
- Normalise whitespace; remove stray symbols that are not part of the data.
- Use Title Case for names and places.
- Return null for any field you cannot confidently extract.
- Do NOT fabricate data that is not present in the text.
Respond ONLY with the JSON object matching the schema.`.trim();

function idPrompt(ocrText: string): string {
  return `${COMMON_INSTRUCTIONS}

The OCR text below was scanned from a Philippine government ID or school ID.
Extract the personal-information fields listed in the schema.

If the text does NOT appear to be from an ID document at all, set "Id" to false
and set every other field to null.

For date_of_birth use MM/DD/YYYY format.
Calculate age from the date of birth if not explicitly stated.
For sex, return "Male" or "Female".

OCR TEXT:
"""
${ocrText}
"""`;
}

function corPrompt(ocrText: string, applicantName?: string): string {
  const nameCheck = applicantName
    ? `The applicant's name is "${applicantName}". Set "Match name" to true only if the name found in the document closely matches this (allow minor OCR noise).`
    : `Set "Match name" to true.`;

  return `${COMMON_INSTRUCTIONS}

The OCR text below was scanned from a Certificate of Registration (COR) document.
Extract the fields listed in the schema.

If the text does NOT appear to be a Certificate of Registration, set
"Certificate of Registration" to false and set every other field to null.

${nameCheck}

OCR TEXT:
"""
${ocrText}
"""`;
}

function cogPrompt(ocrText: string, applicantName?: string): string {
  const nameCheck = applicantName
    ? `The applicant's name is "${applicantName}". Set "Match name" to true only if the name found in the document closely matches this (allow minor OCR noise).`
    : `Set "Match name" to true.`;

  return `${COMMON_INSTRUCTIONS}

The OCR text below was scanned from a Certificate of Grades (COG) / Transcript
of Records. Extract the fields listed in the schema.

If the text does NOT appear to be a Certificate of Grades, set
"Certificate of Grades" to false and set every other field to null.

${nameCheck}

For subjects, extract every subject row you can find with code, description,
units, and grade. If no subject rows are found, set subjects to null.

OCR TEXT:
"""
${ocrText}
"""`;
}

// ---------------------------------------------------------------------------
// Public extraction functions
// ---------------------------------------------------------------------------

export async function extractIdWithGroq(ocrText: string): Promise<IdFields> {
  const client = getClient();
  const completion = await client.chat.completions.create({
    model: process.env.GROQ_MODEL || DEFAULT_MODEL,
    messages: [{ role: "user", content: idPrompt(ocrText) }],
    response_format: {
      type: "json_schema",
      json_schema: idJsonSchema,
    },
    temperature: 0.1,
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error("Groq returned empty response");
  return IdFieldsSchema.parse(JSON.parse(text));
}

export async function extractCorWithGroq(
  ocrText: string,
  applicantName?: string
): Promise<CORFields> {
  const client = getClient();
  const completion = await client.chat.completions.create({
    model: process.env.GROQ_MODEL || DEFAULT_MODEL,
    messages: [{ role: "user", content: corPrompt(ocrText, applicantName) }],
    response_format: {
      type: "json_schema",
      json_schema: corJsonSchema,
    },
    temperature: 0.1,
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error("Groq returned empty response");
  return CORFieldsSchema.parse(JSON.parse(text));
}

export async function extractCogWithGroq(
  ocrText: string,
  applicantName?: string
): Promise<COGFields> {
  const client = getClient();
  const completion = await client.chat.completions.create({
    model: process.env.GROQ_MODEL || DEFAULT_MODEL,
    messages: [{ role: "user", content: cogPrompt(ocrText, applicantName) }],
    response_format: {
      type: "json_schema",
      json_schema: cogJsonSchema,
    },
    temperature: 0.1,
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error("Groq returned empty response");
  return COGFieldsSchema.parse(JSON.parse(text));
}
