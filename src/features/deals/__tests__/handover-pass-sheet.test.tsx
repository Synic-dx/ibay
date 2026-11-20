import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Mock server actions to prevent loading next/server in vitest
vi.mock("@/features/deals/actions", () => ({
  getHandoverOtp: vi.fn(),
  regenerateHandoverOtp: vi.fn(),
  confirmHandoverTime: vi.fn(),
  rescheduleHandoverTime: vi.fn(),
}));

// Mock router
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/messages",
}));

// Mock Sheet to render inline during static markup test
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ open, title, subtitle, children }: any) =>
    open ? (
      <div data-testid="sheet">
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
        {children}
      </div>
    ) : null,
}));

import HandoverPassSheet from "../components/handover-pass-sheet";

describe("HandoverPassSheet", () => {
  const mockDeal = {
    id: "deal-123",
    amount: 1100,
    isBuyer: true,
    stage: 0,
    handoverScheduledAt: "2026-11-20T15:00:00.000Z",
    handoverStatus: "confirmed" as const,
    deliveryOtp: "192211",
  };

  const mockOther = {
    id: "seller-1",
    name: "Ujjwal Harsh",
  };

  const mockListing = {
    id: "listing-1",
    title: "Hush Puppies black oxford formal shoes",
    pickupHostel: "SR 18",
  };

  it("renders buyer handover pass with OTP display and link to deals page", () => {
    const html = renderToStaticMarkup(
      <HandoverPassSheet
        open={true}
        onOpenChange={vi.fn()}
        deal={mockDeal}
        other={mockOther}
        listing={mockListing}
      />
    );

    expect(html).toContain("Delivery Pickup Pass");
    expect(html).toContain("Hush Puppies");
    expect(html).toContain("1,100");
    expect(html).toContain("Open Full Deal Tracking");
  });

  it("renders seller verification view with CTA to enter code", () => {
    const sellerDeal = { ...mockDeal, isBuyer: false };
    const html = renderToStaticMarkup(
      <HandoverPassSheet
        open={true}
        onOpenChange={vi.fn()}
        deal={sellerDeal}
        other={mockOther}
        listing={mockListing}
      />
    );

    expect(html).toContain("Deal Verification &amp; Handover");
    expect(html).toContain("Enter Delivery Code on Deals Page");
    expect(html).toContain("Open Full Deal Tracking");
  });
});
