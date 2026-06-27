/** Parse a W3C Baggage header (`key=value,key=value`) into a record. */
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
