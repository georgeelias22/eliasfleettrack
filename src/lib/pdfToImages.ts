// pdfjs-dist v4+ ships ESM modules under the legacy path that works well with bundlers.
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

// @ts-ignore - pdfjs typings are permissive across builds
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export async function pdfToJpegDataUrls(
  file: File,
  opts?: { maxPages?: number; scale?: number; jpegQuality?: number; maxWidth?: number }
): Promise<string[]> {
  const maxPages = opts?.maxPages ?? 2;
  const scale = opts?.scale ?? 2;
  const jpegQuality = opts?.jpegQuality ?? 0.7;
  const maxWidth = opts?.maxWidth ?? 1400;

  const buffer = await file.arrayBuffer();
  // @ts-ignore - getDocument typing varies by build
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pageCount = Math.min(pdf.numPages, maxPages);

  const images: string[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get canvas context");

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    // pdf.js legacy typings sometimes require a `canvas` field as well.
    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;

    if (canvas.width > maxWidth) {
      const ratio = maxWidth / canvas.width;
      const targetW = Math.floor(canvas.width * ratio);
      const targetH = Math.floor(canvas.height * ratio);

      const scaled = document.createElement("canvas");
      scaled.width = targetW;
      scaled.height = targetH;

      const sctx = scaled.getContext("2d");
      if (!sctx) throw new Error("Failed to get canvas context");
      sctx.drawImage(canvas, 0, 0, targetW, targetH);
      images.push(scaled.toDataURL("image/jpeg", jpegQuality));
    } else {
      images.push(canvas.toDataURL("image/jpeg", jpegQuality));
    }
  }

  return images;
}
