import { env } from "../config";
import type { Chunk, RetrievalFilters, Source, SourceKind } from "../types";
import { signedDiagramUrl } from "./diagrams";
import { rerank } from "./reranker";
import { sourceMatchesQuestion } from "./relevance";
import { inferSyllabusScope } from "./syllabus-index";
import { getVectorStore } from "./vectorstore";

/**
 * Source priority. NCERT of the current year always outranks everything else —
 * that's the product's whole claim, so it's encoded here rather than left to
 * the embedding similarity.
 */
const PRIORITY: Record<SourceKind, number> = {
  syllabus: 1.1,
  ncert: 1.0,
  ncert_exercise: 0.91,
  ms: 0.98,
  diagram: 0.94,
  exemplar: 0.92,
  pyq: 0.9,
  sqp: 0.88,
  cfpq: 0.86,
  apq: 0.87,
  apq_answer: 0.98,
  item_bank: 0.89,
  model: 0.8,
  notes: 0.75,
};

const KIND_LABEL: Record<SourceKind, string> = {
  syllabus: "Current syllabus",
  ncert: "NCERT",
  ncert_exercise: "NCERT exercise",
  ms: "Marking scheme",
  diagram: "Diagram",
  exemplar: "Exemplar",
  pyq: "PYQ",
  sqp: "Sample paper",
  cfpq: "CFPQ",
  apq: "Additional practice question",
  apq_answer: "Additional practice marking scheme",
  item_bank: "CBSE item bank",
  model: "Model paper",
  notes: "Notes",
};

const CONTENT_KINDS = (Object.keys(PRIORITY) as SourceKind[]).filter(
  (kind) => kind !== "syllabus" && kind !== "ncert_exercise" && kind !== "item_bank",
);

