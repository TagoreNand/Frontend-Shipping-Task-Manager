const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function midpoint(a: string, b: string | null): string {
  if (b !== null && a >= b) {
    throw new Error(`fractionalIndex: bounds out of order (${a} >= ${b})`);
  }
  const zero = DIGITS[0];
  if (b !== null) {
    let n = 0;
    while ((a[n] ?? zero) === b[n]) {
      n += 1;
    }
    if (n > 0) {
      return b.slice(0, n) + midpoint(a.slice(n), b.slice(n));
    }
  }
  const digitA = a === '' ? 0 : DIGITS.indexOf(a[0]);
  const digitB = b === null ? DIGITS.length : DIGITS.indexOf(b[0]);
  if (digitB - digitA > 1) {
    return DIGITS[Math.round(0.5 * (digitA + digitB))];
  }
  if (b !== null && b.length > 1) {
    return b.slice(0, 1);
  }
  return DIGITS[digitA] + midpoint(a.slice(1), null);
}

export function keyBetween(a: string | null, b: string | null): string {
  return midpoint(a ?? '', b);
}

export function generateKeys(n: number, after: string | null = null): string[] {
  const keys: string[] = [];
  let prev = after;
  for (let i = 0; i < n; i += 1) {
    const key = keyBetween(prev, null);
    keys.push(key);
    prev = key;
  }
  return keys;
}
