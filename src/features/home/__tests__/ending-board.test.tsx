import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
}));

vi.mock("@/components/app-context", () => ({
  useApp: () => ({
    viewer: { id: "user-ujjwal", name: "Ujjwal Harsh", hostel: "SR 18" },
    openAuth: vi.fn(),
  }),
}));

vi.mock("@/components/ui/link", () => ({
  default: ({ href, children, className, ...rest }: any) => (
    <a href={href} className={className} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/features/drops/actions", () => ({
  claimDrop: vi.fn(),
}));

import { EndingBoard } from "../ending-board";
import type { ListingCard } from "@/features/listings/types";

describe("EndingBoard Food Drops Component", () => {
  const ownDrop: Partial<ListingCard> = {
    id: "drop-own-1",
    title: "Veg Noodles",
    price: 0,
    mode: "drop",
    status: "active",
    pickupHostel: "SR 18",
    endsAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    seller: {
      id: "user-ujjwal",
      name: "Ujjwal Harsh",
      plume: 10,
      ratedDeals: 3,
      hostel: "SR 18",
      avatarUrl: null,
      avatarColor: "emerald",
      responseNote: "Quick",
    },
    photo: null,
  };

  const otherDrop: Partial<ListingCard> = {
    id: "drop-other-2",
    title: "Hot samosas (box of 4)",
    price: 0,
    mode: "drop",
    status: "active",
    pickupHostel: "SR 18",
    endsAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    seller: {
      id: "user-karthik",
      name: "Karthik Madhu",
      plume: 12,
      ratedDeals: 5,
      hostel: "SR 18",
      avatarUrl: null,
      avatarColor: "indigo",
      responseNote: "Fast",
    },
    photo: null,
  };

  it("renders both own drop with 'Your drop' and other drop with 'Claim'", () => {
    const html = renderToStaticMarkup(
      <EndingBoard
        drops={[ownDrop as ListingCard, otherDrop as ListingCard]}
        auctions={[]}
        allDrops={6}
      />
    );

    // Header matches viewer's hostel
    expect(html).toContain("Food drops in SR 18");
    expect(html).toContain("2 live · only people in SR 18 can see these · 4 more in other hostels");

    // Own drop displays "Your drop" link
    expect(html).toContain("Veg Noodles");
    expect(html).toContain('href="/item/drop-own-1"');
    expect(html).toContain("Your drop");

    // Other student's drop displays "Claim" button
    expect(html).toContain("Hot samosas (box of 4)");
    expect(html).toContain("Claim");
  });
});
