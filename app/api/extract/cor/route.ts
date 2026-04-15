import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { extractCorWithGemini } from "@/lib/services/gemini-text-cleanup";

export interface CORExtractionResponse {
  "Certificate of Registration": boolean;
  school: string | null;
  school_year: string | null;
  semester: string | null;
  course: string | null;
  name: string | null;
  total_units: number | null;
}

interface RequestBody {
  ocrText: string;
  fileData?: string;
  fileUrl?: string;
  fileName?: string;
  userId?: string;
  applicantName?: string | null;
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

    const { ocrText, fileData, fileUrl, fileName, userId, applicantName } =
      body;

    let finalFileUrl: string | null = fileUrl || null;

    if (fileData && fileName && userId && !fileUrl) {
      try {
        const supabase = getSupabaseServerClient();
        const base64Data = fileData.split(",")[1] || fileData;
        const buffer = Buffer.from(base64Data, "base64");
        const timestamp = Date.now();
        const filePath = `${userId}/cor/${timestamp}-${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("documents")
          .upload(filePath, buffer, {
            contentType: fileName.endsWith(".pdf")
              ? "application/pdf"
              : "image/jpeg",
            upsert: false,
          });

        if (uploadError) {
          console.error("COR file upload error:", uploadError);
        } else {
          finalFileUrl = uploadData.path;
        }
      } catch (storageError) {
        console.error("COR storage error:", storageError);
      }
    }

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

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "COR extraction service not configured" },
        { status: 503 }
      );
    }

    const fields = await extractCorWithGemini(
      ocrText,
      applicantName ?? undefined
    );

    if (!fields["Certificate of Registration"]) {
      return NextResponse.json(
        {
          error:
            "Invalid file type: Uploaded file is not a valid Certificate of Registration document",
        },
        { status: 400 }
      );
    }

    if (!fields["Match name"]) {
      return NextResponse.json(
        {
          error:
            "The name on your Certificate of Registration does not match the name entered in the application form. Please upload the correct COR.",
        },
        { status: 400 }
      );
    }

    const data: CORExtractionResponse = {
      "Certificate of Registration": fields["Certificate of Registration"],
      school: fields.school,
      school_year: fields.school_year,
      semester: fields.semester,
      course: fields.course,
      name: fields.name,
      total_units: fields.total_units,
    };

    return NextResponse.json({ ...data, fileUrl: finalFileUrl });
  } catch (error) {
    console.error("Unexpected error in extract-cor API:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "An unexpected error occurred while processing your request",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
