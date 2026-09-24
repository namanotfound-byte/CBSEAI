export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) {
    return Response.json({ google: false, github: false }, { status: 503 });
  }

  try {
    const response = await fetch(`${base}/auth/v1/settings`, {
      headers: { apikey: key },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Auth settings returned ${response.status}`);
    const settings = await response.json() as { external?: Record<string, boolean> };
    return Response.json({
      google: Boolean(settings.external?.google),
      github: Boolean(settings.external?.github),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ google: false, github: false }, { status: 503 });
  }
}
