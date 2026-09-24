import type { Subject, SubjectId } from "../types";

/**
 * Class 10 chapter list, ordered as in the rationalised NCERT.
 *
 * NOTE — this is the one file that must be re-checked every April. NCERT drops
 * and renumbers chapters between editions and the model is pinned to a year
 * (see env.syllabusVersion). When you refresh this, bump SYLLABUS_VERSION too so retrieval
 * and the UI stay on the same edition.
 *
 * `marks` is approximate board weightage, used to order the study plan.
 */
export const SUBJECTS: Subject[] = [
  {
    id: "science",
    name: "Science",
    short: "Sci",
    chapters: [
      { no: 1, name: "Chemical Reactions and Equations", marks: 5 },
      { no: 2, name: "Acids, Bases and Salts", marks: 6 },
      { no: 3, name: "Metals and Non-metals", marks: 6 },
      { no: 4, name: "Carbon and its Compounds", marks: 8 },
      { no: 5, name: "Life Processes", marks: 8 },
      { no: 6, name: "Control and Coordination", marks: 6 },
      { no: 7, name: "How do Organisms Reproduce?", marks: 6 },
      { no: 8, name: "Heredity", marks: 4 },
      { no: 9, name: "Light — Reflection and Refraction", marks: 8 },
      { no: 10, name: "The Human Eye and the Colourful World", marks: 5 },
      { no: 11, name: "Electricity", marks: 8 },
      { no: 12, name: "Magnetic Effects of Electric Current", marks: 5 },
      { no: 13, name: "Our Environment", marks: 5 },
    ],
  },
  {
    id: "maths",
    name: "Mathematics",
    short: "Math",
    chapters: [
      { no: 1, name: "Real Numbers", marks: 6 },
      { no: 2, name: "Polynomials", marks: 4 },
      { no: 3, name: "Pair of Linear Equations in Two Variables", marks: 6 },
      { no: 4, name: "Quadratic Equations", marks: 5 },
      { no: 5, name: "Arithmetic Progressions", marks: 5 },
      { no: 6, name: "Triangles", marks: 7 },
      { no: 7, name: "Coordinate Geometry", marks: 6 },
      { no: 8, name: "Introduction to Trigonometry", marks: 6 },
      { no: 9, name: "Some Applications of Trigonometry", marks: 6 },
      { no: 10, name: "Circles", marks: 6 },
      { no: 11, name: "Areas Related to Circles", marks: 4 },
      { no: 12, name: "Surface Areas and Volumes", marks: 6 },
      { no: 13, name: "Statistics", marks: 6 },
      { no: 14, name: "Probability", marks: 5 },
    ],
  },
  {
    id: "social",
    name: "Social Science",
    short: "SST",
    chapters: [
      { no: 1, name: "The Rise of Nationalism in Europe", marks: 5 },
      { no: 2, name: "Nationalism in India", marks: 5 },
      { no: 3, name: "The Making of a Global World", marks: 5 },
      { no: 4, name: "The Age of Industrialisation", marks: 5 },
      { no: 5, name: "Print Culture and the Modern World", marks: 5 },
      { no: 6, name: "Resources and Development", marks: 5 },
      { no: 7, name: "Forest and Wildlife Resources", marks: 3 },
      { no: 8, name: "Water Resources", marks: 4 },
      { no: 9, name: "Agriculture", marks: 5 },
      { no: 10, name: "Minerals and Energy Resources", marks: 5 },
      { no: 11, name: "Manufacturing Industries", marks: 5 },
      { no: 12, name: "Lifelines of National Economy", marks: 4 },
      { no: 13, name: "Power Sharing", marks: 3 },
      { no: 14, name: "Federalism", marks: 4 },
      { no: 15, name: "Gender, Religion and Caste", marks: 4 },
      { no: 16, name: "Political Parties", marks: 4 },
      { no: 17, name: "Outcomes of Democracy", marks: 3 },
      { no: 18, name: "Development", marks: 4 },
      { no: 19, name: "Sectors of the Indian Economy", marks: 5 },
      { no: 20, name: "Money and Credit", marks: 5 },
      { no: 21, name: "Globalisation and the Indian Economy", marks: 4 },
    ],
  },
  {
    id: "english",
    name: "English Lang. & Lit.",
    short: "Eng",
    chapters: [
      { no: 1, name: "First Flight — Prose", marks: 10 },
      { no: 2, name: "First Flight — Poems", marks: 8 },
      { no: 3, name: "Footprints Without Feet", marks: 10 },
      { no: 4, name: "Grammar", marks: 10 },
      { no: 5, name: "Writing — Letter & Analytical Paragraph", marks: 10 },
      { no: 6, name: "Reading — Unseen Passages", marks: 20 },
    ],
  },
  {
    id: "hindi",
    name: "हिंदी",
    short: "हिं",
    chapters: [
      { no: 1, name: "क्षितिज — काव्य खंड", marks: 12 },
      { no: 2, name: "क्षितिज — गद्य खंड", marks: 12 },
      { no: 3, name: "कृतिका", marks: 10 },
      { no: 4, name: "व्याकरण", marks: 16 },
      { no: 5, name: "लेखन", marks: 20 },
    ],
  },
];

/** Only these subjects have a reviewed current-year RAG pipeline. */
export const ACTIVE_SUBJECTS = SUBJECTS.filter((subject) =>
  subject.id === "science" || subject.id === "maths"
);

export const SUBJECT_MAP: Record<SubjectId, Subject> = Object.fromEntries(
  SUBJECTS.map((s) => [s.id, s]),
) as Record<SubjectId, Subject>;

export function chapterName(subject?: SubjectId, no?: number) {
  if (!subject || !no) return undefined;
  return SUBJECT_MAP[subject]?.chapters.find((c) => c.no === no)?.name;
}
