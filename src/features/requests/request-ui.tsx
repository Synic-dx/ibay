"use client";
/**
 * FEATURE: Requests UI [RUBRIC:CRUD-CREATE] [RUBRIC:CRUD-UPDATE] [RUBRIC:VALIDATION-CLIENT]
 * RequestSheet  post or edit a request: text (5 to 120), category, budget
 *               (up to 40), needed-by chips (today to +30 days)
 * VoteButton    "I need this too"
 * ReplySheet    "I have this": description, price, optional photo
 * OwnerBar      Edit / Found it / Delete (confirm + Undo) for the request owner
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { useApp } from "@/components/app-context";
import { useNoValidate } from "@/lib/hooks/use-novalidate";
import { dayLabel, istDay } from "@/lib/format";
import { requestSchema, type RequestInput } from "@/lib/validation/market";
import { uploadPhoto } from "@/features/listings/upload-client";
import { createRequest, deleteRequest, replyToRequest, restoreRequest, setRequestFound, updateRequest, voteRequest } from "./actions";

const ymd = (o: number) => istDay(o).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export function RequestSheet({
  open,
  onOpenChange,
  categories,
  initial,
  editId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categories: { id: string; name: string }[];
  initial?: Partial<RequestInput>;
  editId?: string;
}) {
  const router = useRouter();
  const noValidate = useNoValidate();
  const [pending, start] = useTransition();
  const form = useForm<RequestInput>({
    resolver: noValidate ? undefined : zodResolver(requestSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: { text: "", categoryId: "preprocess", budget: "", neededBy: "", ...initial },
  });
  const { register, handleSubmit, formState, watch, setValue, setError } = form;
  const e = formState.errors;
  const need = watch("neededBy");
  const text = watch("text") ?? "";

  const onSubmit = handleSubmit((v) =>
    start(async () => {
      const r = editId ? await updateRequest(editId, v) : await createRequest(v);
      if (!r.ok) {
        for (const [k, m] of Object.entries(r.fieldErrors ?? {})) {
          setError(k as keyof RequestInput, { message: m });
        }
        if (!r.fieldErrors) toast.error(r.formError);
        return;
      }
      toast(r.message);
      onOpenChange(false);
      form.reset();
      if (!editId && r.data && "id" in (r.data as object)) router.push(`/requests/${(r.data as { id: string }).id}`);
      router.refresh();
    }),
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange} icon="list" title={editId ? "Edit your request" : "I am looking for a..."} subtitle="People who have it reply with a photo and price">
      <form className="stack" style={{ gap: 14 }} onSubmit={onSubmit} noValidate>
        <div className="field">
          <label className="label" htmlFor="rq-text">
            <Icon name="search" />
            What do you need?
          </label>
          <input id="rq-text" className={`input ${e.text ? "bad" : ""}`} placeholder="e.g. orange kurta, size M" aria-invalid={!!e.text} aria-describedby={e.text ? "rq-text-err" : undefined} maxLength={noValidate ? undefined : 120} {...register("text")} />
          <span className="fhint">
            <span />
            <span className="cnt-txt">{text.length}/120</span>
          </span>
          {e.text && (
            <span className="ferr" role="alert" id="rq-text-err">
              <Icon name="alert" className="icon i14" />
              {e.text.message}
            </span>
          )}
        </div>
        <div className="field">
          <label className="label" htmlFor="rq-cat">
            <Icon name="grid" />
            Category
          </label>
          <select id="rq-cat" className="input" {...register("categoryId")}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="rq-budget">
            <Icon name="rupee" />
            Budget
          </label>
          <input id="rq-budget" className={`input ${e.budget ? "bad" : ""}`} placeholder="e.g. Rent up to ₹200/day" aria-invalid={!!e.budget} maxLength={noValidate ? undefined : 40} {...register("budget")} />
          {e.budget && (
            <span className="ferr" role="alert">
              <Icon name="alert" className="icon i14" />
              {e.budget.message}
            </span>
          )}
        </div>
        <div className="field">
          <span className="label">
            <Icon name="cal" />
            Needed by
          </span>
          <div className="chips" role="radiogroup" aria-label="Needed by">
            {[null, 0, 1, 2, 3, 6].map((o) => {
              const val = o == null ? "" : ymd(o);
              return (
                <button key={String(o)} type="button" role="radio" aria-checked={(need ?? "") === val} className={`chip ${(need ?? "") === val ? "on" : ""}`} onClick={() => setValue("neededBy", val, { shouldValidate: true })}>
                  {o == null ? "No rush" : dayLabel(o, true)}
                </button>
              );
            })}
            <input type="date" className="input" style={{ width: "auto", minHeight: 36, padding: "4px 10px", fontSize: 14 }} aria-label="Pick a date" value={need ?? ""} onChange={(ev) => setValue("neededBy", ev.target.value, { shouldValidate: true })} />
          </div>
          {e.neededBy && (
            <span className="ferr" role="alert">
              <Icon name="alert" className="icon i14" />
              {e.neededBy.message}
            </span>
          )}
        </div>
        <button className="btn block" type="submit" disabled={pending}>
          {pending ? <span className="spin" /> : <Icon name="send" />}
          {editId ? "Save changes" : "Post request"}
        </button>
      </form>
    </Sheet>
  );
}

export function VoteButton({ id, votes, voted }: { id: string; votes: number; voted: boolean }) {
  const { viewer, openAuth } = useApp();
  const router = useRouter();
  const [on, setOn] = useState(voted);
  const [n, setN] = useState(votes);
  const [, start] = useTransition();
  return (
    <div className="vote">
      <button
        type="button"
        className={on ? "on" : ""}
        aria-pressed={on}
        aria-label="I need this too"
        onClick={() => {
          if (!viewer) return openAuth({ reason: "Sign in to upvote requests" });
          setOn(!on);
          setN(n + (on ? -1 : 1));
          start(async () => {
            const r = await voteRequest(id);
            if (!r.ok) {
              setOn(on);
              setN(n);
              toast.error(r.formError);
            }
            router.refresh();
          });
        }}
      >
        <Icon name="up" />
      </button>
      {n}
      <small>need it</small>
    </div>
  );
}

export function ReplySheet({ open, onOpenChange, requestId, requestText }: { open: boolean; onOpenChange: (v: boolean) => void; requestId: string; requestText: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [price, setPrice] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();
  const send = () =>
    start(async () => {
      if (text.trim().length < 2) return setErrs({ text: "Add a short description." });
      const r = await replyToRequest(requestId, { text, priceText: price, imageUrl: photo ?? undefined });
      if (!r.ok) return setErrs(r.fieldErrors ?? { form: r.formError ?? "" });
      toast(r.message);
      onOpenChange(false);
      setText("");
      setPrice("");
      setPhoto(null);
      router.refresh();
    });
  return (
    <Sheet open={open} onOpenChange={onOpenChange} icon="img" title="I have this" subtitle={`For: ${requestText}`}>
      <div className="stack" style={{ gap: 14 }}>
        <div className="field">
          <textarea className={`input ${errs.text ? "bad" : ""}`} placeholder="Size, colour, condition, where to pick up" aria-label="Description" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} aria-invalid={!!errs.text} />
          {errs.text && <span className="ferr" role="alert"><Icon name="alert" className="icon i14" />{errs.text}</span>}
        </div>
        <div className="row">
          <input className="input" placeholder="Price, e.g. ₹150/day" aria-label="Price" value={price} onChange={(e) => setPrice(e.target.value)} maxLength={40} />
          <label className="sqbtn" style={{ cursor: "pointer" }} aria-label="Add a photo">
            {busy ? <span className="spin" /> : <Icon name="camera" />}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setBusy(true);
                const r = await uploadPhoto(f);
                setBusy(false);
                if ("error" in r) toast.error(r.error);
                else setPhoto(r.url);
              }}
            />
          </label>
        </div>
        {photo && <span className="faint xs">Photo added.</span>}
        {errs.form && <div className="formerr" role="alert">{errs.form}</div>}
        <button type="button" className="btn block" onClick={send} disabled={pending || busy}>
          <Icon name="send" />
          Send offer
        </button>
      </div>
    </Sheet>
  );
}

export function OwnerBar({ id, status, categories, initial }: { id: string; status: string; categories: { id: string; name: string }[]; initial: Partial<RequestInput> }) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [del, setDel] = useState(false);
  const [pending, start] = useTransition();
  const found = () =>
    start(async () => {
      const r = await setRequestFound(id, status !== "found");
      if (r.ok) toast(r.message);
      router.refresh();
    });
  const remove = () =>
    start(async () => {
      const r = await deleteRequest(id);
      if (!r.ok) return void toast.error(r.formError);
      setDel(false);
      toast("Request deleted", { duration: 10_000, action: { label: "Undo", onClick: async () => (await restoreRequest(id), router.push(`/requests/${id}`), router.refresh()) } });
      router.push("/requests");
    });
  return (
    <>
      <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
        <button type="button" className="btn sec small" onClick={() => setEdit(true)}>
          <Icon name="edit" />
          Edit
        </button>
        <button type="button" className="btn sec small" onClick={found} disabled={pending}>
          <Icon name={status === "found" ? "undo" : "check"} />
          {status === "found" ? "Reopen" : "Found it"}
        </button>
        <button type="button" className="btn sec small danger-o" onClick={() => setDel(true)}>
          <Icon name="trash" />
          Delete
        </button>
      </div>
      <RequestSheet open={edit} onOpenChange={setEdit} categories={categories} initial={initial} editId={id} />
      <Sheet open={del} onOpenChange={setDel} icon="trash" title="Delete this request?" subtitle={String(initial.text ?? "")}>
        <div className="stack" style={{ gap: 12 }}>
          <ul className="bullets sm">
            <li>It disappears from the requests board right away.</li>
            <li>People who replied keep their chats with you.</li>
            <li>You can undo for 10 seconds.</li>
          </ul>
          <div className="row">
            <button type="button" className="btn sec" style={{ flex: 1 }} onClick={() => setDel(false)}>
              Cancel
            </button>
            <button type="button" className="btn danger" style={{ flex: 1 }} onClick={remove} disabled={pending}>
              <Icon name="trash" />
              Delete
            </button>
          </div>
        </div>
      </Sheet>
    </>
  );
}

/** "I am looking for a..." button that opens the composer (opens itself with ?new=1). */
export function NewRequestButton({ categories, autoOpen, initialText }: { categories: { id: string; name: string }[]; autoOpen: boolean; initialText?: string }) {
  const [open, setOpen] = useState(autoOpen);
  return (
    <>
      <button type="button" className="panel row" style={{ padding: "12px 14px", width: "100%", textAlign: "left" }} onClick={() => setOpen(true)}>
        <Icon name="plus" />
        <span className="input" style={{ display: "flex", alignItems: "center", color: "var(--ink-3)" }}>
          I am looking for a...
        </span>
      </button>
      <RequestSheet open={open} onOpenChange={setOpen} categories={categories} initial={initialText ? { text: initialText } : undefined} />
    </>
  );
}
