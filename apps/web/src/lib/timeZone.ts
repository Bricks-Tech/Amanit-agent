export const TIME_ZONE_KEY = "amanit.timeZone";

export const TIME_ZONES = [
  { id: "Asia/Dubai", label: "Dubai" },
  { id: "Europe/Madrid", label: "Spain" },
  { id: "Asia/Karachi", label: "Karachi" },
  { id: "America/New_York", label: "New York" },
  { id: "UTC", label: "UTC" },
] as const;

export function browserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function readTimeZoneChoice() {
  try {
    const saved = localStorage.getItem(TIME_ZONE_KEY);
    if (!saved || saved === "browser") return "browser";
    if (TIME_ZONES.some((zone) => zone.id === saved)) return saved;
  } catch {
    // Private browsing can block localStorage.
  }
  return "browser";
}

export function resolveTimeZone(choice: string) {
  return choice === "browser" ? browserTimeZone() : choice;
}

let activeTimeZone = browserTimeZone();

export function getActiveTimeZone() {
  return activeTimeZone;
}

export function setActiveTimeZone(timeZone: string) {
  activeTimeZone = timeZone;
}

type CalendarDay = { year: number; month: number; day: number; weekday: number };

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function zonedCalendar(date: Date, timeZone: string): CalendarDay {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: Number(value("year")),
    month: Number(value("month")),
    day: Number(value("day")),
    weekday: WEEKDAYS[value("weekday")] ?? 0,
  };
}

function zoneOffsetMs(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  let hour = value("hour");
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(value("year"), value("month") - 1, value("day"), hour, value("minute"), value("second"));
  return asUtc - instant.getTime();
}

function shiftCalendar(year: number, month: number, day: number, delta: number) {
  const shifted = new Date(Date.UTC(year, month - 1, day + delta));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/** Midnight at the start of that calendar day in the zone, as a UTC instant. */
export function startOfZonedDay(year: number, month: number, day: number, timeZone: string) {
  const utcGuess = Date.UTC(year, month - 1, day);
  let instant = new Date(utcGuess - zoneOffsetMs(new Date(utcGuess), timeZone));
  instant = new Date(utcGuess - zoneOffsetMs(instant, timeZone));
  return instant;
}

export function startOfZonedPeriod(period: "today" | "week" | "month", timeZone: string, now = new Date()) {
  const today = zonedCalendar(now, timeZone);
  if (period === "today") return startOfZonedDay(today.year, today.month, today.day, timeZone);
  if (period === "week") {
    const offset = today.weekday === 0 ? 6 : today.weekday - 1;
    const monday = shiftCalendar(today.year, today.month, today.day, -offset);
    return startOfZonedDay(monday.year, monday.month, monday.day, timeZone);
  }
  return startOfZonedDay(today.year, today.month, 1, timeZone);
}

export function isSameZonedDay(value: string | Date, timeZone = getActiveTimeZone(), now = new Date()) {
  const left = zonedCalendar(value instanceof Date ? value : new Date(value), timeZone);
  const right = zonedCalendar(now, timeZone);
  return left.year === right.year && left.month === right.month && left.day === right.day;
}

export function zonedDayIndex(value: string | Date, start: Date, timeZone: string) {
  const left = zonedCalendar(value instanceof Date ? value : new Date(value), timeZone);
  const right = zonedCalendar(start, timeZone);
  const from = Date.UTC(right.year, right.month - 1, right.day);
  const to = Date.UTC(left.year, left.month - 1, left.day);
  return Math.floor((to - from) / 86400000);
}
