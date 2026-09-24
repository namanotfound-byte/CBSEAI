import type { Chunk } from "../types";

/** Small development corpus that follows the production syllabus-mapping contract. */
export const SEED_CHUNKS: Chunk[] = [
  syllabus("science.life-processes.photosynthesis", "science", 5, "Photosynthesis: autotrophic nutrition, raw materials and major events."),
  syllabus("science.life-processes.stomata", "science", 5, "Stomata: gas exchange, water loss and the role of guard cells."),
  syllabus("science.life-processes.amoeba-nutrition", "science", 5, "Nutrition in Amoeba: ingestion with pseudopodia and a food vacuole, followed by digestion, absorption, assimilation and egestion, with a labelled diagram."),
  syllabus("science.electricity.ohms-law", "science", 11, "Ohm's law: V divided by I gives resistance; relation between voltage, potential difference and current; the unit of resistance is the ohm."),
  syllabus("science.electricity.resistor-combinations", "science", 11, "Series and parallel combinations of resistors and equivalent resistance."),
  syllabus("maths.quadratic-equations.roots", "maths", 4, "Quadratic formula and discriminant: standard form, real roots, equal roots, no real roots, and nature of roots."),
  syllabus("maths.quadratic-equations.word-problems", "maths", 4, "Quadratic word problems and sample-paper Question 12: forming the equation from a let statement, mark split and marking scheme."),
  syllabus("science.chemical-reactions.balancing-equations", "science", 1, "Writing and balancing chemical equations, physical states and reaction conditions."),
  {
    id: "sci-5-photosynthesis",
    text: "Photosynthesis takes place in three events: absorption of light energy by chlorophyll, conversion of that light energy into chemical energy along with the splitting of water into hydrogen and oxygen, and reduction of carbon dioxide to carbohydrates. These events need not take place one immediately after the other.",
    meta: contentMeta("ncert", "ncert_section", "science", 5, "2025", "science.life-processes.photosynthesis", "Nutrition in plants", { page: 95, officialUrl: "https://ncert.nic.in/textbook.php" }),
  },
  {
    id: "sci-5-stomata",
    text: "Exchange of gases across the leaf surface happens through stomata. Large amounts of water are also lost through these pores, so the plant closes them when it does not need carbon dioxide. The opening and closing is controlled by the swelling and shrinking of the guard cells.",
    meta: contentMeta("ncert", "ncert_section", "science", 5, "2025", "science.life-processes.stomata", "Stomata", { page: 96, officialUrl: "https://ncert.nic.in/textbook.php" }),
  },
  {
    id: "sci-5-pyq-2024",
    text: "Board question, 2024: Describe the process of nutrition in Amoeba with the help of a labelled diagram. Three marks were allotted — one for the stages named in order, one for the diagram, one for the labels.",
    meta: contentMeta("pyq", "question_block", "science", 5, "2024", "science.life-processes.amoeba-nutrition", "Nutrition in Amoeba", { joinPrefix: "2024|086/1/1|7", officialUrl: "https://cbseacademic.nic.in/" }),
  },
  {
    id: "ms-2024-086-q7",
    text: "Marking scheme for Q7: 1 mark for stages of ingestion, digestion, absorption and egestion in order; 1 mark for a neat Amoeba diagram; 1 mark for labels including pseudopodia, food vacuole and nucleus.",
    meta: contentMeta("ms", "marking_scheme", "science", 5, "2024", "science.life-processes.amoeba-nutrition", "Nutrition in Amoeba", { joinPrefix: "2024|086/1/1|7", joinKey: "2024|086/1/1|7|", officialUrl: "https://cbseacademic.nic.in/" }),
  },
  {
    id: "diag-amoeba-nutrition",
    text: "Diagram caption: Amoeba nutrition showing pseudopodia surrounding food, food vacuole inside cytoplasm, nucleus and egestion of undigested residue. Tags: amoeba, nutrition, pseudopodia, food vacuole.",
    meta: contentMeta("diagram", "diagram", "science", 5, "2025", "science.life-processes.amoeba-nutrition", "Nutrition in Amoeba", { page: 97, joinPrefix: "2024|086/1/1|7", conceptTags: ["amoeba", "nutrition", "pseudopodia", "food vacuole"], officialUrl: "https://ncert.nic.in/textbook.php" }),
  },
  {
    id: "sci-11-ohms-law",
    text: "Ohm's law states that the potential difference across the ends of a metallic conductor is directly proportional to the current flowing through it, provided its temperature remains the same. The constant of proportionality is the resistance, measured in ohms.",
    meta: contentMeta("ncert", "ncert_section", "science", 11, "2025", "science.electricity.ohms-law", "Ohm's law", { page: 201, officialUrl: "https://ncert.nic.in/textbook.php" }),
  },
  {
    id: "sci-11-exemplar-series",
    text: "In a series combination the current through every resistor is the same and the total resistance is the sum of the individual resistances. In parallel the potential difference is the same across each resistor and the reciprocals of the resistances add.",
    meta: contentMeta("exemplar", "exemplar_item", "science", 11, "2024", "science.electricity.resistor-combinations", "Combination of resistors", { officialUrl: "https://ncert.nic.in/exemplar-problems.php" }),
  },
  {
    id: "math-4-quadratic",
    text: "A quadratic equation ax² + bx + c = 0, a ≠ 0, has real roots when the discriminant b² − 4ac is greater than or equal to zero. The roots are then given by x = (−b ± √(b² − 4ac)) / 2a.",
    meta: contentMeta("ncert", "ncert_section", "maths", 4, "2025", "maths.quadratic-equations.roots", "Nature of roots", { page: 72, officialUrl: "https://ncert.nic.in/textbook.php" }),
  },
  {
    id: "math-4-sqp",
    text: "Sample paper question: The product of two consecutive positive integers is 306. Form a quadratic equation and find the integers.",
    meta: contentMeta("sqp", "question_block", "maths", 4, "2026", "maths.quadratic-equations.word-problems", "Word problems", { joinPrefix: "2026|041/1/1|12", officialUrl: "https://cbseacademic.nic.in/" }),
  },
  {
    id: "ms-2026-041-q12",
    text: "Marking scheme for Q12: 1 mark for a correct 'let' statement; 1 mark for forming the quadratic equation; 1 mark for solving the roots; 1 mark for rejecting the impossible value; 1 mark for the final answer with unit.",
    meta: contentMeta("ms", "marking_scheme", "maths", 4, "2026", "maths.quadratic-equations.word-problems", "Word problems", { joinPrefix: "2026|041/1/1|12", joinKey: "2026|041/1/1|12|", officialUrl: "https://cbseacademic.nic.in/" }),
  },
  {
    id: "sci-1-balancing",
    text: "A balanced chemical equation has an equal number of atoms of each element on both sides. Physical states are written in brackets after the formulae, and conditions such as heat, pressure or a catalyst are written above or below the arrow.",
    meta: contentMeta("ncert", "ncert_section", "science", 1, "2025", "science.chemical-reactions.balancing-equations", "Balanced chemical equations", { page: 8, officialUrl: "https://ncert.nic.in/textbook.php" }),
  },
];

function syllabus(topicId: string, subject: "science" | "maths", chapter: number, text: string): Chunk {
  return {
    id: `syllabus-${topicId}`,
    text,
    meta: contentMeta("syllabus", "syllabus_scope", subject, chapter, "2026-27", topicId, text),
  };
}

function contentMeta(
  kind: Chunk["meta"]["kind"],
  chunkType: string,
  subject: Chunk["meta"]["subject"],
  chapter: number,
  sourceYear: string,
  syllabusTopicId: string,
  heading: string,
  extra: Partial<Chunk["meta"]> = {},
): Chunk["meta"] {
  return {
    kind,
    chunkType,
    subject,
    chapter,
    sourceYear,
    syllabusVersion: "2026-27",
    syllabusTopicId,
    heading,
    language: "en",
    officialUrl: "https://cbseacademic.nic.in/",
    inActiveSyllabus: true,
    ...extra,
  };
}
