import {
  pesosToCentavos,
  centavosToPesos,
  formatPeso,
  calculateEqualSplit,
  customSplitRemaining,
  MAX_AMOUNT_CENTAVOS,
} from '../expense-utils';

describe('pesosToCentavos', () => {
  it('converts peso float to centavo integer', () => {
    expect(pesosToCentavos(100.5)).toBe(10050);
  });

  it('converts zero', () => {
    expect(pesosToCentavos(0)).toBe(0);
  });

  it('converts max amount', () => {
    expect(pesosToCentavos(999999.99)).toBe(99999999);
  });

  it('rounds correctly for floating point edge cases', () => {
    expect(pesosToCentavos(0.1 + 0.2)).toBe(30);
  });
});

describe('centavosToPesos', () => {
  it('converts centavos to peso float', () => {
    expect(centavosToPesos(10050)).toBe(100.5);
  });

  it('converts zero', () => {
    expect(centavosToPesos(0)).toBe(0);
  });
});

describe('formatPeso', () => {
  it('formats centavos to display string', () => {
    expect(formatPeso(10050)).toBe('100.50');
  });

  it('formats large numbers with comma separators', () => {
    expect(formatPeso(123456789)).toBe('1,234,567.89');
  });

  it('formats zero', () => {
    expect(formatPeso(0)).toBe('0.00');
  });
});

describe('calculateEqualSplit', () => {
  it('splits evenly when divisible', () => {
    const result = calculateEqualSplit(100, ['a', 'b']);
    expect(result).toEqual({ a: 50, b: 50 });
  });

  it('distributes remainder to first N members', () => {
    const result = calculateEqualSplit(10000, ['a', 'b', 'c']);
    expect(result).toEqual({ a: 3334, b: 3333, c: 3333 });
  });

  it('sum always equals total for 10000/3', () => {
    const result = calculateEqualSplit(10000, ['a', 'b', 'c']);
    const sum = (Object.values(result) as number[]).reduce((a, b) => a + b, 0);
    expect(sum).toBe(10000);
  });

  it('handles 1 centavo among 3 members', () => {
    const result = calculateEqualSplit(1, ['a', 'b', 'c']);
    expect(result).toEqual({ a: 1, b: 0, c: 0 });
    const sum = (Object.values(result) as number[]).reduce((a, b) => a + b, 0);
    expect(sum).toBe(1);
  });

  it('handles 10001 among 4 members', () => {
    const result = calculateEqualSplit(10001, ['a', 'b', 'c', 'd']);
    const sum = (Object.values(result) as number[]).reduce((a, b) => a + b, 0);
    expect(sum).toBe(10001);
    expect(result.a).toBe(2501);
    expect(result.b).toBe(2500);
  });

  it('returns empty object for empty member array', () => {
    const result = calculateEqualSplit(100, []);
    expect(result).toEqual({});
  });
});

describe('customSplitRemaining', () => {
  it('returns 0 when amounts match total', () => {
    expect(customSplitRemaining(10000, { a: 5000, b: 5000 })).toBe(0);
  });

  it('returns remaining when amounts are partial', () => {
    expect(customSplitRemaining(10000, { a: 5000, b: 3000 })).toBe(2000);
  });

  it('returns total for empty amounts', () => {
    expect(customSplitRemaining(10000, {})).toBe(10000);
  });
});

describe('MAX_AMOUNT_CENTAVOS', () => {
  it('is 99999900 (999,999.00 pesos)', () => {
    expect(MAX_AMOUNT_CENTAVOS).toBe(99999900);
  });
});
