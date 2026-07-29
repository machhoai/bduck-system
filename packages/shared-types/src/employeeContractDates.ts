import type { LocalDate } from "./utility.js";

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;
const DISPLAY_DATE_PATTERN = /^(\d{2})-(\d{2})-(\d{4})$/u;

const isLeapYear = (year: number): boolean =>
  year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);

const daysInMonth = (year: number, month: number): number => {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
};

const isValidDateParts = (year: number, month: number, day: number): boolean =>
  year >= 1 &&
  year <= 9999 &&
  month >= 1 &&
  month <= 12 &&
  day >= 1 &&
  day <= daysInMonth(year, month);

const pad = (value: number, length = 2): string =>
  String(value).padStart(length, "0");

export const isValidContractLocalDate = (value: string): value is LocalDate => {
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) return false;
  return isValidDateParts(Number(match[1]), Number(match[2]), Number(match[3]));
};

export const parseContractDisplayDate = (value: string): LocalDate | null => {
  const match = DISPLAY_DATE_PATTERN.exec(value);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (!isValidDateParts(year, month, day)) return null;
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
};

export const formatContractDisplayDate = (
  value: LocalDate | null | undefined,
): string => {
  if (!value || !isValidContractLocalDate(value)) return "";
  const [year, month, day] = value.split("-");
  return `${day}-${month}-${year}`;
};

export const getNextContractLocalDate = (
  value: LocalDate,
): LocalDate | null => {
  if (!isValidContractLocalDate(value)) return null;
  let [year, month, day] = value.split("-").map(Number);
  day += 1;
  if (day > daysInMonth(year, month)) {
    day = 1;
    month += 1;
  }
  if (month > 12) {
    month = 1;
    year += 1;
  }
  if (year > 9999) return null;
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
};

const localDateToUtcDay = (value: LocalDate): number | null => {
  if (!isValidContractLocalDate(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
};

export const addContractLocalDays = (
  value: LocalDate,
  days: number,
): LocalDate | null => {
  const utcDay = localDateToUtcDay(value);
  if (utcDay === null || !Number.isInteger(days)) return null;
  const result = new Date(utcDay + days * 86_400_000);
  const year = result.getUTCFullYear();
  if (year < 1 || year > 9999) return null;
  return `${pad(year, 4)}-${pad(result.getUTCMonth() + 1)}-${pad(
    result.getUTCDate(),
  )}`;
};

export const differenceInContractLocalDays = (
  later: LocalDate,
  earlier: LocalDate,
): number | null => {
  const laterUtc = localDateToUtcDay(later);
  const earlierUtc = localDateToUtcDay(earlier);
  if (laterUtc === null || earlierUtc === null) return null;
  return Math.round((laterUtc - earlierUtc) / 86_400_000);
};
