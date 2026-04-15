import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { z } from "zod";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash-preview-05-20",
  generationConfig: { responseMimeType: "application/json" },
});

// ---------------------------------------------------------------------------
// Zod schemas for validated output
// ---------------------------------------------------------------------------

export const IdFieldsSchema = z.object({
  Id: z.boolean(),
  last_name: z.string().nullable(),
  first_name: z.string().nullable(),
  middle_name: z.string().nullable(),
  date_of_birth: z.string().nullable(),
  place_of_birth: z.string().nullable(),
  age: z.string().nullable(),
  sex: z.string().nullable(),
  residential_address: z.string().nullable(),
  citizenship: z.string().nullable(),
  contact_no: z.string().nullable(),
  religion: z.string().nullable(),
  course_or_strand: z.string().nullable(),
  year_level: z.string().nullable(),
});

export const CORFieldsSchema = z.object({
  "Certificate of Registration": z.boolean(),
  "Match name": z.boolean(),
  school: z.string().nullable(),
  school_year: z.string().nullable(),
  semester: z.string().nullable(),
  course: z.string().nullable(),
  name: z.string().nullable(),
  total_units: z.number().nullable(),
});

const GradeSubjectSchema = z.object({
  code: z.string(),
  description: z.string(),
  units: z.number(),
  grade: z.union([z.string(), z.number()]),
});

export const COGFieldsSchema = z.object({
  "Certificate of Grades": z.boolean(),
  "Match name": z.boolean(),
  school: z.string().nullable(),
  school_year: z.string().nullable(),
  semester: z.string().nullable(),
  course: z.string().nullable(),
  name: z.string().nullable(),
  total_gwa: z.number().nullable(),
  total_units: z.number().nullable(),
  subjects: z.array(GradeSubjectSchema).nullable(),
});

export type IdFields = z.infer<typeof IdFieldsSchema>;
export type CORFields = z.infer<typeof CORFieldsSchema>;
export type COGFields = z.infer<typeof COGFieldsSchema>;

// ---------------------------------------------------------------------------
// Gemini JSON Schema definitions (mirrors the Zod schemas for the model)
// ---------------------------------------------------------------------------

const idResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    Id: { type: SchemaType.BOOLEAN },
    last_name: { type: SchemaType.STRING, nullable: true },
    first_name: { type: SchemaType.STRING, nullable: true },
    middle_name: { type: SchemaType.STRING, nullable: true },
    date_of_birth: { type: SchemaType.STRING, nullable: true },
    place_of_birth: { type: SchemaType.STRING, nullable: true },
    age: { type: SchemaType.STRING, nullable: true },
    sex: { type: SchemaType.STRING, nullable: true },
    residential_address: { type: SchemaType.STRING, nullable: true },
    citizenship: { type: SchemaType.STRING, nullable: true },
    contact_no: { type: SchemaType.STRING, nullable: true },
    religion: { type: SchemaType.STRING, nullable: true },
    course_or_strand: { type: SchemaType.STRING, nullable: true },
    year_level: { type: SchemaType.STRING, nullable: true },
  },
  required: [
    "Id",
    "last_name",
    "first_name",
    "middle_name",
    "date_of_birth",
    "place_of_birth",
    "age",
    "sex",
    "residential_address",
    "citizenship",
    "contact_no",
    "religion",
    "course_or_strand",
    "year_level",
  ],
};

const corResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    "Certificate of Registration": { type: SchemaType.BOOLEAN },
    "Match name": { type: SchemaType.BOOLEAN },
    school: { type: SchemaType.STRING, nullable: true },
    school_year: { type: SchemaType.STRING, nullable: true },
    semester: { type: SchemaType.STRING, nullable: true },
    course: { type: SchemaType.STRING, nullable: true },
    name: { type: SchemaType.STRING, nullable: true },
    total_units: { type: SchemaType.NUMBER, nullable: true },
  },
  required: [
    "Certificate of Registration",
    "Match name",
    "school",
    "school_year",
    "semester",
    "course",
    "name",
    "total_units",
  ],
};

const cogResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    "Certificate of Grades": { type: SchemaType.BOOLEAN },
    "Match name": { type: SchemaType.BOOLEAN },
    school: { type: SchemaType.STRING, nullable: true },
    school_year: { type: SchemaType.STRING, nullable: true },
    semester: { type: SchemaType.STRING, nullable: true },
    course: { type: SchemaType.STRING, nullable: true },
    name: { type: SchemaType.STRING, nullable: true },
    total_gwa: { type: SchemaType.NUMBER, nullable: true },
    total_units: { type: SchemaType.NUMBER, nullable: true },
    subjects: {
      type: SchemaType.ARRAY,
      nullable: true,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          code: { type: SchemaType.STRING },
          description: { type: SchemaType.STRING },
          units: { type: SchemaType.NUMBER },
          grade: { type: SchemaType.STRING },
        },
        required: ["code", "description", "units", "grade"],
      },
    },
  },
  required: [
    "Certificate of Grades",
    "Match name",
    "school",
    "school_year",
    "semester",
    "course",
    "name",
    "total_gwa",
    "total_units",
    "subjects",
  ],
};

// ---------------------------------------------------------------------------
// Prompt helpers
// ---------------------------------------------------------------------------

const COMMON_INSTRUCTIONS = `
You are a document‐data‐extraction assistant. You receive raw OCR text that may
contain noise, garbled characters, or formatting artefacts. Your job is to
extract the requested fields as clean, correctly‑cased values. Apply these rules:
- Fix common OCR confusions (0↔O, 1↔l, rn↔m, etc.).
- Normalise whitespace; remove stray symbols that are not part of the data.
- Use Title Case for names and places.
- Return null for any field you cannot confidently extract.
- Do NOT fabricate data that is not present in the text.
`.trim();

function idPrompt(ocrText: string): string {
  return `${COMMON_INSTRUCTIONS}

The OCR text below was scanned from a Philippine government ID or school ID.
Extract the personal‐information fields listed in the schema.

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

export async function extractIdWithGemini(ocrText: string): Promise<IdFields> {
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: idPrompt(ocrText) }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: idResponseSchema,
    },
  });

  const raw = JSON.parse(result.response.text());
  return IdFieldsSchema.parse(raw);
}

export async function extractCorWithGemini(
  ocrText: string,
  applicantName?: string
): Promise<CORFields> {
  const result = await model.generateContent({
    contents: [
      { role: "user", parts: [{ text: corPrompt(ocrText, applicantName) }] },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: corResponseSchema,
    },
  });

  const raw = JSON.parse(result.response.text());
  return CORFieldsSchema.parse(raw);
}

export async function extractCogWithGemini(
  ocrText: string,
  applicantName?: string
): Promise<COGFields> {
  const result = await model.generateContent({
    contents: [
      { role: "user", parts: [{ text: cogPrompt(ocrText, applicantName) }] },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: cogResponseSchema,
    },
  });

  const raw = JSON.parse(result.response.text());
  return COGFieldsSchema.parse(raw);
}
