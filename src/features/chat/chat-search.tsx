"use client";
/** FEATURE: Filter the chat list by name (client-side, instant). */
import { Icon } from "@/components/ui/icon";

export function ChatSearch() {
  return (
    <div className="iwrap" style={{ margin: "4px 14px 8px" }}>
      <Icon name="search" className="icon i18" />
      <input
        name="q"
        type="search"
        className="input"
        style={{ minHeight: 42, paddingTop: 8, paddingBottom: 8 }}
        placeholder="Search chats…"
        aria-label="Search chats"
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => {
          const v = e.target.value.toLowerCase();
          document.querySelectorAll<HTMLElement>(".thr").forEach((el) => (el.style.display = (el.dataset.n ?? "").includes(v) ? "" : "none"));
        }}
      />
    </div>
  );
}
