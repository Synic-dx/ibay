/**
 * FEATURE: Rental time slots (shared by the server and the booking sheets)
 * WHAT: Which hours of a day are booked or free, and the "Free Today 9 PM" label.
 * All days and hours are in India time.
 */
import { dayLabel, hrLabel, istDay, istHour } from "@/lib/format";

export type Period = { start: string; end: string };

/** Booked hours (0 to 23) on a given day offset, from a list of booked periods. */
export function bookedHours(bookings: Period[], dayOffset: number): number[] {
  const dayStart = istDay(dayOffset).getTime();
  const hours: number[] = [];
  for (let h = 0; h < 24; h++) {
    const s = dayStart + h * 36e5;
    if (bookings.some((b) => new Date(b.start).getTime() < s + 36e5 && new Date(b.end).getTime() > s)) hours.push(h);
  }
  return hours;
}

/** Free hours on a day (past hours of today are not free). */
export function freeHours(bookings: Period[], dayOffset: number): number[] {
  const booked = bookedHours(bookings, dayOffset);
  const now = istHour();
  return Array.from({ length: 24 }, (_, h) => h).filter((h) => !booked.includes(h) && !(dayOffset === 0 && h <= now));
}

/** "Today 9 PM" style label for the next free evening hour (or any free hour). */
export function nextFreeLabel(bookings: Period[]): string {
  for (let d = 0; d < 14; d++) {
    const f = freeHours(bookings, d);
    const h = f.find((x) => x >= 17) ?? f[0];
    if (h != null) return `${dayLabel(d)} ${hrLabel(h)}`;
  }
  return "Fully booked";
}


/** True if any booking overlaps the given day (used by day / week / month rentals). */
export function dayBooked(bookings: Period[], dayOffset: number): boolean {
  const s = istDay(dayOffset).getTime();
  const e = s + 864e5;
  return bookings.some((b) => new Date(b.start).getTime() < e && new Date(b.end).getTime() > s);
}
