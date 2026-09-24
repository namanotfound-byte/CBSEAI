import type { QueryRoute, Source } from "../types";
import { verifyClaims } from "./nli";

const MARK_TOKEN_RE = /\[(?:\d+(?:\/2|\.\d+)?|½)\s*marks?\]|\b\d+(?:\/2|\.\d+)?\s*marks?\b/i;
const MARK_TOKEN_GLOBAL_RE = /(?:\[)?(\d+(?:\/2|\.\d+)?|½)\s*marks?(?:\])?/gi;
const MACHINE_MARKS_RE = /^MARKS:\s*\d/im;

export interface VerificationResult {
  text: string;
  citationOk: boolean;
  marksOk: boolean;
  nliOk: boolean;
  unsupportedClaims: string[];
  notice?: string;
}

export async function verifyAnswer(
  text: string,
  sources: Source[],
  route: QueryRoute,
): Promise<VerificationResult> {
  const ids = new Set(sources.map((s) => s.id));
  const hasMarkingScheme = sources.some(
    (s) => s.kind === "ms" || s.chunkType === "marking_scheme",
  );
  const citedIds = [
    ...text.matchAll(/\[\[source:([^\]]+)\]\]|\[\[diagram:([^\]]+)\]\]/g),
  ].map((m) => m[1] ?? m[2]);
  const evidenceIds = new Set(sources.filter((source) => source.kind !== "syllabus").map((source) => source.id));
  const isFallback = /^(?:This topic is in the active syllabus, but I don't have enough approved source material to answer it yet\.|This topic is in the active syllabus, but I couldn't verify a grounded answer from the approved passages yet\.)$/i.test(text.trim());
  const citationOk = citedIds.every((id) => ids.has(id)) &&
    (isFallback || (evidenceIds.size > 0 && citedIds.some((id) => evidenceIds.has(id))));

  let cleaned = text;
  let marksOk = true;
  let notice: string | undefined;

  if (!hasMarkingScheme && (MARK_TOKEN_RE.test(cleaned) || MACHINE_MARKS_RE.test(cleaned))) {
    marksOk = false;
    cleaned = stripMarks(cleaned);
    if (route === "marking" || route === "pyq") {
      notice = "Mark allocation unavailable without an approved marking scheme.";
    }
  } else if (hasMarkingScheme) {
    const allowedMarks = new Set(
      sources
        .filter((source) => source.kind === "ms" || source.chunkType === "marking_scheme")
        .flatMap((source) => markValues(source.content ?? source.snippet)),
    );
    const unsupported = markValues(cleaned).some((value) => !allowedMarks.has(value));
    if (unsupported) {
      marksOk = false;
      cleaned = stripMarks(cleaned);
      if (route === "marking" || route === "pyq") {
        notice = "Mark allocation unavailable without an approved marking scheme.";
      }
    }
  }

  const nli = citationOk
    ? await verifyClaims(cleaned, sources)
    : { ok: false, checked: false, unsupportedClaims: [] };
  if (!nli.checked && !notice) {
    notice = "Citations were checked; independent claim verification is not configured.";
  }

  return {
    text: cleaned.trim(),
    citationOk,
    marksOk,
    nliOk: nli.ok,
    unsupportedClaims: nli.unsupportedClaims,
    notice,
  };
}

function markValues(text: string) {
  return [...text.matchAll(MARK_TOKEN_GLOBAL_RE)].map((match) => {
    const raw = match[1].toLowerCase();
    if (raw === "½" || raw.endsWith("/2")) return "0.5";
    return String(Number(raw));
  });
}

export function stripMarks(text: string) {
  return text
    .replace(/^MARKS:\s*.+$/gim, "")
    .replace(/\s*\[(?:\d+(?:\/2|\.\d+)?|½)\s*marks?\]\s*/gi, " ")
    .replace(/\n{3,}/g, "\n\n");
}
