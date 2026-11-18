"use client";
/**
 * FEATURE: The 3-step sell / edit form [RUBRIC:CRUD-CREATE] [RUBRIC:CRUD-UPDATE] [RUBRIC:VALIDATION-CLIENT]
 * WHAT: Step 1 deal type, photos, title (category guessed from the title);
 *       step 2 price, original price, purchase month, size and specs;
 *       step 3 condition, description, bundle, live preview.
 * EDIT MODE: the same form prefilled, with locked fields and a short reason,
 *       the edit history and a red "Delete listing" danger zone.
 * VALIDATION: React Hook Form + the shared Zod schema. Errors show on blur and
 *       then as you type; "Continue" checks only the current step and focuses
 *       the first bad field. The server runs the same schema again; its field
 *       errors are mapped back onto the same inputs. Dev only: ?novalidate=1
 *       turns the browser checks off to show the server catching bad data.
 */
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { Controller, useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { useApp } from "@/components/app-context";
import { useNoValidate } from "@/lib/hooks/use-novalidate";
import { ago, ageMonths, ageText, ageTone, MONTHS, unitWord } from "@/lib/format";
import {
  AUCTION_HOURS, CONDITIONS, guessCategory, listingSchema, NO_VALUE_CHECK, SEAL_STATUSES, STEP_FIELDS, SUPPLEMENT_RE,
  checkPurchaseMonth, type ListingData, type ListingInput,
} from "@/lib/validation/listing";
import { ProductCard } from "../components/product-card";
import { createListing } from "../actions/create";
import { updateListing } from "../actions/update";
import { DeleteDialog } from "../delete-dialog";
import { PhotoField, type Photo } from "./photo-field";
import SpotPicker from "@/features/map/components/spot-picker";
import type { ListingCard, Mode } from "../types";
import type { Category } from "@/features/shell/queries";

type Values = ListingInput & Record<string, unknown>;

export type EditInfo = {
  id: string;
  bids: number;
  bookedAhead: boolean;
  status: string;
  createdAt: string;
  history: { at: string; changes: string }[];
  card: ListingCard;
};

const TYPES: [Mode, string, string, string][] = [
  ["sell", "Fixed price", "Buyers can still make offers", "tag"],
  ["rent", "Rent it out", "By the hour, day or week", "repeat"],
  ["auction", "Auction", "Set a minimum, campus bids", "hammer"],
  ["drop", "Food drop", "Extra food, only your hostel sees it", "flame"],
];
const STEP_NAMES = ["", "Type, photos & title", "Price, age & size", "Details & preview"];

/** Label + input + inline error, wired with aria-invalid / aria-describedby. */
function F({ id, label, icon, error, hint, children }: { id: string; label: string; icon: string; error?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="field" style={{ flex: 1, minWidth: 140 }}>
      <label className="label" htmlFor={id}>
        <Icon name={icon} />
        {label}
      </label>
      {children}
      {hint}
      {error && (
        <span className="ferr" role="alert" id={`${id}-err`}>
          <Icon name="alert" className="icon i14" />
          {error}
        </span>
      )}
    </div>
  );
}

export function ListingForm({ categories, initial, edit }: { categories: Category[]; initial: Values; edit?: EditInfo }) {
  const router = useRouter();
  const noValidate = useNoValidate();
  const { viewer } = useApp();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [pending, start] = useTransition();
  const [formErr, setFormErr] = useState<string | null>(null);
  const [pickCat, setPickCat] = useState(false);
  const [delOpen, setDelOpen] = useState(false);

  const form = useForm<Values, unknown, ListingData>({
    // WHY: the same schema the server uses. ?novalidate=1 (dev only) turns it off for the demo.
    resolver: noValidate ? undefined : zodResolver(listingSchema) as never,
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: initial,
    shouldFocusError: true,
  });
  const { register, watch, setValue, formState, trigger, setError, control, getValues } = form;
  const errors = formState.errors as Record<string, { message?: string } | undefined>;
  const err = (k: string) => errors[k]?.message;
  const v = watch();
  const mode = v.mode as Mode;
  const title = String(v.title ?? "");
  const guessed = useMemo(() => guessCategory(title), [title]);
  const catId = mode === "drop" ? "food" : String(v.categoryId || "") || guessed || "";
  const needValue = mode !== "drop" && !NO_VALUE_CHECK.includes(catId);
  const supplement = SUPPLEMENT_RE.test(title) || (catId === "gym" && Boolean(v.sealStatus));
  const locked = {
    mode: Boolean(edit),
    price: Boolean(edit && mode === "auction" && edit.bids > 0),
    unit: Boolean(edit && mode === "rent" && edit.bookedAhead),
    drop: Boolean(edit && mode === "drop"),
  };

  // Keep the guessed category in the form value (the user can still change it).
  useEffect(() => {
    if (mode !== "drop" && !v.categoryId && guessed) setValue("categoryId", guessed as never);
  }, [guessed, mode, v.categoryId, setValue]);
  useEffect(() => {
    if (mode === "drop") setValue("categoryId", "food" as never);
  }, [mode, setValue]);

  const ids = (k: string) => ({ id: `f-${k}`, "aria-invalid": Boolean(err(k)), "aria-describedby": err(k) ? `f-${k}-err` : undefined });

  /** Validates only this step's fields; focuses the first bad one. */
  const next = async () => {
    if (!noValidate) {
      const fields = STEP_FIELDS[step].filter((f) => f in getValues() || ["mrp", "purchasedOn", "photos"].includes(f));
      const okStep = await trigger(fields as FieldPath<Values>[], { shouldFocus: true });
      if (!okStep) {
        if (err("categoryId")) setPickCat(true);
        toast("Please fix the highlighted fields");
        return;
      }
    }
    setStep((s) => (s < 3 ? ((s + 1) as 2 | 3) : s));
    window.scrollTo(0, 0);
  };

  /** Publish / Save. The server re-validates; its errors go back onto the fields. */
  const submit = () =>
    start(async () => {
      setFormErr(null);
      if (!noValidate) {
        const okAll = await trigger(undefined, { shouldFocus: true });
        if (!okAll) {
          const bad = Object.keys(formState.errors);
          setStep(bad.some((k) => STEP_FIELDS[1].includes(k)) ? 1 : bad.some((k) => STEP_FIELDS[2].includes(k)) ? 2 : 3);
          toast("Please fix the highlighted fields");
          return;
        }
      }
      const values = { ...getValues(), categoryId: catId || getValues().categoryId } as ListingInput;
      const r = edit ? await updateListing(edit.id, values) : await createListing(values);
      if (!r.ok) {
        // [RUBRIC:VALIDATION-SERVER] map the server's field errors onto the same inputs.
        const fe = r.fieldErrors ?? {};
        for (const [k, m] of Object.entries(fe)) setError(k as FieldPath<Values>, { message: m });
        const keys = Object.keys(fe);
        if (keys.some((k) => STEP_FIELDS[1].includes(k))) setStep(1);
        else if (keys.some((k) => STEP_FIELDS[2].includes(k))) setStep(2);
        setFormErr(r.code === "CONFLICT" ? r.formError ?? null : keys.length ? `Server check failed: ${r.formError}` : (r.formError ?? "Something went wrong."));
        if (r.code === "CONFLICT") toast.error(r.formError);
        return;
      }
      toast(r.message ?? (edit ? "Changes saved" : "Your listing is live"));
      router.push(`/item/${r.data.id}`);
      router.refresh();
    });

  const priceLabel = mode === "auction" ? "Starting bid" : mode === "rent" ? "Rent" : "Your price";
  const unit = String(v.rentUnit || (catId === "preprocess" ? "hour" : "day"));
  const pNum = Number(v.price) || 0;
  const oNum = Number(v.mrp) || 0;
  const t = title.toLowerCase();
  const wear = ["preprocess", "formals", "ethnic", "clothing"].includes(catId);
  const shoe = /shoe|heels|loafer|oxford|sneaker|boots|air force|ultraboost/.test(t);
  const suit = /suit/.test(t);
  const now = new Date();
  const [py, pm] = String(v.purchasedOn || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`).split("-");
  const purchaseErr = checkPurchaseMonth(`${py}-${pm}`);
  const specs = (v.specs as { k: string; v: string }[] | undefined) ?? [];
  const specVal = (k: string) => specs.find((s) => s.k === k)?.v ?? "";
  const setSpec = (k: string, val: string) => {
    const rest = specs.filter((s) => s.k !== k);
    setValue("specs", (val.trim() ? [...rest, { k, v: val }] : rest) as never, { shouldDirty: true });
  };

  // Live preview card for step 3.
  const preview: ListingCard = {
    ...(edit?.card ?? ({} as ListingCard)),
    id: "preview", title: title || "Your item", mode, categoryId: catId || "room", price: pNum, mrp: oNum || null,
    rentUnit: mode === "rent" ? (unit as ListingCard["rentUnit"]) : null, deposit: Number(v.deposit) || 0, reservePrice: pNum, buyNowPrice: null,
    endsAt: new Date(Date.now() + (mode === "drop" ? Number(v.availableMinutes || 30) * 60e3 : Number(v.durationHours || 24) * 3600e3)).toISOString(),
    status: "active", purchasedOn: mode === "drop" ? null : `${py}-${pm}-01`, condition: String(v.condition || "Good"),
    photo: (v.photos as Photo[] | undefined)?.[0] ?? null, ticketInfo: [], isBundle: Boolean(v.isBundle), bundleCount: String(v.bundleContents ?? "").split("\n").filter(Boolean).length,
    bidCount: 0, priceDropAmount: null, priceDroppedAt: null, pickupHostel: viewer?.hostel ?? "", views: 0, saves: 0, saved: false,
    seller: { id: viewer?.id ?? "", name: viewer?.name ?? "", hostel: viewer?.hostel ?? "", plume: viewer?.plume ?? 0, ratedDeals: viewer?.ratedDeals ?? 0, avatarUrl: null, avatarColor: "", responseNote: null },
    brand: (v.brand as string) || null, model: null, size: null, tags: [], createdAt: "", updatedAt: "", deletedAt: null, nextFree: "Today 7 PM",
  };

  return (
    <>
      <header className="tb">
        <div className="tb-row">
          <button type="button" className="ib" onClick={() => router.back()} aria-label="Close">
            <Icon name="x" />
          </button>
          <h1 className="tb-title">
            {edit ? "Edit listing" : "List an item"}
            <small>
              Step {step} of 3 · {STEP_NAMES[step]}
            </small>
          </h1>
        </div>
        <div className="prog" style={{ padding: "0 6px 4px" }} aria-hidden="true">
          {[1, 2, 3].map((i) => (
            <i key={i} className={i <= step ? "on" : ""} />
          ))}
        </div>
      </header>

      <main className="withbar formpage">
        <form className="stack" style={{ gap: 18 }} noValidate onSubmit={(e) => e.preventDefault()}>
          {noValidate && (
            <div className="capoff">
              <Icon name="alert" className="icon i16" />
              Browser checks are off (?novalidate=1). The server will still check everything.
            </div>
          )}
          {formErr && (
            <div className="formerr" role="alert">
              <Icon name="alert" className="icon i16" />
              {formErr}
            </div>
          )}

          {step === 1 && (
            <>
              <div className="field">
                <span className="label">
                  <Icon name="bag" />
                  How do you want to sell it?
                </span>
                {locked.mode && (
                  <div className="note">
                    <Icon name="lock" />
                    <span>Deal type can&apos;t be changed after posting. To switch, delete this and list it again.</span>
                  </div>
                )}
                <div className="types" role="radiogroup" aria-label="Deal type">
                  {TYPES.map(([k, n, d, i]) => (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={mode === k}
                      className={`type ${mode === k ? "on" : ""}`}
                      disabled={locked.mode && mode !== k}
                      style={locked.mode && mode !== k ? { opacity: 0.45 } : undefined}
                      onClick={() => setValue("mode", k as never, { shouldValidate: false })}
                    >
                      <Icon name={i} />
                      <b>{n}</b>
                      <span>{d}</span>
                    </button>
                  ))}
                </div>
              </div>

              {!locked.drop && (
                <Controller
                  control={control}
                  name={"photos" as FieldPath<Values>}
                  render={({ field }) => <PhotoField value={(field.value as Photo[]) ?? []} onChange={(p) => (field.onChange(p), form.clearErrors("photos" as FieldPath<Values>))} error={err("photos")} />}
                />
              )}

              <F
                id="f-title"
                label={mode === "drop" ? "What are you sharing?" : "Title, with brand and model"}
                icon="edit"
                error={err("title")}
                hint={
                  <span className="fhint">
                    <span />
                    <span className="cnt-txt">{title.length}/80</span>
                  </span>
                }
              >
                <input
                  className={`input ${err("title") ? "bad" : ""}`}
                  maxLength={noValidate ? undefined : 80}
                  placeholder={mode === "drop" ? "e.g. Extra biryani, sealed" : "e.g. Yonex Astrox 77 Pro, 4U G5"}
                  readOnly={locked.drop}
                  {...ids("title")}
                  {...register("title")}
                />
              </F>
              {mode === "drop" ? (
                <span className="sm muted row" style={{ gap: 6 }}>
                  <Icon name="flame" className="icon i16" />
                  Listed under <b>Food drops</b>, visible only to people in {viewer?.hostel}
                </span>
              ) : catId && !pickCat ? (
                <span className="sm muted row" style={{ gap: 6 }}>
                  <Icon name={categories.find((c) => c.id === catId)?.icon ?? "grid"} className="icon i16" />
                  Category: <b>{categories.find((c) => c.id === catId)?.name}</b>
                  <button type="button" className="btn quiet small" style={{ minHeight: 0, padding: 0 }} onClick={() => setPickCat(true)}>
                    change
                  </button>
                </span>
              ) : null}
              {mode !== "drop" && (!catId || pickCat) && (
                <F id="f-categoryId" label="Category" icon="grid" error={err("categoryId")}>
                  <select className={`input ${err("categoryId") ? "bad" : ""}`} {...ids("categoryId")} {...register("categoryId")} onChange={(e) => (setValue("categoryId", e.target.value as never, { shouldValidate: true }), setPickCat(false))}>
                    <option value="">Choose a category</option>
                    {categories
                      .filter((c) => c.id !== "food")
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </F>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <div className="row" style={{ gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                <F
                  id="f-price"
                  label={priceLabel}
                  icon="rupee"
                  error={err("price")}
                  hint={locked.price || locked.drop ? <span className="locked"><Icon name="lock" className="icon i12" />{locked.price ? "Locked: people have already bid" : "Locked for food drops"}</span> : undefined}
                >
                  <input className={`input ${err("price") ? "bad" : ""}`} inputMode="numeric" placeholder="₹" disabled={locked.price || locked.drop} {...ids("price")} {...register("price")} />
                </F>
                {needValue && (
                  <F id="f-mrp" label="Original price" icon="tag" error={err("mrp")}>
                    <input className={`input ${err("mrp") ? "bad" : ""}`} inputMode="numeric" placeholder="What you paid" {...ids("mrp")} {...register("mrp")} />
                  </F>
                )}
              </div>
              {needValue && pNum > 0 && oNum > 0 && !(mode !== "rent" && pNum > oNum) && (
                <div className="note" style={{ color: "var(--good)" }}>
                  <Icon name="trend" />
                  <span>
                    {mode === "rent"
                      ? `That is ${((pNum / oNum) * 100).toFixed(1)}% of its value per ${unitWord(unit as never)}.`
                      : mode === "auction"
                        ? `Bidding starts ${Math.round((1 - pNum / oNum) * 100)}% below the original price.`
                        : `That's ${Math.round((1 - pNum / oNum) * 100)}% below the original price.`}
                  </span>
                </div>
              )}

              {mode === "rent" && (
                <>
                  <div className="field">
                    <span className="label">
                      <Icon name="clock" />
                      Charge per
                    </span>
                    <div className="seg" role="radiogroup" aria-label="Charge per">
                      {(["hour", "day", "week", "month"] as const).map((u) => (
                        <button key={u} type="button" role="radio" aria-checked={unit === u} className={unit === u ? "on" : ""} disabled={locked.unit && unit !== u} onClick={() => setValue("rentUnit", u as never, { shouldValidate: true })}>
                          {u[0].toUpperCase() + u.slice(1)}
                        </button>
                      ))}
                    </div>
                    {locked.unit && (
                      <span className="locked">
                        <Icon name="lock" className="icon i12" />
                        Locked: someone has an upcoming booking. A new rate applies to new bookings only.
                      </span>
                    )}
                    {err("rentUnit") && <span className="ferr" role="alert"><Icon name="alert" className="icon i14" />{err("rentUnit")}</span>}
                  </div>
                  <F id="f-deposit" label="Refundable deposit" icon="shield" error={err("deposit")}>
                    <input className={`input ${err("deposit") ? "bad" : ""}`} inputMode="numeric" placeholder="₹ (0 is allowed)" {...ids("deposit")} {...register("deposit")} />
                  </F>
                </>
              )}

              {mode === "auction" && (
                <>
                  <F id="f-buyNow" label="Buy it now price (optional)" icon="zap" error={err("buyNow")}>
                    <input className={`input ${err("buyNow") ? "bad" : ""}`} inputMode="numeric" placeholder="₹, more than the starting bid" disabled={locked.price} {...ids("buyNow")} {...register("buyNow")} />
                  </F>
                  {!edit && (
                    <div className="field">
                      <span className="label">
                        <Icon name="hourglass" />
                        Ends in
                      </span>
                      <div className="seg" role="radiogroup" aria-label="Ends in">
                        {AUCTION_HOURS.map((h) => (
                          <button key={h} type="button" role="radio" aria-checked={Number(v.durationHours) === h} className={Number(v.durationHours) === h ? "on" : ""} onClick={() => setValue("durationHours", h as never)}>
                            {h === 6 ? "6 hr" : h === 24 ? "1 day" : h === 72 ? "3 days" : "7 days"}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {edit && (
                    <span className="locked">
                      <Icon name="lock" className="icon i12" />
                      {edit.bids > 0 ? "End time is locked because people have bid." : "Change the end time with Extend auction in My listings."}
                    </span>
                  )}
                </>
              )}

              {mode === "drop" && (
                <>
                  <div className="note">
                    <Icon name="home" />
                    <span>
                      Food drops are <b>only shown to people in {viewer?.hostel}</b>, so whoever claims it can walk over in minutes.
                    </span>
                  </div>
                  <div className="field">
                    <span className="label">
                      <Icon name="hourglass" />
                      {edit ? "Keep it up for (from when you posted)" : "Available for"}
                    </span>
                    <div className="seg" role="radiogroup" aria-label="Available for">
                      {[15, 30, 60, 180].map((m) => (
                        <button key={m} type="button" role="radio" aria-checked={Number(v.availableMinutes) === m} className={Number(v.availableMinutes) === m ? "on" : ""} onClick={() => setValue("availableMinutes", m as never)}>
                          {m < 60 ? `${m} min` : `${m / 60} hr`}
                        </button>
                      ))}
                    </div>
                    {locked.drop && <span className="locked"><Icon name="lock" className="icon i12" />You can only extend the time (3 hours max in total) or edit the description.</span>}
                  </div>
                </>
              )}

              {needValue && (
                <div className="field">
                  <span className="label" id="purchased-label">
                    <Icon name="cal" />
                    When did you buy it?
                  </span>
                  <div className="row">
                    <select className="input" aria-labelledby="purchased-label" aria-label="Month" value={pm} onChange={(e) => setValue("purchasedOn", `${py}-${e.target.value}` as never, { shouldValidate: true })}>
                      {MONTHS.map((x, i) => (
                        <option key={x} value={String(i + 1).padStart(2, "0")}>
                          {x}
                        </option>
                      ))}
                    </select>
                    <select className="input" aria-label="Year" value={py} onChange={(e) => setValue("purchasedOn", `${e.target.value}-${pm}` as never, { shouldValidate: true })}>
                      {Array.from({ length: 16 }, (_, k) => now.getFullYear() - k).map((y) => (
                        <option key={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  {err("purchasedOn") || purchaseErr ? (
                    <span className="ferr" role="alert">
                      <Icon name="alert" className="icon i14" />
                      {err("purchasedOn") ?? purchaseErr}
                    </span>
                  ) : (
                    <div>
                      <span className={`age big ${ageTone(ageMonths(`${py}-${pm}-01`))}`}>{ageText(ageMonths(`${py}-${pm}-01`), true)}</span>
                    </div>
                  )}
                </div>
              )}

              {mode !== "drop" && (
                <div className="field">
                  <span className="label">
                    <Icon name="ruler" />
                    Brand, model, size & specs
                  </span>
                  <div className="row">
                    <input className="input" placeholder="Brand, e.g. Yonex" aria-label="Brand" {...register("brand")} />
                    <input className="input" placeholder="Model, e.g. Astrox 77 Pro" aria-label="Model" {...register("model")} />
                  </div>
                  {shoe ? (
                    <div className="chips" role="radiogroup" aria-label="Shoe size">
                      {["UK 6", "UK 7", "UK 8", "UK 9", "UK 10", "UK 11"].map((z) => (
                        <button key={z} type="button" role="radio" aria-checked={v.size === z} className={`chip ${v.size === z ? "on" : ""}`} onClick={() => setValue("size", z as never)}>
                          {z}
                        </button>
                      ))}
                    </div>
                  ) : suit ? (
                    <div className="row">
                      <input className="input" placeholder="Jacket, e.g. 40" aria-label="Jacket size" value={specVal("Jacket")} onChange={(e) => setSpec("Jacket", e.target.value)} />
                      <input className="input" placeholder="Trouser waist, in" aria-label="Trouser waist" value={specVal("Trouser waist")} onChange={(e) => setSpec("Trouser waist", e.target.value)} />
                    </div>
                  ) : wear ? (
                    <>
                      <div className="chips" role="radiogroup" aria-label="Size">
                        {["XS", "S", "M", "L", "XL", "XXL", "Free size"].map((z) => (
                          <button key={z} type="button" role="radio" aria-checked={v.size === z} className={`chip ${v.size === z ? "on" : ""}`} onClick={() => setValue("size", z as never)}>
                            {z}
                          </button>
                        ))}
                      </div>
                      <div className="row">
                        <input className="input" placeholder="Chest, in" aria-label="Chest" value={specVal("Chest")} onChange={(e) => setSpec("Chest", e.target.value)} />
                        <input className="input" placeholder="Length, in" aria-label="Length" value={specVal("Length")} onChange={(e) => setSpec("Length", e.target.value)} />
                      </div>
                    </>
                  ) : catId === "gym" ? (
                    <div className="row">
                      <input className="input" placeholder="Net weight / left" aria-label="Net weight" value={specVal("Net weight")} onChange={(e) => setSpec("Net weight", e.target.value)} />
                      <input className="input" placeholder="Servings" aria-label="Servings" value={specVal("Servings")} onChange={(e) => setSpec("Servings", e.target.value)} />
                    </div>
                  ) : ["books", "exam", "reads"].includes(catId) ? (
                    <div className="row">
                      <input className="input" placeholder="Edition / volumes" aria-label="Edition" value={specVal("Edition")} onChange={(e) => setSpec("Edition", e.target.value)} />
                      <input className="input" placeholder="Pages" aria-label="Pages" value={specVal("Pages")} onChange={(e) => setSpec("Pages", e.target.value)} />
                    </div>
                  ) : (
                    <>
                      <input className="input" placeholder="L × W × H, e.g. 60 × 40 × 95 cm" aria-label="Dimensions" value={specVal("Dimensions")} onChange={(e) => setSpec("Dimensions", e.target.value)} />
                      <div className="row">
                        <input className="input" placeholder="Weight, kg" aria-label="Weight" value={specVal("Weight")} onChange={(e) => setSpec("Weight", e.target.value)} />
                        <input className="input" placeholder="Capacity, L / GB" aria-label="Capacity" value={specVal("Capacity")} onChange={(e) => setSpec("Capacity", e.target.value)} />
                      </div>
                    </>
                  )}
                </div>
              )}

              {supplement && (
                <div className="row" style={{ gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div className="field" style={{ flex: 1, minWidth: 160 }}>
                    <span className="label">
                      <Icon name="shield" />
                      Seal
                    </span>
                    <div className="chips" role="radiogroup" aria-label="Seal status">
                      {SEAL_STATUSES.map((s) => (
                        <button key={s} type="button" role="radio" aria-checked={v.sealStatus === s} className={`chip ${v.sealStatus === s ? "on" : ""}`} onClick={() => setValue("sealStatus", s as never, { shouldValidate: true })}>
                          {s}
                        </button>
                      ))}
                    </div>
                    {err("sealStatus") && <span className="ferr" role="alert"><Icon name="alert" className="icon i14" />{err("sealStatus")}</span>}
                  </div>
                  <F id="f-expiresOn" label="Expiry date" icon="hourglass" error={err("expiresOn")}>
                    <input type="date" className={`input ${err("expiresOn") ? "bad" : ""}`} {...ids("expiresOn")} {...register("expiresOn")} />
                  </F>
                </div>
              )}
            </>
          )}

          {step === 3 && (
            <>
              {mode !== "drop" && (
                <div className="field">
                  <span className="label">
                    <Icon name="sparkles" />
                    Condition
                  </span>
                  <div className="chips" role="radiogroup" aria-label="Condition">
                    {CONDITIONS.map((c) => (
                      <button key={c} type="button" role="radio" aria-checked={v.condition === c} className={`chip ${v.condition === c ? "on" : ""}`} onClick={() => setValue("condition", c as never)}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <F
                id="f-description"
                label="Description"
                icon="edit"
                error={err("description")}
                hint={
                  <span className="fhint">
                    <span>What is included, any defects, when you are free</span>
                    <span className="cnt-txt">{String(v.description ?? "").length}/1000</span>
                  </span>
                }
              >
                <textarea className={`input ${err("description") ? "bad" : ""}`} placeholder="What is included, any defects, when you are free" maxLength={noValidate ? undefined : 1000} {...ids("description")} {...register("description")} />
              </F>
              {mode !== "drop" && (
                <>
                  <button type="button" className="between" style={{ width: "100%" }} role="switch" aria-checked={Boolean(v.isBundle)} onClick={() => setValue("isBundle", !v.isBundle as never)}>
                    <span className="row">
                      <Icon name="layers" />
                      This is a bundle
                    </span>
                    <span className={`sw ${v.isBundle ? "on" : ""}`} />
                  </button>
                  {Boolean(v.isBundle) && <textarea className="input" placeholder="What is included, one per line" aria-label="Bundle contents" {...register("bundleContents")} />}
                </>
              )}
              <div className="field">
                <span className="label">
                  <Icon name="eye" />
                  Preview
                </span>
                <div style={{ width: "min(60%, 240px)", pointerEvents: "none" }}>
                  <ProductCard l={preview} preview />
                </div>
              </div>
              <SpotPicker
                initialHostel={String(v.pickupHostel || viewer?.hostel || "SR 18")}
                initialLat={v.pickupLat ? Number(v.pickupLat) : null}
                initialLng={v.pickupLng ? Number(v.pickupLng) : null}
                initialNote={String(v.pickupNote || "")}
                onChange={({ hostel, lat, lng, note }) => {
                  setValue("pickupHostel", hostel as never);
                  setValue("pickupLat", lat as never);
                  setValue("pickupLng", lng as never);
                  setValue("pickupNote", note as never);
                }}
              />
              {edit && edit.history.length > 0 && (
                <div className="panel pad">
                  <h3 style={{ marginBottom: 6 }}>
                    <Icon name="clock" className="icon i16" /> Edit history
                  </h3>
                  {edit.history.slice(0, 6).map((h, i) => (
                    <div key={i} className="xs muted" style={{ padding: "3px 0" }}>
                      {ago(h.at)}: {h.changes}
                    </div>
                  ))}
                </div>
              )}
              {edit && (
                <div className="danger-zone">
                  <div>
                    <b>Delete this listing</b>
                    <span className="xs muted">It disappears from search. You can restore it for 30 days.</span>
                  </div>
                  <button type="button" className="btn sec danger-o small" onClick={() => setDelOpen(true)}>
                    <Icon name="trash" />
                    Delete listing
                  </button>
                </div>
              )}
            </>
          )}
        </form>
      </main>
      <div className="actbar">
        {step > 1 && (
          <button type="button" className="btn sec" onClick={() => (setStep((s) => (s - 1) as 1 | 2), window.scrollTo(0, 0))}>
            Back
          </button>
        )}
        <button type="button" className="btn" style={{ flex: 1 }} onClick={step < 3 ? next : submit} disabled={pending}>
          {pending ? <span className="spin" /> : step === 3 ? <Icon name="check" /> : null}
          {step < 3 ? "Continue" : edit ? "Save changes" : "Publish listing"}
        </button>
      </div>
      {edit && <DeleteDialog open={delOpen} onOpenChange={setDelOpen} listing={edit.card} bids={edit.bids} bookedAhead={edit.bookedAhead} afterDelete={() => router.push("/my-listings")} />}
    </>
  );
}
