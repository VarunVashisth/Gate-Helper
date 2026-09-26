const FUNCTIONS: Record<string, (value: number) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sqrt: Math.sqrt, log: Math.log10, ln: Math.log,
  exp: Math.exp, abs: Math.abs,
};

type Token = { type: 'number' | 'name' | 'operator' | 'left' | 'right'; value: string };

const tokenize = (source: string): Token[] => {
  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    const rest = source.slice(index);
    const whitespace = rest.match(/^\s+/);
    if (whitespace) { index += whitespace[0].length; continue; }
    const number = rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i);
    if (number) { tokens.push({ type: 'number', value: number[0] }); index += number[0].length; continue; }
    const name = rest.match(/^[a-z]+/i);
    if (name) { tokens.push({ type: 'name', value: name[0].toLowerCase() }); index += name[0].length; continue; }
    const character = source[index];
    if ('+-*/^%'.includes(character)) tokens.push({ type: 'operator', value: character });
    else if (character === '(') tokens.push({ type: 'left', value: character });
    else if (character === ')') tokens.push({ type: 'right', value: character });
    else throw new Error(`Unsupported character “${character}”.`);
    index += 1;
  }
  return tokens;
};

export const evaluateCalculatorExpression = (source: string) => {
  if (!source.trim()) throw new Error('Enter an expression.');
  if (source.length > 300) throw new Error('Expression is too long.');
  const tokens = tokenize(source);
  let position = 0;
  const peek = () => tokens[position];
  const take = () => tokens[position++];

  const primary = (): number => {
    const token = take();
    if (!token) throw new Error('Expression ended unexpectedly.');
    if (token.type === 'number') return Number(token.value);
    if (token.type === 'operator' && (token.value === '+' || token.value === '-')) {
      const value = primary();
      return token.value === '-' ? -value : value;
    }
    if (token.type === 'left') {
      const value = addition();
      if (take()?.type !== 'right') throw new Error('A closing parenthesis is missing.');
      return value;
    }
    if (token.type === 'name') {
      if (token.value === 'pi') return Math.PI;
      if (token.value === 'e') return Math.E;
      const fn = FUNCTIONS[token.value];
      if (!fn) throw new Error(`Unknown function “${token.value}”.`);
      if (take()?.type !== 'left') throw new Error(`${token.value} requires parentheses.`);
      const value = addition();
      if (take()?.type !== 'right') throw new Error('A closing parenthesis is missing.');
      return fn(value);
    }
    throw new Error('Expected a number, function, or parenthesized expression.');
  };
  const power = (): number => {
    const left = primary();
    return peek()?.value === '^' ? (take(), left ** power()) : left;
  };
  const multiplication = (): number => {
    let value = power();
    while (peek()?.type === 'operator' && ['*', '/', '%'].includes(peek().value)) {
      const operator = take().value;
      const right = power();
      if ((operator === '/' || operator === '%') && right === 0) throw new Error('Division by zero is undefined.');
      value = operator === '*' ? value * right : operator === '/' ? value / right : value % right;
    }
    return value;
  };
  const addition = (): number => {
    let value = multiplication();
    while (peek()?.type === 'operator' && ['+', '-'].includes(peek().value)) {
      const operator = take().value;
      const right = multiplication();
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  };

  const result = addition();
  if (position !== tokens.length) throw new Error(`Unexpected token “${peek().value}”.`);
  if (!Number.isFinite(result)) throw new Error('The result is outside the supported numerical range.');
  return Object.is(result, -0) ? 0 : result;
};
