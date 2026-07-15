type ServiceError = Error & {
  statusCode: number;
  messages: Record<string, string>;
};

export const createTransferError = (
  statusCode: number,
  vi: string,
  zh: string,
): ServiceError => {
  const error = new Error(vi) as ServiceError;
  error.statusCode = statusCode;
  error.messages = { vi, zh };
  return error;
};

export const generateTransferOrderNumber = (isIntra: boolean): string => {
  const prefix = isIntra ? "TRF-I" : "TRF-X";
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const sequence = String(Math.floor(Math.random() * 900) + 100);
  return `${prefix}-${datePart}-${sequence}`;
};
