import { Calculator, Delete } from 'lucide-react';
import { useState } from 'react';
import { evaluateCalculatorExpression } from '../../../shared/domain/calculator';
import { Dialog } from '../ui/Dialog';

const KEYS = ['sin(', 'cos(', 'tan(', 'sqrt(', 'log(', 'ln(', '(', ')', '7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', 'pi', '+', '^', '%'];

export function ScientificCalculator() {
  const [open, setOpen] = useState(false);
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState('');
  const calculate = () => {
    try { setResult(String(Number(evaluateCalculatorExpression(expression).toPrecision(12)))); }
    catch (cause) { setResult(cause instanceof Error ? cause.message : 'Invalid expression.'); }
  };
  return <>
    <button className="button button--secondary" onClick={() => setOpen(true)}><Calculator size={15} /> Calculator</button>
    <Dialog open={open} title="Scientific calculator" description="Offline calculator. Trigonometric functions use radians." onClose={() => setOpen(false)}>
      <div className="calculator-display"><input autoFocus aria-label="Calculator expression" value={expression} onChange={(event) => setExpression(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') calculate(); }} placeholder="Example: sqrt(16) + sin(pi / 2)" /><output aria-live="polite">{result || '0'}</output></div>
      <div className="calculator-grid">{KEYS.map((key) => <button type="button" key={key} onClick={() => setExpression((value) => value + key)}>{key}</button>)}</div>
      <div className="button-row"><button className="button button--secondary" onClick={() => { setExpression(''); setResult(''); }}>Clear</button><button className="button button--secondary" aria-label="Delete last character" onClick={() => setExpression((value) => value.slice(0, -1))}><Delete size={15} /> Delete</button><button className="button button--primary" onClick={calculate}>= Calculate</button></div>
    </Dialog>
  </>;
}
