import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SearchAutocomplete } from "../search-autocomplete";

describe("SearchAutocomplete", () => {
  const mockCategories: any[] = [
    { id: "gym", name: "Gym Corner", short: "Gym", icon: "dumbbell", group: "Play" },
    { id: "books", name: "Books", short: "Books", icon: "book", group: "Study" },
  ];

  it("renders search suggestions when active", () => {
    const html = renderToStaticMarkup(
      <SearchAutocomplete
        query="gym"
        open={true}
        categories={mockCategories}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(html).toContain("Gym Corner");
    expect(html).toContain("Categories");
  });

  it("renders recent searches section when query is empty and open", () => {
    const html = renderToStaticMarkup(
      <SearchAutocomplete
        query=""
        open={true}
        categories={mockCategories}
        recentSearches={["cooler", "formals"]}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(html).toContain("Recent Searches");
    expect(html).toContain("cooler");
    expect(html).toContain("formals");
  });

  it("returns null when open is false", () => {
    const html = renderToStaticMarkup(
      <SearchAutocomplete
        query=""
        open={false}
        categories={mockCategories}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(html).toBe("");
  });
});
