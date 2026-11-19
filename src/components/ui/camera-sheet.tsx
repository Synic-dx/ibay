"use client";
/**
 * FEATURE: Take a photo with the computer's camera
 * WHAT: A sheet with a live camera preview and a Capture button. Used on
 *       laptops and desktops; phones open their own camera app instead
 *       (see photo-field.tsx). The picture is returned as a JPEG file.
 * PRIVACY: the camera is switched off as soon as the sheet closes.
 */
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";

export function CameraSheet({ open, onOpenChange, onCapture }: { open: boolean; onOpenChange: (v: boolean) => void; onCapture: (file: File) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const start = async () => {
      setError(null);
      setReady(false);
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser can't use the camera. Use Choose photos instead.");
        return;
      }
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play().catch(() => undefined);
        }
        setReady(true);
      } catch (e) {
        const name = e instanceof DOMException ? e.name : "";
        setError(
          name === "NotAllowedError"
            ? "Camera access is blocked. Allow it in your browser's address bar, then try again."
            : name === "NotFoundError" || name === "OverconstrainedError"
              ? "No camera found on this device. Use Choose photos instead."
              : "Couldn't start the camera. Close other apps using it, or use Choose photos.",
        );
      }
    };
    start();
    return () => {
      cancelled = true;
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
    };
  }, [open]);

  const capture = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")?.drawImage(v, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" }));
        onOpenChange(false);
      },
      "image/jpeg",
      0.88,
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} icon="camera" title="Take a photo" subtitle="Hold the item in good light, filling most of the frame.">
      <div className="stack" style={{ gap: 12 }}>
        {error ? (
          <div className="formerr" role="alert">
            <Icon name="alert" className="icon i16" />
            {error}
          </div>
        ) : (
          <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", background: "var(--photo)", aspectRatio: "4 / 3" }}>
            <video ref={video} playsInline muted aria-label="Camera preview" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            {!ready && (
              <span className="faint sm" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
                Starting camera...
              </span>
            )}
          </div>
        )}
        <button type="button" className="btn block" onClick={capture} disabled={!ready || !!error}>
          <Icon name="camera" />
          Capture
        </button>
        <button type="button" className="btn quiet block" onClick={() => onOpenChange(false)}>
          Cancel
        </button>
      </div>
    </Sheet>
  );
}
