"use client";
/**
 * FEATURE: Booking sheets [RUBRIC:EXTRA]
 * DatesSheet  (day / week / month rentals): a 14-day strip, pick pickup and
 *             return days, see the cost breakdown, "Request to rent".
 * HoursSheet  (hourly preprocess outfits): 14 day tiles with a "booked share"
 *             bar, then a 24 hour timeline in Night / Morning / Afternoon /
 *             Evening rows. Booked hours are striped, past hours faded, and a
 *             range can't cross a booking.
 */
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { dayLabel, fmt, hrLabel, istDay, istHour } from "@/lib/format";
import { bookRental } from "./actions";
import { bookedHours, dayBooked, freeHours, type Period } from "./slots";
import type { ListingCard } from "@/features/listings/types";

type Props = { open: boolean; onOpenChange: (v: boolean) => void; l: ListingCard; bookings: Period[] };

const dayParts = (o: number) => {
  const d = istDay(o);
  return {
    wd: o === 0 ? "Today" : d.toLocaleDateString("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" }),
    num: Number(d.toLocaleDateString("en-IN", { day: "numeric", timeZone: "Asia/Kolkata" })),
  };
};

/** After booking: open the chat (dock on desktop, page on phones). */
function useAfterBooking() {
  const router = useRouter();
  return (conv: string | null) => {
    if (!conv) return router.push("/deals");
    if (window.innerWidth >= 1080) window.dispatchEvent(new CustomEvent("ibay:open-chat", { detail: { id: conv } }));
    else router.push(`/messages/${conv}`);
    router.refresh();
  };
}

export function DatesSheet({ open, onOpenChange, l, bookings }: Props) {
  const [range, setRange] = useState<[number?, number?]>([]);
  const [pending, start] = useTransition();
  const after = useAfterBooking();
  const [a, b] = range;
  const n = a != null ? (b != null ? b - a + 1 : 1) : 0;
  const ud = l.rentUnit === "week" ? 7 : l.rentUnit === "month" ? 30 : 1;
  const units = Math.max(1, Math.ceil(n / ud));
  const rent = units * l.price;
  const booked = useMemo(() => Array.from({ length: 14 }, (_, o) => dayBooked(bookings, o)), [bookings]);

  const pick = (o: number) => {
    if (a == null || b != null || o < a) return setRange([o]);
    if (booked.slice(a + 1, o + 1).some(Boolean)) return toast("Some days in between are booked");
    setRange([a, o]);
  };
  const submit = () =>
    start(async () => {
      const end = b ?? a!;
      const r = await bookRental({
        listingId: l.id,
        start: istDay(a!).toISOString(),
        end: istDay(end + 1).toISOString(),
        message: `Hi! I'd like to rent this from ${dayLabel(a!, true)} to ${dayLabel(end, true)}. When can I pick it up?`,
      });
      if (!r.ok) return void toast.error(r.formError);
      onOpenChange(false);
      toast(`Request sent to ${l.seller.name.split(" ")[0]}`, { action: { label: "View deal", onClick: () => (window.location.href = "/deals") } });
      after(r.data.conversationId);
    });

  return (
    <Sheet open={open} onOpenChange={onOpenChange} icon="cal" title="Choose your dates" subtitle={`${fmt(l.price)}/${l.rentUnit} · pay at pickup`}>
      <div className="stack" style={{ gap: 14 }}>
        <span className="label">{a == null ? "Tap your pickup day" : b == null ? "Now tap your return day" : "Your dates"}</span>
        <div className="days" role="group" aria-label="Days">
          {Array.from({ length: 14 }, (_, o) => {
            const { wd, num } = dayParts(o);
            const inR = a != null && b != null && o > a && o < b;
            const edge = o === a || o === b;
            const blocked = a != null && b == null && o > a && booked.slice(a + 1, o + 1).some(Boolean);
            return (
              <button key={o} type="button" className={`day ${inR ? "in" : ""} ${edge ? "edge" : ""}`} disabled={booked[o] || blocked} onClick={() => pick(o)} aria-pressed={edge || inR} aria-label={`${dayLabel(o, true)}${booked[o] ? ", booked" : ""}`}>
                <span>{wd}</span>
                <b>{num}</b>
              </button>
            );
          })}
        </div>
        {n > 0 && (
          <div className="calc">
            <div>
              <span>
                {fmt(l.price)} × {units} {l.rentUnit}
                {units > 1 ? "s" : ""}
              </span>
              <span>{fmt(rent)}</span>
            </div>
            <div className="tot">
              <span>Pay at pickup</span>
              <span>{fmt(rent)}</span>
            </div>
            <div className="faint xs" style={{ display: "block" }}>
              Pickup {dayLabel(a!, true)}, return by {dayLabel(b ?? a!, true)}.
            </div>
          </div>
        )}
        <button type="button" className="btn block" disabled={!n || pending} onClick={submit}>
          {pending ? <span className="spin" /> : null}
          {n ? "Request to rent" : "Select dates"}
        </button>
        <div className="note">
          <Icon name="shield" />
          <span>Free to cancel before pickup. Take condition photos at handover.</span>
        </div>
      </div>
    </Sheet>
  );
}

