import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

const mockViewer = {
  id: "user-buyer-1",
  name: "Aditi Sharma",
  hostel: "SR 18",
};

vi.mock("@/lib/auth/session", () => ({
  getViewer: vi.fn().mockImplementation(() => Promise.resolve(mockViewer)),
}));

const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  db: () => ({
    from: mockFrom,
    rpc: mockRpc,
  }),
}));

vi.mock("@/features/chat/service", () => ({
  startConversation: vi.fn().mockResolvedValue("conv-123"),
}));

import { claimDrop } from "../actions";

describe("Food Drop Claim Workflow", () => {
  const listingId = "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d";

  beforeEach(() => {
    vi.clearAllMocks();
    mockViewer.id = "user-buyer-1";
    mockViewer.hostel = "SR 18";
  });

  it("prevents the seller from claiming their own food drop", async () => {
    mockViewer.id = "user-seller-1";
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: {
                id: listingId,
                seller_id: "user-seller-1",
                pickup_hostel: "SR 18",
                status: "active",
                mode: "drop",
                ends_at: new Date(Date.now() + 3600000).toISOString(),
                price: 0,
                title: "Biryani",
              },
            }),
        }),
      }),
    });

    const res = await claimDrop(listingId);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.formError).toBe("You cannot claim your own food drop.");
    }
  });

  it("prevents claiming an expired food drop", async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: {
                id: listingId,
                seller_id: "user-seller-2",
                pickup_hostel: "SR 18",
                status: "active",
                mode: "drop",
                ends_at: new Date(Date.now() - 60000).toISOString(), // expired
                price: 0,
                title: "Cold Coffee",
              },
            }),
        }),
      }),
    });

    const res = await claimDrop(listingId);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.formError).toBe("This food drop has expired.");
    }
  });

  it("prevents claiming an already claimed food drop", async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: {
                id: listingId,
                seller_id: "user-seller-2",
                pickup_hostel: "SR 18",
                status: "claimed",
                mode: "drop",
                ends_at: new Date(Date.now() + 3600000).toISOString(),
                price: 0,
                title: "Pizza Slices",
              },
            }),
        }),
      }),
    });

    const res = await claimDrop(listingId);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.formError).toBe("Someone else already claimed this food drop.");
    }
  });

  it("prevents claiming by a student outside walking cluster radius", async () => {
    mockViewer.hostel = "SR 01"; // Distant hostel from SR 18
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: {
                id: listingId,
                seller_id: "user-seller-2",
                pickup_hostel: "SR 18",
                status: "active",
                mode: "drop",
                ends_at: new Date(Date.now() + 3600000).toISOString(),
                price: 0,
                title: "Cake",
              },
            }),
        }),
      }),
    });

    const res = await claimDrop(listingId);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.formError).toContain("only available for residents in or near SR 18");
    }
  });
});
