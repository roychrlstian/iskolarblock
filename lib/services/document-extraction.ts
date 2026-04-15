export interface COGExtractionResponse {
  "Certificate of Grades": boolean;
  school: string | null;
  school_year: string | null;
  semester: string | null;
  course: string | null;
  name: string | null;
  gwa: number | null;
  total_units: number | null;
  subjects: GradeSubject[] | null;
  fileUrl?: string | null;
}

export interface GradeSubject {
  code: string;
  description: string;
  units: number;
  grade: string | number;
}

export interface CORExtractionResponse {
  "Certificate of Registration": boolean;
  school: string | null;
  school_year: string | null;
  semester: string | null;
  course: string | null;
  name: string | null;
  total_units: number | null;
  fileUrl?: string | null;
}

export interface DocumentExtractionError {
  message: string;
  code: string;
  statusCode?: number;
}

async function uploadAndGetUrl(
  file: File,
  userId: string,
  docType: "cog" | "cor"
): Promise<{ fileData?: string; fileUrl?: string; fileName: string }> {
  const fileName = file.name;

  try {
    const { uploadFileToSupabase } = await import("@/lib/utils/file-upload");
    const fileUrl = await uploadFileToSupabase(file, userId, undefined, docType);
    return { fileUrl, fileName };
  } catch {
    const fileData = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    return { fileData, fileName };
  }
}

function handleApiError(statusCode: number, errorMessage: string): never {
  if (statusCode === 400) {
    throw new Error(
      errorMessage || "Invalid request. Please check the uploaded document."
    );
  } else if (statusCode === 401 || statusCode === 403) {
    throw new Error("Authentication error. Please try again.");
  } else if (statusCode === 404) {
    throw new Error("Extraction service not found. Please contact support.");
  } else if (statusCode === 503) {
    throw new Error(
      errorMessage ||
        "Extraction service is temporarily unavailable. Please try again later."
    );
  } else if (statusCode === 504) {
    throw new Error(
      "Request timed out. The document may be too complex to process."
    );
  } else if (statusCode >= 500) {
    throw new Error(
      "Server error occurred. Please try again in a few moments."
    );
  }
  throw new Error(errorMessage);
}

export async function extractCOGData(
  ocrText: string,
  file?: File,
  userId?: string,
  applicantName?: string
): Promise<COGExtractionResponse | null> {
  if (!ocrText || typeof ocrText !== "string") {
    throw new Error("Invalid OCR text");
  }

  if (ocrText.trim().length === 0) {
    return null;
  }

  try {
    let fileData: string | undefined;
    let fileUrl: string | undefined;
    let fileName: string | undefined;

    if (file && userId) {
      const uploaded = await uploadAndGetUrl(file, userId, "cog");
      fileData = uploaded.fileData;
      fileUrl = uploaded.fileUrl;
      fileName = uploaded.fileName;
    }

    const response = await fetch("/api/extract/cog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ocrText, fileData, fileUrl, fileName, userId, applicantName }),
    });

    if (!response.ok) {
      let errorData: { error?: string } = {};
      try {
        errorData = await response.json();
      } catch {
        // ignore parse failure
      }
      handleApiError(response.status, errorData.error || "Failed to extract COG data");
    }

    const data = (await response.json()) as COGExtractionResponse;

    if (!data || typeof data !== "object") {
      throw new Error("Invalid data format received from server.");
    }

    const hasData = Object.values(data).some(
      (value) => value !== null && value !== undefined && value !== ""
    );

    return hasData ? data : null;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error(
      "An unexpected error occurred while extracting data from your document."
    );
  }
}

export async function extractCORData(
  ocrText: string,
  file?: File,
  userId?: string,
  applicantName?: string
): Promise<CORExtractionResponse | null> {
  if (!ocrText || typeof ocrText !== "string") {
    throw new Error("Invalid OCR text");
  }

  if (ocrText.trim().length === 0) {
    return null;
  }

  try {
    let fileData: string | undefined;
    let fileUrl: string | undefined;
    let fileName: string | undefined;

    if (file && userId) {
      const uploaded = await uploadAndGetUrl(file, userId, "cor");
      fileData = uploaded.fileData;
      fileUrl = uploaded.fileUrl;
      fileName = uploaded.fileName;
    }

    const response = await fetch("/api/extract/cor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ocrText, fileData, fileUrl, fileName, userId, applicantName }),
    });

    if (!response.ok) {
      let errorData: { error?: string } = {};
      try {
        errorData = await response.json();
      } catch {
        // ignore parse failure
      }
      handleApiError(response.status, errorData.error || "Failed to extract COR data");
    }

    const data = (await response.json()) as CORExtractionResponse;

    if (!data || typeof data !== "object") {
      throw new Error("Invalid data format received from server.");
    }

    const hasData = Object.values(data).some(
      (value) => value !== null && value !== undefined && value !== ""
    );

    return hasData ? data : null;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error(
      "An unexpected error occurred while extracting data from your document."
    );
  }
}