export function HoursSheet({ open, onOpenChange, l, bookings }: Props) {
  const firstFree = useMemo(() => Array.from({ length: 14 }, (_, d) => d).find((d) => freeHours(bookings, d).length) ?? 0, [bookings]);
  const [day, setDay] = useState(firstFree);
  const [hr, setHr] = useState<[number?, number?]>([]);
  const [pending, start] = useTransition();
  const after = useAfterBooking();
  const booked = bookedHours(bookings, day);
  const nowH = istHour();
  const [a, b] = hr;
  const n = a != null ? (b ?? a) - a + 1 : 0;

  const pickHour = (h: number) => {
    if (a == null || b != null || h < a) return setHr([h]);
    if (booked.some((x) => x > a && x <= h)) return toast("Some hours in between are booked");
    setHr([a, h]);
  };
  const cell = (h: number) => {
    const bk = booked.includes(h);
    const past = day === 0 && h <= nowH;
    const inR = a != null && b != null && h > a && h < b;
    const edge = h === a || h === b;
    return (
      <button key={h} type="button" className={`slot ${bk ? "bk" : ""} ${past ? "past" : ""} ${inR ? "in" : ""} ${edge ? "edge" : ""}`} disabled={bk || past} onClick={() => pickHour(h)} aria-label={`${hrLabel(h)}${bk ? ", booked" : past ? ", past" : ""}`} aria-pressed={edge || inR}>
        {h % 12 || 12}
        <small>{h < 12 ? "am" : "pm"}</small>
      </button>
    );
  };
  const submit = () =>
    start(async () => {
      const end = (b ?? a!) + 1;
      const base = istDay(day).getTime();
      const r = await bookRental({
        listingId: l.id,
        start: new Date(base + a! * 36e5).toISOString(),
        end: new Date(base + end * 36e5).toISOString(),
        message: `Hi! I've booked this for ${dayLabel(day, true)}, ${hrLabel(a!)} to ${hrLabel(end)}. Where should I pick it up?`,
      });
      if (!r.ok) return void toast.error(r.formError);
      onOpenChange(false);
      toast(`Booked ${n} hour${n > 1 ? "s" : ""}`, { action: { label: "View deal", onClick: () => (window.location.href = "/deals") } });
      after(r.data.conversationId);
    });

  return (
    <Sheet open={open} onOpenChange={onOpenChange} icon="clock" title="Book by the hour" subtitle={`${fmt(l.price)}/hr · pay at pickup`}>
      <div className="stack" style={{ gap: 12 }}>
        <span className="label">
          <Icon name="cal" />
          1. Pick a day
        </span>
        <div className="days" role="group" aria-label="Days">
          {Array.from({ length: 14 }, (_, o) => {
            const { wd, num } = dayParts(o);
            const fr = freeHours(bookings, o).length;
            const bk = bookedHours(bookings, o).length;
            return (
              <button
                key={o}
                type="button"
                className={`day ${o === day ? "edge" : ""}`}
                disabled={!fr}
                aria-pressed={o === day}
                aria-label={`${dayLabel(o, true)}, ${bk} of 24 hours booked`}
                onClick={() => {
                  setDay(o);
                  setHr([]);
                }}
              >
                <span>{wd}</span>
                <b>{num}</b>
                <i className="dbar">
                  <i style={{ width: `${Math.round((bk / 24) * 100)}%` }} />
                </i>
              </button>
            );
          })}
        </div>
        <div className="between">
          <span className="label">
            <Icon name="clock" />
            2. Pick hours · {dayLabel(day, true)}
          </span>
          {a != null && (
            <button type="button" className="btn quiet small" style={{ minHeight: 28 }} onClick={() => setHr([])}>
              Clear
            </button>
          )}
        </div>
        <div className="tl">
          {(
            [
              ["Night", "moon", 0],
              ["Morning", "sun", 6],
              ["Afternoon", "sun", 12],
              ["Evening", "sparkles", 18],
            ] as const
          ).map(([nm, i, st]) => [
            <span key={nm} className="tlr">
              <Icon name={i} />
              {nm}
            </span>,
            ...[0, 1, 2, 3, 4, 5].map((k) => cell(st + k)),
          ])}
        </div>
        <div className="tleg">
          <span>
            <i className="lg-f" />
            Free
          </span>
          <span>
            <i className="lg-b" />
            Booked
          </span>
          <span>
            <i className="lg-s" />
            Yours
          </span>
        </div>
        <span className="faint xs">{a == null ? "Tap your pickup hour, then the last hour you need it." : b == null ? "Tap the last hour you need it, or book just this one." : ""}</span>
        {n > 0 && (
          <div className="calc">
            <div>
              <span>
                {fmt(l.price)} × {n} hr{n > 1 ? "s" : ""}
              </span>
              <span>{fmt(n * l.price)}</span>
            </div>
            <div className="tot">
              <span>Pay at pickup</span>
              <span>{fmt(n * l.price)}</span>
            </div>
            <div className="faint xs" style={{ display: "block" }}>
              {dayLabel(day, true)}: pick up {hrLabel(a!)}, return by {hrLabel((b ?? a!) + 1)}.
            </div>
          </div>
        )}
        <button type="button" className="btn block" disabled={!n || pending} onClick={submit}>
          {pending ? <span className="spin" /> : null}
          {n ? `Book ${n} hour${n > 1 ? "s" : ""}` : "Select hours"}
        </button>
        <div className="note">
          <Icon name="info" />
          <span>Sessions run late. Book a buffer hour; late returns are charged per hour.</span>
        </div>
      </div>
    </Sheet>
  );
}
