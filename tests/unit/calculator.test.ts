import { describe, expect, it } from 'vitest';
import { evaluateCalculatorExpression } from '../../src/shared/domain/calculator';

describe('scientific calculator', () => {
  it('uses operator precedence and right-associative powers', () => {
    expect(evaluateCalculatorExpression('2 + 3 * 4')).toBe(14);
    expect(evaluateCalculatorExpression('2^3^2')).toBe(512);
  });
  it('supports constants and scientific functions', () => {
    expect(evaluateCalculatorExpression('sqrt(16) + sin(pi / 2)')).toBeCloseTo(5);
    expect(evaluateCalculatorExpression('log(100) + ln(e)')).toBeCloseTo(3);
  });
  it('rejects unsafe syntax and invalid arithmetic', () => {
    expect(() => evaluateCalculatorExpression('globalThis.process')).toThrow();
    expect(() => evaluateCalculatorExpression('1 / 0')).toThrow('Division by zero');
  });
});