export async function retrieve(
  query: string,
  filters: RetrievalFilters = {},
): Promise<Source[]> {
  const store = getVectorStore();
  const topK = filters.topK ?? 5;
  const namedItemIdentity = query.match(/\bmaths10[a-z0-9]+\b/i)?.[0].toLowerCase();
  const itemBankQuery = Boolean(namedItemIdentity) && /\bitem[\s-]*bank\b/i.test(query);
  const inferred = itemBankQuery
    ? { subject: "maths" as const, chapters: undefined, outOfSyllabus: false }
    : inferSyllabusScope(query, filters.subject);
  if (inferred.outOfSyllabus) return [];
  const requestedKinds = filters.route === "competency"
    ? (itemBankQuery
        ? (["item_bank"] satisfies SourceKind[])
        : /\bncert\b.*\bexercis/i.test(query)
        ? (["ncert_exercise"] satisfies SourceKind[])
        : /\bexemplar\b/i.test(query)
          ? (["exemplar"] satisfies SourceKind[])
          : (["cfpq", "sqp", "pyq", "apq", "apq_answer", "ms", "ncert_exercise", "exemplar", "item_bank"] satisfies SourceKind[]))
    : filters.kinds?.filter((kind) => kind !== "syllabus") ?? CONTENT_KINDS;
  const scopedFilters: RetrievalFilters = {
    ...filters,
    subject: itemBankQuery ? "maths" : filters.subject ?? inferred.subject,
    chapter: itemBankQuery ? undefined : filters.chapter,
    chapters: itemBankQuery ? undefined :
      filters.chapter || filters.chapters?.length
        ? filters.chapters
        : inferred.chapters,
    syllabusVersion: filters.syllabusVersion ?? env.syllabusVersion,
  };

  // A chapter-level syllabus paragraph can be semantically close to a question
  // about a different chapter. Search reviewed content across the allowed
  // subject first, then require the exact matching syllabus node. This keeps
  // a relevant NCERT passage from being lost to an unrelated top syllabus hit.
  const broadFilters: RetrievalFilters = {
    ...scopedFilters,
    chapters: filters.chapters,
    kinds: requestedKinds,
    itemIdentitySearch: itemBankQuery ? namedItemIdentity : undefined,
    topK: 40,
  };
  const [syllabusHits, broadHits] = await Promise.all([
    store.search(query, { ...scopedFilters, kinds: ["syllabus"], topK: 8 }),
    store.search(query, broadFilters),
  ]);
  const relevantSyllabusHits = store.name === "memory"
    ? syllabusHits.filter((hit) => hit.score >= 0.18)
    : syllabusHits;
  const directHits = broadHits.filter((hit) =>
    (store.name !== "memory" || hit.score >= 0.18) &&
    (filters.route === "competency"
      ? isPracticeQuestionChunk(hit) && matchesExplicitExerciseSubquestion(query, hit.text)
      : sourceMatchesQuestion(query, hit.text)),
  );
  const [bestDirectHit] = await rerank(query, directHits, 1);
  let syllabusHit = bestDirectHit
    ? relevantSyllabusHits.find((hit) => hit.meta.syllabusTopicId === bestDirectHit.meta.syllabusTopicId)
    : undefined;
  if (bestDirectHit && !syllabusHit) {
    [syllabusHit] = await store.search(query, {
      ...scopedFilters,
      chapters: undefined,
      syllabusTopicId: bestDirectHit.meta.syllabusTopicId,
      kinds: ["syllabus"],
      topK: 1,
    });
  }
  if (!syllabusHit) [syllabusHit] = await rerank(query, relevantSyllabusHits, 1);
  if (!syllabusHit) return [];

  const syllabusTopicId = filters.syllabusTopicId ?? syllabusHit.meta.syllabusTopicId;
  const contentFilters: RetrievalFilters = {
    ...scopedFilters,
    chapters: undefined,
    syllabusTopicId,
    kinds: requestedKinds,
    itemIdentitySearch: itemBankQuery ? namedItemIdentity : undefined,
  };

  // Hybrid retrieval over-fetches to 40; the cross-encoder then produces the
  // canonical top-8 candidate set before source-priority slotting.
  const hits = await store.search(query, {
    ...contentFilters,
    topK: Math.max(40, topK * 5),
  });

  const needsAnswerEvidence = !["competency", "marking", "pyq"].includes(filters.route ?? "theory");
  const relevantHits = hits.filter((hit) =>
    (store.name !== "memory" || hit.score >= 0.18) &&
    (filters.route !== "competency" ||
      (isPracticeQuestionChunk(hit) && matchesExplicitExerciseSubquestion(query, hit.text))) &&
    (!needsAnswerEvidence || sourceMatchesQuestion(query, hit.text)),
  );
  const reranked = await rerank(query, relevantHits, Math.max(8, topK * 2));
  const exactPractice = filters.route === "competency"
    ? relevantHits.filter((hit) => practicePhraseMatch(query, hit.text))
    : [];
  const candidates = [...new Map([...exactPractice, ...reranked]
    .map((hit) => [hit.id, hit])).values()];
  const ordered = candidates
    .map((h) => ({ ...h, ranked: h.score * PRIORITY[h.meta.kind] +
      (filters.route === "competency" && practicePhraseMatch(query, h.text) ? 2 : 0) }))
    .sort((a, b) => b.ranked - a.ranked);
  const ranked = slot(ordered, filters.route ?? "theory", topK);

  // The syllabus proves scope, but it cannot answer a student's question by
  // itself. Never surface a neighbouring syllabus paragraph as a citation
  // when there is no directly relevant, approved teaching passage.
  if (!ranked.length) return [];

  // A child question hit is never allowed to reach the reasoner alone. Expand
  // its question prefix to the full question block, all sub-parts, diagrams,
  // and every available marking-scheme row for that question.
  // Do not expand a merely incidental low-score paper hit: that can drag an
  // unrelated question and marking scheme into an otherwise correct theory
  // answer. Real child/parent hits comfortably clear this floor.
  const expandable = ranked;
  const prefixes = [...new Set(expandable.map((h) => h.meta.joinPrefix).filter(Boolean))] as string[];
  const parentIds = [...new Set(expandable.map((h) => h.meta.parentId).filter(Boolean))] as string[];
  const parents = await store.findByIds(parentIds, {
    ...contentFilters,
  });
  const expanded = await store.findByJoinPrefixes(prefixes, {
    ...contentFilters,
    topK: Math.max(24, topK * 4),
  });

  const merged = new Map<string, Chunk & { score: number }>();
  ranked.forEach((hit) => merged.set(hit.id, hit));
  parents.forEach((hit) => merged.set(hit.id, hit));
  expanded
    .sort((a, b) => PRIORITY[b.meta.kind] - PRIORITY[a.meta.kind])
    .forEach((hit) => merged.set(hit.id, hit));

  return [toSource(syllabusHit), ...[...merged.values()].map(toSource)];
}

