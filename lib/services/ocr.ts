/**
 * OCR Processing utility for extracting text from images and PDFs
 * Uses Tesseract.js for OCR and PDF.js for PDF rendering
 */

export interface OCRProgress {
  status: string;
  progress: number; // 0-100
}

export interface OCRResult {
  text: string;
  confidence: number;
  error?: string;
}

/**
 * Extract text from an image file using Tesseract OCR
 */
export async function extractTextFromImage(
  file: File,
  onProgress?: (progress: OCRProgress) => void
): Promise<OCRResult> {
  try {
    const Tesseract = (await import("tesseract.js")).default;

    return await new Promise<OCRResult>((resolve, reject) => {
      Tesseract.recognize(file, "eng", {
        logger: (m: { status?: string; progress?: number }) => {
          if (m?.status === "recognizing text" && typeof m.progress === "number") {
            onProgress?.({
              status: "Recognizing text...",
              progress: Math.max(1, Math.min(99, Math.round(m.progress * 100))),
            });
          }
        },
      })
        .then((res: { data?: { text?: string; confidence?: number } }) => {
          resolve({
            text: res?.data?.text ?? "",
            confidence: res?.data?.confidence ?? 0,
          });
        })
        .catch((err) => {
          reject(err);
        });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process image";
    return { text: "", confidence: 0, error: message };
  }
}

/**
 * Extract text from a PDF file by rendering pages to canvas then using Tesseract OCR
 */
export async function extractTextFromPDF(
  file: File,
  onProgress?: (progress: OCRProgress) => void
): Promise<OCRResult> {
  try {
    const Tesseract = (await import("tesseract.js")).default;
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    
    // Set up worker - use local worker from public directory
    if (typeof window !== "undefined") {
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.mjs";
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    let combinedText = "";
    const pageConfidences: number[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2 });
      
      // Create canvas element
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context not available");
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Render PDF page to canvas
      await page.render({ canvasContext: ctx, viewport }).promise;

      // OCR the canvas
      const pageResult = await new Promise<{ text: string; confidence: number }>((resolve, reject) => {
        Tesseract.recognize(canvas, "eng", {
          logger: (m: { status?: string; progress?: number }) => {
            if (m?.status === "recognizing text" && typeof m.progress === "number") {
              const pageProgress = m.progress;
              const total = ((pageNum - 1) + pageProgress) / pdf.numPages;
              onProgress?.({
                status: `Processing page ${pageNum} of ${pdf.numPages}...`,
                progress: Math.max(1, Math.min(99, Math.round(total * 100))),
              });
            }
          },
        })
          .then((res: { data?: { text?: string; confidence?: number } }) => {
            resolve({
              text: res?.data?.text ?? "",
              confidence: res?.data?.confidence ?? 0,
            });
          })
          .catch(reject);
      });

      combinedText += pageResult.text + "\n";
      pageConfidences.push(pageResult.confidence);
    }

    const avgConfidence =
      pageConfidences.length > 0
        ? pageConfidences.reduce((a, b) => a + b, 0) / pageConfidences.length
        : 0;

    return { text: combinedText.trim(), confidence: Math.round(avgConfidence) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process PDF";
    return { text: "", confidence: 0, error: message };
  }
}

/**
 * Auto-detect file type and extract text accordingly
 */
export async function extractText(
  file: File,
  onProgress?: (progress: OCRProgress) => void
): Promise<OCRResult> {
  const isPDF = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const isImage = file.type.startsWith("image/");

  if (isPDF) {
    return extractTextFromPDF(file, onProgress);
  } else if (isImage) {
    return extractTextFromImage(file, onProgress);
  } else {
    return {
      text: "",
      confidence: 0,
      error: "Unsupported file type. Please upload an image or PDF.",
    };
  }
}
