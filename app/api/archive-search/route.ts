import { createClient } from "@supabase/supabase-js";
import { authenticatedUser } from "@/lib/auth/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ARCHIVE_ADMIN_EMAIL = "naman070609@gmail.com";
const MAX_QUERY_LENGTH = 240;
const MAX_QUERY_TERMS = 12;
const MAX_RESULTS = 20;

type ArchiveSearchRpcRow = {
  subject: string;
  source_path: string;
  archive_member: string | null;
  page: number;
  review_status: string;
  page_type: string | null;
  citation: string;
  excerpt: string;
};

/** Authenticated discovery against raw extracted source pages. Results never enter RAG. */
export async function GET(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const user = await authenticatedUser(token);
  if (!user) {
    return Response.json({ error: "Sign in to search the source archive." }, { status: 401 });
  }
  if (user.email?.toLowerCase() !== ARCHIVE_ADMIN_EMAIL) {
    return Response.json({ error: "Not authorized to search the source archive." }, { status: 403 });
  }

  const url = new URL(req.url);
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  const terms = query.match(/[\p{L}\p{N}]+/gu)?.slice(0, MAX_QUERY_TERMS) ?? [];
  if (!terms.length) return Response.json({ error: "Enter words to search." }, { status: 400 });

  const requestedSubject = url.searchParams.get("subject");
  if (requestedSubject && requestedSubject !== "science" && requestedSubject !== "maths") {
    return Response.json({ error: "Subject must be science or maths." }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey || !token) {
    return Response.json({ error: "The source archive search is not configured." }, { status: 503 });
  }

  try {
    // Forward the verified user's JWT so the database applies the authenticated
    // role and auth.uid() check on the archive RPC. No service key is used here.
    const supabase = createClient(supabaseUrl, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await supabase.rpc("search_source_page_archive", {
      query_text: terms.join(" "),
      match_limit: MAX_RESULTS,
      subject_filter: requestedSubject || null,
    });

    if (error) throw error;
    return Response.json({
      query,
      count: data?.length ?? 0,
      results: ((data ?? []) as ArchiveSearchRpcRow[]).map((row) => ({
        subject: row.subject,
        sourcePath: row.source_path,
        archiveMember: row.archive_member,
        page: row.page,
        extractionStatus: row.review_status,
        pageType: row.page_type,
        excerpt: row.excerpt,
        citation: row.citation,
      })),
      notice: "Archive extracts are unverified discovery leads. They are not approved for tutor answers.",
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "The source archive search could not be completed." }, { status: 500 });
  }
}
