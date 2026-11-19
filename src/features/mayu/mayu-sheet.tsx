"use client";
/**
 * FEATURE: Mayu chat sheet + launcher button [RUBRIC:EXTRA]
 * WHAT: The round peacock button (bottom right; 60px on desktop) opens a tall
 *       sheet. Answers stream in; listing cards are real tool results.
 */
import Link from "@/components/ui/link";
import { usePathname } from "next/navigation";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { Peacock } from "@/components/brand";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { useApp } from "@/components/app-context";
import { ageMonths, ageText, fmt } from "@/lib/format";
import { PhotoTile, hasAge, priceText } from "@/features/listings/components/parts";
import type { ListingCard } from "@/features/listings/types";

type Msg = { role: "user" | "assistant"; content: string; cards?: ListingCard[]; typing?: boolean };

const SUGGEST = ["Cheapest fx-991ES", "Yonex racquets", "One Piece manga", "How does Plume work?"];
const SHOW_ON = [/^\/$/, /^\/explore/, /^\/browse/, /^\/requests$/, /^\/you/, /^\/saved/];

/** Renders **bold** from the answer text safely (no HTML from the model). */
function Rich({ text }: { text: unknown }) {
  if (!text) return null;
  const safeText = typeof text === "string" ? text : typeof text === "object" && text !== null ? JSON.stringify(text) : String(text ?? "");
  return (
    <>
      {safeText.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>))}
    </>
  );
}

class MayuMessagesErrorBoundary extends Component<{ children: ReactNode; onReset: () => void }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; onReset: () => void }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("[Mayu] Handled error in messages area:", error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, textAlign: "center" }}>
          <p className="sm faint">Mayu had trouble displaying that response.</p>
          <button
            type="button"
            className="btn sec"
            onClick={() => {
              this.setState({ hasError: false });
              this.props.onReset();
            }}
          >
            Clear and ask again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function MiniCard({ l, onClose }: { l: ListingCard; onClose: () => void }) {
  if (!l || !l.id) return null;
  const title = l.title ?? "Listing";
  const price = priceText(l);
  let age = "";
  try {
    age = hasAge(l) ? ageText(ageMonths(l.purchasedOn)) : (l.pickupHostel ?? "");
  } catch {
    age = l.pickupHostel ?? "";
  }
  return (
    <Link className="mini" href={`/item/${l.id}`} onClick={onClose} prefetch={false}>
      <PhotoTile l={l} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="sm" style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {title}
        </span>
        <b>{price}</b>
        {l.mrp ? <span className="mrp">{fmt(l.mrp)}</span> : null}{" "}
        {age ? <span className="faint xs">· {age}</span> : null}
      </span>
    </Link>
  );
}

class MayuRootErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: unknown) {
    console.error("[Mayu] Handled error in launcher:", error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <button
          type="button"
          className="mayu"
          aria-label="Ask Mayu, the shopping assistant"
          onClick={() => this.setState({ hasError: false })}
        >
          <Peacock size={40} />
        </button>
      );
    }
    return this.props.children;
  }
}

