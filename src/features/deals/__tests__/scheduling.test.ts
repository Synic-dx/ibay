import { describe, it, expect } from "vitest";
import { formatHandoverSchedule, createGoogleCalendarUrl } from "../scheduling";

describe("Handover Scheduling Helpers", () => {
  it("formats ISO schedule time into human readable string", () => {
    // 2026-11-20T12:30:00.000Z in IST (UTC+5:30) is 18:00 (6:00 PM) on Nov 20
    const iso = "2026-11-20T12:30:00.000Z";
    const formatted = formatHandoverSchedule(iso);
    expect(formatted).toContain("6:00 PM");
  });

  it("formats dates beyond tomorrow with day and month", () => {
    const futureDate = new Date(Date.now() + 4 * 24 * 3600 * 1000).toISOString();
    const formatted = formatHandoverSchedule(futureDate);
    expect(formatted).toMatch(/[A-Za-z]+, \d+ [A-Za-z]+, \d+:\d+ (AM|PM)/);
  });

  it("generates correct Google Calendar URL", () => {
    const title = "Handover: Casio fx-991EX";
    const location = "SR 18, Room 204";
    const startIso = "2026-11-20T12:30:00.000Z";
    const url = createGoogleCalendarUrl({
      title,
      location,
      startIso,
      durationMinutes: 30,
    });

    expect(url).toContain("https://calendar.google.com/calendar/render?action=TEMPLATE");
    expect(url).toContain("text=" + encodeURIComponent(title));
    expect(url).toContain("location=" + encodeURIComponent(location));
    expect(url).toContain("dates=20261120T123000Z%2F20261120T130000Z");
  });
});
