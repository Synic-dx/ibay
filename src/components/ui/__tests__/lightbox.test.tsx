import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Lightbox } from "../lightbox";

describe("Lightbox", () => {
  const images = ["/img/puffer.webp", "/img/racquet.webp"];

  it("renders null when open is false", () => {
    const html = renderToStaticMarkup(
      <Lightbox
        open={false}
        images={images}
        currentIndex={0}
        onClose={vi.fn()}
        onIndexChange={vi.fn()}
      />
    );
    expect(html).toBe("");
  });

  it("renders current image and counter when open is true", () => {
    const html = renderToStaticMarkup(
      <Lightbox
        open={true}
        images={images}
        currentIndex={0}
        alt="Puffer jacket"
        onClose={vi.fn()}
        onIndexChange={vi.fn()}
      />
    );
    expect(html).toContain('src="/img/puffer.webp"');
    expect(html).toContain("1 / 2");
    expect(html).toContain("Close");
  });
});
