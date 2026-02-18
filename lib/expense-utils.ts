/**
 * Expense utility functions for split calculations and peso formatting.
 *
 * All currency math uses centavos (integers) to avoid floating-point errors.
 * 1 peso = 100 centavos.
 */

/** Maximum expense amount: 999,999.00 pesos = 99,999,900 centavos */
export const MAX_AMOUNT_CENTAVOS = 99999900;

/** Convert pesos (float) to centavos (integer). */
export function pesosToCentavos(pesos: number): number {
  return Math.round(pesos * 100);
}

/** Convert centavos (integer) to pesos (float). */
export function centavosToPesos(centavos: number): number {
  return centavos / 100;
}

/**
 * Format centavos as a Philippine peso display string.
 * Example: 10050 -> "100.50", 123456789 -> "1,234,567.89"
 */
export function formatPeso(centavos: number): string {
  const pesos = centavos / 100;
  return new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(pesos);
}

/**
 * Split totalCentavos equally among memberIds.
 * Remainder centavos are distributed to the first N members.
 *
 * Example: calculateEqualSplit(10000, ['a','b','c'])
 *   -> { a: 3334, b: 3333, c: 3333 }
 *
 * Returns empty object for empty member array.
 */
export function calculateEqualSplit(
  totalCentavos: number,
  memberIds: string[],
): Record<string, number> {
  if (memberIds.length === 0) return {};

  const count = memberIds.length;
  const base = Math.floor(totalCentavos / count);
  const remainder = totalCentavos - base * count;

  const splits: Record<string, number> = {};
  memberIds.forEach((id, i) => {
    splits[id] = base + (i < remainder ? 1 : 0);
  });
  return splits;
}

/**
 * Calculate remaining centavos for a custom split.
 * Returns 0 when all amounts sum to the total (valid split).
 *
 * Example: customSplitRemaining(10000, { a: 5000, b: 3000 }) -> 2000
 */
export function customSplitRemaining(
  totalCentavos: number,
  amounts: Record<string, number>,
): number {
  const sum = (Object.values(amounts) as number[]).reduce((a, b) => a + b, 0);
  return totalCentavos - sum;
}
