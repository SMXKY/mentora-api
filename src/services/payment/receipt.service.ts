import fs from "fs";
import os from "os";
import path from "path";
import { randomUUID, randomBytes } from "crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import prisma from "../../config/database.config";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import { FileCategory, FileType } from "../../generated/prisma";
import { MediaService } from "../media/media.service";
import { fileTypes } from "../media/media.types";

function generateReferenceNumber(): string {
  return `MTR-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

async function buildReceiptPdf(params: {
  referenceNumber: string;
  userName: string;
  amountXaf: number;
  bookingId: string;
  subjectName: string;
  sessionDate: string;
  createdAt: Date;
}): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([420, 560]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let y = 500;
  const draw = (text: string, opts: { size?: number; useBold?: boolean; gap?: number } = {}) => {
    page.drawText(text, {
      x: 40,
      y,
      size: opts.size ?? 11,
      font: opts.useBold ? bold : font,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= opts.gap ?? 20;
  };

  draw("Mentora — Payment Receipt", { size: 18, useBold: true, gap: 30 });
  draw(`Reference: ${params.referenceNumber}`, { useBold: true });
  draw(`Date: ${params.createdAt.toISOString().slice(0, 10)}`);
  draw(`Paid by: ${params.userName}`);
  draw(`Subject: ${params.subjectName}`);
  draw(`Session date: ${params.sessionDate}`);
  draw(`Booking reference: ${params.bookingId}`, { gap: 30 });
  draw(`Amount paid: ${params.amountXaf.toLocaleString()} XAF`, { size: 14, useBold: true });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

/** Generates a PDF receipt and files it under the payer's Receipt records. */
async function generateReceiptForBooking(bookingId: string, userId: string) {
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { subject: { select: { name: true } } },
  });
  if (!booking.totalAmountXaf) {
    throw new AppError("payment/errors:bookingHasNoAgreedRate", StatusCodes.CONFLICT);
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const referenceNumber = generateReferenceNumber();

  const pdfBytes = await buildReceiptPdf({
    referenceNumber,
    userName: [user.firstName, user.lastName].filter(Boolean).join(" ") || "Mentora user",
    amountXaf: booking.totalAmountXaf,
    bookingId: booking.id,
    subjectName: booking.subject.name,
    sessionDate: booking.sessionDate.toISOString().slice(0, 10),
    createdAt: new Date(),
  });

  const tempFilePath = path.join(os.tmpdir(), `receipt-${randomUUID()}.pdf`);
  fs.writeFileSync(tempFilePath, pdfBytes);

  try {
    const [uploaded] = await MediaService.upload(
      [{ tempFilePath, originalFileName: `${referenceNumber}.pdf` }],
      {
        uploadedById: userId,
        fileCategory: FileCategory.RECEIPT,
        fileType: FileType.DOCUMENT,
        allowedTypes: [fileTypes.document.pdf],
        maxSizeMB: 10,
        refTable: "bookings",
        refRecordId: bookingId,
      }
    );

    return prisma.receipt.create({
      data: {
        referenceNumber,
        bookingId,
        userId,
        fileId: uploaded.fileId,
        amountXaf: booking.totalAmountXaf,
        metadata: { subjectName: booking.subject.name, sessionDate: booking.sessionDate.toISOString().slice(0, 10) },
      },
    });
  } finally {
    fs.unlink(tempFilePath, () => undefined);
  }
}

async function getReceiptByReference(referenceNumber: string) {
  const receipt = await prisma.receipt.findUnique({ where: { referenceNumber } });
  if (!receipt) throw new AppError("payment/errors:receiptNotFound", StatusCodes.NOT_FOUND);
  return receipt;
}

async function listMyReceipts(userId: string) {
  return prisma.receipt.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
}

export const ReceiptService = { generateReceiptForBooking, getReceiptByReference, listMyReceipts };
export default ReceiptService;
