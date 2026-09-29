/* Calculator UI: keypad, screens, modes and persistence. */
(function () {
  'use strict';

  const E = window.Engine;
  const VAR_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'M', 'X', 'Y'];
  const STORE_KEY = 'calculator.state.v1';

  // ---------------------------------------------------------------------------
  // Keypad definition. `a` is the main action, `s` the SHIFT action and `al`
  // the ALPHA action. Actions starting with ':' are commands; anything else is
  // a piece of text inserted into the expression.
  // ---------------------------------------------------------------------------

  const FUNC_KEYS = [
    { id: 'shift', l: 'SHIFT', a: ':shift', cls: 'mod shift' },
    { id: 'alpha', l: 'ALPHA', a: ':alpha', cls: 'mod alpha' },
    { id: 'dpad', dpad: true },
    { id: 'mode', l: 'MODE', a: ':mode', s: ['SETUP', ':setup'], cls: 'sys' },
    { id: 'hist', l: 'HIST', a: ':history', s: ['RCL', ':recall'], cls: 'sys' },
    { id: 'calc', l: 'CALC', a: ':calc', s: ['SOLVE', ':solve'], al: ['=', '='] },
    { id: 'integ', l: '∫dx', a: '∫(', s: ['d/dx', 'd/dx('] },
    { id: 'inv', l: 'x⁻¹', a: '⁻¹', s: ['x!', '!'] },
    { id: 'sum', l: 'Σ', a: 'Σ(', s: ['Π', 'Π('] },
    { id: 'sqrt', l: '√▫', a: '√(', s: ['∛', '∛('] },
    { id: 'sq', l: 'x²', a: '²', s: ['x³', '³'] },
    { id: 'pow', l: 'xʸ', a: '^(', s: ['ˣ√', 'ˣ√('] },
    { id: 'log', l: 'log', a: 'log(', s: ['10ˣ', '10^('] },
    { id: 'ln', l: 'ln', a: 'ln(', s: ['eˣ', 'e^('] },
    { id: 'ncr', l: 'nCr', a: '𝐂', s: ['nPr', '𝐏'] },
    { id: 'neg', l: '(−)', a: ':neg', s: ['Abs', 'Abs('], al: ['A', 'A'] },
    { id: 'pol', l: 'Pol', a: 'Pol(', s: ['Rec', 'Rec('], al: ['B', 'B'] },
    { id: 'hyp', l: 'hyp', a: ':hyp', al: ['C', 'C'] },
    { id: 'sin', l: 'sin', a: ':sin', s: ['sin⁻¹', ':asin'], al: ['D', 'D'] },
    { id: 'cos', l: 'cos', a: ':cos', s: ['cos⁻¹', ':acos'], al: ['E', 'E'] },
    { id: 'tan', l: 'tan', a: ':tan', s: ['tan⁻¹', ':atan'], al: ['F', 'F'] },
    { id: 'sto', l: 'STO', a: ':sto' },
    { id: 'eng', l: 'ENG', a: ':eng', s: ['←ENG', ':engback'] },
    { id: 'lp', l: '(', a: '(', s: ['%', '%'] },
    { id: 'rp', l: ')', a: ')', s: [',', ','], al: ['X', 'X'] },
    { id: 'sd', l: 'S⇔D', a: ':sd', al: ['Y', 'Y'] },
    { id: 'mplus', l: 'M+', a: ':mplus', s: ['M−', ':mminus'], al: ['M', 'M'] },
  ];

  const NUM_KEYS = [
    { id: 'n7', l: '7', a: '7', s: ['GCD', 'GCD('] },
    { id: 'n8', l: '8', a: '8', s: ['LCM', 'LCM('] },
    { id: 'n9', l: '9', a: '9', s: ['Int', 'Int('] },
    { id: 'del', l: 'DEL', a: ':del', cls: 'warn' },
    { id: 'ac', l: 'AC', a: ':ac', cls: 'warn' },
    { id: 'n4', l: '4', a: '4', s: ['Intg', 'Intg('] },
    { id: 'n5', l: '5', a: '5', s: ['Rnd', 'Rnd('] },
    { id: 'n6', l: '6', a: '6', s: ['RanInt', 'RanInt#('] },
    { id: 'mul', l: '×', a: '×', cls: 'op' },
    { id: 'div', l: '÷', a: '÷', cls: 'op' },
    { id: 'n1', l: '1', a: '1' },
    { id: 'n2', l: '2', a: '2' },
    { id: 'n3', l: '3', a: '3' },
    { id: 'add', l: '+', a: '+', cls: 'op' },
    { id: 'sub', l: '−', a: '−', cls: 'op' },
    { id: 'n0', l: '0', a: '0' },
    { id: 'dot', l: '.', a: '.', s: ['Ran#', 'Ran#'] },
    { id: 'exp', l: '×10ˣ', a: 'ᴇ', s: ['π', 'π'] },
    { id: 'ans', l: 'Ans', a: 'Ans', s: ['e', 'e'] },
    { id: 'eq', l: '=', a: ':eq', s: ['≈', ':approx'], cls: 'eq' },
  ];

  const ALL_KEYS = Object.fromEntries([...FUNC_KEYS, ...NUM_KEYS].map((k) => [k.id, k]));

  // Pieces that continue from the previous answer when typed right after "=".
  const CONTINUE = new Set(['+', '−', '×', '÷', '^(', '²', '³', '⁻¹', '!', '%', '𝐂', '𝐏', 'ˣ√(']);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const PIECE_HTML = {
    '𝐂': '<span class="pc">C</span>',
    '𝐏': '<span class="pc">P</span>',
    'ᴇ': '<span class="pe">ᴇ</span>',
    and: '<span class="pw">and</span>',
    or: '<span class="pw">or</span>',
    xor: '<span class="pw">xor</span>',
    xnor: '<span class="pw">xnor</span>',
  };
  const pieceHtml = (p) => PIECE_HTML[p] || esc(p);

  class Editor {
    constructor(pieces = []) {
      this.pieces = [...pieces];
      this.cursor = this.pieces.length;
    }
    insert(p) { this.pieces.splice(this.cursor, 0, p); this.cursor++; }
    del() { if (this.cursor > 0) { this.pieces.splice(this.cursor - 1, 1); this.cursor--; } }
    left() { this.cursor = this.cursor > 0 ? this.cursor - 1 : this.pieces.length; }
    right() { this.cursor = this.cursor < this.pieces.length ? this.cursor + 1 : 0; }
    clear() { this.pieces = []; this.cursor = 0; }
    get empty() { return this.pieces.length === 0; }
    text() { return this.pieces.join(''); }
    html(cursor = true) {
      // A thin gap keeps "2" followed by "10^(" from reading as 210.
      const parts = this.pieces.map((p, i) =>
        (i > 0 && p.length > 1 && /^\d/.test(p) && /^[\d.]$/.test(this.pieces[i - 1]) ? '<span class="gap"></span>' : '') + pieceHtml(p));
      if (cursor) parts.splice(this.cursor, 0, '<span class="cur"></span>');
      return parts.join('');
    }
  }

  const fracHtml = (n, d) => `<span class="frac"><span class="fn">${n}</span><span class="fd">${d}</span></span>`;
  const sqrtHtml = (r) => `<span class="sqrt">√<span class="rad">${r}</span></span>`;

  function exactHtml(ef) {
    const coeff = ef.num === 1 && (ef.root > 1 || ef.pi) ? '' : String(ef.num);
    const top = coeff + (ef.root > 1 ? sqrtHtml(ef.root) : '') + (ef.pi ? 'π' : '');
    const sign = ef.sign < 0 ? '−' : '';
    return ef.den === 1 ? sign + top : sign + fracHtml(top, ef.den);
  }

  function fmt() {
    const s = S.setup;
    return { mode: s.fmt, digits: s.digits };
  }

  function useExact() {
    return S.setup.exact && (S.setup.fmt === 'norm1' || S.setup.fmt === 'norm2');
  }

  // Number to HTML, preferring an exact form (fraction, surd, π) if enabled.
  function numHtml(x, exact = useExact()) {
    if (exact) {
      const ef = E.exactForm(x);
      if (ef && (ef.den !== 1 || ef.root > 1 || ef.pi)) return exactHtml(ef);
    }
    return sciHtml(E.formatNumber(x, fmt()));
  }

  // Render "1.2×10⁻³" with a real superscript for readability.
  function sciHtml(s) {
    const m = /^(.*)×10([⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/.exec(s);
    if (!m) return esc(s);
    const map = { '⁻': '−', '⁰': 0, '¹': 1, '²': 2, '³': 3, '⁴': 4, '⁵': 5, '⁶': 6, '⁷': 7, '⁸': 8, '⁹': 9 };
    const e = m[2].split('').map((c) => map[c]).join('');
    return `${esc(m[1])}<span class="x10">×10<sup>${e}</sup></span>`;
  }

  function complexHtml(z, exact) {
    if (z.im === 0) return numHtml(z.re, exact);
    const re = z.re === 0 ? '' : numHtml(z.re, exact);
    const sign = z.im < 0 ? (re ? ' − ' : '−') : re ? ' + ' : '';
    const mag = Math.abs(z.im);
    const im = mag === 1 ? '' : numHtml(mag, exact);
    return `${re}${sign}${im}<i class="ii">i</i>`;
  }

  // (p ± q√m [i]) / d from Engine.quadExact
  function surdSumHtml(r) {
    let top;
    if (r.q === 0) top = String(Math.abs(r.p));
    else {
      const qa = Math.abs(r.q);
      const rad = (qa === 1 ? '' : qa) + (r.m > 1 ? sqrtHtml(r.m) : '') + (r.imag ? '<i class="ii">i</i>' : '');
      const radStr = rad || '1';
      if (r.p === 0) top = (r.q < 0 ? '−' : '') + radStr;
      else top = `${r.p < 0 ? '−' : ''}${Math.abs(r.p)} ${r.q < 0 ? '−' : '+'} ${radStr}`;
    }
    const neg = r.q === 0 && r.p < 0 ? '−' : '';
    if (r.q === 0) return r.d === 1 ? neg + top : neg + fracHtml(top, r.d);
    return r.d === 1 ? top : fracHtml(top, r.d);
  }

  function roundForDisplay(x) {
    const s = S.setup;
    if (!Number.isFinite(x)) return x;
    if (s.fmt === 'fix') return parseFloat(x.toFixed(s.digits));
    if (s.fmt === 'sci') return parseFloat(x.toPrecision(s.digits || 10));
    return parseFloat(x.toPrecision(10));
  }

  function context() {
    return E.makeContext({ vars: S.vars, ans: S.ans, angle: S.setup.angle, round: roundForDisplay });
  }

  function errKind(e) {
    if (e instanceof E.CalcError) return e.kind;
    console.error(e);
    return E.MATH;
  }

  const vibrate = () => {
    if (S.setup.vibrate && navigator.vibrate) {
      try { navigator.vibrate(8); } catch (e) { /* ignore */ }
    }
  };

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const S = {
    mode: 'COMP',
    shift: false,
    alpha: false,
    hyp: false,
    sto: false,
    setup: { angle: 'deg', fmt: 'norm1', digits: 0, exact: true, vibrate: true },
    vars: Object.fromEntries(VAR_NAMES.map((v) => [v, 0])),
    ans: 0,
    history: [],
    comp: { ed: new Editor(), result: null, fresh: false, histPos: -1 },
    view: null, // form / list / table screen on top of the current mode
    menu: null,
    eqn: { type: null, coef: {} },
    table: { f: [], g: [], start: 1, end: 5, step: 1 },
    stat: { type: '1', xs: [], ys: [], row: 0, col: 0, ed: new Editor() },
    base: { ed: new Editor(), radix: 10, value: null, error: null },
  };

  function save() {
    try {
      const data = {
        setup: S.setup, vars: S.vars, ans: S.ans, mode: S.mode,
        history: S.history.slice(-30),
        eqn: { type: S.eqn.type, coef: S.eqn.coef },
        table: S.table,
        stat: { type: S.stat.type, xs: S.stat.xs, ys: S.stat.ys },
        radix: S.base.radix,
      };
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (e) { /* storage unavailable */ }
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      Object.assign(S.setup, d.setup || {});
      Object.assign(S.vars, d.vars || {});
      if (typeof d.ans === 'number') S.ans = d.ans;
      if (Array.isArray(d.history)) S.history = d.history;
      if (d.eqn) S.eqn.coef = d.eqn.coef || {};
      if (d.eqn && d.eqn.type) S.eqn.type = d.eqn.type;
      if (d.table) Object.assign(S.table, d.table);
      if (d.stat) Object.assign(S.stat, { type: d.stat.type || '1', xs: d.stat.xs || [], ys: d.stat.ys || [] });
      if (d.radix) S.base.radix = d.radix;
      if (d.mode && d.mode !== 'COMP') enterMode(d.mode, true);
    } catch (e) { /* corrupt or unavailable storage */ }
  }

  // ---------------------------------------------------------------------------
  // Menus (bottom sheet)
  // ---------------------------------------------------------------------------

  function openMenu(title, items, opts = {}) {
    S.menu = { title, items, note: opts.note };
  }

  function closeMenu() { S.menu = null; }

  function modeMenu() {
    openMenu('MODE', [
      { label: 'COMP', hint: 'General calculations', run: () => enterMode('COMP') },
      { label: 'STAT', hint: 'Statistics & regression', run: () => enterMode('STAT') },
      { label: 'TABLE', hint: 'Function table f(x), g(x)', run: () => enterMode('TABLE') },
      { label: 'EQN', hint: 'Equations & polynomials', run: () => enterMode('EQN') },
      { label: 'BASE-N', hint: 'DEC · HEX · BIN · OCT', run: () => enterMode('BASE') },
    ]);
  }

  function setupMenu() {
    const s = S.setup;
    const on = (b) => (b ? ' ✓' : '');
    openMenu('SETUP', [
      { label: 'Degree (D)' + on(s.angle === 'deg'), run: () => { s.angle = 'deg'; } },
      { label: 'Radian (R)' + on(s.angle === 'rad'), run: () => { s.angle = 'rad'; } },
      { label: 'Gradian (G)' + on(s.angle === 'gra'), run: () => { s.angle = 'gra'; } },
      { label: 'Fix' + (s.fmt === 'fix' ? ` ${s.digits} ✓` : ''), run: () => digitsMenu('fix') },
      { label: 'Sci' + (s.fmt === 'sci' ? ` ${s.digits || 10} ✓` : ''), run: () => digitsMenu('sci') },
      { label: 'Norm 1' + on(s.fmt === 'norm1'), run: () => { s.fmt = 'norm1'; } },
      { label: 'Norm 2' + on(s.fmt === 'norm2'), run: () => { s.fmt = 'norm2'; } },
      { label: 'Exact results (fractions, √, π)' + on(s.exact), run: () => { s.exact = !s.exact; } },
      { label: 'Key vibration' + on(s.vibrate), run: () => { s.vibrate = !s.vibrate; } },
      { label: 'Clear variables & memory', run: clearVars },
      { label: 'Reset all', run: resetAll },
    ]);
  }

  function digitsMenu(kind) {
    const items = [];
    for (let d = 0; d <= 9; d++) {
      const label = kind === 'sci' && d === 0 ? '10 digits' : `${d} ${kind === 'fix' ? 'decimals' : 'digits'}`;
      items.push({ label, run: () => { S.setup.fmt = kind; S.setup.digits = d; } });
    }
    openMenu(kind === 'fix' ? 'Fix 0~9' : 'Sci 0~9', items);
  }

  function clearVars() {
    VAR_NAMES.forEach((v) => { S.vars[v] = 0; });
    S.ans = 0;
    toast('Variables cleared');
  }

  function resetAll() {
    try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
    location.reload();
  }

  function historyMenu() {
    if (!S.history.length) { toast('History is empty'); return; }
    const items = S.history.slice().reverse().map((h) => ({
      label: h.pieces.map(pieceHtml).join(''),
      html: true,
      hint: '= ' + E.formatNumber(h.value, fmt()),
      run: () => {
        if (S.mode !== 'COMP') enterMode('COMP');
        const c = S.comp;
        if (c.fresh || c.ed.empty) {
          c.ed = new Editor(h.pieces);
          c.result = null;
          c.fresh = false;
        } else {
          h.pieces.forEach((p) => c.ed.insert(p));
        }
      },
    }));
    items.push({ label: 'Clear history', run: () => { S.history = []; } });
    openMenu('HISTORY', items);
  }

  function recallMenu() {
    const items = VAR_NAMES.map((v) => ({
      label: v,
      hint: E.formatNumber(S.vars[v], fmt()),
      run: () => handler().input(v),
    }));
    items.push({ label: 'Ans', hint: E.formatNumber(S.ans, fmt()), run: () => handler().input('Ans') });
    openMenu('RECALL', items);
  }

  // ---------------------------------------------------------------------------
  // Modes
  // ---------------------------------------------------------------------------

  function enterMode(mode, silent) {
    S.mode = mode;
    S.view = null;
    S.hyp = false;
    if (mode === 'EQN') {
      if (silent && S.eqn.type) openEqnForm(S.eqn.type);
      else eqnTypeMenu();
    } else if (mode === 'STAT') {
      if (!silent) statTypeMenu();
    } else if (mode === 'TABLE') {
      openTableForm();
    }
  }

  // ---- Generic form view (coefficients, CALC prompts, table settings) ----

  // fields: [{ key, label, value, kind: 'num'|'expr', pieces?, optional? }]
  function openForm(title, fields, onDone, opts = {}) {
    S.view = {
      type: 'form', title, fields, idx: 0, ed: null,
      onDone, onBack: opts.onBack, doneLabel: opts.doneLabel || 'Solve',
    };
  }

  function formCommit(v) {
    const f = v.fields[v.idx];
    if (!v.ed) return true;
    if (f.kind === 'expr') {
      if (v.ed.empty && !f.optional) { v.error = E.SYNTAX; return false; }
      if (!v.ed.empty) {
        try { E.parse(v.ed.pieces); } catch (e) { v.error = errKind(e); return false; }
      }
      f.pieces = [...v.ed.pieces];
      v.ed = null;
      return true;
    }
    if (v.ed.empty) { v.ed = null; return true; }
    try {
      const r = E.calc(v.ed.pieces, { vars: S.vars, ans: S.ans, angle: S.setup.angle, round: roundForDisplay });
      f.value = r.value;
      v.ed = null;
      return true;
    } catch (e) {
      v.error = errKind(e);
      return false;
    }
  }

  function formDone(v) {
    if (!formCommit(v)) return;
    v.onDone(v.fields);
  }

  const formHandler = {
    input(p) {
      const v = S.view;
      v.error = null;
      if (!v.ed) v.ed = new Editor(v.fields[v.idx].kind === 'expr' ? v.fields[v.idx].pieces || [] : []);
      v.ed.insert(p);
    },
    del() {
      const v = S.view;
      v.error = null;
      if (!v.ed) {
        const f = v.fields[v.idx];
        v.ed = new Editor(f.kind === 'expr' ? f.pieces || [] : []);
      }
      v.ed.del();
    },
    ac() {
      const v = S.view;
      if (v.error) { v.error = null; return; }
      if (v.ed && !v.ed.empty) { v.ed.clear(); return; }
      if (v.ed) { v.ed = null; return; }
      if (v.onBack) v.onBack();
    },
    eq() {
      const v = S.view;
      v.error = null;
      if (!formCommit(v)) return;
      if (v.idx < v.fields.length - 1) v.idx++;
      else formDone(v);
    },
    up() {
      const v = S.view;
      if (v.ed && !formCommit(v)) return;
      v.idx = (v.idx - 1 + v.fields.length) % v.fields.length;
    },
    down() {
      const v = S.view;
      if (v.ed && !formCommit(v)) return;
      v.idx = (v.idx + 1) % v.fields.length;
    },
    left() { if (S.view.ed) S.view.ed.left(); },
    right() { if (S.view.ed) S.view.ed.right(); },
    soft() {
      const v = S.view;
      return [{ label: v.doneLabel, run: () => formDone(v) }];
    },
  };

  // ---- Generic list view (results) ----

  function openList(title, rows, opts = {}) {
    S.view = { type: 'list', title, rows, back: S.view, scroll: 0, onBack: opts.onBack, soft: opts.soft, table: opts.table };
  }

  const listHandler = {
    input() {},
    del() {},
    ac() { listBack(); },
    eq() { listBack(); },
    up() { scrollList(-1); },
    down() { scrollList(1); },
    left() {},
    right() {},
    soft() { return S.view.soft || [{ label: 'Back', run: listBack }]; },
  };

  function listBack() {
    const v = S.view;
    if (v.onBack) v.onBack();
    else S.view = v.back;
  }

  function scrollList(dir) {
    const el = document.querySelector('.screen-body');
    if (el) el.scrollBy({ top: dir * 40, behavior: 'smooth' });
  }

  // ---- EQN ----

  const EQN_TYPES = {
    lin2: { title: 'aX + bY = c', n: 2 },
    lin3: { title: 'aX + bY + cZ = d', n: 3 },
    poly2: { title: 'aX² + bX + c = 0', deg: 2 },
    poly3: { title: 'aX³ + bX² + cX + d = 0', deg: 3 },
    poly4: { title: 'aX⁴ + bX³ + cX² + dX + e = 0', deg: 4 },
  };

  function eqnTypeMenu() {
    openMenu('EQN', Object.entries(EQN_TYPES).map(([k, t]) => ({
      label: t.title,
      hint: t.n ? `Simultaneous · ${t.n} unknowns` : `Polynomial · degree ${t.deg}`,
      run: () => openEqnForm(k),
    })));
  }

  const SUB = ['₁', '₂', '₃', '₄'];
  const LETTERS = ['a', 'b', 'c', 'd', 'e'];

  function openEqnForm(type) {
    S.eqn.type = type;
    const t = EQN_TYPES[type];
    const saved = S.eqn.coef[type] || [];
    const fields = [];
    if (t.n) {
      for (let r = 0; r < t.n; r++) {
        for (let c = 0; c <= t.n; c++) {
          fields.push({ label: LETTERS[c] + SUB[r], value: saved[fields.length] ?? 0, kind: 'num' });
        }
      }
    } else {
      for (let c = 0; c <= t.deg; c++) fields.push({ label: LETTERS[c], value: saved[c] ?? 0, kind: 'num' });
    }
    openForm(t.title, fields, solveEqn, { onBack: eqnTypeMenu });
    S.view.grid = t.n ? t.n + 1 : 0;
  }

  function solveEqn(fields) {
    const type = S.eqn.type;
    const t = EQN_TYPES[type];
    const vals = fields.map((f) => f.value);
    S.eqn.coef[type] = vals;
    const rows = [];
    if (t.n) {
      const A = [], b = [];
      for (let r = 0; r < t.n; r++) {
        A.push(vals.slice(r * (t.n + 1), r * (t.n + 1) + t.n));
        b.push(vals[r * (t.n + 1) + t.n]);
      }
      const res = E.solveLinear(A, b);
      if (res.status === 'none') rows.push({ label: '', html: 'No Solution' });
      else if (res.status === 'infinite') rows.push({ label: '', html: 'Infinite Solution' });
      else res.x.forEach((x, i) => rows.push({ label: ['X', 'Y', 'Z'][i], html: numHtml(x) }));
    } else {
      if (vals[0] === 0) { S.view.error = E.MATH; return; }
      let roots;
      try { roots = E.polyRoots(vals); } catch (e) { S.view.error = errKind(e); return; }
      const exact = t.deg === 2 && useExact() ? E.quadExact(...vals) : null;
      const allSame = roots.every((z) => z.re === roots[0].re && z.im === roots[0].im);
      const shown = allSame ? [roots[0]] : roots;
      shown.forEach((z, i) => {
        const html = exact ? surdSumHtml(exact[i]) : complexHtml(z);
        rows.push({ label: allSame ? 'X' : 'X' + SUB[i], html });
      });
      if (t.deg === 2) {
        const [a, b, c] = vals;
        const xv = -b / (2 * a);
        const yv = c - (b * b) / (4 * a);
        rows.push({ label: a > 0 ? 'Min X' : 'Max X', html: numHtml(xv) });
        rows.push({ label: a > 0 ? 'Min Y' : 'Max Y', html: numHtml(yv) });
      }
    }
    save();
    openList(t.title, rows, {
      soft: [
        { label: 'Edit', run: listBack },
        { label: 'Type', run: eqnTypeMenu },
      ],
    });
  }

  // ---- TABLE ----

  function openTableForm() {
    const t = S.table;
    openForm('TABLE', [
      { label: 'f(X)', kind: 'expr', pieces: t.f.length ? t.f : ['X', '²'] },
      { label: 'g(X)', kind: 'expr', pieces: t.g, optional: true },
      { label: 'Start', kind: 'num', value: t.start },
      { label: 'End', kind: 'num', value: t.end },
      { label: 'Step', kind: 'num', value: t.step },
    ], buildTable, { doneLabel: 'Table' });
  }

  function buildTable(fields) {
    const [f, g, start, end, step] = fields;
    const t = S.table;
    t.f = f.pieces; t.g = g.pieces || [];
    t.start = start.value; t.end = end.value; t.step = step.value;
    save();
    if (t.step <= 0 || t.end < t.start) { S.view.error = E.MATH; return; }
    const n = Math.floor((t.end - t.start) / t.step + 1e-9) + 1;
    if (n > 200) { S.view.error = 'Range ERROR'; return; }
    let tf, tg;
    try {
      tf = E.parse(t.f);
      tg = t.g.length ? E.parse(t.g) : null;
    } catch (e) { S.view.error = errKind(e); return; }
    const cell = (tree, x) => {
      if (!tree) return '';
      const ctx = context();
      ctx.vars = { ...S.vars, X: x };
      try { return numHtml(E.evaluate(tree, ctx), false); } catch (e) { return '<span class="err">ERROR</span>'; }
    };
    const rows = [];
    for (let i = 0; i < n; i++) {
      const x = parseFloat((t.start + i * t.step).toPrecision(12));
      rows.push([numHtml(x, false), cell(tf, x), cell(tg, x)]);
    }
    const head = tg ? ['X', 'f(X)', 'g(X)'] : ['X', 'f(X)'];
    openList('TABLE', [], {
      table: { head, rows: rows.map((r) => r.slice(0, head.length)) },
      soft: [{ label: 'Edit', run: listBack }],
    });
  }

  // ---- STAT ----

  function statTypeMenu() {
    openMenu('STAT', [
      { label: '1-VAR', hint: 'Single variable x', run: () => setStatType('1') },
      { label: 'y = a + bx', hint: 'Paired data · linear regression', run: () => setStatType('2') },
    ]);
  }

  function setStatType(type) {
    const st = S.stat;
    if (st.type !== type) { st.xs = []; st.ys = []; }
    st.type = type;
    st.row = 0; st.col = 0; st.ed = new Editor();
    S.view = null;
  }

  function statCommit() {
    const st = S.stat;
    if (st.ed.empty) return true;
    let v;
    try {
      v = E.calc(st.ed.pieces, { vars: S.vars, ans: S.ans, angle: S.setup.angle }).value;
    } catch (e) { st.error = errKind(e); return false; }
    const n = st.xs.length;
    if (st.row >= n) { st.xs.push(0); if (st.type === '2') st.ys.push(0); }
    (st.col === 0 ? st.xs : st.ys)[st.row] = v;
    st.ed = new Editor();
    save();
    return true;
  }

  const statHandler = {
    input(p) { S.stat.error = null; S.stat.ed.insert(p); },
    del() {
      const st = S.stat;
      st.error = null;
      if (!st.ed.empty) { st.ed.del(); return; }
      if (st.row < st.xs.length) {
        st.xs.splice(st.row, 1);
        if (st.type === '2') st.ys.splice(st.row, 1);
        save();
      }
    },
    ac() {
      const st = S.stat;
      if (st.error) { st.error = null; return; }
      st.ed.clear();
    },
    eq() {
      const st = S.stat;
      if (!statCommit()) return;
      if (st.type === '2' && st.col === 0) st.col = 1;
      else { st.col = 0; st.row = Math.min(st.row + 1, st.xs.length); }
    },
    up() { const st = S.stat; if (statCommit()) st.row = Math.max(0, st.row - 1); },
    down() { const st = S.stat; if (statCommit()) st.row = Math.min(st.xs.length, st.row + 1); },
    left() {
      const st = S.stat;
      if (!st.ed.empty) st.ed.left();
      else if (st.type === '2') st.col = 0;
    },
    right() {
      const st = S.stat;
      if (!st.ed.empty) st.ed.right();
      else if (st.type === '2') st.col = 1;
    },
    soft() {
      return [
        { label: 'Results', run: statResults },
        { label: 'Clear', run: () => { S.stat.xs = []; S.stat.ys = []; S.stat.row = 0; S.stat.col = 0; save(); } },
        { label: 'Type', run: statTypeMenu },
      ];
    },
  };

  function statResults() {
    const st = S.stat;
    if (!statCommit()) return;
    if (!st.xs.length) { st.error = 'No data'; return; }
    const f = (x) => (Number.isFinite(x) ? sciHtml(E.formatNumber(x, fmt())) : '—');
    let rows;
    if (st.type === '1') {
      const s = E.stats1(st.xs);
      rows = [
        ['n', s.n], ['x̄', s.mean], ['Σx', s.sum], ['Σx²', s.sum2], ['σx', s.popSD], ['sx', s.sampleSD],
        ['min', s.min], ['Q₁', s.q1], ['Med', s.median], ['Q₃', s.q3], ['max', s.max],
      ];
    } else {
      const s = E.stats2(st.xs, st.ys);
      rows = [
        ['n', s.n], ['x̄', s.x.mean], ['ȳ', s.y.mean], ['Σx', s.x.sum], ['Σy', s.y.sum],
        ['Σxy', s.sumXY], ['Σx²', s.x.sum2], ['Σy²', s.y.sum2],
        ['σx', s.x.popSD], ['σy', s.y.popSD], ['sx', s.x.sampleSD], ['sy', s.y.sampleSD],
        ['a', s.a], ['b', s.b], ['r', s.r],
      ];
    }
    openList(st.type === '1' ? '1-VAR results' : 'y = a + bx', rows.map(([label, x]) => ({ label, html: f(x) })), {
      soft: [{ label: 'Data', run: listBack }],
    });
  }

  // ---- BASE-N ----

  const RADIX_NAME = { 10: 'DEC', 16: 'HEX', 2: 'BIN', 8: 'OCT' };

  const BASE_OPS = new Set(['+', '−', '×', '÷', 'and', 'or', 'xor', 'xnor']);
  const BASE_PIECE = /^([0-9A-F]|[+−×÷()]|and|or|xor|xnor|Not\(|Neg\()$/;

  const baseHandler = {
    input(p) {
      if (!BASE_PIECE.test(p)) return;
      const b = S.base;
      if (b.value !== null || b.error) {
        // After a result, an operator continues from it; anything else starts over.
        let start = [];
        if (b.value !== null && BASE_OPS.has(p)) {
          const v = b.value;
          start = b.radix === 10 && v < 0
            ? ['Neg(', ...String(-v), ')']
            : [...E.baseFormat(v, b.radix).replace(/\s/g, '')];
        }
        b.ed = new Editor(start);
        b.value = null;
        b.error = null;
      }
      b.ed.insert(p);
    },
    del() { const b = S.base; b.value = null; b.error = null; b.ed.del(); },
    ac() { const b = S.base; b.ed.clear(); b.value = null; b.error = null; },
    eq() {
      const b = S.base;
      if (b.ed.empty) return;
      try { b.value = E.baseEval(b.ed.pieces, b.radix); b.error = null; } catch (e) { b.error = errKind(e); }
    },
    up() {}, down() {},
    left() { const b = S.base; b.value = null; b.error = null; b.ed.left(); },
    right() { const b = S.base; b.value = null; b.error = null; b.ed.right(); },
    soft() { return []; },
  };

  function setRadix(r) {
    const b = S.base;
    b.radix = r;
    if (b.value !== null) b.ed = new Editor();
    else { b.ed.clear(); b.error = null; }
    save();
  }

  // ---- COMP ----

  function evaluateComp(decimal) {
    const c = S.comp;
    if (c.ed.empty) return;
    const ctx = context();
    try {
      const tree = E.parse(c.ed.pieces);
      if (tree.type === 'eq') throw new E.CalcError(E.SYNTAX);
      const value = E.evaluate(tree, ctx);
      S.ans = value;
      c.result = { value, multi: ctx.multi, decimal: !!decimal, eng: null };
      S.history.push({ pieces: [...c.ed.pieces], value });
      if (S.history.length > 30) S.history.shift();
      save();
    } catch (e) {
      c.result = { error: errKind(e) };
    }
    c.fresh = true;
    c.histPos = -1;
  }

  // Value of the current display for M+, STO: the shown answer or a fresh evaluation.
  function currentValue() {
    const c = S.comp;
    if (!(c.fresh && c.result && !c.result.error)) evaluateComp();
    return c.result && !c.result.error ? c.result.value : null;
  }

  function startEditing(toStart) {
    const c = S.comp;
    c.fresh = false;
    c.result = null;
    c.ed.cursor = toStart ? 0 : c.ed.pieces.length;
  }

  const compHandler = {
    input(p, meta = {}) {
      const c = S.comp;
      if (c.fresh) {
        const cont = c.result && !c.result.error && CONTINUE.has(p) && !meta.neg;
        c.ed = new Editor(cont ? ['Ans', p] : [p]);
        c.fresh = false;
        c.result = null;
        c.histPos = -1;
        return;
      }
      c.ed.insert(p);
    },
    del() { const c = S.comp; if (c.fresh) startEditing(); else c.ed.del(); },
    ac() {
      const c = S.comp;
      c.ed.clear();
      c.result = null;
      c.fresh = false;
      c.histPos = -1;
    },
    eq() { evaluateComp(false); },
    left() { const c = S.comp; if (c.fresh) startEditing(false); else c.ed.left(); },
    right() { const c = S.comp; if (c.fresh) startEditing(true); else c.ed.right(); },
    up() { replay(1); },
    down() { replay(-1); },
    soft() { return []; },
  };

  function replay(dir) {
    const c = S.comp;
    if (!S.history.length) return;
    if (!c.fresh && !c.ed.empty && c.histPos < 0) return;
    let pos = c.histPos < 0 ? (dir > 0 ? 0 : -1) : c.histPos + dir;
    if (c.histPos < 0 && c.fresh && dir > 0) pos = 1; // the shown result is entry 0
    if (pos < 0 || pos >= S.history.length) return;
    const h = S.history[S.history.length - 1 - pos];
    c.histPos = pos;
    c.ed = new Editor(h.pieces);
    c.result = { value: h.value, decimal: false, eng: null };
    c.fresh = true;
  }

  function usedVars(pieces) {
    const seen = [];
    for (const p of pieces) if (VAR_NAMES.includes(p) && !seen.includes(p)) seen.push(p);
    return seen;
  }

  function startCalc() {
    const c = S.comp;
    if (c.ed.empty) return;
    const vars = usedVars(c.ed.pieces);
    if (!vars.length) { evaluateComp(); return; }
    openForm('CALC', vars.map((v) => ({ key: v, label: v, value: S.vars[v], kind: 'num' })), (fields) => {
      fields.forEach((f) => { S.vars[f.key] = f.value; });
      S.view = null;
      evaluateComp();
    }, { doneLabel: 'Calc', onBack: () => { S.view = null; } });
  }

  function startSolve() {
    const c = S.comp;
    if (c.ed.empty) return;
    let tree;
    try { tree = E.parse(c.ed.pieces); } catch (e) { c.result = { error: errKind(e) }; c.fresh = true; return; }
    const vars = usedVars(c.ed.pieces);
    const target = vars.includes('X') ? 'X' : vars[0];
    if (!target) { c.result = { error: E.SYNTAX }; c.fresh = true; return; }
    const others = vars.filter((v) => v !== target);
    const fields = others.map((v) => ({ key: v, label: v, value: S.vars[v], kind: 'num' }));
    fields.push({ key: target, label: `${target} (guess)`, value: S.vars[target], kind: 'num' });
    openForm('SOLVE for ' + target, fields, (fs) => {
      fs.forEach((f) => { S.vars[f.key] = f.value; });
      try {
        const r = E.solveFor(tree, { vars: { ...S.vars }, ans: S.ans, angle: S.setup.angle }, S.vars[target], target);
        S.vars[target] = r.x;
        S.ans = r.x;
        save();
        const formView = S.view;
        openList('SOLVE', [
          { label: target, html: numHtml(r.x, false) },
          { label: 'L−R', html: numHtml(r.lr, false) },
        ], {
          onBack: () => { S.view = null; },
          soft: [
            { label: 'Again', run: () => { S.view = formView; } },
            { label: 'Done', run: () => { S.view = null; } },
          ],
        });
      } catch (e) {
        S.view.error = errKind(e);
      }
    }, { doneLabel: 'Solve', onBack: () => { S.view = null; } });
  }

  function storeTo(v) {
    const val = S.mode === 'COMP' && !S.view ? currentValue() : null;
    if (val === null) return;
    S.vars[v] = val;
    const c = S.comp;
    c.result = { value: val, decimal: false, eng: null, stored: v };
    c.fresh = true;
    save();
  }

  function memory(sign) {
    if (S.mode !== 'COMP' || S.view) return;
    const val = currentValue();
    if (val === null) return;
    S.vars.M = S.vars.M + sign * val;
    save();
    toast(`M = ${E.formatNumber(S.vars.M, fmt())}`);
  }

  // ---------------------------------------------------------------------------
  // Dispatch
  // ---------------------------------------------------------------------------

  function handler() {
    if (S.view && S.view.type === 'form') return formHandler;
    if (S.view && S.view.type === 'list') return listHandler;
    if (S.mode === 'STAT') return statHandler;
    if (S.mode === 'BASE') return baseHandler;
    return compHandler;
  }

  function trigPiece(name, inverse) {
    const h = S.hyp ? 'h' : '';
    S.hyp = false;
    return `${name}${h}${inverse ? '⁻¹' : ''}(`;
  }

  function command(cmd) {
    const h = handler();
    switch (cmd) {
      case ':mode': modeMenu(); break;
      case ':setup': setupMenu(); break;
      case ':history': historyMenu(); break;
      case ':recall': recallMenu(); break;
      case ':del': h.del(); break;
      case ':ac': S.hyp = false; h.ac(); break;
      case ':eq': h.eq(); break;
      case ':approx':
        if (h === compHandler) evaluateComp(true); else h.eq();
        break;
      case ':left': h.left(); break;
      case ':right': h.right(); break;
      case ':up': h.up(); break;
      case ':down': h.down(); break;
      case ':neg': h.input('−', { neg: true }); break;
      case ':hyp': S.hyp = !S.hyp; break;
      case ':sin': case ':cos': case ':tan': h.input(trigPiece(cmd.slice(1), false)); break;
      case ':asin': case ':acos': case ':atan': h.input(trigPiece(cmd.slice(2), true)); break;
      case ':sto': if (S.mode === 'COMP' && !S.view) S.sto = true; break;
      case ':calc': if (h === compHandler) startCalc(); break;
      case ':solve': if (h === compHandler) startSolve(); break;
      case ':mplus': memory(1); break;
      case ':mminus': memory(-1); break;
      case ':sd': {
        const r = S.comp.result;
        if (h === compHandler && r && !r.error && S.comp.fresh) { r.decimal = !r.decimal; r.eng = null; }
        break;
      }
      case ':eng': case ':engback': {
        const r = S.comp.result;
        if (h === compHandler && r && !r.error && S.comp.fresh) {
          r.eng = (r.eng === null ? 0 : r.eng + (cmd === ':eng' ? 1 : -1));
        }
        break;
      }
      default: break;
    }
  }

  function pressKey(id) {
    const key = ALL_KEYS[id];
    if (!key) return;
    vibrate();

    if (S.menu) {
      // Number keys pick a menu item; AC closes the menu.
      const m = /^n([1-9])$/.exec(id);
      if (m && S.menu.items[+m[1] - 1]) chooseMenu(+m[1] - 1);
      else if (id === 'ac') closeMenu();
      render();
      return;
    }

    if (key.a === ':shift') { S.shift = !S.shift; S.alpha = false; render(); return; }
    if (key.a === ':alpha') { S.alpha = !S.alpha; S.shift = false; S.sto = false; render(); return; }

    let action = key.a;
    if (S.sto) {
      S.sto = false;
      S.shift = false; S.alpha = false;
      if (key.al && VAR_NAMES.includes(key.al[1])) storeTo(key.al[1]);
      render();
      return;
    }
    if (S.shift && key.s) action = key.s[1];
    else if (S.alpha && key.al) action = key.al[1];
    S.shift = false;
    S.alpha = false;

    if (action.startsWith(':')) command(action);
    else handler().input(action);
    render();
  }

  function chooseMenu(i) {
    const item = S.menu.items[i];
    const before = S.menu;
    item.run();
    if (S.menu === before) closeMenu();
    save();
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  const els = {};

  function buildKeypad() {
    const makeKey = (k) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'key ' + (k.cls || '');
      b.dataset.id = k.id;
      const sh = k.s ? `<span class="ls">${esc(k.s[0])}</span>` : '<span class="ls"></span>';
      const al = k.al ? `<span class="la">${esc(k.al[0])}</span>` : '<span class="la"></span>';
      b.innerHTML = `<span class="lbl">${sh}${al}</span><span class="face">${esc(k.l)}</span>`;
      b.setAttribute('aria-label', k.l);
      return b;
    };
    const fn = els.fnPad;
    for (const k of FUNC_KEYS) {
      if (k.dpad) {
        const d = document.createElement('div');
        d.className = 'dpad';
        d.innerHTML = [
          ['up', '▲', 'Up'], ['left', '◀', 'Left'], ['right', '▶', 'Right'], ['down', '▼', 'Down'],
        ].map(([dir, sym, name]) => `<button type="button" class="dp dp-${dir}" data-dir="${dir}" aria-label="${name}">${sym}</button>`).join('');
        fn.appendChild(d);
      } else fn.appendChild(makeKey(k));
    }
    for (const k of NUM_KEYS) els.numPad.appendChild(makeKey(k));

    const onPress = (e) => {
      const dp = e.target.closest('[data-dir]');
      if (dp) {
        e.preventDefault();
        vibrate();
        if (S.menu) return;
        S.shift = false; S.alpha = false;
        command(':' + dp.dataset.dir);
        render();
        return;
      }
      const btn = e.target.closest('.key');
      if (btn) { e.preventDefault(); pressKey(btn.dataset.id); }
    };
    els.keypad.addEventListener('click', onPress);
  }

  function statusHtml() {
    const s = S.setup;
    const flag = (on, txt, cls = '') => `<span class="flag ${cls} ${on ? 'on' : ''}">${txt}</span>`;
    const angle = { deg: 'D', rad: 'R', gra: 'G' }[s.angle];
    const f = s.fmt === 'fix' ? `FIX${s.digits}` : s.fmt === 'sci' ? `SCI${s.digits || 10}` : '';
    const modeName = { COMP: '', STAT: 'STAT', TABLE: 'TABLE', EQN: 'EQN', BASE: 'BASE-N' }[S.mode];
    return [
      flag(S.shift, 'S', 'f-s'), flag(S.alpha, 'A', 'f-a'), flag(S.hyp, 'hyp'), flag(S.sto, 'STO'),
      flag(S.vars.M !== 0, 'M'), flag(true, angle), f ? flag(true, f) : '',
      modeName ? `<span class="mode-tag">${modeName}</span>` : '',
    ].join('');
  }

  function compScreen() {
    const c = S.comp;
    const r = c.result;
    let res = '';
    if (r) {
      if (r.error) {
        res = `<div class="error">${esc(r.error)}</div><div class="hint">AC: clear · ◀ ▶ / DEL: edit</div>`;
      } else if (r.multi) {
        res = r.multi.map(([l, v]) => `<div class="multi"><span>${l}=</span>${numHtml(v, false)}</div>`).join('');
      } else if (r.eng !== null) {
        res = sciHtml(E.formatEng(r.value, r.eng));
      } else {
        res = numHtml(r.value, useExact() && !r.decimal);
      }
      if (r.stored) res = `<span class="stored">→${r.stored}</span> ` + res;
    }
    const input = c.ed.html(!c.fresh);
    return `<div class="line-in ${c.fresh ? 'dim' : ''}">${input}</div>
      <div class="line-out ${r && r.error ? 'is-error' : ''}">${res}</div>`;
  }

  function formScreen(v) {
    const rows = v.fields.map((f, i) => {
      const active = i === v.idx;
      let content;
      if (active && v.ed) content = v.ed.html(true);
      else if (f.kind === 'expr') content = (f.pieces || []).map(pieceHtml).join('') || '<span class="muted">—</span>';
      else content = numHtml(f.value, false);
      return `<div class="frow ${active ? 'active' : ''}" data-field="${i}">
        <span class="flabel">${esc(f.label)}</span><span class="fval">${content}</span></div>`;
    }).join('');
    const err = v.error ? `<div class="error small">${esc(v.error)}</div>` : '';
    const cls = v.grid ? `form grid g${v.grid}` : 'form';
    return `<div class="stitle">${esc(v.title)}</div>${err}<div class="${cls}">${rows}</div>`;
  }

  function listScreen(v) {
    if (v.table) {
      const head = v.table.head.map((h) => `<th>${esc(h)}</th>`).join('');
      const body = v.table.rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('');
      return `<div class="stitle">${esc(v.title)}</div><table class="tbl"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
    }
    const rows = v.rows.map((r) => `<div class="lrow"><span class="flabel">${esc(r.label)}${r.label ? ' =' : ''}</span><span class="lval">${r.html}</span></div>`).join('');
    return `<div class="stitle">${esc(v.title)}</div><div class="list">${rows}</div>`;
  }

  function statScreen() {
    const st = S.stat;
    const two = st.type === '2';
    const n = st.xs.length;
    const cell = (r, c) => {
      const active = r === st.row && c === st.col;
      if (active && !st.ed.empty) return `<td class="active">${st.ed.html(true)}</td>`;
      const arr = c === 0 ? st.xs : st.ys;
      const v = r < n ? sciHtml(E.formatNumber(arr[r], fmt())) : '';
      return `<td class="${active ? 'active' : ''}" data-cell="${r},${c}">${v}${active ? '<span class="cur"></span>' : ''}</td>`;
    };
    let body = '';
    for (let r = 0; r <= n; r++) {
      body += `<tr><th>${r + 1}</th>${cell(r, 0)}${two ? cell(r, 1) : ''}</tr>`;
    }
    const err = st.error ? `<div class="error small">${esc(st.error)}</div>` : '';
    return `<div class="stitle">${two ? 'STAT · y = a + bx' : 'STAT · 1-VAR'}</div>${err}
      <table class="tbl stat"><thead><tr><th></th><th>x</th>${two ? '<th>y</th>' : ''}</tr></thead><tbody>${body}</tbody></table>`;
  }

  function baseScreen() {
    const b = S.base;
    let out = '';
    if (b.error) out = `<div class="error">${esc(b.error)}</div>`;
    else if (b.value !== null) {
      out = `<div class="line-out">${esc(E.baseFormat(b.value, b.radix))}</div>
        <div class="base-all">${[10, 16, 8, 2].filter((r) => r !== b.radix).map((r) =>
          `<div><span>${RADIX_NAME[r]}</span>${esc(E.baseFormat(b.value, r))}</div>`).join('')}</div>`;
    }
    return `<div class="line-in ${b.value !== null ? 'dim' : ''}">${b.ed.html(b.value === null)}</div>${out}`;
  }

  function baseSoftKeys() {
    const b = S.base;
    const radix = [10, 16, 2, 8].map((r) => ({ label: RADIX_NAME[r], run: () => setRadix(r), on: b.radix === r }));
    const ins = (p, label = p) => ({ label, run: () => baseHandler.input(p) });
    const hex = ['A', 'B', 'C', 'D', 'E', 'F'].map((d) => ({ ...ins(d), disabled: b.radix !== 16 }));
    const logic = [ins('and'), ins('or'), ins('xor'), ins('xnor'), ins('Not(', 'Not'), ins('Neg(', 'Neg')];
    return [...radix, ...hex, ...logic];
  }

  function render() {
    els.status.innerHTML = statusHtml();
    let body;
    const v = S.view;
    if (v && v.type === 'form') body = formScreen(v);
    else if (v && v.type === 'list') body = listScreen(v);
    else if (S.mode === 'STAT') body = statScreen();
    else if (S.mode === 'BASE') body = baseScreen();
    else body = compScreen();
    els.body.innerHTML = body;
    els.body.className = 'screen-body ' + (v ? v.type : S.mode.toLowerCase());

    const soft = S.mode === 'BASE' && !v ? baseSoftKeys() : handler().soft();
    els.soft.innerHTML = soft.map((s, i) =>
      `<button type="button" class="soft ${s.on ? 'on' : ''}" data-soft="${i}" ${s.disabled ? 'disabled' : ''}>${esc(s.label)}</button>`).join('');
    els.soft.className = 'softkeys ' + (S.mode === 'BASE' && !v ? 'base' : '');
    els.soft.hidden = soft.length === 0;
    els.softList = soft;

    els.keypad.classList.toggle('shift-on', S.shift);
    els.keypad.classList.toggle('alpha-on', S.alpha || S.sto);

    renderMenu();

    const cur = els.body.querySelector('.cur, .active');
    if (cur) cur.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    else if (S.mode === 'COMP' && !v) els.body.scrollTop = els.body.scrollHeight;
  }

  function renderMenu() {
    const m = S.menu;
    els.sheet.hidden = !m;
    if (!m) return;
    els.sheetTitle.textContent = m.title;
    els.sheetList.innerHTML = m.items.map((it, i) => `
      <button type="button" class="mitem" data-menu="${i}">
        <span class="mnum">${i < 9 ? i + 1 : ''}</span>
        <span class="mtext"><span class="mlabel">${it.html ? it.label : esc(it.label)}</span>
        ${it.hint ? `<span class="mhint">${esc(it.hint)}</span>` : ''}</span>
      </button>`).join('');
  }

  let toastTimer;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 1600);
  }

  // ---------------------------------------------------------------------------
  // Physical keyboard support
  // ---------------------------------------------------------------------------

  const KEYBOARD = {
    '0': 'n0', '1': 'n1', '2': 'n2', '3': 'n3', '4': 'n4', '5': 'n5', '6': 'n6', '7': 'n7', '8': 'n8', '9': 'n9',
    '.': 'dot', ',': 'dot', '+': 'add', '-': 'sub', '*': 'mul', 'x': 'mul', '/': 'div',
    'Enter': 'eq', '=': 'eq', 'Backspace': 'del', 'Delete': 'ac', 'Escape': 'ac',
    '(': 'lp', ')': 'rp', '^': 'pow', '!': null, 's': 'sin', 'c': 'cos', 't': 'tan', 'l': 'ln',
  };

  function onKeyDown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const arrows = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    if (arrows[e.key]) {
      e.preventDefault();
      if (S.menu) return;
      command(':' + arrows[e.key]);
      render();
      return;
    }
    if (e.key === '!') { e.preventDefault(); handler().input('!'); render(); return; }
    if (e.key === '%') { e.preventDefault(); handler().input('%'); render(); return; }
    if (S.mode === 'BASE' && /^[a-fA-F]$/.test(e.key) && !S.view) {
      e.preventDefault(); baseHandler.input(e.key.toUpperCase()); render(); return;
    }
    const id = KEYBOARD[e.key];
    if (id) { e.preventDefault(); pressKey(id); }
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  function init() {
    els.status = document.getElementById('status');
    els.body = document.getElementById('screen-body');
    els.soft = document.getElementById('softkeys');
    els.keypad = document.getElementById('keypad');
    els.fnPad = document.getElementById('fn-pad');
    els.numPad = document.getElementById('num-pad');
    els.sheet = document.getElementById('sheet');
    els.sheetTitle = document.getElementById('sheet-title');
    els.sheetList = document.getElementById('sheet-list');
    els.toast = document.getElementById('toast');

    buildKeypad();

    els.soft.addEventListener('click', (e) => {
      const b = e.target.closest('[data-soft]');
      if (!b) return;
      vibrate();
      const s = els.softList[+b.dataset.soft];
      if (s && !s.disabled) { s.run(); render(); }
    });

    els.sheetList.addEventListener('click', (e) => {
      const b = e.target.closest('[data-menu]');
      if (!b) return;
      vibrate();
      chooseMenu(+b.dataset.menu);
      render();
    });
    document.getElementById('sheet-close').addEventListener('click', () => { closeMenu(); render(); });
    els.sheet.addEventListener('click', (e) => { if (e.target === els.sheet) { closeMenu(); render(); } });

    // Tap a form row or stat cell to select it.
    els.body.addEventListener('click', (e) => {
      const row = e.target.closest('[data-field]');
      if (row && S.view && S.view.type === 'form') {
        const v = S.view;
        if (v.ed && !formCommit(v)) { render(); return; }
        v.idx = +row.dataset.field;
        render();
        return;
      }
      const cell = e.target.closest('[data-cell]');
      if (cell && S.mode === 'STAT' && !S.view) {
        if (!statCommit()) { render(); return; }
        const [r, c] = cell.dataset.cell.split(',').map(Number);
        S.stat.row = Math.min(r, S.stat.xs.length);
        S.stat.col = c;
        render();
      }
    });

    document.addEventListener('keydown', onKeyDown);

    load();
    render();

    const native = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
    if (native) setupNative();
    else if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  // Android app: the hardware back button steps back through menus and
  // screens before leaving the app.
  function setupNative() {
    const App = window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (!App) return;
    App.addListener('backButton', () => {
      const v = S.view;
      if (S.menu) closeMenu();
      else if (v && v.type === 'list') listBack();
      else if (v && (v.ed || v.error)) formHandler.ac();
      else if (v && S.mode === 'COMP') S.view = null;
      else if (S.shift || S.alpha || S.sto) { S.shift = false; S.alpha = false; S.sto = false; }
      else if (S.mode !== 'COMP') enterMode('COMP');
      else { App.exitApp(); return; }
      save();
      render();
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
