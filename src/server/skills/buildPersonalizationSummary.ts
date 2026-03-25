import type { NormalizedNotionRecord, PersonalizationSummary } from "../types";

interface BuildPersonalizationSummaryInput {
  recentRecords: NormalizedNotionRecord[];
}

function collectCounts(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const value of values) {
    const key = value.trim();
    if (!key) {
      continue;
    }

    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

function topEntries(values: string[], minimumCount: number): string[] {
  return [...collectCounts(values).entries()]
    .filter(([, count]) => count >= minimumCount)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([value]) => value);
}

export function buildPersonalizationSummary(
  input: BuildPersonalizationSummaryInput,
): PersonalizationSummary {
  const recentRecords = input.recentRecords.slice(0, 5);
  if (recentRecords.length === 0) {
    return {
      recentPatterns: [],
      stablePreferences: [],
      avoidRepeats: [],
      confidenceNotes: "No recent history is available.",
    };
  }

  const tones = recentRecords.map((record) => record.tone ?? "").filter(Boolean);
  const breakfastCategories = recentRecords.map((record) => record.breakfastCategory ?? "").filter(Boolean);
  const sceneSettings = recentRecords.map((record) => record.sceneSetting ?? "").filter(Boolean);
  const breakfastNames = recentRecords.map((record) => record.breakfastName ?? "").filter(Boolean);
  const motifs = recentRecords.flatMap((record) => record.motifs ?? []);
  const visualAnchors = recentRecords.flatMap((record) => record.visualAnchors ?? []);

  const recentPatterns: string[] = [];
  const stablePreferences: string[] = [];
  const avoidRepeats: string[] = [];

  if (tones[0]) {
    recentPatterns.push(`Recent tone: ${tones[0]}`);
  }
  if (breakfastCategories[0]) {
    recentPatterns.push(`Recent breakfast category: ${breakfastCategories[0]}`);
  }

  for (const value of topEntries(visualAnchors, 2)) {
    stablePreferences.push(`Recurring visual anchor: ${value}`);
  }

  if (recentRecords[0].breakfastName) {
    avoidRepeats.push(`the breakfast name ${recentRecords[0].breakfastName}`);
  }
  if (recentRecords[0].sceneSetting) {
    avoidRepeats.push(`the scene setting ${recentRecords[0].sceneSetting}`);
  }

  for (const value of topEntries(motifs, 2).slice(0, 2)) {
    avoidRepeats.push(`the motif ${value}`);
  }

  if (recentRecords.length === 1) {
    return {
      recentPatterns: recentPatterns.slice(0, 1),
      stablePreferences,
      avoidRepeats,
      confidenceNotes: "Only one recent record is available, so recent repetition is light and stable preference evidence is weak.",
    };
  }

  const repeatedTone = topEntries(tones, 2)[0];
  const repeatedCategory = topEntries(breakfastCategories, 2)[0];
  const repeatedScene = topEntries(sceneSettings, 2)[0];
  const repeatedBreakfast = topEntries(breakfastNames, 2)[0];

  if (repeatedTone) {
    recentPatterns.push(`Repeated tone: ${repeatedTone}`);
  }
  if (repeatedCategory) {
    recentPatterns.push(`Repeated breakfast category: ${repeatedCategory}`);
  }
  if (repeatedScene) {
    avoidRepeats.push(`the repeated scene ${repeatedScene}`);
  }
  if (repeatedBreakfast) {
    avoidRepeats.push(`the repeated breakfast ${repeatedBreakfast}`);
  }

  return {
    recentPatterns,
    stablePreferences,
    avoidRepeats,
    confidenceNotes: "Recent repetition is reliable enough to guide variation; stable preference evidence is still lightweight.",
  };
}
