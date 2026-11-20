import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChatDealBar } from "../components/chat-deal-bar";

describe("ChatDealBar", () => {
  it("renders agreed deal amount and View Pass button for buyer", () => {
    const deal = {
      id: "deal-1",
      amount: 1100,
      isBuyer: true,
      stage: 0,
      handoverScheduledAt: null,
    };
    const html = renderToStaticMarkup(
      <ChatDealBar deal={deal} onOpenPass={vi.fn()} compact={true} />
    );
    expect(html).toContain("Deal agreed");
    expect(html).toContain("1,100");
    expect(html).toContain("View Pass");
  });

  it("renders Verify Deal button for seller", () => {
    const deal = {
      id: "deal-2",
      amount: 1100,
      isBuyer: false,
      stage: 0,
      handoverScheduledAt: null,
    };
    const html = renderToStaticMarkup(
      <ChatDealBar deal={deal} onOpenPass={vi.fn()} compact={true} />
    );
    expect(html).toContain("Deal agreed");
    expect(html).toContain("Verify Deal");
  });

  it("formats scheduled handover time cleanly in the single-line bar", () => {
    const deal = {
      id: "deal-3",
      amount: 1100,
      isBuyer: true,
      stage: 0,
      handoverScheduledAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      handoverStatus: "confirmed" as const,
    };
    const html = renderToStaticMarkup(
      <ChatDealBar deal={deal} onOpenPass={vi.fn()} compact={true} />
    );
    expect(html).toContain("Handover");
    expect(html).toContain("View Pass");
    expect(html).toContain("calendar.google.com");
    expect(html).toContain("Add to Google Calendar");
  });
});
