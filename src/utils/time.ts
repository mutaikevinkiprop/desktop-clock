/**
 * Time derivation and formatting helpers.
 *
 * Design rule: the displayed time is ALWAYS derived from `Date.now()` at render
 * time. We never increment a counter. This keeps the clock correct across
 * sleep/wake, NTP corrections, manual clock changes and long uptimes.
 */

import type { Settings, TimeFormat } from "../types";

export interface TimeParts {
  hours: string;
  minutes: string;
  seconds: string;
  /** "AM" | "PM" | "" (empty in 24-hour mode or when hidden). */
  meridiem: string;
  /** e.g. "THURSDAY" */
  weekday: string;
  /** e.g. "10 SEPTEMBER 2026" */
  dateLong: string;
  /** e.g. "10 SEP 2026" */
  dateShort: string;
  /** e.g. "10 SEP" */
  dateCompact: string;
}

const LONG_DATE: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "long",
  year: "numeric",
};

const SHORT_DATE: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short",
  year: "numeric",
};

const COMPACT_DATE: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short",
};

/**
 * Cache of `Intl.DateTimeFormat` instances. Constructing these is relatively
 * expensive; reusing them keeps the per-frame cost negligible.
 */
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(locale: string | undefined, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale ?? ""}|${JSON.stringify(opts)}`;
  let fmt = formatterCache.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, opts);
    formatterCache.set(key, fmt);
  }
  return fmt;
}

export function locale(): string {
  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language;
  }
  return "en-GB";
}

/** Accurately derive all displayable parts of the current wall-clock time. */
export function getTimeParts(
  date: Date,
  format: TimeFormat,
  showSeconds: boolean,
  showAmPm: boolean,
  timeZone?: string,
): TimeParts {
  const loc = locale();
  const tz = timeZone ? { timeZone } : {};

  const hourFmt = getFormatter(loc, { ...tz, hour: "2-digit", hour12: format === "12" });
  const minuteFmt = getFormatter(loc, { ...tz, minute: "2-digit" });
  const secondFmt = getFormatter(loc, { ...tz, second: "2-digit" });
  const hour12Fmt = getFormatter(loc, { ...tz, hour: "numeric", hour12: true });

  let hours = safePart(hourFmt, date);
  const minutes = safePart(minuteFmt, date);

  let meridiem = "";
  if (format === "12") {
    // Derive the 12-hour number and meridiem from a numeric hour format.
    const h = Number(safePart(hour12Fmt, date));
    hours = pad(h);
    if (showAmPm) {
      const h23 = dateToZonedHour(date, timeZone);
      meridiem = h23 >= 12 ? "PM" : "AM";
    }
  } else {
    // Ensure 24-hour output regardless of the user's locale (e.g. some
    // locales default to a non-padded or differently delivered hour).
    hours = pad(dateToZonedHour(date, timeZone));
  }

  const seconds = showSeconds ? safePart(secondFmt, date) : "";

  return {
    hours,
    minutes,
    seconds,
    meridiem,
    weekday: getFormatter(loc, { ...tz, weekday: "long" }).format(date).toUpperCase(),
    dateLong: getFormatter(loc, { ...tz, ...LONG_DATE }).format(date).toUpperCase(),
    dateShort: getFormatter(loc, { ...tz, ...SHORT_DATE }).format(date).toUpperCase(),
    dateCompact: getFormatter(loc, { ...tz, ...COMPACT_DATE }).format(date).toUpperCase(),
  };
}

/**
 * Extract the hour-of-day (0..23) in a given IANA zone using Intl, without
 * depending on the browser's own local zone.
 */
export function dateToZonedHour(date: Date, timeZone?: string): number {
  if (!timeZone) return date.getHours();
  const fmt = getFormatter("en-US", {
    timeZone,
    hour: "2-digit",
    hour12: false,
  });
  const h = Number(safePart(fmt, date));
  // Intl can report 24 for midnight in some engines; normalise to 0.
  return Number.isFinite(h) ? h % 24 : 0;
}

/**
 * Build a formatter that renders the current time for an arbitrary zone.
 * Cached, so repeated calls during rendering are cheap.
 */
const zoneTimeCache = new Map<string, Intl.DateTimeFormat>();

export function formatZoneTime(
  date: Date,
  timeZone: string,
  format: TimeFormat,
  showSeconds: boolean,
): { time: string; meridiem: string } {
  const key = `${timeZone}|${format}|${showSeconds}`;
  let fmt = zoneTimeCache.get(key);
  if (!fmt) {
    const opts: Intl.DateTimeFormatOptions = {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: format === "12",
    };
    if (showSeconds) opts.second = "2-digit";
    fmt = new Intl.DateTimeFormat("en-GB", opts);
    zoneTimeCache.set(key, fmt);
  }

  const parts = fmt.formatToParts(date);
  let hour = "";
  let minute = "";
  let second = "";
  let dayPeriod = "";
  for (const p of parts) {
    switch (p.type) {
      case "hour":
        hour = p.value;
        break;
      case "minute":
        minute = p.value;
        break;
      case "second":
        second = p.value;
        break;
      case "dayPeriod":
        dayPeriod = p.value.toUpperCase();
        break;
      default:
        break;
    }
  }

  // For 24-hour output, force zero-padding (some zones/locales omit it).
  if (format === "24") {
    hour = pad(dateToZonedHour(date, timeZone));
  }

  const time = showSeconds ? `${hour}:${minute}:${second}` : `${hour}:${minute}`;
  return { time, meridiem: format === "12" ? dayPeriod : "" };
}

/** Stable per-minute change key, used to avoid redundant DOM updates. */
export function minuteKey(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function safePart(fmt: Intl.DateTimeFormat, date: Date): string {
  try {
    const parts = fmt.formatToParts(date);
    for (const p of parts) {
      if (
        p.type === "hour" ||
        p.type === "minute" ||
        p.type === "second" ||
        p.type === "day"
      ) {
        return p.value;
      }
    }
    return fmt.format(date);
  } catch {
    return "";
  }
}

/** Determine whether the OS prefers a 12-hour clock, best-effort. */
export function detectSystemTimeFormat(): TimeFormat {
  try {
    const resolved = new Intl.DateTimeFormat(locale(), {
      hour: "numeric",
    }).resolvedOptions();
    // `hour12` is the most reliable signal available to web content.
    if (typeof resolved.hour12 === "boolean") {
      return resolved.hour12 ? "12" : "24";
    }
    // Fallback: inspect a formatted sample for an AM/PM marker.
    const sample = new Intl.DateTimeFormat(locale(), { hour: "numeric" }).format(
      new Date(2020, 0, 1, 13, 0, 0),
    );
    return /[ap]\.?m/i.test(sample) ? "12" : "24";
  } catch {
    return "24";
  }
}

/** Best-effort detection of the user's IANA time zone. */
export function detectLocalZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Validate an IANA time-zone identifier. */
export function isValidTimeZone(zone: string): boolean {
  if (!zone || typeof zone !== "string") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** A curated list of common IANA zones for the picker. */
export const COMMON_ZONES: string[] = [
  "Africa/Nairobi",
  "Africa/Cairo",
  "Africa/Lagos",
  "Africa/Johannesburg",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "America/Mexico_City",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Pacific/Auckland",
  "UTC",
];

/** Turn "Africa/Nairobi" into "Nairobi". */
export function zoneToLabel(zone: string): string {
  const parts = zone.split("/");
  return (parts[parts.length - 1] ?? zone).replace(/_/g, " ");
}

/** Human-readable difference from local time, e.g. "+3H" or "-5:30H". */
export function zoneOffsetLabel(date: Date, zone: string): string {
  try {
    const localOffset = -date.getTimezoneOffset();
    const targetOffset = getZoneOffsetMinutes(date, zone);
    const diff = targetOffset - localOffset;
    if (diff === 0) return "SAME";
    const sign = diff > 0 ? "+" : "-";
    const abs = Math.abs(diff);
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return m === 0 ? `${sign}${h}H` : `${sign}${h}:${String(m).padStart(2, "0")}H`;
  } catch {
    return "";
  }
}

function getZoneOffsetMinutes(date: Date, zone: string): number {
  // Format the same instant in the target zone and in UTC, then diff them.
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = Number(p.value);
  }
  const asUTC = Date.UTC(
    map.year ?? 1970,
    (map.month ?? 1) - 1,
    map.day ?? 1,
    (map.hour ?? 0) % 24,
    map.minute ?? 0,
    map.second ?? 0,
  );
  return Math.round((asUTC - date.getTime()) / 60000);
}

/** The formatted main clock time string, derived freshly each call. */
export function formatClock(parts: TimeParts, showSeconds: boolean): string {
  const base = `${parts.hours}:${parts.minutes}`;
  const withSeconds = showSeconds && parts.seconds ? `${base}:${parts.seconds}` : base;
  return parts.meridiem ? `${withSeconds} ${parts.meridiem}` : withSeconds;
}

/** Compute the date line according to the current settings. */
export function formatDateLine(parts: TimeParts, settings: Settings, narrow: boolean): string {
  const segments: string[] = [];
  if (settings.showDay) segments.push(parts.weekday);
  if (settings.showDate) {
    segments.push(narrow || settings.compactDate ? parts.dateCompact : parts.dateLong);
  }
  return segments.join("  ");
}