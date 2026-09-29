const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../js/engine.js');

const val = (s, opts) => E.calc(s, opts).value;
const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≈ ${b}`);
const err = (s, kind, opts) => assert.throws(() => E.calc(s, opts), (e) => e.kind === kind);

test('basic arithmetic and precedence', () => {
  assert.equal(val('1+2×3'), 7);
  assert.equal(val('(1+2)×3'), 9);
  assert.equal(val('10÷4'), 2.5);
  assert.equal(val('2^(10)'), 1024);
  assert.equal(val('−2²'), -4);
  assert.equal(val('2^(3)^(2)'), 512);
  assert.equal(val('1−0.9−0.1'), 0);
  assert.equal(val('0.1+0.2'), 0.30000000000000004);
});

test('implicit multiplication binds tighter than division', () => {
  near(val('1÷2π'), 1 / (2 * Math.PI));
  assert.equal(val('2(3+4)'), 14);
  assert.equal(val('3A', { vars: { A: 4 } }), 12);
});

test('auto-closing parentheses and syntax errors', () => {
  assert.equal(val('(2+3'), 5);
  near(val('√(2'), Math.SQRT2);
  err('2+', E.SYNTAX);
  err('2)', E.SYNTAX);
  err('1.2.3', E.SYNTAX);
  err('', E.SYNTAX);
});

test('pieces tokenization keeps multi-char keys separate', () => {
  assert.equal(E.calc(['2', '10^(', '2', ')']).value, 2 * 100);
  assert.equal(E.calc(['1', '2', '+', '3']).value, 15);
  assert.equal(E.calc(['2', 'ᴇ', '−', '3']).value, 0.002);
});

test('trigonometry respects angle unit', () => {
  near(val('sin(30)'), 0.5);
  assert.equal(val('cos(90)'), 0);
  assert.equal(val('sin(180)'), 0);
  err('tan(90)', E.MATH);
  near(val('sin(π÷6)', { angle: 'rad' }), 0.5);
  assert.equal(val('cos(100)', { angle: 'gra' }), 0);
  near(val('sin⁻¹(0.5)'), 30);
  near(val('tan⁻¹(1)', { angle: 'rad' }), Math.PI / 4);
  err('sin⁻¹(2)', E.MATH);
});

test('logs, roots, powers', () => {
  assert.equal(val('log(1000)'), 3);
  assert.equal(val('log(2,8)'), 3);
  near(val('ln(e)'), 1);
  assert.equal(val('√(16)'), 4);
  assert.equal(val('∛(−27)'), -3);
  near(val('3ˣ√(8)'), 2);
  near(val('(−8)^(1÷3)'), -2);
  err('√(−1)', E.MATH);
  err('(−8)^(0.5)', E.MATH);
  err('log(0)', E.MATH);
  err('1÷0', E.MATH);
});

test('postfix operators and combinatorics', () => {
  assert.equal(val('5!'), 120);
  assert.equal(val('3²'), 9);
  assert.equal(val('2³'), 8);
  assert.equal(val('4⁻¹'), 0.25);
  assert.equal(val('50%'), 0.5);
  assert.equal(val('5𝐏2'), 20);
  assert.equal(val('5𝐂2'), 10);
  assert.equal(val('52𝐂5'), 2598960);
  err('2.5!', E.MATH);
  err('3𝐂5', E.MATH);
});

test('scientific notation input', () => {
  assert.equal(val('3ᴇ2'), 300);
  assert.equal(val('1.5ᴇ−3'), 0.0015);
});

test('functions', () => {
  assert.equal(val('GCD(12,18)'), 6);
  assert.equal(val('LCM(4,6)'), 12);
  assert.equal(val('Int(−2.7)'), -2);
  assert.equal(val('Intg(−2.7)'), -3);
  assert.equal(val('Abs(−3)'), 3);
  const r = E.calc('Pol(3,4)');
  assert.equal(r.value, 5);
  near(r.multi[1][1], 53.13010235);
  const q = E.calc('Rec(2,60)');
  near(q.multi[0][1], 1);
  near(q.multi[1][1], Math.sqrt(3));
});

test('calculus', () => {
  near(val('∫(X²,0,3)'), 9);
  near(val('∫(sin(X),0,π)', { angle: 'rad' }), 2);
  near(val('∫(1÷X,1,e)'), 1);
  near(val('d/dx(X³,2)'), 12, 1e-8);
  near(val('d/dx(sin(X),0)', { angle: 'rad' }), 1, 1e-8);
  assert.equal(val('Σ(X,1,100)'), 5050);
  assert.equal(val('Π(X,1,5)'), 120);
});

test('variables and Ans', () => {
  assert.equal(val('Ans×2', { ans: 21 }), 42);
  assert.equal(val('A+B', { vars: { A: 1, B: 2 } }), 3);
});

test('solve', () => {
  const t1 = E.parse('X²=2');
  near(E.solveFor(t1, {}, 1).x, Math.SQRT2);
  const t2 = E.parse('X³−2X−5');
  near(E.solveFor(t2, {}, 0).x, 2.0945514815);
  const t3 = E.parse('cos(X)=X');
  near(E.solveFor(t3, { angle: 'rad' }, 0).x, 0.7390851332);
  assert.throws(() => E.solveFor(E.parse('X²+1'), {}, 0), (e) => e.kind === E.SOLVE);
  near(E.solveFor(E.parse('2A=7'), {}, 0, 'A').x, 3.5);
});

test('number formatting', () => {
  const f = (x, fmt) => E.formatNumber(x, fmt);
  assert.equal(f(0), '0');
  assert.equal(f(1234.5), '1234.5');
  assert.equal(f(-2.5), '−2.5');
  assert.equal(f(1 / 3), '0.3333333333');
  assert.equal(f(2 / 3), '0.6666666667');
  assert.equal(f(0.001), '1×10⁻³');
  assert.equal(f(0.001, { mode: 'norm2' }), '0.001');
  assert.equal(f(12345678901), '1.23456789×10¹⁰');
  assert.equal(f(0.30000000000000004), '0.3');
  assert.equal(f(3.14159, { mode: 'fix', digits: 2 }), '3.14');
  assert.equal(f(-0.001, { mode: 'fix', digits: 2 }), '0.00');
  assert.equal(f(1234, { mode: 'sci', digits: 3 }), '1.23×10³');
  assert.equal(E.formatEng(12345), '12.345×10³');
  assert.equal(E.formatEng(12345, 1), '12345×10⁰');
  assert.equal(E.formatEng(0.00123), '1.23×10⁻³');
});

test('exact forms', () => {
  const t = (x) => E.exactText(E.exactForm(x));
  assert.equal(t(0.5), '1/2');
  assert.equal(t(1 / 3), '1/3');
  assert.equal(t(-0.75), '−3/4');
  assert.equal(t(0.1 + 0.2), '3/10');
  assert.equal(t(Math.SQRT2 / 2), '√2/2');
  assert.equal(t(3 * Math.sqrt(3)), '3√3');
  assert.equal(t(Math.PI / 4), 'π/4');
  assert.equal(t(Math.PI), 'π');
  assert.equal(t(42), '42');
  assert.equal(E.exactForm(Math.E), null);
});

test('linear systems', () => {
  const r = E.solveLinear([[2, 1], [1, -1]], [5, 1]);
  assert.equal(r.status, 'unique');
  near(r.x[0], 2);
  near(r.x[1], 1);
  const r3 = E.solveLinear([[1, 1, 1], [0, 2, 5], [2, 5, -1]], [6, -4, 27]);
  near(r3.x[0], 5); near(r3.x[1], 3); near(r3.x[2], -2);
  assert.equal(E.solveLinear([[1, 1], [2, 2]], [1, 3]).status, 'none');
  assert.equal(E.solveLinear([[1, 1], [2, 2]], [1, 2]).status, 'infinite');
});

test('polynomial roots', () => {
  const q = E.polyRoots([1, -3, 2]);
  assert.deepEqual(q.map((z) => z.re), [2, 1]);
  const c = E.polyRoots([1, 0, 1]);
  near(c[0].im, 1); near(c[1].im, -1);
  const cub = E.polyRoots([1, -6, 11, -6]);
  cub.forEach((z, i) => near(z.re, [3, 2, 1][i]));
  const cub2 = E.polyRoots([1, 0, 0, -1]);
  assert.equal(cub2[0].re, 1);
  near(Math.abs(cub2[1].im), Math.sqrt(3) / 2);
  const quart = E.polyRoots([1, 0, -5, 0, 4]);
  quart.forEach((z, i) => near(z.re, [2, 1, -1, -2][i]));
});

test('exact quadratic roots', () => {
  const r = E.quadExact(1, -2, -1); // 1 ± √2
  assert.deepEqual(r[0], { p: 1, q: 1, m: 2, d: 1, imag: false });
  assert.deepEqual(r[1], { p: 1, q: -1, m: 2, d: 1, imag: false });
  const c = E.quadExact(1, 2, 5); // −1 ± 2i
  assert.deepEqual(c[0], { p: -1, q: 2, m: 1, d: 1, imag: true });
  const h = E.quadExact(2, -1, -1); // 1, −1/2
  assert.deepEqual(h.map((x) => [x.p, x.d]), [[1, 1], [-1, 2]]);
});

test('statistics', () => {
  const s = E.stats1([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(s.mean, 4.5);
  assert.equal(s.median, 4.5);
  assert.equal(s.q1, 2.5);
  assert.equal(s.q3, 6.5);
  near(s.popSD, 2.291287847);
  near(s.sampleSD, 2.449489743);
  const r = E.stats2([1, 2, 3, 4], [3, 5, 7, 9]);
  near(r.a, 1); near(r.b, 2); near(r.r, 1);
});

test('base-n', () => {
  assert.equal(E.baseEval('FF+1', 16), 256);
  assert.equal(E.baseEval('1010and1100', 2), 8);
  assert.equal(E.baseEval('Not(0)', 10), -1);
  assert.equal(E.baseFormat(-1, 16), 'FFFFFFFF');
  assert.equal(E.baseFormat(10, 2), '0000 0000 0000 0000 0000 0000 0000 1010');
  assert.equal(E.baseEval('7÷2', 10), 3);
  assert.equal(E.baseEval('FFFFFFFF', 16), -1);
  assert.throws(() => E.baseEval('2', 2), (e) => e.kind === E.SYNTAX);
  assert.throws(() => E.baseEval('2147483647+1', 10), (e) => e.kind === E.MATH);
});
