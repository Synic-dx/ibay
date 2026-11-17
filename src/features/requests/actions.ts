"use server";
/**
 * FEATURE: Requests CRUD ("I am looking for a...") [RUBRIC:CRUD-CREATE] [RUBRIC:CRUD-UPDATE] [RUBRIC:CRUD-DELETE] [RUBRIC:CAPTCHA]
 * WHAT: Owners post (CAPTCHA), edit text / budget / needed-by, close ("Found it"),
 *       delete (with Undo) a request. Anyone signed in can upvote and reply
 *       "I have this" with a photo and price; repliers can edit or delete their reply.
 * WHO: every action re-checks the session and ownership on the server.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewer } from "@/lib/auth/session";
import { db } from "@/lib/supabase/server";
import { fail, invalid, ok, type ActionResult } from "@/lib/action-result";
import { friendlyDbError } from "@/lib/db-errors";
import { checkCaptcha, rateLimit } from "@/lib/security/guard";
import { replySchema, requestSchema, type RequestInput } from "@/lib/validation/market";
import { notify, startConversation } from "@/features/chat/service";

const refresh = (id?: string) => {
  revalidatePath("/requests");
  revalidatePath("/");
  if (id) revalidatePath(`/requests/${id}`);
};

/** Loads a request the viewer owns (null for anyone else). */
async function ownRequest(id: string, viewerId: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const { data } = await db().from("requests").select("*").eq("id", id).maybeSingle();
  return data && data.author_id === viewerId ? data : null;
}

/** Posts a request (CAPTCHA first, then the same Zod schema as the form). */
export async function createRequest(input: RequestInput): Promise<ActionResult<{ id: string }>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Sign in to post a request.", undefined, "AUTH");
  const capErr = await checkCaptcha(input.captchaToken, "post-request");
  if (capErr) return fail(capErr, { captchaToken: capErr }, "CAPTCHA");
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!(await rateLimit(`request:${viewer.id}`, 3600, 10))) return fail("You have posted a lot in the last hour. Try again later.");
  const v = parsed.data;
  const { data, error } = await db()
    .from("requests")
    .insert({ author_id: viewer.id, category_id: v.categoryId, text: v.text[0].toUpperCase() + v.text.slice(1), budget: v.budget || "Open to offers", needed_by: v.neededBy || null })
    .select("id")
    .single();
  if (error) return fail(friendlyDbError(error).message);
  await db().from("request_votes").insert({ request_id: data.id, user_id: viewer.id });
  refresh(data.id);
  return ok({ id: data.id }, "Posted. People in that category can reply with a photo and price.");
}

/** Edits text, budget and needed-by (owner only). */
export async function updateRequest(id: string, input: RequestInput): Promise<ActionResult<null>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.", undefined, "AUTH");
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!(await ownRequest(id, viewer.id))) return fail("Request not found.");
  const v = parsed.data;
  const { error } = await db().from("requests").update({ text: v.text, budget: v.budget || "Open to offers", needed_by: v.neededBy || null, category_id: v.categoryId }).eq("id", id);
  if (error) return fail(friendlyDbError(error).message);
  refresh(id);
  return ok(null, "Request updated");
}

/** "Found it": closes the request (or reopens it). */
export async function setRequestFound(id: string, found: boolean): Promise<ActionResult<null>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.", undefined, "AUTH");
  if (!(await ownRequest(id, viewer.id))) return fail("Request not found.");
  await db().from("requests").update({ status: found ? "found" : "open" }).eq("id", id);
  refresh(id);
  return ok(null, found ? "Marked as found. Nice!" : "Reopened");
}

/** Soft delete with Undo. */
export async function deleteRequest(id: string): Promise<ActionResult<null>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.", undefined, "AUTH");
  if (!(await ownRequest(id, viewer.id))) return fail("Request not found.");
  await db().from("requests").update({ status: "deleted", deleted_at: new Date().toISOString() }).eq("id", id);
  refresh(id);
  return ok(null, "Request deleted");
}

