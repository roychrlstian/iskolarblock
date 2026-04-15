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

export interface IDExtractionError {
  message: string;
  code: string;
  statusCode?: number;
}

export async function extractIDData(
  ocrText: string
): Promise<IDExtractionResponse | null> {
  if (!ocrText || typeof ocrText !== "string") {
    throw new Error("Invalid OCR text");
  }

  if (ocrText.trim().length === 0) {
    return null;
  }

  try {
    const response = await fetch("/api/extract/id", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ocrText }),
    });

    if (!response.ok) {
      let errorData: { error?: string } = {};
      try {
        errorData = await response.json();
      } catch {
        // ignore parse failure
      }

      const errorMessage = errorData.error || "Failed to extract ID data";
      const statusCode = response.status;

      if (statusCode === 400) {
        throw new Error(
          errorMessage || "Invalid request. Please check the uploaded document."
        );
      } else if (statusCode === 401 || statusCode === 403) {
        throw new Error("Authentication error. Please try again.");
      } else if (statusCode === 404) {
        throw new Error(
          "Extraction service not found. Please contact support."
        );
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

    const data = (await response.json()) as IDExtractionResponse;

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

export interface ParsedAddress {
  houseNumber: string;
  purok: string;
  barangay: string;
  municipality: string;
}

export function parseResidentialAddress(
  address: string | null
): ParsedAddress | null {
  if (!address || typeof address !== "string") {
    return null;
  }

  const trimmedAddress = address.trim();

  if (trimmedAddress.length === 0) {
    return null;
  }

  try {
    const parts = trimmedAddress
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    if (parts.length === 0) {
      return null;
    }

    if (parts.length === 1) {
      return {
        houseNumber: "",
        purok: "",
        barangay: "",
        municipality: parts[0],
      };
    }

    if (parts.length === 2) {
      return {
        houseNumber: "",
        purok: parts[0],
        barangay: "",
        municipality: parts[1],
      };
    }

    let houseNumber = "";
    let purok = "";
    let barangay = "";
    let municipality = "";

    const firstPart = parts[0];

    const houseMatch = firstPart.match(/^(\d+[A-Za-z]?)\s+(.+)$/);
    if (houseMatch) {
      houseNumber = houseMatch[1].trim();
      purok = houseMatch[2].trim();
    } else {
      purok = firstPart;
    }

    if (parts[1]) {
      barangay = parts[1];
      barangay = barangay.replace(/^(Brgy\.?|Barangay|Bgry\.?)\s+/i, "").trim();
    }

    if (parts.length === 3) {
      municipality = parts[2];
    } else if (parts.length > 3) {
      municipality = parts.slice(2).join(", ");
    }

    return {
      houseNumber: houseNumber || "",
      purok: purok || "",
      barangay: barangay || "",
      municipality: municipality || trimmedAddress,
    };
  } catch {
    return {
      houseNumber: "",
      purok: "",
      barangay: "",
      municipality: trimmedAddress,
    };
  }
}
