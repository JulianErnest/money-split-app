/**
 * Balance utility functions for debt simplification.
 *
 * All currency math uses centavos (integers) to avoid floating-point errors.
 * 1 peso = 100 centavos.
 */

/** A settlement transaction: one person pays another. */
export interface Settlement {
  from: string; // debtor member id
  to: string; // creditor member id
  amount: number; // centavos (positive integer)
}

/**
 * Simplify debts using the greedy algorithm.
 *
 * Takes a map of member_id -> net_balance_centavos where:
 *   positive = owed money (creditor)
 *   negative = owes money (debtor)
 *
 * Returns a minimal set of settlement transactions.
 *
 * Algorithm:
 * 1. Separate into debtors (negative) and creditors (positive)
 * 2. Sort both descending by amount
 * 3. Greedily match highest debtor to highest creditor
 * 4. Transfer min(debtor.amount, creditor.amount), advance when zeroed
 */
export function simplifyDebts(
  netBalances: Map<string, number>,
): Settlement[] {
  const debtors: Array<{ id: string; amount: number }> = [];
  const creditors: Array<{ id: string; amount: number }> = [];

  for (const [id, balance] of netBalances) {
    if (balance < 0) debtors.push({ id, amount: -balance });
    else if (balance > 0) creditors.push({ id, amount: balance });
  }

  // Sort descending by amount for greedy matching
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const settlements: Settlement[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const transfer = Math.min(debtors[i].amount, creditors[j].amount);
    settlements.push({
      from: debtors[i].id,
      to: creditors[j].id,
      amount: transfer,
    });
    debtors[i].amount -= transfer;
    creditors[j].amount -= transfer;
    if (debtors[i].amount === 0) i++;
    if (creditors[j].amount === 0) j++;
  }

  return settlements;
}

/**
 * Convert RPC response rows (pesos as decimal) to a centavos map.
 *
 * Uses Math.round(amount * 100) to avoid floating-point errors.
 * Skips zero-balance entries.
 */
export function netBalancesToCentavos(
  rows: Array<{ member_id: string; net_balance: number }>,
): Map<string, number> {
  const result = new Map<string, number>();

  for (const row of rows) {
    const centavos = Math.round(row.net_balance * 100);
    if (centavos !== 0) {
      result.set(row.member_id, centavos);
    }
  }

  return result;
}
