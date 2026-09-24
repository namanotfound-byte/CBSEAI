import type { Chunk, SourceKind, SubjectId } from "../types";

const KINDS = new Set<SourceKind>([
  "syllabus",
  "ncert",
  "exemplar",
  "pyq",
  "sqp",
  "ms",
  "diagram",
  "model",
  "cfpq",
  "notes",
]);
const SUBJECTS = new Set<SubjectId>(["science", "maths"]);

export function validateChunks(chunks: Chunk[]) {
  const errors: string[] = [];

  chunks.forEach((chunk, i) => {
    const at = chunk.id || `row ${i + 1}`;
    if (!chunk.id) errors.push(`${at}: id is required`);
    if (!chunk.text?.trim()) errors.push(`${at}: text is required`);
    if (!chunk.meta) errors.push(`${at}: meta is required`);
    if (chunk.meta && !KINDS.has(chunk.meta.kind)) errors.push(`${at}: meta.kind is invalid`);
    if (chunk.meta && !SUBJECTS.has(chunk.meta.subject)) errors.push(`${at}: meta.subject is invalid`);
    if (chunk.meta && !Number.isFinite(chunk.meta.chapter)) errors.push(`${at}: meta.chapter is required`);
    if (chunk.meta && !chunk.meta.chunkType) errors.push(`${at}: meta.chunkType is required`);
    if (chunk.meta && "year" in chunk.meta) {
      errors.push(`${at}: legacy meta.year is not allowed; use sourceYear and syllabusVersion`);
    }
    if (chunk.meta && !chunk.meta.sourceYear?.trim()) errors.push(`${at}: meta.sourceYear is required`);
    if (chunk.meta && !chunk.meta.syllabusVersion?.trim()) errors.push(`${at}: meta.syllabusVersion is required`);
    if (chunk.meta && !chunk.meta.syllabusTopicId?.trim()) errors.push(`${at}: meta.syllabusTopicId is required`);
    if (chunk.meta && !chunk.meta.officialUrl) errors.push(`${at}: meta.officialUrl is required`);
    if (chunk.meta && typeof chunk.meta.inActiveSyllabus !== "boolean") {
      errors.push(`${at}: meta.inActiveSyllabus must be true or false`);
    }
    if (chunk.meta?.reviewStatus !== "approved") errors.push(`${at}: meta.reviewStatus must be approved`);
    if (chunk.meta?.assessmentStatus !== "summative") errors.push(`${at}: only summative material can be indexed`);
    if (chunk.meta && chunk.meta.syllabusVersion !== "2026-27") {
      errors.push(`${at}: only the 2026-27 syllabus is enabled`);
    }
    if (chunk.meta && !/^[a-f0-9]{64}$/i.test(chunk.meta.contentSha256 ?? "")) {
      errors.push(`${at}: meta.contentSha256 must be a SHA-256 hex digest`);
    }
    if (chunk.meta && !chunk.meta.language) errors.push(`${at}: meta.language is required`);
    if (chunk.meta?.kind === "ms" && !chunk.meta.joinPrefix) {
      errors.push(`${at}: marking_scheme chunks need meta.joinPrefix`);
    }
    if (["pyq", "sqp", "cfpq"].includes(chunk.meta?.kind ?? "") && !chunk.meta?.joinPrefix) {
      errors.push(`${at}: question chunks need meta.joinPrefix`);
    }
    if (["pyq", "sqp", "cfpq"].includes(chunk.meta?.kind ?? "") &&
        !["question_block", "question_part"].includes(chunk.meta?.chunkType ?? "")) {
      errors.push(`${at}: question-bank chunks must use question_block or question_part`);
    }
    if (chunk.meta?.kind === "syllabus" && chunk.meta.chunkType !== "syllabus_scope") {
      errors.push(`${at}: syllabus chunks must use meta.chunkType="syllabus_scope"`);
    }
    if (chunk.meta?.kind === "diagram" && chunk.meta.chunkType !== "diagram") {
      errors.push(`${at}: diagram chunks should use meta.chunkType="diagram"`);
    }
    if (chunk.meta?.kind === "diagram" && !chunk.meta.conceptTags?.length) {
      errors.push(`${at}: diagram chunks need meta.conceptTags`);
    }
    if (["question_part", "ncert_atom"].includes(chunk.meta?.chunkType ?? "") && !chunk.meta?.parentId) {
      errors.push(`${at}: child chunks need meta.parentId`);
    }
    if (chunk.meta?.officialUrl && !isOfficialUrl(chunk.meta.officialUrl)) {
      errors.push(`${at}: officialUrl must be from NCERT, ePathshala, or CBSE Academic`);
    }
  });

  return errors;
}

function isOfficialUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    return ["ncert.nic.in", "epathshala.nic.in", "cbseacademic.nic.in"]
      .some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}
