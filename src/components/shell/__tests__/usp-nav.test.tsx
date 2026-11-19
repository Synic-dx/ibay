import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { UspNavChips } from "../usp-nav";

// Mock next/navigation
let mockPathname = "/browse";
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}));

// Mock Link from @/components/ui/link
vi.mock("@/components/ui/link", () => ({
  default: ({ href, children, className, ...rest }: any) => (
    <a href={href} className={className} {...rest}>
      {children}
    </a>
  ),
}));

describe("UspNavChips", () => {
  it("renders all three USP links with correct hrefs", () => {
    mockPathname = "/";
    mockSearchParams = new URLSearchParams();

    const html = renderToStaticMarkup(<UspNavChips />);

    expect(html).toContain('href="/browse?modes=rent"');
    expect(html).toContain('href="/browse?modes=auction"');
    expect(html).toContain('href="/browse?cat=food"');
    expect(html).toContain("Rentals");
    expect(html).toContain("Auctions");
    expect(html).toContain("Food drops");
  });

  it("applies active state when browsing rentals", () => {
    mockPathname = "/browse";
    mockSearchParams = new URLSearchParams("modes=rent");

    const html = renderToStaticMarkup(<UspNavChips />);

    expect(html).toMatch(/href="\/browse\?modes=rent"[^>]*class="[^"]*\bon\b/);
    expect(html).not.toMatch(/href="\/browse\?modes=auction"[^>]*class="[^"]*\bon\b/);
  });

  it("applies active state when browsing auctions", () => {
    mockPathname = "/browse";
    mockSearchParams = new URLSearchParams("modes=auction");

    const html = renderToStaticMarkup(<UspNavChips />);

    expect(html).toMatch(/href="\/browse\?modes=auction"[^>]*class="[^"]*\bon\b/);
  });

  it("applies active state when browsing food drops", () => {
    mockPathname = "/browse";
    mockSearchParams = new URLSearchParams("cat=food");

    const html = renderToStaticMarkup(<UspNavChips />);

    expect(html).toMatch(/href="\/browse\?cat=food"[^>]*class="[^"]*\bon\b/);
  });

  it("contains SVG icons and zero emoji characters in rendered text", () => {
    const html = renderToStaticMarkup(<UspNavChips />);
    const svgCount = (html.match(/<svg/g) || []).length;
    expect(svgCount).toBeGreaterThanOrEqual(3);

    // Strip out HTML tags to inspect text content
    const textContent = html.replace(/<[^>]*>/g, "");
    const emojiRegex = /\p{Extended_Pictographic}/u;
    expect(emojiRegex.test(textContent)).toBe(false);
  });
});
