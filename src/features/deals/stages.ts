/**
 * FEATURE: Deal shape and step rules (shared by the server and the Deals screen)
 * STEPS: Sale: Agreed -> Handed over -> Rate. Rental: Agreed -> Picked up -> Returned -> Rate.
 */
import type { ListingCard } from "@/features/listings/types";

export type Deal = {
  id: string;
  kind: "sale" | "rental" | "auction";
  role: "buyer" | "seller";
  amount: number;
  stage: number;
  createdAt: string;
  listing: ListingCard;
  handoverNote?: string | null;
  handoverScheduledAt?: string | null;
  handoverStatus?: "proposed" | "confirmed" | "rescheduled" | "completed";
  handoverProposedBy?: string | null;
  deliveryOtp?: string | null;
  returnOtp?: string | null;
  otpAttempts?: number;
  otpLockedUntil?: string | null;
  other: { id: string; name: string; plume: number; ratedDeals: number; hostel: string };
  myRating: { score: number; editableUntil: string; reason: string; tags: string[] } | null;
  conversationId?: string | null;
};

/** Step names for a deal kind. */
export const stagesFor = (kind: Deal["kind"]) => (kind === "rental" ? ["Agreed", "Picked up", "Returned", "Rate"] : ["Agreed", "Handed over", "Rate"]);
/** True when the handover is done and the deal can be rated. */
export const canRate = (d: Pick<Deal, "kind" | "stage">) => d.stage >= stagesFor(d.kind).length - 2;

