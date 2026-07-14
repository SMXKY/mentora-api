/**
 * Generates realistic, multi-page, genuinely-valid PDF fixtures for the
 * 5 "real tutor" k6 fixtures (k6/fixtures/real-tutors/tutor-N/). Unlike the
 * 200-byte TINY_PDF stub used by the other seed scripts (structurally valid
 * but not representative), these exercise media.processor.ts's validatePdf()
 * (multi-page PDFDocument.load) the way a real scanned document would.
 *
 * Run manually: ts-node k6/support/generate-real-tutor-pdfs.ts
 */
import fs from "fs";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const TUTOR_NAMES = [
  "Marie Nkeng",
  "Jean Fotso",
  "Fatima Bello",
  "Paul Njoya",
  "Grace Tchoumi",
];

async function buildPdf(
  title: string,
  bodyLines: string[],
  pageCount: number
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  for (let p = 0; p < pageCount; p++) {
    const page = doc.addPage([595, 842]); // A4
    page.drawText(title, {
      x: 50,
      y: 780,
      size: 18,
      font: boldFont,
      color: rgb(0.1, 0.1, 0.4),
    });
    page.drawText(`Page ${p + 1} of ${pageCount}`, {
      x: 50,
      y: 755,
      size: 10,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
    let y = 710;
    for (const line of bodyLines) {
      page.drawText(line, { x: 50, y, size: 12, font, color: rgb(0, 0, 0) });
      y -= 22;
    }
    page.drawText(
      `Generated for k6 KYC real-file testing — not a genuine document.`,
      { x: 50, y: 40, size: 8, font, color: rgb(0.6, 0.6, 0.6) }
    );
  }

  return doc.save();
}

async function main(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    const tutorDir = path.join(
      __dirname,
      "..",
      "fixtures",
      "real-tutors",
      `tutor-${i + 1}`
    );
    fs.mkdirSync(tutorDir, { recursive: true });
    const name = TUTOR_NAMES[i];

    const nonConviction = await buildPdf(
      "CERTIFICATE OF NON-CONVICTION",
      [
        `Name: ${name}`,
        `Issued by: Tribunal de Première Instance`,
        `Reference: NC-${1000 + i}-2026`,
        `This certifies that the above-named person has no criminal`,
        `record on file as of the date of issue.`,
      ],
      2
    );
    fs.writeFileSync(
      path.join(tutorDir, "non-conviction.pdf"),
      nonConviction
    );

    const degree = await buildPdf(
      "UNIVERSITY DEGREE CERTIFICATE",
      [
        `This is to certify that`,
        name,
        `has been awarded the degree of`,
        `Bachelor of Science in Mathematics`,
        `University of Yaoundé I — Class of 2018`,
      ],
      3
    );
    fs.writeFileSync(path.join(tutorDir, "degree.pdf"), degree);

    console.log(
      JSON.stringify({ event: "real_tutor_pdfs_generated", tutor: i + 1, name })
    );
  }
}

main().catch((err) => {
  console.error("PDF generation failed:", err);
  process.exit(1);
});
