/**
 * Timezone and Date Range Utilities for ROLLZ Restaurant POS
 * Configured Timezone: Asia/Kolkata (IST = UTC + 05:30)
 */

export interface DateRangeResult {
  startDate: Date;
  endDate: Date;
  preset: string;
  startDateStr: string; // YYYY-MM-DD
  endDateStr: string;   // YYYY-MM-DD
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // +05:30 in milliseconds

/**
 * Get current date-time parts in Asia/Kolkata
 */
export function getNowInIST(): { year: number; month: number; day: number; fullDate: Date } {
  const now = new Date();
  const istTime = new Date(now.getTime() + IST_OFFSET_MS);
  return {
    year: istTime.getUTCFullYear(),
    month: istTime.getUTCMonth(), // 0-indexed
    day: istTime.getUTCDate(),
    fullDate: istTime,
  };
}

/**
 * Format a Date into YYYY-MM-DD string in Asia/Kolkata
 */
export function formatISTDate(date: Date): string {
  const istTime = new Date(date.getTime() + IST_OFFSET_MS);
  const year = istTime.getUTCFullYear();
  const month = String(istTime.getUTCMonth() + 1).padStart(2, "0");
  const day = String(istTime.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Convert a YYYY-MM-DD date string at 00:00:00 or 23:59:59.999 IST to UTC Date
 */
export function createISTDateBoundary(year: number, month: number, day: number, isEnd = false): Date {
  if (isEnd) {
    // 23:59:59.999 in IST = (23 - 5.5) = 18:29:59.999 UTC
    return new Date(Date.UTC(year, month, day, 23, 59, 59, 999) - IST_OFFSET_MS);
  }
  // 00:00:00.000 in IST = (0 - 5.5) = 18:30:00.000 UTC of previous day
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0) - IST_OFFSET_MS);
}

/**
 * Parse a date range preset or explicit custom date strings into UTC boundary dates
 */
export function parseDateRangeIST(params: {
  preset?: string;
  startDate?: string;
  endDate?: string;
}): DateRangeResult {
  const { preset, startDate, endDate } = params;
  const now = getNowInIST();

  if (startDate && endDate) {
    const [sY, sM, sD] = startDate.split("-").map(Number);
    const [eY, eM, eD] = endDate.split("-").map(Number);

    if (!isNaN(sY) && !isNaN(sM) && !isNaN(sD) && !isNaN(eY) && !isNaN(eM) && !isNaN(eD)) {
      const start = createISTDateBoundary(sY, sM - 1, sD, false);
      const end = createISTDateBoundary(eY, eM - 1, eD, true);

      return {
        startDate: start,
        endDate: end,
        preset: preset || "custom",
        startDateStr: startDate,
        endDateStr: endDate,
      };
    }
  }

  // Handle Preset
  const activePreset = preset?.toLowerCase() || "today";

  switch (activePreset) {
    case "yesterday": {
      const yDate = new Date(Date.UTC(now.year, now.month, now.day - 1));
      const yY = yDate.getUTCFullYear();
      const yM = yDate.getUTCMonth();
      const yD = yDate.getUTCDate();
      const start = createISTDateBoundary(yY, yM, yD, false);
      const end = createISTDateBoundary(yY, yM, yD, true);
      const str = `${yY}-${String(yM + 1).padStart(2, "0")}-${String(yD).padStart(2, "0")}`;
      return {
        startDate: start,
        endDate: end,
        preset: "yesterday",
        startDateStr: str,
        endDateStr: str,
      };
    }

    case "last7days": {
      const startD = new Date(Date.UTC(now.year, now.month, now.day - 6));
      const sY = startD.getUTCFullYear();
      const sM = startD.getUTCMonth();
      const sD = startD.getUTCDate();
      const start = createISTDateBoundary(sY, sM, sD, false);
      const end = createISTDateBoundary(now.year, now.month, now.day, true);
      return {
        startDate: start,
        endDate: end,
        preset: "last7days",
        startDateStr: `${sY}-${String(sM + 1).padStart(2, "0")}-${String(sD).padStart(2, "0")}`,
        endDateStr: `${now.year}-${String(now.month + 1).padStart(2, "0")}-${String(now.day).padStart(2, "0")}`,
      };
    }

    case "last30days": {
      const startD = new Date(Date.UTC(now.year, now.month, now.day - 29));
      const sY = startD.getUTCFullYear();
      const sM = startD.getUTCMonth();
      const sD = startD.getUTCDate();
      const start = createISTDateBoundary(sY, sM, sD, false);
      const end = createISTDateBoundary(now.year, now.month, now.day, true);
      return {
        startDate: start,
        endDate: end,
        preset: "last30days",
        startDateStr: `${sY}-${String(sM + 1).padStart(2, "0")}-${String(sD).padStart(2, "0")}`,
        endDateStr: `${now.year}-${String(now.month + 1).padStart(2, "0")}-${String(now.day).padStart(2, "0")}`,
      };
    }

    case "thismonth": {
      const start = createISTDateBoundary(now.year, now.month, 1, false);
      const end = createISTDateBoundary(now.year, now.month, now.day, true);
      return {
        startDate: start,
        endDate: end,
        preset: "thismonth",
        startDateStr: `${now.year}-${String(now.month + 1).padStart(2, "0")}-01`,
        endDateStr: `${now.year}-${String(now.month + 1).padStart(2, "0")}-${String(now.day).padStart(2, "0")}`,
      };
    }

    case "prevmonth": {
      const prevMonthLastDate = new Date(Date.UTC(now.year, now.month, 0));
      const pY = prevMonthLastDate.getUTCFullYear();
      const pM = prevMonthLastDate.getUTCMonth();
      const pLastDay = prevMonthLastDate.getUTCDate();
      const start = createISTDateBoundary(pY, pM, 1, false);
      const end = createISTDateBoundary(pY, pM, pLastDay, true);
      return {
        startDate: start,
        endDate: end,
        preset: "prevmonth",
        startDateStr: `${pY}-${String(pM + 1).padStart(2, "0")}-01`,
        endDateStr: `${pY}-${String(pM + 1).padStart(2, "0")}-${String(pLastDay).padStart(2, "0")}`,
      };
    }

    case "today":
    default: {
      const start = createISTDateBoundary(now.year, now.month, now.day, false);
      const end = createISTDateBoundary(now.year, now.month, now.day, true);
      const str = `${now.year}-${String(now.month + 1).padStart(2, "0")}-${String(now.day).padStart(2, "0")}`;
      return {
        startDate: start,
        endDate: end,
        preset: "today",
        startDateStr: str,
        endDateStr: str,
      };
    }
  }
}
