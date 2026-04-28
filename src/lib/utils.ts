import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely parse a date string. Handles ISO dates, date+time combos,
 * bare TIME strings, and returns fallback date if parsing fails.
 */
export function safeParse(value: string | null | undefined): Date {
  if (!value) return new Date(0);
  try {
    // Already a full ISO datetime
    if (value.includes("T") || value.includes("-")) return parseISO(value);
    // Bare time like "09:00:00" — combine with today
    if (/^\d{2}:\d{2}/.test(value)) {
      const today = new Date().toISOString().split("T")[0];
      return parseISO(`${today}T${value}`);
    }
    return new Date(value);
  } catch {
    return new Date(0);
  }
}

/**
 * Format a "calendar date" (YYYY-MM-DD with no time) for display in es-MX.
 * `new Date("2026-04-27")` parses as UTC midnight, which renders as the
 * previous day in any UTC-negative timezone (Mexico is UTC-6). This helper
 * builds a Date from the local-time components so the displayed day matches
 * what was stored.
 */
export function formatCalendarDate(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {}
): string {
  if (!value) return "—";
  let y: number, m: number, d: number;
  if (value instanceof Date) {
    y = value.getUTCFullYear();
    m = value.getUTCMonth();
    d = value.getUTCDate();
  } else {
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return "—";
    y = Number(match[1]);
    m = Number(match[2]) - 1;
    d = Number(match[3]);
  }
  return new Date(y, m, d).toLocaleDateString("es-MX", options);
}
