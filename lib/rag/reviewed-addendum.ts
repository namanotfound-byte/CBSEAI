import type { Chunk } from "@/lib/types";
import scienceConcepts from "@/data/corpus/science-concept-reviewed-addendum.json";
import mathsConcepts from "@/data/corpus/maths-reviewed-addendum-2.json";
import scienceSamplePaper from "@/data/corpus/science-sqp-reviewed-addendum.json";

// Page-checked against the authoritative ../Data source corpus.
const FIRST_REVIEWED_ADDENDUM: Chunk[] = [
  {
    "id": "ncert.maths.ch03.p012.elimination_method",
    "text": "To solve a pair of linear equations by elimination, first multiply the equations by suitable non-zero numbers so that one variable has coefficients of equal magnitude. Add or subtract the equations to eliminate that variable. If this gives a true statement with no variable, there are infinitely many solutions; if it gives a false statement, there is no solution. Otherwise, solve for the remaining variable and substitute its value into an original equation to find the other variable.",
    "meta": {
      "kind": "ncert",
      "subject": "maths",
      "sourceYear": "2026",
      "syllabusVersion": "2026-27",
      "inActiveSyllabus": true,
      "assessmentStatus": "summative",
      "reviewStatus": "approved",
      "officialUrl": "https://ncert.nic.in/textbook.php?jemh1=0-14",
      "language": "en",
      "reviewBatch": "maths-addon-20260925",
      "reviewEvidence": "reports/maths-reviewed-addendum-source-review.md",
      "extractionVersion": "visual-page-curation-v1",
      "chapter": 3,
      "page": 12,
      "printedPage": 35,
      "syllabusTopicId": "maths.ch03",
      "chunkType": "ncert_section",
      "heading": "Pair of Linear Equations in Two Variables · printed textbook p. 35",
      "contentSha256": "d04ef69d830a97243be9bd1cab0aa82399056f0f4a621bb71bbe97ecd1dfa147",
      "sourcePath": "NCERTs/Maths_2026.zip!/jemh103.pdf",
      "conceptTags": [
        "linear equations",
        "elimination method",
        "infinite solutions",
        "no solution"
      ],
      "extractiveQuote": "Let us now note down these steps in the elimination method",
      "sourceTransform": "page_verified_paraphrase"
    }
  },
  {
    "id": "ncert.maths.ch06.p016.sss_similarity",
    "text": "SSS similarity criterion: If the three pairs of corresponding sides of two triangles are proportional, then their corresponding angles are equal and the triangles are similar.",
    "meta": {
      "kind": "ncert",
      "subject": "maths",
      "sourceYear": "2026",
      "syllabusVersion": "2026-27",
      "inActiveSyllabus": true,
      "assessmentStatus": "summative",
      "reviewStatus": "approved",
      "officialUrl": "https://ncert.nic.in/textbook.php?jemh1=0-14",
      "language": "en",
      "reviewBatch": "maths-addon-20260925",
      "reviewEvidence": "reports/maths-reviewed-addendum-source-review.md",
      "extractionVersion": "visual-page-curation-v1",
      "chapter": 6,
      "page": 16,
      "printedPage": 88,
      "syllabusTopicId": "maths.ch06",
      "chunkType": "ncert_section",
      "heading": "Triangles · printed textbook p. 88",
      "contentSha256": "028a1243ccd005e952fca0f9c498be86cd526b74deb0bc6cd5147e15eef12f58",
      "sourcePath": "NCERTs/Maths_2026.zip!/jemh106.pdf",
      "conceptTags": [
        "similar triangles",
        "SSS similarity criterion",
        "proportional sides"
      ],
      "extractiveQuote": "If in two triangles, sides of one triangle are proportional",
      "sourceTransform": "page_verified_paraphrase"
    }
  },
  {
    "id": "ncert.maths.ch11.p004.segment_area",
    "text": "For the minor circular segment AYB in Fig. 11.6, bounded by chord AB and the minor arc AYB, area of segment AYB = area of sector OAYB - area of triangle OAB. In the worked example, the central angle AOB is 120 degrees.",
    "meta": {
      "kind": "ncert",
      "subject": "maths",
      "sourceYear": "2026",
      "syllabusVersion": "2026-27",
      "inActiveSyllabus": true,
      "assessmentStatus": "summative",
      "reviewStatus": "approved",
      "officialUrl": "https://ncert.nic.in/textbook.php?jemh1=0-14",
      "language": "en",
      "reviewBatch": "maths-addon-20260925",
      "reviewEvidence": "reports/maths-reviewed-addendum-source-review.md",
      "extractionVersion": "visual-page-curation-v1",
      "chapter": 11,
      "page": 4,
      "printedPage": 157,
      "syllabusTopicId": "maths.ch11",
      "chunkType": "ncert_section",
      "heading": "Areas Related to Circles · printed textbook p. 157",
      "contentSha256": "1c73d7750139b63e98acf3682a7cae1a9bd163ed40d8e90e2199ab72e99c73b1",
      "sourcePath": "NCERTs/Maths_2026.zip!/jemh111.pdf",
      "conceptTags": [
        "circular segment",
        "sector",
        "triangle area",
        "120 degrees"
      ],
      "extractiveQuote": "Area of the segment AY B",
      "sourceTransform": "page_verified_paraphrase"
    }
  },
  {
    "id": "ncert.maths.ch14.p005.complement_rule",
    "text": "The event 'not E' is the complement of event E. E and not E are complementary events. Their probabilities add to 1, so P(not E) = 1 - P(E).",
    "meta": {
      "kind": "ncert",
      "subject": "maths",
      "sourceYear": "2026",
      "syllabusVersion": "2026-27",
      "inActiveSyllabus": true,
      "assessmentStatus": "summative",
      "reviewStatus": "approved",
      "officialUrl": "https://ncert.nic.in/textbook.php?jemh1=0-14",
      "language": "en",
      "reviewBatch": "maths-addon-20260925",
      "reviewEvidence": "reports/maths-reviewed-addendum-source-review.md",
      "extractionVersion": "visual-page-curation-v1",
      "chapter": 14,
      "page": 5,
      "printedPage": 206,
      "syllabusTopicId": "maths.ch14",
      "chunkType": "ncert_section",
      "heading": "Probability · printed textbook p. 206",
      "contentSha256": "d5f516dc7109fe926ae7388aac3f4b87a776e41098fc517baec0eec000528d11",
      "sourcePath": "NCERTs/Maths_2026.zip!/jemh114.pdf",
      "conceptTags": [
        "complementary events",
        "probability",
        "not E"
      ],
      "extractiveQuote": "P(E) + P(not E) = 1",
      "sourceTransform": "page_verified_paraphrase"
    }
  },
  {
    "id": "ncert.science.ch01.p008.para21",
    "text": "Decomposition of calcium carbonate to calcium oxide and carbon dioxide on heating is an important decomposition reaction used in various industries. Calcium oxide is called lime or quick lime. It has many uses – one is in the manufacture of cement. When a decomposition reaction is carried out by heating, it is called thermal decomposition.",
    "meta": {
      "kind": "ncert",
      "subject": "science",
      "chapter": 1,
      "sourceYear": "undated",
      "syllabusVersion": "2026-27",
      "syllabusTopicId": "science.ch01",
      "chunkType": "ncert_paragraph",
      "heading": "Chemical Reactions and Equations",
      "officialUrl": "https://ncert.nic.in/textbook.php?jesc1=0-13",
      "inActiveSyllabus": true,
      "assessmentStatus": "summative",
      "reviewStatus": "approved",
      "contentSha256": "9d58fa614b2d1064f4ef13423eaf85155b0efc5e74bdf3e8c5e6f15f1b742d36",
      "language": "en",
      "page": 8,
      "extractionVersion": "pdfplumber-main-column-v2",
      "sourcePath": "NCERTs/Science_2026.zip!/jesc101.pdf",
      "extractiveQuote": "Decomposition of calcium carbonate to calcium oxide and carbon dioxide on heating is an important decomposition reaction used in various industries. Calcium oxide is called lime or quick lime. It has many uses – one is in the manufacture of",
      "reviewBatch": "science-addon-20260925",
      "reviewEvidence": "reports/science-addendum-source-review.md"
    }
  },
  {
    "id": "ncert.science.ch05.p008.para03",
    "text": "The small intestine is the site of the complete digestion of carbohydrates, proteins and fats. It receives the secretions of the liver and pancreas for this purpose. The food coming from the stomach is acidic and has to be made alkaline for the pancreatic enzymes to act. Bile juice from the liver accomplishes this in addition to acting on fats. Fats are present in the intestine in the form of large globules which makes it difficult for enzymes to act on them. Bile salts break them down into smaller globules increasing the efficiency of enzyme action. This is similar to the emulsifying action of soaps on dirt that we have learnt about in Chapter 4. The pancreas secretes pancreatic juice which contains enzymes like trypsin for digesting proteins and lipase for breaking down emulsified fats. The walls of the small intestine contain glands which secrete intestinal juice. The enzymes present in it finally convert the proteins to amino acids, complex carbohydrates into glucose and fats into fatty acids and glycerol.",
    "meta": {
      "kind": "ncert",
      "subject": "science",
      "chapter": 5,
      "sourceYear": "undated",
      "syllabusVersion": "2026-27",
      "syllabusTopicId": "science.ch05",
      "chunkType": "ncert_paragraph",
      "heading": "Life Processes",
      "officialUrl": "https://ncert.nic.in/textbook.php?jesc1=0-13",
      "inActiveSyllabus": true,
      "assessmentStatus": "summative",
      "reviewStatus": "approved",
      "contentSha256": "685ec7228afeb79d7bc9b989648e381e5eb4b5a6d290d6a13374489c9284054f",
      "language": "en",
      "page": 8,
      "extractionVersion": "pdfplumber-main-column-v2",
      "sourcePath": "NCERTs/Science_2026.zip!/jesc105.pdf",
      "extractiveQuote": "The small intestine is the site of the complete digestion of carbohydrates, proteins and fats. It receives the secretions of the liver and pancreas for this purpose. The food coming from the stomach is acidic and has to be made alkaline for",
      "reviewBatch": "science-addon-20260925",
      "reviewEvidence": "reports/science-addendum-source-review.md"
    }
  },
  {
    "id": "ncert.science.ch07.p012.para05",
    "text": "If the egg is not fertilised, it lives for about one day. Since the ovary releases one egg every month, the uterus also prepares itself every month to receive a fertilised egg. Thus its lining becomes thick and spongy. This would be required for nourishing the embryo if fertilisation had taken place. Now, however, this lining is not needed any longer. So, the lining slowly breaks and comes out through the vagina as blood and mucous. This cycle takes place roughly every month and is known as menstruation. It usually lasts for about two to eight days.",
    "meta": {
      "kind": "ncert",
      "subject": "science",
      "chapter": 7,
      "sourceYear": "undated",
      "syllabusVersion": "2026-27",
      "syllabusTopicId": "science.ch07",
      "chunkType": "ncert_paragraph",
      "heading": "How do Organisms Reproduce?",
      "officialUrl": "https://ncert.nic.in/textbook.php?jesc1=0-13",
      "inActiveSyllabus": true,
      "assessmentStatus": "summative",
      "reviewStatus": "approved",
      "contentSha256": "575cb5a50b488a46715e500d4cbeaf3b687bf01f9da7989c928d35f1a3a88ec0",
      "language": "en",
      "page": 12,
      "extractionVersion": "pdfplumber-main-column-v2",
      "sourcePath": "NCERTs/Science_2026.zip!/jesc107.pdf",
      "extractiveQuote": "If the egg is not fertilised, it lives for about one day. Since the ovary releases one egg every month, the uterus also prepares itself every month to receive a fertilised egg. Thus its lining becomes thick and spongy. This would be require",
      "reviewBatch": "science-addon-20260925",
      "reviewEvidence": "reports/science-addendum-source-review.md"
    }
  },
  {
    "id": "ncert.science.ch10.p002.para05",
    "text": "Sometimes, the crystalline lens of people at old age becomes milky and cloudy. This condition is called cataract. This causes partial or complete loss of vision. It is possible to restore vision through a cataract surgery.",
    "meta": {
      "kind": "ncert",
      "subject": "science",
      "chapter": 10,
      "sourceYear": "undated",
      "syllabusVersion": "2026-27",
      "syllabusTopicId": "science.ch10",
      "chunkType": "ncert_paragraph",
      "heading": "The Human Eye and the Colourful World",
      "officialUrl": "https://ncert.nic.in/textbook.php?jesc1=0-13",
      "inActiveSyllabus": true,
      "assessmentStatus": "summative",
      "reviewStatus": "approved",
      "contentSha256": "c8ed49fa55eedeb9ee5d5fbfa6d02061adb94075e94a32ca9bd16f4caf67c423",
      "language": "en",
      "page": 2,
      "extractionVersion": "pdfplumber-main-column-v2",
      "sourcePath": "NCERTs/Science_2026.zip!/jesc110.pdf",
      "extractiveQuote": "Sometimes, the crystalline lens of people at old age becomes milky and cloudy. This condition is called cataract. This causes partial or complete loss of vision. It is possible to restore vision through a cataract surgery.",
      "reviewBatch": "science-addon-20260925",
      "reviewEvidence": "reports/science-addendum-source-review.md"
    }
  },
  {
    "id": "ncert.science.ch08.p002.inheritance_rules",
    "text": "The rules for inheritance of such traits in human beings are related to the fact that both the father and the mother contribute practically equal amounts of genetic material to the child. This means that each trait can be influenced by both paternal and maternal DNA. Thus, for each trait there will be two versions in each child.",
    "meta": {
      "kind": "ncert",
      "subject": "science",
      "chapter": 8,
      "sourceYear": "2026",
      "syllabusVersion": "2026-27",
      "syllabusTopicId": "science.ch08",
      "chunkType": "ncert_section",
      "heading": "Rules for the Inheritance of Traits — Mendel’s Contributions",
      "officialUrl": "https://ncert.nic.in/textbook.php?jesc1=0-13",
      "inActiveSyllabus": true,
      "assessmentStatus": "summative",
      "reviewStatus": "approved",
      "contentSha256": "b0357c0bcc860190c9d3dccc7c91ee31a65012442e795be5bc00cd9f621bff5b",
      "language": "en",
      "extractionVersion": "manual-visual-excerpt-v1",
      "sourcePath": "NCERTs/Science_2026.zip!/jesc108.pdf",
      "reviewBatch": "science-addon-20260925",
      "reviewEvidence": "reports/science-addendum-source-review.md",
      "page": 2,
      "extractiveQuote": "The rules for inheritance of such traits in human beings are related to the fact that both the father and the mother contribute practically equal amounts of genetic material to the child. This means that each trait can be influenced by both"
    }
  },
  {
    "id": "ncert.science.ch08.p005.sex_chromosomes",
    "text": "Most human chromosomes have a maternal and a paternal copy, and we have 22 such pairs. But one pair, called the sex chromosomes, is odd in not always being a perfect pair. Women have a perfect pair of sex chromosomes, both called X. But men have a mismatched pair in which one is a normal-sized X while the other is a short one called Y. So women are XX, while men are XY.",
    "meta": {
      "kind": "ncert",
      "subject": "science",
      "chapter": 8,
      "sourceYear": "2026",
      "syllabusVersion": "2026-27",
      "syllabusTopicId": "science.ch08",
      "chunkType": "ncert_section",
      "heading": "Sex Determination",
      "officialUrl": "https://ncert.nic.in/textbook.php?jesc1=0-13",
      "inActiveSyllabus": true,
      "assessmentStatus": "summative",
      "reviewStatus": "approved",
      "contentSha256": "b0357c0bcc860190c9d3dccc7c91ee31a65012442e795be5bc00cd9f621bff5b",
      "language": "en",
      "extractionVersion": "manual-visual-excerpt-v1",
      "sourcePath": "NCERTs/Science_2026.zip!/jesc108.pdf",
      "reviewBatch": "science-addon-20260925",
      "reviewEvidence": "reports/science-addendum-source-review.md",
      "page": 5,
      "extractiveQuote": "Most human chromosomes have a maternal and a paternal copy, and we have 22 such pairs. But one pair, called the sex chromosomes, is odd in not always being a perfect pair. Women have a perfect pair of sex chromosomes, both called X. But men"
    }
  }
];

// The JSON files mirror the page-reviewed, checksum-pinned records in ../Data.
// Keep the corpus records in the deployment so the owner-only publishing route
// cannot accept arbitrary client-provided source text.
export const REVIEWED_ADDENDUM: Chunk[] = [
  ...FIRST_REVIEWED_ADDENDUM,
  ...(scienceConcepts as Chunk[]),
  ...(mathsConcepts as Chunk[]),
  ...(scienceSamplePaper as Chunk[]),
];
