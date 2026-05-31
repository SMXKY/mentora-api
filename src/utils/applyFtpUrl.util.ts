import { StatusCodes } from "http-status-codes";
import { AppError } from "./AppError.util";

export const applyFtpUrlTransform = (
  docOrDocs: any,
  field: string = "profilePictureUrl"
): any => {
  const baseUrl = process.env.FTP_BASE_URL;
  if (!baseUrl) {
    throw new AppError(
      "No FTP base URL found in environment configuration.",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }

  const transformString = (value: string): string =>
    value && !value.startsWith("https://") ? baseUrl + value : value;

  const transformDoc = (doc: any) => {
    if (doc && doc[field] && typeof doc[field] === "string") {
      doc[field] = transformString(doc[field]);
    }
  };

  if (typeof docOrDocs === "string") {
    return transformString(docOrDocs);
  }

  if (Array.isArray(docOrDocs)) {
    if (docOrDocs.every((item) => typeof item === "string")) {
      return docOrDocs.map(transformString);
    }
    docOrDocs.forEach(transformDoc);
    return docOrDocs;
  }

  transformDoc(docOrDocs);
  return docOrDocs;
};
