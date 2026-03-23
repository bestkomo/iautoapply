export function toJsonArray(arr: string[] | undefined | null): string {
  return JSON.stringify(arr || []);
}

export function fromJsonArray(str: string | undefined | null): string[] {
  if (!str) return [];
  try {
    return JSON.parse(str);
  } catch {
    return [];
  }
}
