export const toFirestoreDate = (value: unknown): Date => {
  if (value instanceof Date) return value;
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date(value as string | number);
};

export const mapFirestoreDocument = <T>(
  snapshot: FirebaseFirestore.DocumentSnapshot,
  dateFields: string[],
  nullableDateFields: string[] = [],
): T => {
  const data = { ...snapshot.data(), id: snapshot.id } as Record<
    string,
    unknown
  >;
  dateFields.forEach((field) => {
    data[field] = toFirestoreDate(data[field]);
  });
  nullableDateFields.forEach((field) => {
    data[field] = data[field] == null ? null : toFirestoreDate(data[field]);
  });
  return data as T;
};