export function practicePhraseMatch(query: string, candidate: string): boolean {
  const requestedSubquestion = parseExerciseSubquestion(query);
  if (requestedSubquestion) {
    const candidateSubquestion = parseExerciseSubquestion(candidate);
    return Boolean(candidateSubquestion && sameExerciseSubquestion(requestedSubquestion, candidateSubquestion));
  }
  const focus = query.match(/\bquestion\s*:\s*(.+)$/i)?.[1] ??
    query.match(/\b(?:about|on|regarding)\s+(.+)$/i)?.[1];
  if (!focus) return false;
  const normalized = (value: string) => value.toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  const phrase = normalized(focus).replace(/^(?:a|an|the)\s+/, "");
  return phrase.length >= 12 && normalized(candidate).includes(phrase);
}

type ExerciseSubquestion = { exercise: string; question: string; part: string };

function parseExerciseSubquestion(value: string): ExerciseSubquestion | null {
  const exercise = value.match(/\b(?:exercise|ex\.?)\s*(\d+)\s*\.\s*(\d+)\b/i);
  const question = value.match(/\b(?:question|q\.?)\s*(\d+)\s*\(\s*([ivxlcdm]+|[a-z])\s*\)/i);
  if (!exercise || !question) return null;
  return {
    exercise: `${exercise[1]}.${exercise[2]}`,
    question: question[1],
    part: question[2].toLowerCase(),
  };
}

function sameExerciseSubquestion(a: ExerciseSubquestion, b: ExerciseSubquestion) {
  return a.exercise === b.exercise && a.question === b.question && a.part === b.part;
}

function matchesExplicitExerciseSubquestion(query: string, candidate: string) {
  const requested = parseExerciseSubquestion(query);
  if (!requested) return true;
  const found = parseExerciseSubquestion(candidate);
  return Boolean(found && sameExerciseSubquestion(requested, found));
}

export function hasApprovedCompetencyQuestion(sources: Source[]) {
  return sources.some(
    (source) =>
      (["cfpq", "sqp", "pyq", "apq"].includes(source.kind) &&
        ["question_block", "question_part"].includes(source.chunkType ?? "")) ||
      (source.kind === "ncert_exercise" && source.chunkType === "ncert_question") ||
      (source.kind === "exemplar" && source.chunkType === "exemplar_question") ||
      (source.kind === "item_bank" && source.chunkType === "item_bank_question"),
  );
}

function isPracticeQuestionChunk(chunk: Chunk) {
  return (["cfpq", "sqp", "pyq", "apq"].includes(chunk.meta.kind) &&
    ["question_block", "question_part"].includes(chunk.meta.chunkType ?? "")) ||
    (chunk.meta.kind === "ncert_exercise" && chunk.meta.chunkType === "ncert_question") ||
    (chunk.meta.kind === "exemplar" && chunk.meta.chunkType === "exemplar_question") ||
    (chunk.meta.kind === "item_bank" && chunk.meta.chunkType === "item_bank_question" && chunk.meta.practiceModeEligible === true);
}

