/**
 * FEATURE: Handover scheduling formatting and calendar helpers
 * Zero emojis, clean typography, IST timezone aware.
 */
import { dayLabel, dayOffsetOf, istDay } from "@/lib/format";

const TZ = "Asia/Kolkata";

/** Formats an ISO string (e.g. "2026-11-20T12:30:00.000Z") to "Tomorrow, 6:00 PM" or "Fri, 20 Nov, 6:00 PM". */
export function formatHandoverSchedule(isoString: string | null | undefined): string {
  if (!isoString) return "Unscheduled";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "Invalid date";

  // Compute offset in IST
  const isoDateStr = date.toLocaleDateString("en-CA", { timeZone: TZ }); // yyyy-mm-dd
  const offset = dayOffsetOf(isoDateStr);

  const dayStr = dayLabel(offset, true);
  const timeStr = date
    .toLocaleTimeString("en-IN", {
      timeZone: TZ,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toUpperCase();

  return `${dayStr}, ${timeStr}`;
}

/** Formats a Date object to YYYYMMDDTHHmmssZ for calendar templates. */
function toUtcCompact(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    "Z"
  );
}

export type GoogleCalendarParams = {
  title: string;
  location?: string;
  details?: string;
  startIso: string;
  durationMinutes?: number;
};

/** Builds a 1-click Google Calendar add-event link. */
export function createGoogleCalendarUrl({
  title,
  location = "",
  details = "i-bay campus handover meeting",
  startIso,
  durationMinutes = 30,
}: GoogleCalendarParams): string {
  const startDate = new Date(startIso);
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

  const startUtc = toUtcCompact(startDate);
  const endUtc = toUtcCompact(endDate);
  const dates = `${startUtc}%2F${endUtc}`;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${startUtc}/${endUtc}`,
    details,
    location,
  });

  // Re-encode dates explicitly to match URL standard %2F
  const base = "https://calendar.google.com/calendar/render?action=TEMPLATE";
  return `${base}&text=${encodeURIComponent(title)}&dates=${dates}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}`;
}
