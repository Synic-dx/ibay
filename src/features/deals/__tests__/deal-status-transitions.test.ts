import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

const mockViewer = {
  id: "user-seller-1",
  name: "Karthik Menon",
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
  notify: vi.fn().mockResolvedValue(true),
  startConversation: vi.fn().mockResolvedValue("conv-123"),
}));

const mockRefreshListingPages = vi.fn();
vi.mock("@/features/listings/actions/shared", () => ({
  refreshListingPages: (id?: string) => mockRefreshListingPages(id),
}));

import { advanceDeal, verifyHandoverOtp } from "../actions";
import { hashOtp } from "../otp-crypto";

describe("Deal Status Transitions & Handover", () => {
  const txId = "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d";
  const listingId = "b2c3d4e5-f6a1-4b2c-9d3e-4f5a6b7c8d9e";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks listing as sold and refreshes listing pages when sale OTP is verified", async () => {
    mockRpc.mockResolvedValue({ data: 1, error: null });

    const updateListingMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "transactions") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    buyer_id: "user-buyer-2",
                    seller_id: "user-seller-1",
                    kind: "sale",
                    listing_id: listingId,
                  },
                }),
            }),
          }),
        };
      }
      if (table === "listings") {
        return {
          update: updateListingMock,
        };
      }
      return {};
    });

    const res = await verifyHandoverOtp(txId, "123456", "pickup");
    expect(res.ok).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith("verify_handover_otp", {
      p_tx: txId,
      p_actor: "user-seller-1",
      p_candidate_hash: hashOtp("123456"),
      p_step: "pickup",
    });
    expect(updateListingMock).toHaveBeenCalledWith({ status: "sold" });
    expect(mockRefreshListingPages).toHaveBeenCalledWith(listingId);
  });

  it("advances deal to stage 2 on rental return without setting listing to sold", async () => {
    mockRpc.mockResolvedValue({ data: 2, error: null });

    const updateListingMock = vi.fn();

    mockFrom.mockImplementation((table: string) => {
      if (table === "transactions") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    buyer_id: "user-buyer-2",
                    seller_id: "user-seller-1",
                    kind: "rental",
                    listing_id: listingId,
                  },
                }),
            }),
          }),
        };
      }
      if (table === "listings") {
        return {
          update: updateListingMock,
        };
      }
      return {};
    });

    const res = await verifyHandoverOtp(txId, "654321", "return");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.stage).toBe(2);
      expect(res.data.step).toBe("return");
    }
    // Rental listings must stay active for future bookings
    expect(updateListingMock).not.toHaveBeenCalled();
  });

  it("marks listing as sold when advanceDeal reaches handover stage", async () => {
    mockRpc.mockResolvedValue({ data: 1, error: null });

    const updateListingMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "transactions") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    buyer_id: "user-buyer-2",
                    seller_id: "user-seller-1",
                    kind: "sale",
                    listing_id: listingId,
                  },
                }),
            }),
          }),
        };
      }
      if (table === "listings") {
        return {
          update: updateListingMock,
        };
      }
      return {};
    });

    const res = await advanceDeal(txId, true, true);
    expect(res.ok).toBe(true);
    expect(updateListingMock).toHaveBeenCalledWith({ status: "sold" });
    expect(mockRefreshListingPages).toHaveBeenCalledWith(listingId);
  });
});
