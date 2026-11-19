"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Icon } from "@/components/ui/icon";
import { istDay, dayLabel } from "@/lib/format";
import { formatHandoverSchedule } from "../scheduling";

const TZ = "Asia/Kolkata";

interface HandoverTimePickerProps {
  sellerSlots?: string[];
  initialIso?: string | null;
  onChange: (isoString: string) => void;
}

const PRESET_TIMES: Record<string, { label: string; time: string; hour: number; minute: number }> = {
  morning: { label: "Morning", time: "10:00 AM", hour: 10, minute: 0 },
  afternoon: { label: "Afternoon", time: "02:00 PM", hour: 14, minute: 0 },
  evening: { label: "Evening", time: "06:00 PM", hour: 18, minute: 0 },
  latenight: { label: "Late Night", time: "10:00 PM", hour: 22, minute: 0 },
};

const DEFAULT_TIMES = [
  { label: "11:00 AM", hour: 11, minute: 0 },
  { label: "03:00 PM", hour: 15, minute: 0 },
  { label: "06:30 PM", hour: 18, minute: 30 },
  { label: "09:30 PM", hour: 21, minute: 30 },
];

export default function HandoverTimePicker({
  sellerSlots = [],
  initialIso,
  onChange,
}: HandoverTimePickerProps) {
  // Day offsets: 0 (Today) through 4 (+4 days)
  const [dayOffset, setDayOffset] = useState<number>(0);
  const [selectedHour, setSelectedHour] = useState<number>(18);
  const [selectedMinute, setSelectedMinute] = useState<number>(0);
  const [isCustomTime, setIsCustomTime] = useState<boolean>(false);
  const [customTimeVal, setCustomTimeVal] = useState<string>("18:00");

  // Determine relevant presets based on seller's preference
  const activePresets = useMemo(() => {
    const valid = sellerSlots.filter((s) => s in PRESET_TIMES);
    if (valid.length > 0) {
      return valid.map((s) => PRESET_TIMES[s]);
    }
    return DEFAULT_TIMES;
  }, [sellerSlots]);

  // Compute and notify parent when day or time changes
  useEffect(() => {
    // Construct local IST date
    const now = Date.now();
    const d = istDay(dayOffset, now);
    // Adjust IST timestamp to targeted hour and minute
    // istDay returns midnight in UTC corresponding to local IST midnight
    // Since IST is UTC+5.5, adding (hour * 3600 + minute * 60) * 1000 gives exact UTC instant
    const scheduledUtc = new Date(d.getTime() + (selectedHour * 3600 + selectedMinute * 60) * 1000);
    onChange(scheduledUtc.toISOString());
  }, [dayOffset, selectedHour, selectedMinute, onChange]);

  const days = useMemo(() => {
    return [0, 1, 2, 3, 4].map((offset) => {
      const d = istDay(offset);
      const isToday = offset === 0;
      const isTomorrow = offset === 1;
      const dayName = isToday ? "Today" : isTomorrow ? "Tom" : d.toLocaleDateString("en-IN", { timeZone: TZ, weekday: "short" });
      const dateNum = d.toLocaleDateString("en-IN", { timeZone: TZ, day: "numeric", month: "short" });
      return { offset, dayName, dateNum };
    });
  }, []);

  const handlePresetClick = (hour: number, minute: number) => {
    setSelectedHour(hour);
    setSelectedMinute(minute);
    setIsCustomTime(false);
    const hh = String(hour).padStart(2, "0");
    const mm = String(minute).padStart(2, "0");
    setCustomTimeVal(`${hh}:${mm}`);
  };

  const handleCustomTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomTimeVal(val);
    const [hh, mm] = val.split(":").map(Number);
    if (!Number.isNaN(hh) && !Number.isNaN(mm)) {
      setSelectedHour(hh);
      setSelectedMinute(mm);
      setIsCustomTime(true);
    }
  };

  // Preview text for currently selected slot
  const currentIso = useMemo(() => {
    const d = istDay(dayOffset);
    return new Date(d.getTime() + (selectedHour * 3600 + selectedMinute * 60) * 1000).toISOString();
  }, [dayOffset, selectedHour, selectedMinute]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Day Selector */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="cal" className="icon i14" />
            Pickup Date
          </span>
          <span style={{ fontSize: 12, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
            {dayLabel(dayOffset, true)}
          </span>
        </div>
        <div
          role="radiogroup"
          aria-label="Select pickup day"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 6,
          }}
        >
          {days.map((item) => {
            const active = dayOffset === item.offset;
            return (
              <button
                key={item.offset}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setDayOffset(item.offset)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "8px 4px",
                  borderRadius: 8,
                  border: active ? "1.5px solid var(--brand, #02505F)" : "1px solid var(--shr, rgba(0,0,0,0.1))",
                  background: active ? "var(--tint, rgba(2, 80, 95, 0.08))" : "var(--surface, #ffffff)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: active ? 600 : 500,
                    color: active ? "var(--brand, #02505F)" : "var(--ink)",
                  }}
                >
                  {item.dayName}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: active ? "var(--brand, #02505F)" : "var(--muted)",
                    fontVariantNumeric: "tabular-nums",
                    marginTop: 2,
                  }}
                >
                  {item.dateNum}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Time Selector */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="clock" className="icon i14" />
            Pickup Time
          </span>
          {sellerSlots.length > 0 && !sellerSlots.includes("flexible") && (
            <span style={{ fontSize: 11, color: "var(--brand, #02505F)", fontWeight: 500 }}>
              Tailored to seller&apos;s hours
            </span>
          )}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {activePresets.map((preset) => {
            const active = !isCustomTime && selectedHour === preset.hour && selectedMinute === preset.minute;
            return (
              <button
                key={preset.label}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => handlePresetClick(preset.hour, preset.minute)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: active ? "1.5px solid var(--brand, #02505F)" : "1px solid var(--shr, rgba(0,0,0,0.1))",
                  background: active ? "var(--brand, #02505F)" : "var(--surface, #ffffff)",
                  color: active ? "#ffffff" : "var(--ink)",
                  fontSize: 12,
                  fontWeight: active ? 600 : 500,
                  cursor: "pointer",
                  fontVariantNumeric: "tabular-nums",
                  transition: "all 0.15s ease",
                }}
              >
                {active && <Icon name="check" className="icon i14" strokeWidth={2.5} />}
                {preset.label}
              </button>
            );
          })}

          {/* Exact / Custom Time Button & Input */}
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 999,
              border: isCustomTime ? "1.5px solid var(--brand, #02505F)" : "1px solid var(--shr, rgba(0,0,0,0.1))",
              background: isCustomTime ? "var(--tint, rgba(2, 80, 95, 0.08))" : "var(--surface, #ffffff)",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 500,
              color: isCustomTime ? "var(--brand, #02505F)" : "var(--ink)",
            }}
          >
            <span>Custom</span>
            <input
              type="time"
              value={customTimeVal}
              onChange={handleCustomTimeChange}
              onFocus={() => setIsCustomTime(true)}
              style={{
                border: "none",
                background: "transparent",
                color: "inherit",
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: "pointer",
                outline: "none",
                padding: 0,
              }}
              aria-label="Custom time"
            />
          </label>
        </div>
      </div>

      {/* Confirmation summary strip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 10px",
          borderRadius: 8,
          background: "var(--bg-raised, #f8fafc)",
          border: "1px solid var(--shr, rgba(0,0,0,0.06))",
          fontSize: 12,
          color: "var(--ink)",
        }}
      >
        <span style={{ color: "var(--brand, #02505F)" }}>
          <Icon name="clock" className="icon i14" />
        </span>
        <span style={{ fontWeight: 500 }}>
          Proposed meeting:{" "}
          <strong style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
            {formatHandoverSchedule(currentIso)}
          </strong>
        </span>
      </div>
    </div>
  );
}
