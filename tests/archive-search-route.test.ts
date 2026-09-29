import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../app/api/archive-search/route";

const SUPABASE_URL = "https://archive-test.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_test_key";
const OWNER_EMAIL = "naman070609@gmail.com";

type FetchCall = { url: URL; init?: RequestInit };

async function withArchiveFetch(
  userForToken: (token: string) => { id: string; email: string } | null,
  run: (calls: FetchCall[]) => Promise<void>,
) {
  const previousFetch = globalThis.fetch;
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const calls: FetchCall[] = [];
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = PUBLISHABLE_KEY;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    if (url.pathname === "/auth/v1/user") {
      const token = new Headers(init?.headers).get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
      const user = userForToken(token);
      if (!user) return Response.json({ message: "Invalid token" }, { status: 401 });
      return Response.json({
        id: user.id,
        aud: "authenticated",
        role: "authenticated",
        email: user.email,
        email_confirmed_at: "2026-01-01T00:00:00.000Z",
      });
    }
    if (url.pathname === "/rest/v1/rpc/search_source_page_archive") {
      return Response.json([{
        subject: "science",
        source_path: "Science/chapter.pdf",
        archive_member: null,
        page: 4,
        review_status: "raw",
        page_type: "text",
        citation: "Science/chapter.pdf, PDF page 4",
        excerpt: "An unverified extraction excerpt.",
      }]);
    }
    throw new Error(`Unexpected external request: ${url.pathname}`);
  }) as typeof fetch;
  try {
    await run(calls);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = previousKey;
  }
}

function request(token: string, query = "photosynthesis", subject?: string) {
  const params = new URLSearchParams({ q: query });
  if (subject) params.set("subject", subject);
  return new Request(`https://app.test/api/archive-search?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

test("rejects a signed-in non-owner before calling the archive RPC", async () => {
  await withArchiveFetch((token) => token === "student-token"
    ? { id: "student-uuid", email: "student@example.com" }
    : null, async (calls) => {
    const response = await GET(request("student-token"));
    assert.equal(response.status, 403);
    assert.equal(calls.some((call) => call.url.pathname.includes("search_source_page_archive")), false);
  });
});

test("bounds search input, forwards the user's JWT, and returns only the RPC excerpt", async () => {
  await withArchiveFetch((token) => token === "owner-token"
    ? { id: "owner-uuid", email: OWNER_EMAIL }
    : null, async (calls) => {
    const longQuery = `${Array.from({ length: 20 }, (_, i) => `term${i}`).join(" ")} ${"x".repeat(300)}`;
    const response = await GET(request("owner-token", longQuery, "science"));
    assert.equal(response.status, 200);
    const body = await response.json() as {
      query: string;
      count: number;
      results: { excerpt: string; citation: string }[];
    };
    assert.equal(body.query.length, 240);
    assert.equal(body.count, 1);
    assert.equal(body.results[0].excerpt, "An unverified extraction excerpt.");
    assert.equal(body.results[0].citation, "Science/chapter.pdf, PDF page 4");

    const rpcCalls = calls.filter((call) => call.url.pathname === "/rest/v1/rpc/search_source_page_archive");
    assert.equal(rpcCalls.length, 1);
    const rpc = rpcCalls[0];
    assert.equal(new Headers(rpc.init?.headers).get("Authorization"), "Bearer owner-token");
    assert.equal(new Headers(rpc.init?.headers).get("apikey"), PUBLISHABLE_KEY);
    const args = JSON.parse(String(rpc.init?.body)) as {
      query_text: string;
      match_limit: number;
      subject_filter: string | null;
    };
    assert.equal(args.match_limit, 20);
    assert.equal(args.subject_filter, "science");
    assert.equal(args.query_text.split(" ").length, 12);
    assert.ok(args.query_text.length <= 240);
    assert.equal(calls.some((call) => call.url.pathname.includes("/chat") || call.url.pathname.includes("/rag")), false);
  });
});

test("rejects unsupported subjects without querying Supabase RPC", async () => {
  await withArchiveFetch((token) => token === "owner-token"
    ? { id: "owner-uuid", email: OWNER_EMAIL }
    : null, async (calls) => {
    const response = await GET(request("owner-token", "photosynthesis", "other"));
    assert.equal(response.status, 400);
    assert.equal(calls.some((call) => call.url.pathname.includes("search_source_page_archive")), false);
  });
});
