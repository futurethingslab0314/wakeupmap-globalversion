function getPlainText(value: unknown): string {
  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .map((item) => {
      if (typeof item === "object" && item !== null && "plain_text" in item) {
        const plainText = (item as { plain_text?: unknown }).plain_text;
        return typeof plainText === "string" ? plainText : "";
      }

      return "";
    })
    .join("")
    .trim();
}

export function getTitleProperty(properties: Record<string, unknown>, key: string): string {
  const property = properties[key];
  if (typeof property !== "object" || property === null || !("title" in property)) {
    return "";
  }

  return getPlainText((property as { title?: unknown }).title);
}

export function getRichTextProperty(properties: Record<string, unknown>, key: string): string {
  const property = properties[key];
  if (typeof property !== "object" || property === null || !("rich_text" in property)) {
    return "";
  }

  return getPlainText((property as { rich_text?: unknown }).rich_text);
}

export function getNumberProperty(properties: Record<string, unknown>, key: string): number {
  const property = properties[key];
  if (typeof property !== "object" || property === null || !("number" in property)) {
    return 0;
  }

  const value = (property as { number?: unknown }).number;
  return typeof value === "number" ? value : 0;
}

export function getUrlProperty(properties: Record<string, unknown>, key: string): string {
  const property = properties[key];
  if (typeof property !== "object" || property === null || !("url" in property)) {
    return "";
  }

  const value = (property as { url?: unknown }).url;
  return typeof value === "string" ? value : "";
}

export function getDateProperty(properties: Record<string, unknown>, key: string): string | undefined {
  const property = properties[key];
  if (typeof property !== "object" || property === null || !("date" in property)) {
    return undefined;
  }

  const date = (property as { date?: unknown }).date;
  if (typeof date !== "object" || date === null || !("start" in date)) {
    return undefined;
  }

  const start = (date as { start?: unknown }).start;
  return typeof start === "string" ? start : undefined;
}
