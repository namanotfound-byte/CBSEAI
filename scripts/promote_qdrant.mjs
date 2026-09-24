#!/usr/bin/env node
/** Atomically point the live alias at a validated, versioned collection.
 * Safe dry run by default; use --apply only after evaluation passes.
 * Rollback is the same command with the previous collection name.
 */
const [alias, target, minCountArg, flag] = process.argv.slice(2);
if (!alias || !target || !minCountArg || !/^[a-zA-Z0-9_-]+$/.test(alias) ||
    !/^[a-zA-Z0-9_-]+$/.test(target)) {
  console.error("Usage: node scripts/promote_qdrant.mjs <live-alias> <versioned-collection> <minimum-points> [--apply]");
  process.exit(2);
}
const minCount = Number(minCountArg);
if (!Number.isSafeInteger(minCount) || minCount < 1) throw new Error("minimum-points must be positive");
if (flag && flag !== "--apply") throw new Error("Unknown flag");
if (alias === target) throw new Error("Alias and collection must differ");
const base = process.env.QDRANT_URL?.replace(/\/$/, "");
const key = process.env.QDRANT_API_KEY;
if (!base || !key) throw new Error("QDRANT_URL and QDRANT_API_KEY are required");
const headers = { "Content-Type": "application/json", "api-key": key };
async function request(path, init) {
  const response = await fetch(`${base}${path}`, { ...init, headers });
  if (!response.ok) throw new Error(`Qdrant ${path} returned ${response.status}`);
  return response.json();
}
const countResult = await request(`/collections/${encodeURIComponent(target)}/points/count`, {
  method: "POST", body: JSON.stringify({ exact: true }),
});
const count = countResult.result?.count ?? 0;
if (count < minCount) throw new Error(`Target has ${count} points, below required ${minCount}`);
const aliases = await request("/aliases");
const existing = (aliases.result?.aliases ?? []).find((row) => row.alias_name === alias);
if (existing?.collection_name === target) {
  console.log(JSON.stringify({ status: "already_live", alias, target, count }));
  process.exit(0);
}
const actions = [
  ...(existing ? [{ delete_alias: { alias_name: alias } }] : []),
  { create_alias: { collection_name: target, alias_name: alias } },
];
console.log(JSON.stringify({ status: flag === "--apply" ? "applying" : "dry_run", alias,
  previousCollection: existing?.collection_name ?? null, target, count, actions }, null, 2));
if (flag === "--apply") {
  await request("/collections/aliases", { method: "POST", body: JSON.stringify({ actions }) });
  console.log(JSON.stringify({ status: "promoted", alias, target, rollbackTarget: existing?.collection_name ?? null }));
}
