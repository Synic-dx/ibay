/**
 * FEATURE: Friendly database errors
 * WHAT: Turns raw Postgres errors (CHECK constraints, our IBAY: exceptions,
 *       exclusion violations) into plain sentences and, where possible, the
 *       form field they belong to.
 * WHY: the database is the last guard. If a bad value ever gets past the app,
 *      the user still sees "Your price can't be more than the original price"
 *      instead of a stack trace. [RUBRIC:VALIDATION-SERVER]
 */

type PgError = { code?: string; message?: string; details?: string | null } | null | undefined;

/** Constraint name -> [field, message]. */
const CONSTRAINTS: Record<string, [string, string]> = {
  listings_title_len: ["title", "Title must be 5 to 80 characters."],
  listings_description_len: ["description", "Keep the description under 1,000 characters."],
  listings_price_range: ["price", "Price must be between ₹0 and ₹2,00,000."],
  listings_mrp_range: ["mrp", "Original price must be between ₹1 and ₹5,00,000."],
  listings_mrp_ge_price: ["mrp", "Your price can't be more than the original price."],
  listings_mrp_required: ["mrp", "Add the original price you paid."],
  listings_purchased_required: ["purchasedOn", "Add the month you bought it."],
  listings_purchased_range: ["purchasedOn", "The purchase date can't be in the future."],
  listings_rent_fields: ["deposit", "Rentals need a rate, a unit and a deposit."],
  listings_deposit_range: ["deposit", "Deposit must be between ₹0 and ₹50,000."],
  listings_auction_fields: ["price", "Auctions need a starting bid and an end time."],
  listings_buy_now: ["buyNow", "Buy-now price must be more than the starting bid."],
  listings_drop_fields: ["price", "Food drops can be at most ₹2,000."],
  listings_supplement_fields: ["sealStatus", "Supplements need a seal status and an expiry date."],
  profiles_name_len: ["name", "Name must be 2 to 60 characters."],
  profiles_room: ["room", "Room looks like 212 or B204."],
  profiles_whatsapp: ["whatsapp", "Use a 10 digit Indian mobile number."],
  profiles_email_domain: ["email", "Use your @iimidr.ac.in email."],
  ratings_reason_len: ["reason", "Write 10 to 500 characters about why."],
  ratings_once: ["form", "You have already rated this deal."],
  requests_text_len: ["text", "Describe it in 5 to 120 characters."],
  requests_budget_len: ["budget", "Keep the budget under 40 characters."],
  rental_bookings_no_overlap: ["form", "Some of that time is already booked. Pick another slot."],
};

export type FriendlyError = { message: string; field?: string; code?: string };

/**
 * Converts a Postgres/PostgREST error into a friendly message.
 * @param err the error returned by supabase-js
 * @returns message (and field when known)
 */
export function friendlyDbError(err: PgError): FriendlyError {
  const msg = err?.message ?? "";
  // 1. Our own RAISE EXCEPTION 'IBAY...: text' messages are already friendly.
  const own = msg.match(/^IBAY(?:_([A-Z_]+))?: (.*)$/s);
  if (own) return { message: own[2], code: own[1] };
  // 2. CHECK / EXCLUDE constraint names map to a field and a sentence.
  const name = Object.keys(CONSTRAINTS).find((c) => msg.includes(c) || err?.details?.includes(c));
  if (name) return { field: CONSTRAINTS[name][0], message: CONSTRAINTS[name][1] };
  if (err?.code === "23505") return { message: "That already exists." };
  if (err?.code === "23503") return { message: "Something this refers to no longer exists." };
  return { message: "Something went wrong on our side. Please try again." };
}
