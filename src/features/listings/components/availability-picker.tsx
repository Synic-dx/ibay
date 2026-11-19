"use client";

import React from "react";
import { Icon } from "@/components/ui/icon";
import { AVAILABILITY_SLOT_CONFIG, type AvailabilitySlotId } from "@/lib/validation/listing";

interface AvailabilityPickerProps {
  value: string[];
  onChange: (slots: string[]) => void;
}

export default function AvailabilityPicker({ value = [], onChange }: AvailabilityPickerProps) {
  const toggleSlot = (id: AvailabilitySlotId) => {
    if (id === "flexible") {
      if (value.includes("flexible")) {
        onChange([]);
      } else {
        onChange(["flexible"]);
      }
      return;
    }

    const withoutFlex = value.filter((v) => v !== "flexible");
    if (withoutFlex.includes(id)) {
      onChange(withoutFlex.filter((v) => v !== id));
    } else {
      onChange([...withoutFlex, id]);
    }
  };

  return (
    <div className="field" style={{ gap: 8 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span className="label" style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
          <Icon name="clock" className="icon i16" />
          Availability for Pickup
          <span style={{ fontSize: 11, fontWeight: 400, color: "var(--muted)", marginLeft: "auto" }}>
            Optional
          </span>
        </span>
        <span style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.4 }}>
          Select the typical time windows you are usually free to meet on campus.
        </span>
      </div>

      <div
        role="group"
        aria-label="Pickup availability windows"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: 8,
          marginTop: 4,
        }}
      >
        {AVAILABILITY_SLOT_CONFIG.map((slot) => {
          const isSelected = value.includes(slot.id);
          return (
            <button
              key={slot.id}
              type="button"
              role="checkbox"
              aria-checked={isSelected}
              onClick={() => toggleSlot(slot.id)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                padding: "10px 12px",
                borderRadius: 10,
                border: isSelected ? "1.5px solid var(--brand, #02505F)" : "1px solid var(--shr, rgba(0,0,0,0.1))",
                background: isSelected ? "var(--tint, rgba(2, 80, 95, 0.08))" : "var(--surface, #ffffff)",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s ease",
                position: "relative",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", width: "100%", justifyContent: "space-between", marginBottom: 4 }}>
                <span
                  style={{
                    color: isSelected ? "var(--brand, #02505F)" : "var(--muted)",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <Icon name={slot.icon} className="icon i16" />
                </span>
                {isSelected && (
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      background: "var(--brand, #02505F)",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 9,
                    }}
                  >
                    <Icon name="check" className="icon i14" strokeWidth={3} />
                  </span>
                )}
              </div>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: isSelected ? 600 : 500,
                  color: isSelected ? "var(--brand, #02505F)" : "var(--ink)",
                }}
              >
                {slot.label}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--muted)",
                  fontVariantNumeric: "tabular-nums",
                  marginTop: 1,
                }}
              >
                {slot.sublabel}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
