import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/features/deals/actions", () => ({
  advanceDeal: vi.fn(),
  rateDeal: vi.fn(),
  getHandoverOtp: vi.fn(),
  regenerateHandoverOtp: vi.fn(),
  confirmHandoverTime: vi.fn(),
  rescheduleHandoverTime: vi.fn(),
}));

vi.mock("@/features/chat/use-open-chat", () => ({
  useOpenChat: () => ({ open: vi.fn(), pending: false }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/deals",
}));

vi.mock("@/components/app-context", () => ({
  useApp: () => ({ viewer: { id: "buyer-1", name: "Buyer User", hostel: "SR 18" }, openAuth: vi.fn() }),
}));

vi.mock("@/features/map/components/handover-card", () => ({
  default: () => <div data-testid="handover-card" />,
}));

import { DealsView } from "../deals-view";
import type { Deal } from "../stages";

describe("DealsView chat button navigation", () => {
  const sampleDeal: Deal = {
    id: "deal-calculator-1",
    kind: "rental",
    role: "buyer",
    amount: 60,
    stage: 0,
    createdAt: new Date().toISOString(),
    listing: {
      id: "listing-calc",
      title: "Casio FC-200V financial calculator",
      price: 60,
      mode: "rent",
      categoryId: "calculators",
      status: "active",
      pickupHostel: "SR 03",
      seller: { id: "seller-1", name: "Karthik Madhu", plume: 10, ratedDeals: 5, hostel: "SR 03", avatarUrl: null, avatarColor: "emerald", responseNote: "Quick" },
      mrp: null,
      rentUnit: "day",
      reservePrice: null,
      buyNowPrice: null,
      endsAt: null,
      purchasedOn: null,
      condition: "like_new",
      photo: null,
      ticketInfo: [],
      isBundle: false,
      bundleCount: 0,
      bidCount: 0,
      priceDropAmount: null,
      priceDroppedAt: null,
    } as unknown as Deal["listing"],
    other: { id: "seller-1", name: "Karthik Madhu", plume: 10, ratedDeals: 5, hostel: "SR 03" },
    myRating: null,
    conversationId: "conv-1234-abcd",
  };

  it("renders a direct link to the chat thread with transactionId parameter", () => {
    const html = renderToStaticMarkup(<DealsView deals={[sampleDeal]} tab="all" />);
    expect(html).toContain('href="/messages/conv-1234-abcd?deal=deal-calculator-1"');
    expect(html).toContain('aria-label="Chat with Karthik Madhu"');
  });

  it("falls back to /messages if conversationId is not yet established", () => {
    const dealWithoutConv: Deal = {
      ...sampleDeal,
      id: "deal-calculator-2",
      conversationId: null,
    };
    const html = renderToStaticMarkup(<DealsView deals={[dealWithoutConv]} tab="all" />);
    expect(html).toContain('href="/messages"');
  });
});
