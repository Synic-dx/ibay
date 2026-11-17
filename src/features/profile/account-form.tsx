"use client";
/**
 * FEATURE: Account settings (profile read + update, delete my account) [RUBRIC:CRUD-UPDATE] [RUBRIC:CRUD-DELETE]
 * WHAT: Photo, display name, hostel, room, WhatsApp (shown only to people you
 *       chat with, if you allow it), email notification toggles, and
 *       "Delete my account" which needs DELETE typed in capitals.
 * VALIDATION: the same profileSchema in the browser and in updateProfile().
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/brand";
import { Sheet } from "@/components/ui/sheet";
import { useNoValidate } from "@/lib/hooks/use-novalidate";
import { HOSTELS, profileSchema, type ProfileInput } from "@/lib/validation/auth";
import { uploadPhoto } from "@/features/listings/upload-client";
import { deleteMyAccount, setAvatar, setNotifyPref, updateProfile } from "./actions";

type Me = { name: string; hostel: string; room: string | null; whatsapp: string | null; showWhatsapp: boolean; avatarUrl: string | null; avatarColor: string; notifyPrefs: Record<string, boolean> };

const PREFS: [string, string][] = [
  ["email", "Email me as well as the bell"],
  ["outbid", "Someone outbids me"],
  ["offers", "Offers and replies in chat"],
  ["requests", "Replies to my requests"],
  ["drops", "Food drops in my hostel"],
  ["price_drops", "Price drops on saved items"],
  ["returns", "Rental return reminders"],
  ["ratings", "New ratings"],
];

export function AccountForm({ me }: { me: Me }) {
  const router = useRouter();
  const noValidate = useNoValidate();
  const [pending, start] = useTransition();
  const [prefs, setPrefs] = useState(me.notifyPrefs);
  const [del, setDel] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [delErr, setDelErr] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const form = useForm<ProfileInput>({
    resolver: noValidate ? undefined : zodResolver(profileSchema) as never,
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: { name: me.name, hostel: me.hostel as ProfileInput["hostel"], room: me.room ?? "", whatsapp: me.whatsapp ?? "", showWhatsapp: me.showWhatsapp },
  });
  const { register, handleSubmit, formState, watch, setValue, setError } = form;
  const e = formState.errors;
  const hostel = watch("hostel");
  const show = watch("showWhatsapp");

  const save = handleSubmit(
    (v) =>
      start(async () => {
        const r = await updateProfile(v);
        if (!r.ok) {
          for (const [k, m] of Object.entries(r.fieldErrors ?? {})) setError(k as keyof ProfileInput, { message: m });
          if (!r.fieldErrors) toast.error(r.formError);
          return;
        }
        toast("Saved");
        router.refresh();
      }),
    () => toast("Please fix the highlighted fields"),
  );

  const err = (k: keyof ProfileInput) =>
    e[k] ? (
      <span className="ferr" role="alert" id={`a-${k}-err`}>
        <Icon name="alert" className="icon i14" />
        {e[k]?.message as string}
      </span>
    ) : null;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <form className="stack" style={{ gap: 16 }} onSubmit={save} noValidate>
        <div className="row" style={{ gap: 14 }}>
          <Avatar name={me.name} url={me.avatarUrl} color={me.avatarColor} size={72} />
          <label className="btn sec small" style={{ cursor: "pointer" }}>
            {photoBusy ? <span className="spin" /> : <Icon name="camera" />}
            Change photo
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={async (ev) => {
                const f = ev.target.files?.[0];
                if (!f) return;
                setPhotoBusy(true);
                const r = await uploadPhoto(f);
                if ("error" in r) {
                  toast.error(r.error);
                  setPhotoBusy(false);
                  return;
                }
                const s = await setAvatar(r.url, r.publicId);
                setPhotoBusy(false);
                toast(s.ok ? "Photo updated" : (s.formError ?? "Failed"));
                router.refresh();
              }}
            />
          </label>
        </div>
        <div className="field">
          <label className="label" htmlFor="a-name">
            <Icon name="user" />
            Display name
          </label>
          <input id="a-name" className={`input ${e.name ? "bad" : ""}`} aria-invalid={!!e.name} aria-describedby={e.name ? "a-name-err" : undefined} {...register("name")} />
          {err("name")}
        </div>
        <div className="field">
          <span className="label">
            <Icon name="bed" />
            Hostel
          </span>
          <div className="chips" role="radiogroup" aria-label="Hostel">
            {HOSTELS.map((h) => (
              <button key={h} type="button" role="radio" aria-checked={hostel === h} className={`chip ${hostel === h ? "on" : ""}`} onClick={() => setValue("hostel", h, { shouldValidate: true })}>
                {h}
              </button>
            ))}
          </div>
          {err("hostel")}
        </div>
        <div className="field">
          <label className="label" htmlFor="a-room">
            <Icon name="key" />
            Room
          </label>
          <input id="a-room" className={`input ${e.room ? "bad" : ""}`} placeholder="e.g. 212 or B204" aria-invalid={!!e.room} aria-describedby={e.room ? "a-room-err" : undefined} {...register("room")} />
          {err("room")}
        </div>
        <div className="field">
          <label className="label" htmlFor="a-wa">
            <Icon name="chat" />
            WhatsApp
          </label>
          <input id="a-wa" type="tel" className={`input ${e.whatsapp ? "bad" : ""}`} placeholder="+91" aria-invalid={!!e.whatsapp} aria-describedby={e.whatsapp ? "a-whatsapp-err" : "a-wa-hint"} {...register("whatsapp")} />
          <span className="xs faint" id="a-wa-hint">
            Only shown to people you are already chatting with.
          </span>
          {err("whatsapp")}
        </div>
        <button type="button" className="between" style={{ width: "100%" }} role="switch" aria-checked={show} onClick={() => setValue("showWhatsapp", !show)}>
          <span className="row">
            <Icon name="eye" />
            Show my WhatsApp in chats
          </span>
          <span className={`sw ${show ? "on" : ""}`} />
        </button>
        <button className="btn block" type="submit" disabled={pending}>
          {pending ? <span className="spin" /> : null}Save changes
        </button>
      </form>

      <div className="sh" style={{ marginTop: 10 }}>
        <h2>
          <Icon name="bell" />
          Notifications
        </h2>
      </div>
      <div className="lgroup">
        {PREFS.map(([k, n]) => {
          const on = prefs[k] !== false;
          return (
            <button
              key={k}
              type="button"
              className="lrow"
              role="switch"
              aria-checked={on}
              onClick={() => {
                setPrefs({ ...prefs, [k]: !on });
                start(async () => void (await setNotifyPref(k, !on)));
              }}
            >
              <span className="lt">
                <b>{n}</b>
              </span>
              <span className={`sw ${on ? "on" : ""}`} />
            </button>
          );
        })}
      </div>

      <div className="danger-zone" style={{ marginTop: 10 }}>
        <div>
          <b>Delete my account</b>
          <span className="xs muted">Your listings are removed. Reviews stay but show &quot;Deleted user&quot;.</span>
        </div>
        <button type="button" className="btn sec danger-o small" onClick={() => setDel(true)}>
          <Icon name="trash" />
          Delete
        </button>
      </div>
      <Sheet open={del} onOpenChange={setDel} icon="alert" title="Delete your account?" subtitle="This can't be undone">
        <div className="stack" style={{ gap: 12 }}>
          <ul className="bullets sm">
            <li>All your listings disappear from i-bay.</li>
            <li>Reviews you gave and received stay, with your name replaced by &quot;Deleted user&quot;.</li>
            <li>You are signed out everywhere.</li>
          </ul>
          <label className="label" htmlFor="del-confirm">
            Type DELETE to confirm
          </label>
          <input id="del-confirm" className={`input ${delErr ? "bad" : ""}`} value={confirm} onChange={(ev) => (setConfirm(ev.target.value), setDelErr(null))} autoComplete="off" aria-invalid={!!delErr} />
          {delErr && <span className="ferr" role="alert"><Icon name="alert" className="icon i14" />{delErr}</span>}
          <button
            type="button"
            className="btn danger block"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await deleteMyAccount({ confirm });
                if (!r.ok) return setDelErr(r.fieldErrors?.confirm ?? r.formError ?? "Couldn't delete.");
                toast(r.message);
                window.location.href = "/";
              })
            }
          >
            Delete my account
          </button>
        </div>
      </Sheet>
    </div>
  );
}
