import mammoth from "mammoth";

export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const ext = name.split(".").pop() || "";

  if (ext === "txt") {
    return await file.text();
  }

  if (ext === "docx") {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }

  if (ext === "pdf") {
    const arrayBuffer = await file.arrayBuffer();
    const pdfjs = await import("pdfjs-dist");
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(" ");
      fullText += pageText + "\n";
    }
    return fullText;
  }

  throw new Error(`Unsupported file type: .${ext}. Please upload .docx, .txt, or .pdf files.`);
}

export function getFileType(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop() || "";
  return ext;
}
