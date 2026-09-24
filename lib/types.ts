/**
 * Shared vocabulary for the whole app.
 * The UI, the model adapter and the retriever all speak these shapes, so you
 * can swap any one of the three without touching the other two.
 */

export type Grade = 10; // widen to 6 | 7 | 8 | 9 | 10 | 11 | 12 as we expand

export type SubjectId =
  | "science"
  | "maths"
  | "social"
  | "english"
  | "hindi";

export interface Subject {
  id: SubjectId;
  name: string;
  short: string;
  /** Chapters as they appear in the current-year NCERT, in order. */
  chapters: Chapter[];
}

export interface Chapter {
  no: number;
  name: string;
  /** Rough board weightage in marks, used by the plan + graph screens. */
  marks: number;
}

/** Where a retrieved chunk came from. Drives the citation chip styling. */
export type SourceKind =
  | "syllabus"
  | "ncert"
  | "exemplar"
  | "pyq"
  | "sqp"
  | "ms"
  | "diagram"
  | "model"
  | "cfpq"
  | "notes";

export interface Source {
  id: string;
  kind: SourceKind;
  chunkType?: string;
  /** e.g. "NCERT Science · Ch 1 · p. 14" */
  label: string;
  /** Verbatim snippet shown in the answer sheet. Keep it short. */
  snippet: string;
  /** Full retrieved block sent to the reasoner; never rendered as a card. */
  content?: string;
  officialUrl?: string;
  diagramUrl?: string;
  joinPrefix?: string;
  joinKey?: string;
  inActiveSyllabus?: boolean;
  subject?: SubjectId;
  chapter?: number;
  page?: number;
  pageStart?: number;
  pageEnd?: number;
  /** Original publication/exam year of this document, e.g. "2024". */
  sourceYear?: string;
  /** Syllabus release this source was reviewed against, e.g. "2026-27". */
  syllabusVersion?: string;
  /** Canonical active-syllabus node this content is allowed to support. */
  syllabusTopicId?: string;
  score?: number;
}

/** A single scoring step, mirroring how a CBSE examiner splits marks. */
export interface MarkStep {
  marks: number;
  /** What earns this mark, in the examiner's words. */
  for: string;
}

export type AnswerMode =
  | "answer" // write it the way you'd write it in the board exam
  | "explain" // understand it first
  | "revise" // 30-second recap
  | "drill"; // ask me questions instead

export type Role = "user" | "assistant";

export interface ImagePart {
  type: "image";
  /** data: URL or https URL for the hosted vision model. */
  url: string;
  alt?: string;
}

export interface TextPart {
  type: "text";
  text: string;
}

export type ContentPart = TextPart | ImagePart;

export interface Message {
  id: string;
  role: Role;
  content: ContentPart[];
  createdAt: number;
  /** Assistant-only. Populated from the retriever. */
  sources?: Source[];
  /** Assistant-only. The marking-scheme breakdown shown in the margin rail. */
  steps?: MarkStep[];
  /** Assistant-only. Total marks the answer is written for. */
  marks?: number;
  /** Assistant-only. Orchestrator notices, not model prose. */
  notice?: string;
  mode?: AnswerMode;
  /** Set while tokens are still arriving. */
  streaming?: boolean;
  error?: string;
}

/** Context the composer attaches to every turn. */
export interface ChatContext {
  grade: Grade;
  subject?: SubjectId;
  chapter?: number;
  mode: AnswerMode;
  /** Marks the question is worth — changes answer length materially. */
  marks?: 1 | 2 | 3 | 5;
}

export interface ChatRequestBody {
  messages: Pick<Message, "role" | "content">[];
  context: ChatContext;
}

/** Server-sent events emitted by /api/chat. */
export type ChatEvent =
  | { type: "sources"; sources: Source[] }
  | { type: "token"; text: string }
  | { type: "steps"; steps: MarkStep[]; marks?: number }
  | { type: "notice"; message: string }
  | { type: "error"; message: string }
  | { type: "done" };

/** A chunk of the corpus, post-ingestion. */
export interface Chunk {
  id: string;
  text: string;
  embedding?: number[];
  meta: {
    kind: SourceKind;
    subject: SubjectId;
    chapter: number;
    page?: number;
    pageStart?: number;
    pageEnd?: number;
    /** Original publication/exam year. Never overwritten during ingestion. */
    sourceYear: string;
    /** Syllabus version this chunk was reviewed and mapped against. */
    syllabusVersion: string;
    /** Canonical syllabus node. Required for every retrievable chunk. */
    syllabusTopicId: string;
    heading?: string;
    chunkType?: string;
    parentId?: string;
    extractiveQuote?: string;
    contentSha256?: string;
    ncertEdition?: string;
    language?: string;
    conceptTags?: string[];
    diagramIds?: string[];
    linkedMsId?: string | null;
    officialUrl?: string;
    joinPrefix?: string;
    joinKey?: string;
    inActiveSyllabus: boolean;
    /** Explicit human/content QA gate before production indexing. */
    reviewStatus?: "staging" | "approved";
    assessmentStatus?: "summative" | "formative" | "excluded";
    sourcePath?: string;
    extractionVersion?: string;
    mathsTrack?: "standard" | "basic";
  };
}

export interface RetrievalFilters {
  subject?: SubjectId;
  chapter?: number;
  chapters?: number[];
  kinds?: SourceKind[];
  syllabusVersion?: string;
  syllabusTopicId?: string;
  topK?: number;
  route?: QueryRoute;
}

export type QueryRoute =
  | "theory"
  | "numerical"
  | "diagram"
  | "marking"
  | "pyq"
  | "competency";

/** Per-topic mastery, from the student's own answers. Powers /graph. */
export interface TopicMastery {
  subject: SubjectId;
  chapter: number;
  topic: string;
  /** 0–1. Below 0.45 is flagged in examiner red. */
  mastery: number;
  attempts: number;
  lastSeen: number;
  /** Concepts the student keeps dropping marks on. */
  slips?: string[];
}
