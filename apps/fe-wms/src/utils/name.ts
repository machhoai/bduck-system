/**
 * Keep only the last 2 words of a Vietnamese full name (1 middle name + first name).
 * Names with <= 2 words are kept as-is.
 * E.g. "Mạch Lâm Quốc Hoài" → "Quốc Hoài"
 * E.g. "Nguyễn Văn An" → "Văn An"
 * E.g. "Trương Linh" → "Trương Linh"
 */
export function shortName(fullName: string | null | undefined): string {
    if (!fullName) return "";
    const trimmed = fullName.trim();
    if (!trimmed) return "";
    const parts = trimmed.split(/\s+/);
    return parts.length > 2 ? parts.slice(-2).join(" ") : trimmed;
}
