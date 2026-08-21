/**
 * Parse a free-text booking price string to integer cents.
 *
 * Handles: "1000", "1000.50", "1000,50", "1.000,50", "1,000.50",
 * "kr 1000", "1 000 DKK", etc.
 *
 * Disambiguation rules (applied after stripping non-digit/comma/period chars):
 *  - Both separators present: the LAST one is the decimal.
 *    "1.000,50" (Danish)  → 100050 ¢
 *    "1,000.50" (English) → 100050 ¢
 *  - Only one separator, 3 trailing digits: treat as thousands separator.
 *    "1.000" → 100000 ¢   "1,000" → 100000 ¢
 *  - Only one separator, other trailing digit count: treat as decimal.
 *    "1000.50" → 100050 ¢   "1000,50" → 100050 ¢
 *  - Multiple of the same separator: always thousands.
 *    "1.000.000" → 100000000 ¢   "1,000,000" → 100000000 ¢
 */
export function parseBookingPriceCents(price: string | null | undefined): number {
  if (!price) return 0;
  const numStr = price.replace(/[^\d.,]/g, "");
  if (!numStr || !/\d/.test(numStr)) return 0;

  const lastComma = numStr.lastIndexOf(",");
  const lastDot   = numStr.lastIndexOf(".");
  let normalized: string;

  if (lastComma === -1 && lastDot === -1) {
    // Pure integer: "1000"
    normalized = numStr;
  } else if (lastComma === -1) {
    // Only periods
    const dotCount = (numStr.match(/\./g) || []).length;
    const afterDot = numStr.slice(lastDot + 1);
    normalized = (dotCount > 1 || afterDot.length === 3)
      ? numStr.replace(/\./g, "")   // "1.000" or "1.000.000" → remove thousands dots
      : numStr;                       // "1000.50" → standard decimal
  } else if (lastDot === -1) {
    // Only commas
    const commaCount = (numStr.match(/,/g) || []).length;
    const afterComma = numStr.slice(lastComma + 1);
    normalized = (commaCount > 1 || afterComma.length === 3)
      ? numStr.replace(/,/g, "")         // "1,000" or "1,000,000" → integer
      : numStr.replace(",", ".");         // "1000,50" → "1000.50"
  } else if (lastDot > lastComma) {
    // Both present, period is last → comma=thousands, period=decimal: "1,000.50"
    normalized = numStr.replace(/,/g, "");
  } else {
    // Both present, comma is last → period=thousands, comma=decimal: "1.000,50"
    normalized = numStr.replace(/\./g, "").replace(",", ".");
  }

  const num = parseFloat(normalized);
  if (!isFinite(num) || num <= 0) return 0;
  return Math.round(num * 100);
}
