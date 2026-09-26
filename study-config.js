import { finalCases, finalVersion } from "./study-cases.js?v=blind-r1";   // qualcompare 에서 고른 최종 케이스 (build_study_cases.py 가 만든다)
// Replace cases with the selected results later. Never map videos by array position.
// Bump version when changing actual study materials; drafts are scoped to config content.
const practiceCaseId = "-9kDwdxVlEw_04841_D_seg01__add";
const models = [
  { id: "m01", label: "Model A", size: "" },
  { id: "m02", label: "Model B", size: "" },
  { id: "m03", label: "Model C", size: "" },
  { id: "m04", label: "Model D", size: "" },
];

export const studyConfig = {
  id: "subject-action-study",
  materialsRevision: "r20260926-01",
  interactionRevision: "two-cases-repeat-penalty-14",
  version: `${finalCases.length ? finalVersion : "template-2-en"}-sequential-2`,
  casesPerParticipant: 2,
  practiceCaseId,
  practiceCase: finalCases.find(item => item.id === practiceCaseId),
  practiceEventIds: ["s1-2", "s1-6"], // One early and one late action keep the practice concise.
  // Relative draw weights; unlisted cases have weight 1. No repeats per participant.
  caseSamplingWeights: {
    "4XsII-V5muw_13884_B_seg01__add": 10,
    "tt0038650__shot_0256_img_0": 10,
    "0HR01_seg01__add": 10,
  },
  caseSamplingConstraint: {
    caseIds: ["4XsII-V5muw_13884_B_seg01__add", "tt0038650__shot_0256_img_0", "0HR01_seg01__add"],
    maxCount: 2,
    repeatWeightMultiplier: 0.15,
  },
  modelLeftmostWeights: { m01: 2 },
  demo: !finalCases.length, // Allows trying the form without real media. Exports are marked as demo.
  blind: true, // Display (a)–(d); exports preserve stable model IDs and per-case display order.
  models,
  cases: finalCases.length ? finalCases.filter(item => item.id !== practiceCaseId) : Array.from({ length: 15 }, (_, index) => ({
    id: `case-${String(index + 1).padStart(2, "0")}`,
    title: `Example scene ${String(index + 1).padStart(2, "0")}`,
    duration: 6,
    prompt: "The person on the left picks up the cup from the table, then drinks from it. The person on the right waves their right hand.",
    initialFrame: "assets/initial-frame.svg?v=academic-3",
    subjects: [
      { id: "s1", label: "S1", description: "Person on the left", mask: "assets/mask-s1.svg", maskMode: "luminance", color: "#12ae79" },
      { id: "s2", label: "S2", description: "Person on the right", mask: "assets/mask-s2.svg", maskMode: "luminance", color: "#9764ed" },
    ],
    events: [
      { id: "s1-pick-up", subjectId: "s1", start: 0, end: 2, action: "Pick up the cup", prompt: "The person on the left picks up the cup from the table." },
      { id: "s1-drink", subjectId: "s1", start: 2, end: 4, action: "Drink from the cup", prompt: "The person on the left drinks from the cup." },
      { id: "s2-wave", subjectId: "s2", start: 2, end: 6, action: "Wave the right hand", prompt: "The person on the right waves their right hand." },
    ],
    videos: { m01: "", m02: "", m03: "", m04: "" },
  })),
};
