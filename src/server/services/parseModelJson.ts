function extractJsonCandidate(value: string): string {
  const trimmed = value.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fencedMatch ? fencedMatch[1].trim() : trimmed;
}

export function parseModelJson<T>(value: string, label: string): T {
  const candidate = extractJsonCandidate(value);

  if (!candidate) {
    throw new Error(`${label} returned empty JSON`);
  }

  try {
    return JSON.parse(candidate) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown JSON parse error";
    throw new Error(`${label} returned invalid JSON: ${message}`);
  }
}
