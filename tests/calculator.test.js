const test = require('node:test');
const assert = require('node:assert/strict');
const { createCalculator } = require('../src/core/calculator.js');

// Flattens a display run to text: fractions as n/d, roots as √r, exponents as ^e.
function text(run) {
  return run.map((p) => {
    if (typeof p === 'string') return p;
    if (p.t === 'frac') return `(${text(p.n)})/(${text(p.d)})`;
    if (p.t === 'sqrt') return `√${text(p.r)}`;
    if (p.t === 'sup') return `^${p.s}`;
    if (p.t === 'i') return 'i';
    return p.s;
  }).join('');
}

function setup() {
  const saved = [];
  const toasts = [];
  const calc = createCalculator({ save: (s) => saved.push(s), toast: (m) => toasts.push(m) });
  const keys = (...ids) => ids.forEach((id) => calc.pressKey(id));
  const body = () => calc.getScreen().body;
  const result = () => text(body().result.run);
  return { calc, keys, body, result, saved, toasts };
}

test('fractions and S⇔D', () => {
  const { keys, result } = setup();
  keys('n1', 'div', 'n3', 'add', 'n1', 'div', 'n6', 'eq');
  assert.equal(result(), '(1)/(2)');
  keys('sd');
  assert.equal(result(), '0.5');
});

test('trig exact form, Ans continuation, π', () => {
  const { keys, result, body } = setup();
  keys('sin', 'n4', 'n5', 'rp', 'eq');
  assert.equal(result(), '(√2)/(2)');
  keys('mul', 'n2', 'eq');
  assert.deepEqual(body().input.pieces, ['Ans', '×', '2']);
  assert.equal(result(), '√2');
  keys('ac', 'shift', 'exp', 'div', 'n4', 'eq');
  assert.equal(result(), '(π)/(4)');
});

test('ENG, errors and editing', () => {
  const { keys, result, body } = setup();
  keys('n1', 'n2', 'n3', 'n4', 'n5', 'eq', 'eng');
  assert.equal(result(), '12.345×10^3');
  keys('ac', 'n1', 'div', 'n0', 'eq');
  assert.equal(body().result.error, 'Math ERROR');
  keys('del', 'del', 'n2', 'eq');
  assert.equal(result(), '(1)/(2)');
});

test('calculus keys', () => {
  const { keys, result } = setup();
  keys('integ', 'alpha', 'rp', 'sq', 'shift', 'rp', 'n0', 'shift', 'rp', 'n3', 'eq');
  assert.equal(result(), '9');
});

test('STO, variables and memory', () => {
  const { keys, result, calc, toasts } = setup();
  keys('n7', 'sto', 'neg');
  assert.equal(calc.getScreen().body.result.stored, 'A');
  keys('ac', 'alpha', 'neg', 'sq', 'eq');
  assert.equal(result(), '49');
  keys('n1', 'mplus', 'n2', 'mplus');
  assert.equal(toasts.at(-1), 'M = 3');
  assert.equal(calc.getScreen().status.memory, true);
});

test('history replay with the direction pad', () => {
  const { keys, calc, body } = setup();
  keys('n2', 'add', 'n2', 'eq', 'n3', 'mul', 'n3', 'eq');
  calc.pressDir('up');
  assert.deepEqual(body().input.pieces, ['2', '+', '2']);
});

test('SOLVE', () => {
  const { keys, calc, body } = setup();
  keys('alpha', 'rp', 'sq', 'alpha', 'calc', 'n2', 'shift', 'calc');
  assert.equal(body().kind, 'form');
  keys('n1', 'eq');
  const b = body();
  assert.equal(b.kind, 'list');
  assert.equal(text(b.rows[0].run), '1.414213562');
  assert.equal(calc.back(), true);
  assert.equal(body().kind, 'comp');
});

test('EQN quadratic with exact roots', () => {
  const { keys, calc, body } = setup();
  keys('mode');
  calc.chooseMenu(3); // EQN
  calc.chooseMenu(2); // quadratic
  keys('n1', 'eq', 'neg', 'n2', 'eq', 'neg', 'n1', 'eq');
  const rows = body().rows.map((r) => `${r.label}=${text(r.run)}`);
  assert.deepEqual(rows, ['X₁=1 + √2', 'X₂=1 − √2', 'Min X=1', 'Min Y=−2']);
});

test('EQN linear system', () => {
  const { keys, calc, body } = setup();
  keys('mode');
  calc.chooseMenu(3);
  calc.chooseMenu(0);
  keys('n2', 'eq', 'n1', 'eq', 'n5', 'eq', 'n1', 'eq', 'neg', 'n1', 'eq', 'n1', 'eq');
  assert.deepEqual(body().rows.map((r) => text(r.run)), ['2', '1']);
});

test('STAT regression', () => {
  const { keys, calc, body } = setup();
  keys('mode');
  calc.chooseMenu(1);
  calc.chooseMenu(1);
  for (const [x, y] of [['1', '3'], ['2', '5'], ['3', '7'], ['4', '9']]) keys('n' + x, 'eq', 'n' + y, 'eq');
  calc.pressSoft(0);
  const rows = Object.fromEntries(body().rows.map((r) => [r.label, text(r.run)]));
  assert.equal(rows.a, '1');
  assert.equal(rows.b, '2');
  assert.equal(rows.r, '1');
});

test('TABLE', () => {
  const { keys, calc, body } = setup();
  keys('mode');
  calc.chooseMenu(2);
  calc.pressSoft(0);
  const b = body();
  assert.equal(b.kind, 'table');
  assert.deepEqual(b.rows.map((r) => r.map(text)), [['1', '1'], ['2', '4'], ['3', '9'], ['4', '16'], ['5', '25']]);
});

test('BASE-N', () => {
  const { keys, calc, body } = setup();
  keys('mode');
  calc.chooseMenu(4);
  calc.pressSoft(1); // HEX
  calc.pressSoft(9); // F
  calc.pressSoft(9);
  keys('add', 'n1', 'eq');
  const b = body();
  assert.equal(b.value, '100');
  assert.deepEqual(b.others[0], ['DEC', '256']);
});

test('back button unwinds menus and modes, then lets the app close', () => {
  const { keys, calc, body } = setup();
  keys('mode');
  calc.chooseMenu(3);
  assert.ok(calc.getScreen().menu);
  assert.equal(calc.back(), true); // closes type menu
  assert.equal(calc.back(), true); // EQN → COMP
  assert.equal(body().kind, 'comp');
  assert.equal(calc.back(), false);
});

test('state persists and restores', () => {
  const a = setup();
  a.keys('n7', 'sto', 'neg');
  const b = setup();
  b.calc.load(a.saved.at(-1));
  b.keys('alpha', 'neg', 'eq');
  assert.equal(b.result(), '7');
});
