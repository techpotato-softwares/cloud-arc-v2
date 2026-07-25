/**
 * Indian financial year (April–March) helper.
 * FY string format: "YYYY-YY" (e.g. "2025-26" for April 2025 – March 2026).
 */

/**
 * Returns the fiscal year string for a given date using Indian FY (April–March).
 * - If month >= 4: FY is current year to next year (e.g. May 2025 → "2025-26").
 * - If month < 4: FY is previous year to current year (e.g. Jan 2025 → "2024-25").
 */
export function getFiscalYearString(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1–12
  if (month >= 4) {
    const nextYearShort = (year + 1) % 100;
    return `${year}-${nextYearShort.toString().padStart(2, '0')}`;
  }
  const prevYear = year - 1;
  const currentYearShort = year % 100;
  return `${prevYear}-${currentYearShort.toString().padStart(2, '0')}`;
}

/** Matches PO / CSV fiscal year segment: `2025-26`. */
export const FISCAL_YEAR_PATTERN = /^\d{4}-\d{2}$/;

/**
 * One Indian FY earlier than `fy` (April–March). `fy` must be `YYYY-YY`.
 */
export function previousFiscalYear(fy: string): string {
  const trimmed = fy.trim();
  if (!FISCAL_YEAR_PATTERN.test(trimmed)) {
    throw new Error(`Invalid fiscal year format: ${fy}`);
  }
  const startYear = parseInt(trimmed.slice(0, 4), 10);
  const newStart = startYear - 1;
  const secondPart = (newStart + 1) % 100;
  return `${newStart}-${secondPart.toString().padStart(2, '0')}`;
}

/**
 * Current FY plus the four fiscal years immediately before it (for Create PO dropdown).
 */
export function getFiscalYearOptionsForCreatePo(referenceDate: Date = new Date()): string[] {
  const current = getFiscalYearString(referenceDate);
  const out: string[] = [current];
  let fy = current;
  for (let i = 0; i < 4; i++) {
    fy = previousFiscalYear(fy);
    out.push(fy);
  }
  return out;
}

/**
 * True if `value` is current FY or one of the four prior FYs (same window as Create PO options).
 */
export function isAllowedCreatePoFiscalYear(
  value: string,
  referenceDate: Date = new Date()
): boolean {
  const trimmed = value.trim();
  if (!FISCAL_YEAR_PATTERN.test(trimmed)) {
    return false;
  }
  const allowed = new Set(getFiscalYearOptionsForCreatePo(referenceDate));
  return allowed.has(trimmed);
}
