import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Mock server actions to avoid loading node_modules/next/server in vitest
vi.mock("../actions", () => ({
  fetchThread: vi.fn(),
  openChat: vi.fn(),
}));

vi.mock("../thread-view", () => ({
  ThreadView: () => null,
}));

// Mock app context
let mockViewer: any = { id: "user-1", name: "Karthik", hostel: "SR 18" };
vi.mock("@/components/app-context", () => ({
  useApp: () => ({ viewer: mockViewer, counts: { unreadChats: 0 } }),
}));

// Mock router & pathname
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock react-query
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: null, isLoading: false }),
}));

import { MessagingDock } from "../dock";

describe("MessagingDock Idle Cleanup", () => {
  it("renders null in idle state (no repetitive bottom messaging bar)", () => {
    // In server/SSR or idle client state before any chat is opened, MessagingDock renders null
    const html = renderToStaticMarkup(<MessagingDock />);
    expect(html).toBe("");
    expect(html).not.toContain("Messaging");
    expect(html).not.toContain("dk-list");
  });
});
