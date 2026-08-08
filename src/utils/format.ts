export function formatNumber(value: number, significantDigits: number = 3): string {
  if (!isFinite(value)) return String(value);
  if (value === 0) return '0';
  return String(Number(value.toPrecision(significantDigits)));
}

export function formatPValue(p: number, alpha: number = 0.05): string {
  if (p < 0.001) return 'p < 0.001 ***';
  const stars = p < 0.01 ? ' **' : p < alpha ? ' *' : '';
  return `p = ${formatNumber(p, 3)}${stars}`;
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
