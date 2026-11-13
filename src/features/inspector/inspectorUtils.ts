export function tryPrettyJson(value: string | null): { valid: boolean; formatted: string } {
  if (value === null) return { valid: false, formatted: '' };
  const trimmed = value.trim();
  if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[')) {
    return { valid: false, formatted: value };
  }
  try {
    const parsed = JSON.parse(trimmed);
    return { valid: true, formatted: JSON.stringify(parsed, null, 2) };
  } catch {
    return { valid: false, formatted: value };
  }
}

export function matchesFieldQuery(
  query: string,
  col: string,
  val: string | null,
  dataType?: string,
): boolean {
  if (!query) return true;
  if (col.toLowerCase().includes(query)) return true;
  if (dataType?.toLowerCase().includes(query)) return true;
  const valText = val === null ? 'null' : val.toLowerCase();
  return valText.includes(query);
}
