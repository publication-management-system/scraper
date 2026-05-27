export function normalizeDate(value: unknown): string | null {
    if (typeof value !== "string") return null;

    const parts = value.trim().split("/");

    if (parts.length < 1 || parts.length > 3) return null;

    const [year, month = "01", day = "01"] = parts;

    if (!isDigits(year) || year.length !== 4) return null;
    if (!isDigits(month) || month.length > 2) return null;
    if (!isDigits(day) || day.length > 2) return null;

    const mm = month.padStart(2, "0");
    const dd = day.padStart(2, "0");

    const monthNum = Number(mm);
    const dayNum = Number(dd);

    if (monthNum < 1 || monthNum > 12) return null;
    if (dayNum < 1 || dayNum > 31) return null;

    return `${year}-${mm}-${dd}`;
}

function isDigits(value: string): boolean {
    return value.length > 0 && [...value].every((char) => char >= "0" && char <= "9");
}