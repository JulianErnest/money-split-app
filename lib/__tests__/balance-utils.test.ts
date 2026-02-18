import {
  simplifyDebts,
  netBalancesToCentavos,
  type Settlement,
} from '../balance-utils';

describe('simplifyDebts', () => {
  it('returns empty array for empty map', () => {
    const balances = new Map<string, number>();
    expect(simplifyDebts(balances)).toEqual([]);
  });

  it('returns empty array when all balances are zero', () => {
    const balances = new Map([
      ['alice', 0],
      ['bob', 0],
      ['charlie', 0],
    ]);
    expect(simplifyDebts(balances)).toEqual([]);
  });

  it('handles simple two-person debt', () => {
    const balances = new Map([
      ['alice', 5000],
      ['bob', -5000],
    ]);
    const result = simplifyDebts(balances);
    expect(result).toEqual([
      { from: 'bob', to: 'alice', amount: 5000 },
    ]);
  });

  it('minimizes transactions for 3-person group', () => {
    const balances = new Map([
      ['alice', 20000],
      ['bob', -15000],
      ['charlie', -5000],
    ]);
    const result = simplifyDebts(balances);
    expect(result.length).toBe(2);
    // Total transferred to Alice should equal 20000
    const totalToAlice = result
      .filter((s) => s.to === 'alice')
      .reduce((sum, s) => sum + s.amount, 0);
    expect(totalToAlice).toBe(20000);
  });

  it('conserves money: net flows match original balances (4-person)', () => {
    const balances = new Map([
      ['a', 10000],
      ['b', -3000],
      ['c', -4000],
      ['d', -3000],
    ]);
    const result = simplifyDebts(balances);
    // Net flow for each person should equal their original balance
    const flows = new Map<string, number>();
    for (const { from, to, amount } of result) {
      flows.set(from, (flows.get(from) || 0) - amount);
      flows.set(to, (flows.get(to) || 0) + amount);
    }
    for (const [id, balance] of balances) {
      expect(flows.get(id)).toBe(balance);
    }
  });

  it('ignores members with zero balance', () => {
    const balances = new Map([
      ['alice', 5000],
      ['bob', 0],
      ['charlie', -5000],
    ]);
    const result = simplifyDebts(balances);
    expect(result.length).toBe(1);
    expect(result[0]).toEqual({
      from: 'charlie',
      to: 'alice',
      amount: 5000,
    });
  });

  it('returns empty array for single person with zero net', () => {
    const balances = new Map([['alice', 0]]);
    expect(simplifyDebts(balances)).toEqual([]);
  });

  it('handles multiple creditors and debtors', () => {
    const balances = new Map([
      ['alice', 8000],
      ['bob', 2000],
      ['charlie', -6000],
      ['dave', -4000],
    ]);
    const result = simplifyDebts(balances);
    // Conservation check
    const flows = new Map<string, number>();
    for (const { from, to, amount } of result) {
      flows.set(from, (flows.get(from) || 0) - amount);
      flows.set(to, (flows.get(to) || 0) + amount);
    }
    for (const [id, balance] of balances) {
      expect(flows.get(id)).toBe(balance);
    }
    // Should minimize: at most 3 transactions (n-1 for 4 people)
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('all settlement amounts are positive integers', () => {
    const balances = new Map([
      ['a', 10000],
      ['b', -3000],
      ['c', -4000],
      ['d', -3000],
    ]);
    const result = simplifyDebts(balances);
    for (const s of result) {
      expect(s.amount).toBeGreaterThan(0);
      expect(Number.isInteger(s.amount)).toBe(true);
    }
  });
});

describe('netBalancesToCentavos', () => {
  it('converts decimal pesos to integer centavos', () => {
    const rows = [
      { member_id: 'alice', net_balance: 150.0 },
      { member_id: 'bob', net_balance: -100.5 },
    ];
    const result = netBalancesToCentavos(rows);
    expect(result.get('alice')).toBe(15000);
    expect(result.get('bob')).toBe(-10050);
  });

  it('skips zero entries', () => {
    const rows = [
      { member_id: 'alice', net_balance: 100.0 },
      { member_id: 'bob', net_balance: 0 },
      { member_id: 'charlie', net_balance: -100.0 },
    ];
    const result = netBalancesToCentavos(rows);
    expect(result.has('bob')).toBe(false);
    expect(result.size).toBe(2);
  });

  it('rounds correctly for floating-point edge cases', () => {
    const rows = [{ member_id: 'alice', net_balance: 0.1 + 0.2 }];
    const result = netBalancesToCentavos(rows);
    expect(result.get('alice')).toBe(30);
  });

  it('returns empty map for empty input', () => {
    const result = netBalancesToCentavos([]);
    expect(result.size).toBe(0);
  });
});
