"use client";
/**
 * FEATURE: Photos in the sell / edit form
 * WHAT: Add up to 6 photos (first one is the cover), drag to reorder (dnd-kit,
 *       works with mouse, touch and keyboard), remove with the x.
 *       Two ways in: "Take a photo" (phone camera app, or the in-page camera on
 *       laptops) and "Choose photos" (gallery or files, any major format incl. HEIC).
 */
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { CameraSheet } from "@/components/ui/camera-sheet";
import { MAX_PHOTOS, PHOTO_ACCEPT, PHOTO_FORMATS_TEXT } from "@/lib/validation/listing";
import { uploadPhoto } from "../upload-client";

export type Photo = { url: string; publicId?: string | null; fit: "contain" | "cover" };

function Thumb({ p, i, onRemove }: { p: Photo; i: number; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: p.url });
  return (
    <div ref={setNodeRef} className="th" style={{ transform: CSS.Transform.toString(transform), transition }} {...attributes} {...listeners} aria-label={`Photo ${i + 1}${i === 0 ? ", cover" : ""}. Drag to reorder.`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- user photo preview */}
      <img src={p.url} alt="" style={p.fit === "contain" ? { objectFit: "contain", background: "var(--photo)" } : undefined} />
      {i === 0 && <span className="badge b-neutral cv">Cover</span>}
      <button type="button" className="rm" aria-label={`Remove photo ${i + 1}`} onPointerDown={(e) => e.stopPropagation()} onClick={onRemove}>
        <Icon name="x" className="icon i14" />
      </button>
    </div>
  );
}

export function PhotoField({ value, onChange, error }: { value: Photo[]; onChange: (v: Photo[]) => void; error?: string }) {
  const [busy, setBusy] = useState(0);
  const [camOpen, setCamOpen] = useState(false);
  const cameraInput = useRef<HTMLInputElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const add = async (files: FileList | File[] | null) => {
    if (!files?.length) return;
    const room = MAX_PHOTOS - value.length;
    const picked = Array.from(files).slice(0, room);
    if (files.length > room) toast(`Up to ${MAX_PHOTOS} photos. Added the first ${room}.`);
    setBusy(picked.length);
    let next = [...value];
    for (const f of picked) {
      const r = await uploadPhoto(f);
      setBusy((b) => b - 1);
      if ("error" in r) toast.error(r.error);
      else next = [...next, { url: r.url, publicId: r.publicId, fit: "cover" }];
      onChange(next);
    }
  };
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = value.findIndex((p) => p.url === e.active.id);
    const to = value.findIndex((p) => p.url === e.over!.id);
    onChange(arrayMove(value, from, to));
  };

  const full = value.length >= MAX_PHOTOS;
  // Phones open their own camera app; laptops get the in-page camera sheet.
  const takePhoto = () => {
    if (full) return toast(`Up to ${MAX_PHOTOS} photos.`);
    const phone = window.matchMedia("(pointer: coarse)").matches;
    if (phone) cameraInput.current?.click();
    else setCamOpen(true);
  };
  const errStyle = error ? { borderColor: "var(--bad)" } : undefined;

  return (
    <div className="field">
      <span className="label" id="photos-label">
        <Icon name="camera" />
        Photos
      </span>
      <div className="photoadd" aria-describedby={error ? "photos-err" : undefined}>
        <button type="button" className="drop" onClick={takePhoto} disabled={full || busy > 0} style={errStyle}>
          <Icon name="camera" />
          <span>
            <b>Take a photo</b>
            <br />
            <span className="faint sm">Opens your camera</span>
          </span>
        </button>
        <label className="drop" style={{ ...errStyle, opacity: full ? 0.5 : undefined }} aria-invalid={!!error}>
          <Icon name="img" />
          <span>
            <b>{busy ? `Uploading ${busy}...` : "Choose photos"}</b>
            <br />
            <span className="faint sm">From your gallery or files</span>
          </span>
          <input type="file" accept={PHOTO_ACCEPT} multiple hidden onChange={(e) => (add(e.target.files), (e.target.value = ""))} disabled={full} aria-labelledby="photos-label" />
        </label>
        {/* Phones: capture="environment" opens the back camera directly. */}
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (add(e.target.files), (e.target.value = ""))} aria-label="Take a photo" />
      </div>
      <span className="faint xs">First one is the cover. Up to {MAX_PHOTOS} photos, 10 MB each. {PHOTO_FORMATS_TEXT}, including iPhone photos.</span>
      <CameraSheet open={camOpen} onOpenChange={setCamOpen} onCapture={(f) => add([f])} />
      {value.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={value.map((p) => p.url)} strategy={rectSortingStrategy}>
            <div className="thumbs">
              {value.map((p, i) => (
                <Thumb key={p.url} p={p} i={i} onRemove={() => onChange(value.filter((x) => x.url !== p.url))} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      {value.length > 1 && <span className="faint xs">Drag photos to change the order.</span>}
      {error && (
        <span className="ferr" role="alert" id="photos-err">
          <Icon name="alert" className="icon i14" />
          {error}
        </span>
      )}
    </div>
  );
}
