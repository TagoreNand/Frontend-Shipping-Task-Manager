/** W3C Baggage (`key=value,key=value`) parse/format helpers. */
export function formatBaggage(entries: Record<string, string>): string {
  return Object.entries(entries)
    .filter(([, value]) => value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join(',');
}

export function parseBaggage(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) {
    return out;
  }
  for (const part of header.split(',')) {
    const eq = part.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const key = decodeURIComponent(part.slice(0, eq).trim());
    if (key) {
      out[key] = decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return out;
}
