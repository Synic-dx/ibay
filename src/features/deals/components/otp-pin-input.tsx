"use client";

import React, { useRef, useEffect } from "react";

interface OtpPinInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  hasError?: boolean;
}

export default function OtpPinInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  hasError = false,
}: OtpPinInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Array of 6 digits (padded with empty strings)
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || "");

  useEffect(() => {
    // Focus first input on mount if value is empty
    if (!value && inputsRef.current[0]) {
      inputsRef.current[0].focus();
    }
  }, [value]);

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "");
    if (!val) return;

    const nextChar = val[val.length - 1]; // take the latest character typed
    const nextArr = [...digits];
    nextArr[index] = nextChar;
    const nextValue = nextArr.join("").slice(0, 6);
    onChange(nextValue);

    // Auto-advance to next cell
    if (index < 5 && inputsRef.current[index + 1]) {
      inputsRef.current[index + 1]?.focus();
    }

    if (nextValue.length === 6 && onComplete) {
      onComplete(nextValue);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        // Move back and clear previous cell
        const nextArr = [...digits];
        nextArr[index - 1] = "";
        onChange(nextArr.join(""));
        inputsRef.current[index - 1]?.focus();
      } else {
        // Clear current cell
        const nextArr = [...digits];
        nextArr[index] = "";
        onChange(nextArr.join(""));
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;

    onChange(pasted);
    const targetIdx = Math.min(pasted.length, 5);
    inputsRef.current[targetIdx]?.focus();

    if (pasted.length === 6 && onComplete) {
      onComplete(pasted);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "10px 0",
      }}
      role="group"
      aria-label="6-digit verification code"
    >
      {[0, 1, 2].map((i) => (
        <input
          key={i}
          ref={(el) => {
            inputsRef.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={digits[i] || ""}
          className="otp-digit"
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          style={{
            width: 44,
            height: 52,
            fontSize: 24,
            fontWeight: 700,
            textAlign: "center",
            borderRadius: 8,
            border: hasError
              ? "1.5px solid var(--bad, #dc2626)"
              : digits[i]
              ? "1.5px solid var(--brand, #02505F)"
              : "1px solid var(--shr, rgba(0,0,0,0.15))",
            background: "var(--surface, #ffffff)",
            color: "var(--ink, #0f172a)",
            fontVariantNumeric: "tabular-nums",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            transition: "all 0.15s ease",
          }}
        />
      ))}

      <span style={{ fontSize: 20, color: "var(--muted)", fontWeight: 700, padding: "0 2px" }}>
        ·
      </span>

      {[3, 4, 5].map((i) => (
        <input
          key={i}
          ref={(el) => {
            inputsRef.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={digits[i] || ""}
          className="otp-digit"
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          style={{
            width: 44,
            height: 52,
            fontSize: 24,
            fontWeight: 700,
            textAlign: "center",
            borderRadius: 8,
            border: hasError
              ? "1.5px solid var(--bad, #dc2626)"
              : digits[i]
              ? "1.5px solid var(--brand, #02505F)"
              : "1px solid var(--shr, rgba(0,0,0,0.15))",
            background: "var(--surface, #ffffff)",
            color: "var(--ink, #0f172a)",
            fontVariantNumeric: "tabular-nums",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            transition: "all 0.15s ease",
          }}
        />
      ))}
    </div>
  );
}
