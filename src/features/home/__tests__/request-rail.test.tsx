import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RequestRail } from "../request-rail";
import type { RequestItem } from "@/features/requests/queries";

vi.mock("@/features/requests/request-link", () => ({
  RequestLink: ({ href, children, className, ...rest }: any) => (
    <a href={href} className={className} {...rest}>
      {children}
    </a>
  ),
}));

describe("RequestRail Component", () => {
  const sampleRequests: RequestItem[] = [
    {
      id: "req-1",
      text: "Looking for Casio fx-991EX ClassWiz for Stats end-term exam",
      neededBy: new Date(Date.now() + 86400000 * 2).toISOString(),
      budget: "₹700 - ₹900",
      categoryId: "exam",
      author: {
        id: "user-1",
        name: "Sara Sharma",
        avatarUrl: null,
        avatarColor: "#02505F",
        hostel: "SR 07",
        plume: 15,
        ratedDeals: 2,
      },
      votes: 3,
      voted: false,
      replyCount: 1,
      status: "open",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "req-2",
      text: "Need a Yonex or Li-Ning badminton racquet for tonight",
      neededBy: new Date(Date.now() + 86400000 * 4).toISOString(),
      budget: "₹1,200 - ₹1,500",
      categoryId: "sports",
      author: {
        id: "user-2",
        name: "Lakshya V",
        avatarUrl: null,
        avatarColor: "#22c55e",
        hostel: "SR 12",
        plume: 8,
        ratedDeals: 1,
      },
      votes: 1,
      voted: false,
      replyCount: 0,
      status: "open",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  it("renders requests in horizontal rail with navigation arrows", () => {
    const html = renderToStaticMarkup(<RequestRail requests={sampleRequests} />);

    expect(html).toContain("People are looking for");
    expect(html).toContain('aria-label="Previous requests"');
    expect(html).toContain('aria-label="Next requests"');
    expect(html).toContain('class="hrail reqrail"');
    expect(html).toContain("Sara · SR 07");
    expect(html).toContain("Looking for Casio fx-991EX ClassWiz");
    expect(html).toContain("₹700 - ₹900");
    expect(html).toContain("Lakshya · SR 12");
    expect(html).toContain("I have this ›");
  });

  it("returns null when request list is empty", () => {
    const html = renderToStaticMarkup(<RequestRail requests={[]} />);
    expect(html).toBe("");
  });
});
