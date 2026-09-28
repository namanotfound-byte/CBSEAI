import type { Chunk, SourceKind, SubjectId } from "../types";

const KINDS = new Set<SourceKind>([
  "syllabus",
  "ncert",
  "ncert_exercise",
  "exemplar",
  "pyq",
  "sqp",
  "ms",
  "diagram",
  "model",
  "cfpq",
  "apq",
  "apq_answer",
  "item_bank",
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
    if (chunk.meta?.page !== undefined && (!Number.isInteger(chunk.meta.page) || chunk.meta.page < 1)) {
      errors.push(`${at}: meta.page must be a positive integer`);
    }
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
    if (chunk.meta?.assessmentStatus !== "summative" && !isEligibleFormativeItemBank(chunk)) {
      errors.push(`${at}: only summative material or approved formative item-bank practice can be indexed`);
    }
    if (chunk.meta && chunk.meta.syllabusVersion !== "2026-27") {
      errors.push(`${at}: only the 2026-27 syllabus is enabled`);
    }
    if (chunk.meta?.subject === "maths" && chunk.meta.chapter === 1 &&
        /euclid(?:['’]s|s)?\s+division\s+(?:algorithm|lemma)/i.test(chunk.text)) {
      errors.push(`${at}: Euclid's division algorithm is outside the current board-answer scope`);
    }
    if (chunk.meta && !/^[a-f0-9]{64}$/i.test(chunk.meta.contentSha256 ?? "")) {
      errors.push(`${at}: meta.contentSha256 must be a SHA-256 hex digest`);
    }
    if (chunk.meta && !chunk.meta.language) errors.push(`${at}: meta.language is required`);
    if (["ms", "apq_answer"].includes(chunk.meta?.kind ?? "") && !chunk.meta.joinPrefix) {
      errors.push(`${at}: marking_scheme chunks need meta.joinPrefix`);
    }
    if (chunk.meta?.kind === "apq" &&
        (!chunk.meta.joinPrefix || chunk.meta.chunkType !== "question_block")) {
      errors.push(`${at}: APQ question chunks need a joinPrefix and question_block chunkType`);
    }
    if (chunk.meta?.kind === "apq_answer" && chunk.meta.chunkType !== "answer_block") {
      errors.push(`${at}: APQ answer chunks must use answer_block chunkType`);
    }
    if (chunk.meta?.kind === "item_bank" && !isValidItemBankChunk(chunk)) {
      errors.push(`${at}: item-bank chunks need a reciprocal question/marking record and practice eligibility metadata`);
    }
    if (chunk.meta?.kind === "ncert_exercise" &&
        (!chunk.meta.joinPrefix || !["ncert_question", "ncert_answer"].includes(chunk.meta.chunkType ?? ""))) {
      errors.push(`${at}: NCERT exercise chunks need a joinPrefix and question/answer chunkType`);
    }
    if (chunk.meta?.kind === "exemplar" &&
        (!chunk.meta.joinPrefix || !["exemplar_question", "exemplar_answer"].includes(chunk.meta.chunkType ?? ""))) {
      errors.push(`${at}: NCERT Exemplar chunks need a joinPrefix and question/answer chunkType`);
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
      errors.push(`${at}: officialUrl must be from NCERT, ePathshala, or CBSE`);
    }
  });

  return errors;
}

function isEligibleFormativeItemBank(chunk: Chunk) {
  return chunk.meta.kind === "item_bank" &&
    chunk.meta.assessmentStatus === "formative" &&
    chunk.meta.reviewStatus === "approved" &&
    chunk.meta.inActiveSyllabus === true &&
    chunk.meta.syllabusVersion === "2026-27" &&
    isValidItemBankChunk(chunk);
}

function isValidItemBankChunk(chunk: Chunk) {
  const m = chunk.meta;
  const question = m.chunkType === "item_bank_question";
  const answer = m.chunkType === "item_bank_marking_scheme";
  return m.assessmentStatus === "formative" && Boolean(m.joinPrefix) &&
    (question && m.practiceModeEligible === true && Boolean(m.pairedAnswerId) && m.answerVisibility === "question_only" ||
      answer && m.practiceModeEligible === false && Boolean(m.pairedQuestionId) && m.answerVisibility === "solution_only");
}

function isOfficialUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    return ["ncert.nic.in", "epathshala.nic.in", "cbseacademic.nic.in", "cbse.gov.in"]
      .some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}
