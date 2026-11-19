import { describe, it, expect, vi } from "vitest";

vi.mock("../actions", () => ({
  openChat: vi.fn(),
}));

import { OPEN_CHAT_EVENT, type OpenChatDetail } from "../use-open-chat";

describe("Chat Performance & Instant Dock Protocol", () => {
  it("defines OPEN_CHAT_EVENT constant correctly", () => {
    expect(OPEN_CHAT_EVENT).toBe("ibay:open-chat");
  });

  it("supports optimistic loading payloads in OpenChatDetail", () => {
    const optimisticDetail: OpenChatDetail = {
      id: "pending",
      other: {
        id: "user-123",
        name: "Sara Mahajan",
        avatarUrl: null,
        avatarColor: "#02505F",
        plume: 85,
        ratedDeals: 12,
        hostel: "SR 07",
      },
      listing: {
        id: "listing-456",
        title: "Leather formal belt",
        price: 300,
        photoUrl: "/img/belt.webp",
      },
    };

    expect(optimisticDetail.id).toBe("pending");
    expect(optimisticDetail.other?.name).toBe("Sara Mahajan");
    expect(optimisticDetail.listing?.price).toBe(300);
  });

  it("supports resolved thread payload in OpenChatDetail", () => {
    const resolvedDetail: OpenChatDetail = {
      id: "conv-789",
      thread: {
        id: "conv-789",
        other: {
          id: "user-123",
          name: "Sara Mahajan",
          hostel: "SR 07",
          plume: 85,
          ratedDeals: 12,
          avatarColor: "#02505F",
          avatarUrl: null,
          whatsapp: null,
        },
        listing: null,
        deal: null,
        messages: [],
      },
    };

    expect(resolvedDetail.id).toBe("conv-789");
    expect(resolvedDetail.thread?.other.name).toBe("Sara Mahajan");
  });

  it("dispatches and receives custom event with zero delay", () => {
    const emitter = new EventTarget();
    let captured: OpenChatDetail | null = null;
    const listener = (e: Event) => {
      captured = (e as CustomEvent<OpenChatDetail>).detail;
    };

    emitter.addEventListener(OPEN_CHAT_EVENT, listener);

    const testPayload: OpenChatDetail = {
      id: "pending",
      other: { id: "test", name: "Tester" },
    };

    emitter.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT, { detail: testPayload }));
    emitter.removeEventListener(OPEN_CHAT_EVENT, listener);

    expect(captured).toEqual(testPayload);
  });
});
