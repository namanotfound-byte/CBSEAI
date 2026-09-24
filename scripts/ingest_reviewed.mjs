#!/usr/bin/env node
/** Upload approved chunks to a staging deployment's authenticated ingest API.
 * Dry run unless --apply. The deployment must use a versioned collection, not
 * the live alias. Never run this against the public production deployment.
 */
import { readFile } from "node:fs/promises";

const [path, flag] = process.argv.slice(2);
if (!path || (flag && flag !== "--apply")) {
  console.error("Usage: node scripts/ingest_reviewed.mjs <approved.jsonl> [--apply]");
  process.exit(2);
}
const rows = (await readFile(path, "utf8")).split("\n").filter(Boolean).map(JSON.parse);
for (const row of rows) {
  if (row.meta?.reviewStatus !== "approved" || row.meta?.assessmentStatus !== "summative" ||
      row.meta?.syllabusVersion !== "2026-27") {
    throw new Error(`Unapproved or out-of-scope row: ${row.id ?? "unknown"}`);
  }
}
console.log(JSON.stringify({ status: flag === "--apply" ? "uploading" : "dry_run", rows: rows.length }));
if (flag === "--apply") {
  const base = process.env.STAGING_INGEST_URL;
  const key = process.env.INGEST_API_KEY;
  if (!base || !key || !base.startsWith("https://")) {
    throw new Error("Protected STAGING_INGEST_URL (HTTPS) and INGEST_API_KEY are required");
  }
  let uploaded = 0;
  for (let offset = 0; offset < rows.length; offset += 16) {
    const batch = rows.slice(offset, offset + 16);
    const response = await fetch(`${base.replace(/\/$/, "")}/api/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ chunks: batch }),
    });
    if (!response.ok) throw new Error(`Ingestion stopped after ${uploaded} rows: HTTP ${response.status}`);
    uploaded += batch.length;
  }
  console.log(JSON.stringify({ status: "uploaded_to_staging", uploaded }));
}
