const fs = require("fs/promises");
const path = require("path");
const mammoth = require("mammoth");
const { PDFParse } = require("pdf-parse");

async function parsePdf(filePath) {
  const fileBuffer = await fs.readFile(filePath);

  const parser = new PDFParse({
    data: fileBuffer,
  });

  try {
    const result = await parser.getText();

    return result.text || "";
  } finally {
    await parser.destroy();
  }
}

async function parseDocx(filePath) {
  const result = await mammoth.extractRawText({
    path: filePath,
  });

  return result.value || "";
}

function cleanExtractedText(text) {
  return String(text || "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractResumeText(file) {
  const extension = path.extname(file.originalname).toLowerCase();

  let extractedText = "";

  if (extension === ".pdf") {
    extractedText = await parsePdf(file.path);
  } else if (extension === ".docx") {
    extractedText = await parseDocx(file.path);
  } else {
    throw new Error("Unsupported resume file format.");
  }

  const cleanedText = cleanExtractedText(extractedText);

  if (!cleanedText) {
    throw new Error(
      "No readable text was found in this resume.",
    );
  }

  return cleanedText;
}

module.exports = {
  extractResumeText,
};