function slot<T extends Chunk & { score: number }>(
  ordered: T[],
  route: NonNullable<RetrievalFilters["route"]>,
  limit: number,
) {
  const selected: T[] = [];
  const add = (chunk?: T) => {
    if (chunk && !selected.some((item) => item.id === chunk.id)) selected.push(chunk);
  };

  if (["theory", "numerical", "diagram", "marking", "pyq"].includes(route)) {
    add(ordered.find((chunk) => chunk.meta.kind === "ncert"));
  }
  if (route === "diagram") add(ordered.find((chunk) => chunk.meta.kind === "diagram"));
  if (route === "marking" || route === "pyq") {
    add(ordered.find((chunk) => ["pyq", "sqp", "cfpq", "apq"].includes(chunk.meta.kind)));
    if (route === "marking") add(ordered.find((chunk) => ["ms", "apq_answer"].includes(chunk.meta.kind)));
  }
  if (route === "competency") {
    add(ordered.find(isPracticeQuestionChunk));
  }
  ordered.forEach((chunk) => {
    if (selected.length < limit) add(chunk);
  });
  return selected.slice(0, limit);
}

export function toSource(chunk: Chunk & { score: number }): Source {
  const parts = [KIND_LABEL[chunk.meta.kind]];
  if (chunk.meta.subject) parts.push(
    titleCase(chunk.meta.subject) +
    (chunk.meta.mathsTrack ? ` ${titleCase(chunk.meta.mathsTrack)}` : ""),
  );
  if (chunk.meta.chapter) parts.push(`Ch ${chunk.meta.chapter}`);
  if (chunk.meta.page) parts.push(`p. ${chunk.meta.page}`);

  return {
    id: chunk.id,
    kind: chunk.meta.kind,
    chunkType: chunk.meta.chunkType ?? chunk.meta.kind,
    label: parts.join(" · "),
    snippet: truncate(chunk.meta.extractiveQuote ?? chunk.text, 240),
    content: chunk.text,
    officialUrl: chunk.meta.officialUrl,
    diagramUrl: chunk.meta.kind === "diagram" ? signedDiagramUrl(chunk.id) : undefined,
    joinPrefix: chunk.meta.joinPrefix,
    joinKey: chunk.meta.joinKey,
    inActiveSyllabus: chunk.meta.inActiveSyllabus,
    subject: chunk.meta.subject,
    chapter: chunk.meta.chapter,
    page: chunk.meta.page,
    pageStart: chunk.meta.pageStart,
    pageEnd: chunk.meta.pageEnd,
    sourceYear: chunk.meta.sourceYear,
    mathsTrack: chunk.meta.mathsTrack,
    syllabusVersion: chunk.meta.syllabusVersion,
    syllabusTopicId: chunk.meta.syllabusTopicId,
    score: chunk.score,
  };
}

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function truncate(s: string, n: number) {
  return s.length <= n ? s : `${s.slice(0, n).trimEnd()}…`;
}

/**
 * Paragraph-aware chunking for the ingestion route.
 *
 * NCERT pages are short and already well-segmented, so paragraph boundaries
 * beat fixed-size windows here. Keep `maxChars` near 900 — long chunks blur
 * the citation and the snippet stops being quotable in the answer sheet.
 */
export function chunkText(
  text: string,
  meta: Chunk["meta"],
  opts: { maxChars?: number; overlap?: number } = {},
): Chunk[] {
  const maxChars = opts.maxChars ?? 900;
  const overlap = opts.overlap ?? 120;

  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const chunks: Chunk[] = [];
  let buffer = "";

  const flush = () => {
    if (!buffer.trim()) return;
    chunks.push({
      id: `${meta.subject}-${meta.chapter}-${meta.kind}-${chunks.length}`,
      text: buffer.trim(),
      meta,
    });
    buffer = buffer.slice(-overlap);
  };

  for (const p of paragraphs) {
    if ((buffer + " " + p).length > maxChars) flush();
    buffer += (buffer ? " " : "") + p;
  }
  flush();

  return chunks;
}
