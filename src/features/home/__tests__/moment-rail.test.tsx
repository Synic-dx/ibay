import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MomentRail, type MomentCardData } from "../moment-rail";

// Mock Link
vi.mock("@/components/ui/link", () => ({
  default: ({ href, children, className, ...rest }: any) => (
    <a href={href} className={className} {...rest}>
      {children}
    </a>
  ),
}));

describe("MomentRail Component", () => {
  const sampleMoments: MomentCardData[] = [
    {
      id: "freshers",
      name: "Freshers' starter kit",
      count: 10,
      previews: [
        { id: "item-1", url: "/img/kettle.webp", cover: false },
        { id: "item-2", url: "/img/lamp.webp", cover: true },
      ],
    },
    {
      id: "moveout",
      name: "Move-out sale",
      count: 7,
      previews: [{ id: "item-3", url: "/img/curtain.webp", cover: false }],
    },
  ];

  it("renders collections in a single horizontal rail with navigation arrows", () => {
    const html = renderToStaticMarkup(<MomentRail moments={sampleMoments} />);

    // Section title
    expect(html).toContain("Shop by moment");

    // Previous and Next navigation arrow buttons
    expect(html).toContain('aria-label="Previous moments"');
    expect(html).toContain('aria-label="Next moments"');

    // Rail container with moment-rail class
    expect(html).toContain('class="hrail moment-rail"');
    expect(html).toContain('role="region"');

    // Collection cards
    expect(html).toContain("Freshers&#x27; starter kit");
    expect(html).toContain("10 items");
    expect(html).toContain("Move-out sale");
    expect(html).toContain("7 items");

    // Collection links
    expect(html).toContain('href="/browse?coll=freshers"');
    expect(html).toContain('href="/browse?coll=moveout"');
  });

  it("returns null when moments array is empty", () => {
    const html = renderToStaticMarkup(<MomentRail moments={[]} />);
    expect(html).toBe("");
  });
});
