// Keypad definition. `a` is the main action, `s` the SHIFT action and `al`
// the ALPHA action. Actions starting with ':' are commands; anything else is
// a piece of text inserted into the expression.

const KEYS = {
  shift: { l: 'SHIFT', a: ':shift', kind: 'shift' },
  alpha: { l: 'ALPHA', a: ':alpha', kind: 'alpha' },
  mode: { l: 'MODE', a: ':mode', s: ['SETUP', ':setup'], kind: 'sys' },
  hist: { l: 'HIST', a: ':history', s: ['RCL', ':recall'], kind: 'sys' },
  calc: { l: 'CALC', a: ':calc', s: ['SOLVE', ':solve'], al: ['=', '='] },
  integ: { l: '∫dx', a: '∫(', s: ['d/dx', 'd/dx('] },
  inv: { l: 'x⁻¹', a: '⁻¹', s: ['x!', '!'] },
  sum: { l: 'Σ', a: 'Σ(', s: ['Π', 'Π('] },
  sqrt: { l: '√▫', a: '√(', s: ['∛', '∛('] },
  sq: { l: 'x²', a: '²', s: ['x³', '³'] },
  pow: { l: 'xʸ', a: '^(', s: ['ˣ√', 'ˣ√('] },
  log: { l: 'log', a: 'log(', s: ['10ˣ', '10^('] },
  ln: { l: 'ln', a: 'ln(', s: ['eˣ', 'e^('] },
  ncr: { l: 'nCr', a: '𝐂', s: ['nPr', '𝐏'] },
  neg: { l: '(−)', a: ':neg', s: ['Abs', 'Abs('], al: ['A', 'A'] },
  pol: { l: 'Pol', a: 'Pol(', s: ['Rec', 'Rec('], al: ['B', 'B'] },
  hyp: { l: 'hyp', a: ':hyp', al: ['C', 'C'] },
  sin: { l: 'sin', a: ':sin', s: ['sin⁻¹', ':asin'], al: ['D', 'D'] },
  cos: { l: 'cos', a: ':cos', s: ['cos⁻¹', ':acos'], al: ['E', 'E'] },
  tan: { l: 'tan', a: ':tan', s: ['tan⁻¹', ':atan'], al: ['F', 'F'] },
  sto: { l: 'STO', a: ':sto' },
  eng: { l: 'ENG', a: ':eng', s: ['←ENG', ':engback'] },
  lp: { l: '(', a: '(', s: ['%', '%'] },
  rp: { l: ')', a: ')', s: [',', ','], al: ['X', 'X'] },
  sd: { l: 'S⇔D', a: ':sd', al: ['Y', 'Y'] },
  mplus: { l: 'M+', a: ':mplus', s: ['M−', ':mminus'], al: ['M', 'M'] },

  n7: { l: '7', a: '7', s: ['GCD', 'GCD('], kind: 'num' },
  n8: { l: '8', a: '8', s: ['LCM', 'LCM('], kind: 'num' },
  n9: { l: '9', a: '9', s: ['Int', 'Int('], kind: 'num' },
  del: { l: 'DEL', a: ':del', kind: 'warn' },
  ac: { l: 'AC', a: ':ac', kind: 'warn' },
  n4: { l: '4', a: '4', s: ['Intg', 'Intg('], kind: 'num' },
  n5: { l: '5', a: '5', s: ['Rnd', 'Rnd('], kind: 'num' },
  n6: { l: '6', a: '6', s: ['RanInt', 'RanInt#('], kind: 'num' },
  mul: { l: '×', a: '×', kind: 'op' },
  div: { l: '÷', a: '÷', kind: 'op' },
  n1: { l: '1', a: '1', kind: 'num' },
  n2: { l: '2', a: '2', kind: 'num' },
  n3: { l: '3', a: '3', kind: 'num' },
  add: { l: '+', a: '+', kind: 'op' },
  sub: { l: '−', a: '−', kind: 'op' },
  n0: { l: '0', a: '0', kind: 'num' },
  dot: { l: '.', a: '.', s: ['Ran#', 'Ran#'], kind: 'num' },
  exp: { l: '×10ˣ', a: 'ᴇ', s: ['π', 'π'], kind: 'num' },
  ans: { l: 'Ans', a: 'Ans', s: ['e', 'e'], kind: 'num' },
  eq: { l: '=', a: ':eq', s: ['≈', ':approx'], kind: 'eq' },
};

// Layout. The top two function rows wrap around the direction pad.
const LAYOUT = {
  topLeft: [['shift', 'alpha'], ['calc', 'integ']],
  topRight: [['mode', 'hist'], ['inv', 'sum']],
  fnRows: [
    ['sqrt', 'sq', 'pow', 'log', 'ln', 'ncr'],
    ['neg', 'pol', 'hyp', 'sin', 'cos', 'tan'],
    ['sto', 'eng', 'lp', 'rp', 'sd', 'mplus'],
  ],
  numRows: [
    ['n7', 'n8', 'n9', 'del', 'ac'],
    ['n4', 'n5', 'n6', 'mul', 'div'],
    ['n1', 'n2', 'n3', 'add', 'sub'],
    ['n0', 'dot', 'exp', 'ans', 'eq'],
  ],
};

module.exports = { KEYS, LAYOUT };
