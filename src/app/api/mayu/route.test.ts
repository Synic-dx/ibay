import { describe, it, expect, vi } from "vitest";
import { POST } from "./route";

// Mock auth and security guards so route tests run deterministically in unit test env
vi.mock("@/lib/auth/session", () => ({
  getViewer: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/security/guard", () => ({
  clientIp: vi.fn().mockResolvedValue("127.0.0.1"),
  rateLimit: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/supabase/server", () => ({
  db: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  }),
}));

describe("POST /api/mayu", () => {
  it("rejects invalid request body with 400", async () => {
    const req = new Request("http://localhost:3000/api/mayu", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Ask Mayu something first.");
  });

  it("handles valid request body with streaming NDJSON response", async () => {
    const req = new Request("http://localhost:3000/api/mayu", {
      method: "POST",
      body: JSON.stringify({
        messages: [{ role: "user", content: "hello" }],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/x-ndjson");

    const text = await res.text();
    expect(text).toContain('"t":"done"');
    expect(text).toContain('"t":"text"');
  });
});