function MayuLauncherInner() {
  const { mayuOpen, setMayuOpen } = useApp();
  const path = usePathname();
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", content: 'Hi, I am **Mayu**! Tell me what you need. Try "cheapest fx-991ES" or "Yonex racquets".' }]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try {
      end.current?.scrollIntoView({ block: "end" });
    } catch {
      // scrollIntoView unsupported or failed silently
    }
  }, [msgs]);

  const ask = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    setQ("");
    setBusy(true);
    const history: Msg[] = [...msgs.filter((m) => !m.typing), { role: "user", content: question }];
    setMsgs([...history, { role: "assistant", content: "", typing: true }]);
    try {
      const res = await fetch("/api/mayu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.slice(-10).map(({ role, content }) => ({ role, content })) }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        const errMsg =
          typeof data?.error === "string"
            ? data.error
            : typeof data?.error?.message === "string"
              ? data.error.message
              : typeof data?.message === "string"
                ? data.message
                : "Mayu couldn't answer right now. Please try again.";
        setMsgs([...history, { role: "assistant", content: errMsg }]);
        return;
      }
      // Read the newline-delimited JSON stream piece by piece.
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let content = "";
      let cards: ListingCard[] = [];
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const ev = JSON.parse(line) as { t: string; v?: unknown };
            if (ev.t === "text" && typeof ev.v === "string") content += ev.v;
            if (ev.t === "cards" && Array.isArray(ev.v)) cards = ev.v as ListingCard[];
            setMsgs([...history, { role: "assistant", content, cards, typing: !content }]);
          } catch (e) {
            console.warn("[Mayu] Error parsing line:", e);
          }
        }
      }
      if (buf.trim()) {
        try {
          const ev = JSON.parse(buf) as { t: string; v?: unknown };
          if (ev.t === "text" && typeof ev.v === "string") content += ev.v;
          if (ev.t === "cards" && Array.isArray(ev.v)) cards = ev.v as ListingCard[];
        } catch {
          // ignore trailing invalid JSON fragment
        }
      }
      // Ensure stream completion marks typing as done
      setMsgs([...history, { role: "assistant", content: content || "Here is what I found:", cards, typing: false }]);
    } catch {
      setMsgs([...history, { role: "assistant", content: "Mayu couldn't answer right now. Try again." }]);
    } finally {
      setBusy(false);
    }
  };

  const show = SHOW_ON.some((re) => re.test(path));
  return (
    <>
      {show && !mayuOpen && (
        <button type="button" className="mayu" aria-label="Ask Mayu, the shopping assistant" onClick={() => setMayuOpen(true)}>
          <Peacock size={40} />
        </button>
      )}
      <Sheet open={mayuOpen} onOpenChange={setMayuOpen} tall title="Mayu" subtitle="Finds things on i-bay · Gemini">
        <MayuMessagesErrorBoundary
          onReset={() =>
            setMsgs([
              {
                role: "assistant",
                content: 'Hi, I am **Mayu**! Tell me what you need. Try "cheapest fx-991ES" or "Yonex racquets".',
              },
            ])
          }
        >
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingBottom: 10 }} aria-live="polite">
            {msgs.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="bm me">
                  {m.content}
                </div>
              ) : m.typing && !m.content ? (
                <div key={i} className="bm them typing" aria-label="Mayu is typing">
                  <span />
                  <span />
                  <span />
                </div>
              ) : (
                <div key={i} className="bm them">
                  <Rich text={m.content} />
                  {(m.cards ?? []).map((l) => (
                    <MiniCard key={l.id} l={l} onClose={() => setMayuOpen(false)} />
                  ))}
                </div>
              ),
            )}
            <div ref={end} />
          </div>
        </MayuMessagesErrorBoundary>
        <div style={{ padding: "8px 0 calc(12px + var(--safe-b))", borderTop: "1px solid var(--line)" }}>
          <div className="qr">
            {SUGGEST.map((s) => (
              <button key={s} type="button" onClick={() => ask(s)}>
                {s}
              </button>
            ))}
          </div>
          <form
            className="cin"
            onSubmit={(e) => {
              e.preventDefault();
              ask(q);
            }}
          >
            <input
              name="query"
              placeholder="Ask Mayu to find something…"
              aria-label="Ask Mayu"
              autoComplete="off"
              spellCheck={false}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              maxLength={500}
            />
            <button className="rb send" type="submit" aria-label={busy ? "Sending…" : "Send"} disabled={busy}>
              {busy ? <span className="spin" /> : <Icon name="send" />}
            </button>
          </form>
        </div>
      </Sheet>
    </>
  );
}

export function MayuLauncher() {
  return (
    <MayuRootErrorBoundary>
      <MayuLauncherInner />
    </MayuRootErrorBoundary>
  );
}