/** Undo a request delete. */
export async function restoreRequest(id: string): Promise<ActionResult<null>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.", undefined, "AUTH");
  if (!(await ownRequest(id, viewer.id))) return fail("Request not found.");
  await db().from("requests").update({ status: "open", deleted_at: null }).eq("id", id);
  refresh(id);
  return ok(null, "Request restored");
}

/** "I need this too" upvote (toggle). */
export async function voteRequest(id: string): Promise<ActionResult<{ voted: boolean }>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Sign in to upvote requests.", undefined, "AUTH");
  if (!z.uuid().safeParse(id).success) return fail("Request not found.");
  const { data, error } = await db().rpc("toggle_request_vote", { p_request: id, p_user: viewer.id });
  if (error) return fail("Couldn't vote. Try again.");
  refresh(id);
  return ok({ voted: data as boolean });
}

/** "I have this": reply with a description, a price and an optional photo. */
export async function replyToRequest(requestId: string, input: { text: string; priceText: string; imageUrl?: string }): Promise<ActionResult<null>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Sign in to reply.", undefined, "AUTH");
  if (!z.uuid().safeParse(requestId).success) return fail("Request not found.");
  const parsed = replySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (parsed.data.imageUrl && !/^https:\/\//.test(parsed.data.imageUrl)) return fail("That photo didn't upload properly.");
  if (!(await rateLimit(`reply:${viewer.id}`, 3600, 30))) return fail("Too many replies in an hour.");
  const { data: r } = await db().from("requests").select("author_id,text,status,deleted_at").eq("id", requestId).maybeSingle();
  if (!r || r.deleted_at || r.status !== "open") return fail("This request is closed.");
  if (r.author_id === viewer.id) return fail("You can't reply to your own request.");
  const { error } = await db().from("request_replies").insert({ request_id: requestId, author_id: viewer.id, text: parsed.data.text, price_text: parsed.data.priceText || "Ask me", image_url: parsed.data.imageUrl || null });
  if (error) return fail(friendlyDbError(error).message);
  await notify(r.author_id, "request_reply", "chat", `${viewer.name.split(" ")[0]} replied to "${r.text}" with an offer (${parsed.data.priceText || "ask"}).`, `/requests/${requestId}`);
  refresh(requestId);
  return ok(null, "Sent. They will be notified.");
}

/** Edit your own reply. */
export async function updateReply(replyId: string, input: { text: string; priceText: string }): Promise<ActionResult<null>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.", undefined, "AUTH");
  const parsed = replySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { data: rep } = await db().from("request_replies").select("author_id,request_id").eq("id", replyId).maybeSingle();
  if (!rep || rep.author_id !== viewer.id) return fail("Reply not found.");
  await db().from("request_replies").update({ text: parsed.data.text, price_text: parsed.data.priceText || "Ask me" }).eq("id", replyId);
  refresh(rep.request_id);
  return ok(null, "Reply updated");
}

/** Delete your own reply. */
export async function deleteReply(replyId: string): Promise<ActionResult<null>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.", undefined, "AUTH");
  const { data: rep } = await db().from("request_replies").select("author_id,request_id").eq("id", replyId).maybeSingle();
  if (!rep || rep.author_id !== viewer.id) return fail("Reply not found.");
  await db().from("request_replies").update({ deleted_at: new Date().toISOString() }).eq("id", replyId);
  refresh(rep.request_id);
  return ok(null, "Reply deleted");
}

/** Accept a reply: marks it and opens a chat with the person. */
export async function acceptReply(replyId: string): Promise<ActionResult<{ conversationId: string | null }>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.", undefined, "AUTH");
  const { data: rep } = await db().from("request_replies").select("id,author_id,price_text,request_id,requests(author_id,text)").eq("id", replyId).maybeSingle();
  const req = rep?.requests as unknown as { author_id: string; text: string } | undefined;
  if (!rep || req?.author_id !== viewer.id) return fail("Reply not found.");
  await db().from("request_replies").update({ accepted: true }).eq("id", replyId);
  const conv = await startConversation(viewer.id, rep.author_id, null, `Hi! I'd like to go with your offer (${rep.price_text}) for "${req.text}". When can I pick it up?`);
  refresh(rep.request_id);
  return ok({ conversationId: conv }, "Offer accepted");
}
