import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Logo, Wordmark } from "../brand";

describe("Brand Components", () => {
  it("renders official Logo SVG with default size and colors", () => {
    const html = renderToStaticMarkup(<Logo />);
    expect(html).toContain('width="32"');
    expect(html).toContain('height="32"');
    expect(html).toContain('viewBox="0 0 64 64"');
    expect(html).toContain('fill="#02505F"');
    expect(html).toContain('fill="#1FC9B2"');
    expect(html).toContain(">i</text>");
  });

  it("renders custom size Logo correctly", () => {
    const html = renderToStaticMarkup(<Logo size={44} className="test-logo" />);
    expect(html).toContain('width="44"');
    expect(html).toContain('height="44"');
    expect(html).toContain('class="test-logo"');
  });

  it("renders Wordmark with all brand letters", () => {
    const html = renderToStaticMarkup(<Wordmark size={24} />);
    expect(html).toContain('aria-label="i-bay"');
    expect(html).toContain(">i</i>");
    expect(html).toContain(">-</i>");
    expect(html).toContain(">b</i>");
    expect(html).toContain(">a</i>");
    expect(html).toContain(">y</i>");
  });
});
