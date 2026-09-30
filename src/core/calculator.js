// Calculator controller: all state and key handling, independent of React.
// The UI calls pressKey()/pressDir()/... and re-renders from getScreen().
const E = require('./engine');
const { KEYS } = require('./keys');
const { numRun, sciRun, complexRun, surdSumRun } = require('./mathRuns');

const VAR_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'M', 'X', 'Y'];

// Pieces that continue from the previous answer when typed right after "=".
const CONTINUE = new Set(['+', '−', '×', '÷', '^(', '²', '³', '⁻¹', '!', '%', '𝐂', '𝐏', 'ˣ√(']);

const EQN_TYPES = {
  lin2: { title: 'aX + bY = c', n: 2 },
  lin3: { title: 'aX + bY + cZ = d', n: 3 },
  poly2: { title: 'aX² + bX + c = 0', deg: 2 },
  poly3: { title: 'aX³ + bX² + cX + d = 0', deg: 3 },
  poly4: { title: 'aX⁴ + bX³ + cX² + dX + e = 0', deg: 4 },
};
const SUB = ['₁', '₂', '₃', '₄'];
const LETTERS = ['a', 'b', 'c', 'd', 'e'];
const RADIX_NAME = { 10: 'DEC', 16: 'HEX', 2: 'BIN', 8: 'OCT' };
const BASE_OPS = new Set(['+', '−', '×', '÷', 'and', 'or', 'xor', 'xnor']);
const BASE_PIECE = /^([0-9A-F]|[+−×÷()]|and|or|xor|xnor|Not\(|Neg\()$/;

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
  // Snapshot for rendering.
  view(showCursor = true) { return { pieces: [...this.pieces], cursor: showCursor ? this.cursor : -1 }; }
}

function initialState() {
  return {
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
    view: null, // form / list screen on top of the current mode
    menu: null,
    eqn: { type: null, coef: {} },
    table: { f: [], g: [], start: 1, end: 5, step: 1 },
    stat: { type: '1', xs: [], ys: [], row: 0, col: 0, ed: new Editor(), error: null },
    base: { ed: new Editor(), radix: 10, value: null, error: null },
  };
}

function createCalculator({ save: persist = () => {}, toast = () => {}, scroll = () => {}, clearStorage = () => {} } = {}) {
  let S = initialState();
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => fn());

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const fmt = () => ({ mode: S.setup.fmt, digits: S.setup.digits });
  const useExact = () => S.setup.exact && (S.setup.fmt === 'norm1' || S.setup.fmt === 'norm2');
  const num = (x, exact = useExact()) => numRun(x, fmt(), exact);
  const plain = (x) => (Number.isFinite(x) ? sciRun(E.formatNumber(x, fmt())) : ['—']);

  function roundForDisplay(x) {
    const s = S.setup;
    if (!Number.isFinite(x)) return x;
    if (s.fmt === 'fix') return parseFloat(x.toFixed(s.digits));
    if (s.fmt === 'sci') return parseFloat(x.toPrecision(s.digits || 10));
    return parseFloat(x.toPrecision(10));
  }

  const context = () => E.makeContext({ vars: S.vars, ans: S.ans, angle: S.setup.angle, round: roundForDisplay });
  const calcOpts = () => ({ vars: S.vars, ans: S.ans, angle: S.setup.angle, round: roundForDisplay });

  function errKind(e) {
    if (e instanceof E.CalcError) return e.kind;
    console.warn(e);
    return E.MATH;
  }

  function save() {
    const data = {
      setup: S.setup, vars: S.vars, ans: S.ans, mode: S.mode,
      history: S.history.slice(-30),
      eqn: { type: S.eqn.type, coef: S.eqn.coef },
      table: S.table,
      stat: { type: S.stat.type, xs: S.stat.xs, ys: S.stat.ys },
      radix: S.base.radix,
    };
    persist(JSON.stringify(data));
  }

  function load(raw) {
    if (!raw) return;
    try {
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
    } catch (e) { /* corrupt storage: start fresh */ }
    emit();
  }

  // ---------------------------------------------------------------------------
  // Menus
  // ---------------------------------------------------------------------------

  const openMenu = (title, items) => { S.menu = { title, items }; };
  const closeMenu = () => { S.menu = null; };

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
    S = initialState();
    clearStorage();
    toast('Reset done');
  }

  function historyMenu() {
    if (!S.history.length) { toast('History is empty'); return; }
    const items = S.history.slice().reverse().map((h) => ({
      pieces: h.pieces,
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
      type: 'form', title, fields, idx: 0, ed: null, error: null, grid: 0,
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
      f.value = E.calc(v.ed.pieces, calcOpts()).value;
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

  const startFieldEditor = (v) => {
    const f = v.fields[v.idx];
    v.ed = new Editor(f.kind === 'expr' ? f.pieces || [] : []);
  };

  const formHandler = {
    input(p) {
      const v = S.view;
      v.error = null;
      if (!v.ed) startFieldEditor(v);
      v.ed.insert(p);
    },
    del() {
      const v = S.view;
      v.error = null;
      if (!v.ed) startFieldEditor(v);
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
    S.view = { type: 'list', title, rows, back: S.view, onBack: opts.onBack, soft: opts.soft, table: opts.table };
  }

  function listBack() {
    const v = S.view;
    if (v.onBack) v.onBack();
    else S.view = v.back;
  }

  const listHandler = {
    input() {},
    del() {},
    ac() { listBack(); },
    eq() { listBack(); },
    up() { scroll(-1); },
    down() { scroll(1); },
    left() {},
    right() {},
    soft() { return S.view.soft || [{ label: 'Back', run: listBack }]; },
  };

  // ---- EQN ----

  function eqnTypeMenu() {
    openMenu('EQN', Object.entries(EQN_TYPES).map(([k, t]) => ({
      label: t.title,
      hint: t.n ? `Simultaneous · ${t.n} unknowns` : `Polynomial · degree ${t.deg}`,
      run: () => openEqnForm(k),
    })));
  }

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
      if (res.status === 'none') rows.push({ label: '', run: ['No Solution'] });
      else if (res.status === 'infinite') rows.push({ label: '', run: ['Infinite Solution'] });
      else res.x.forEach((x, i) => rows.push({ label: ['X', 'Y', 'Z'][i], run: num(x) }));
    } else {
      if (vals[0] === 0) { S.view.error = E.MATH; return; }
      let roots;
      try { roots = E.polyRoots(vals); } catch (e) { S.view.error = errKind(e); return; }
      const exact = t.deg === 2 && useExact() ? E.quadExact(...vals) : null;
      const allSame = roots.every((z) => z.re === roots[0].re && z.im === roots[0].im);
      const shown = allSame ? [roots[0]] : roots;
      shown.forEach((z, i) => {
        const run = exact ? surdSumRun(exact[i]) : complexRun(z, fmt(), useExact());
        rows.push({ label: allSame ? 'X' : 'X' + SUB[i], run });
      });
      if (t.deg === 2) {
        const [a, b, c] = vals;
        rows.push({ label: a > 0 ? 'Min X' : 'Max X', run: num(-b / (2 * a)) });
        rows.push({ label: a > 0 ? 'Min Y' : 'Max Y', run: num(c - (b * b) / (4 * a)) });
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
      const ctx = context();
      ctx.vars = { ...S.vars, X: x };
      try { return num(E.evaluate(tree, ctx), false); } catch (e) { return [{ t: 'err', s: 'ERROR' }]; }
    };
    const rows = [];
    for (let i = 0; i < n; i++) {
      const x = parseFloat((t.start + i * t.step).toPrecision(12));
      const row = [num(x, false), cell(tf, x)];
      if (tg) row.push(cell(tg, x));
      rows.push(row);
    }
    openList('TABLE', [], {
      table: { head: tg ? ['X', 'f(X)', 'g(X)'] : ['X', 'f(X)'], rows },
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
      v = E.calc(st.ed.pieces, calcOpts()).value;
    } catch (e) { st.error = errKind(e); return false; }
    if (st.row >= st.xs.length) { st.xs.push(0); if (st.type === '2') st.ys.push(0); }
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
        { label: 'Clear', run: () => { Object.assign(S.stat, { xs: [], ys: [], row: 0, col: 0 }); save(); } },
        { label: 'Type', run: statTypeMenu },
      ];
    },
  };

  function statResults() {
    const st = S.stat;
    if (!statCommit()) return;
    if (!st.xs.length) { st.error = 'No data'; return; }
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
    openList(st.type === '1' ? '1-VAR results' : 'y = a + bx', rows.map(([label, x]) => ({ label, run: plain(x) })), {
      soft: [{ label: 'Data', run: listBack }],
    });
  }

  // ---- BASE-N ----

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
    up() {},
    down() {},
    left() { const b = S.base; b.value = null; b.error = null; b.ed.left(); },
    right() { const b = S.base; b.value = null; b.error = null; b.ed.right(); },
    soft() {
      const b = S.base;
      const ins = (p, label = p) => ({ label, run: () => baseHandler.input(p) });
      return [
        ...[10, 16, 2, 8].map((r) => ({ label: RADIX_NAME[r], on: b.radix === r, run: () => setRadix(r) })),
        ...['A', 'B', 'C', 'D', 'E', 'F'].map((d) => ({ ...ins(d), disabled: b.radix !== 16 })),
        ins('and'), ins('or'), ins('xor'), ins('xnor'), ins('Not(', 'Not'), ins('Neg(', 'Neg'),
      ];
    },
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

  // Value for M+ and STO: the shown answer or a fresh evaluation.
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
    const fields = vars.filter((v) => v !== target).map((v) => ({ key: v, label: v, value: S.vars[v], kind: 'num' }));
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
          { label: target, run: num(r.x, false) },
          { label: 'L−R', run: num(r.lr, false) },
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
    S.comp.result = { value: val, decimal: false, eng: null, stored: v };
    S.comp.fresh = true;
    save();
  }

  function memory(sign) {
    if (S.mode !== 'COMP' || S.view) return;
    const val = currentValue();
    if (val === null) return;
    S.vars.M += sign * val;
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
    const r = S.comp.result;
    const compResult = h === compHandler && r && !r.error && S.comp.fresh;
    switch (cmd) {
      case ':mode': modeMenu(); break;
      case ':setup': setupMenu(); break;
      case ':history': historyMenu(); break;
      case ':recall': recallMenu(); break;
      case ':del': h.del(); break;
      case ':ac': S.hyp = false; h.ac(); break;
      case ':eq': h.eq(); break;
      case ':approx': if (h === compHandler) evaluateComp(true); else h.eq(); break;
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
      case ':sd': if (compResult) { r.decimal = !r.decimal; r.eng = null; } break;
      case ':eng': case ':engback':
        if (compResult) r.eng = r.eng === null ? 0 : r.eng + (cmd === ':eng' ? 1 : -1);
        break;
      default: break;
    }
  }

  function chooseMenu(i) {
    const before = S.menu;
    const item = before && before.items[i];
    if (!item) return;
    item.run();
    if (S.menu === before) closeMenu();
    save();
    emit();
  }

  function pressKey(id) {
    const key = KEYS[id];
    if (!key) return;

    if (S.menu) {
      // Number keys pick a menu item; AC closes the menu.
      const m = /^n([1-9])$/.exec(id);
      if (m && S.menu.items[+m[1] - 1]) { chooseMenu(+m[1] - 1); return; }
      if (id === 'ac') closeMenu();
      emit();
      return;
    }

    if (key.a === ':shift') { S.shift = !S.shift; S.alpha = false; emit(); return; }
    if (key.a === ':alpha') { S.alpha = !S.alpha; S.shift = false; S.sto = false; emit(); return; }

    if (S.sto) {
      S.sto = false; S.shift = false; S.alpha = false;
      if (key.al && VAR_NAMES.includes(key.al[1])) storeTo(key.al[1]);
      emit();
      return;
    }

    let action = key.a;
    if (S.shift && key.s) action = key.s[1];
    else if (S.alpha && key.al) action = key.al[1];
    S.shift = false;
    S.alpha = false;

    if (action.startsWith(':')) command(action);
    else handler().input(action);
    emit();
  }

  function pressDir(dir) {
    if (S.menu) return;
    S.shift = false;
    S.alpha = false;
    command(':' + dir);
    emit();
  }

  function pressSoft(i) {
    const s = handler().soft()[i];
    if (s && !s.disabled) { s.run(); emit(); }
  }

  function tapField(i) {
    const v = S.view;
    if (!v || v.type !== 'form') return;
    if (v.ed && !formCommit(v)) { emit(); return; }
    v.idx = i;
    emit();
  }

  function tapCell(r, c) {
    if (S.mode !== 'STAT' || S.view) return;
    if (!statCommit()) { emit(); return; }
    S.stat.row = Math.min(r, S.stat.xs.length);
    S.stat.col = c;
    emit();
  }

  // Android back button. Returns false when there is nothing left to go back
  // from, so the system can close the app.
  function back() {
    const v = S.view;
    if (S.menu) closeMenu();
    else if (v && v.type === 'list') listBack();
    else if (v && (v.ed || v.error)) formHandler.ac();
    else if (v && S.mode === 'COMP') S.view = null;
    else if (S.shift || S.alpha || S.sto) { S.shift = false; S.alpha = false; S.sto = false; }
    else if (S.mode !== 'COMP') enterMode('COMP');
    else return false;
    save();
    emit();
    return true;
  }

  // ---------------------------------------------------------------------------
  // View model
  // ---------------------------------------------------------------------------

  function status() {
    const s = S.setup;
    return {
      shift: S.shift, alpha: S.alpha, hyp: S.hyp, sto: S.sto, memory: S.vars.M !== 0,
      angle: { deg: 'D', rad: 'R', gra: 'G' }[s.angle],
      format: s.fmt === 'fix' ? `FIX${s.digits}` : s.fmt === 'sci' ? `SCI${s.digits || 10}` : '',
      mode: { COMP: '', STAT: 'STAT', TABLE: 'TABLE', EQN: 'EQN', BASE: 'BASE-N' }[S.mode],
    };
  }

  function compScreen() {
    const c = S.comp;
    const r = c.result;
    let result = null;
    if (r) {
      if (r.error) result = { error: r.error };
      else if (r.multi) result = { multi: r.multi.map(([l, v]) => [l, num(v, false)]) };
      else if (r.eng !== null) result = { run: sciRun(E.formatEng(r.value, r.eng)) };
      else result = { run: num(r.value, useExact() && !r.decimal) };
      if (r.stored) result.stored = r.stored;
    }
    return { kind: 'comp', input: c.ed.view(!c.fresh), dim: c.fresh, result };
  }

  function formScreen(v) {
    return {
      kind: 'form', title: v.title, error: v.error, grid: v.grid,
      rows: v.fields.map((f, i) => {
        const active = i === v.idx;
        if (active && v.ed) return { label: f.label, active, input: v.ed.view(true) };
        if (f.kind === 'expr') return { label: f.label, active, input: { pieces: f.pieces || [], cursor: -1 } };
        return { label: f.label, active, run: num(f.value, false) };
      }),
    };
  }

  function listScreen(v) {
    if (v.table) return { kind: 'table', title: v.title, head: v.table.head, rows: v.table.rows };
    return { kind: 'list', title: v.title, rows: v.rows };
  }

  function statScreen() {
    const st = S.stat;
    const two = st.type === '2';
    const n = st.xs.length;
    const rows = [];
    for (let r = 0; r <= n; r++) {
      const cells = [];
      for (let c = 0; c < (two ? 2 : 1); c++) {
        const active = r === st.row && c === st.col;
        const arr = c === 0 ? st.xs : st.ys;
        if (active && !st.ed.empty) cells.push({ active, input: st.ed.view(true) });
        else cells.push({ active, run: r < n ? plain(arr[r]) : [] });
      }
      rows.push(cells);
    }
    return { kind: 'stat', title: two ? 'STAT · y = a + bx' : 'STAT · 1-VAR', two, error: st.error, rows };
  }

  function baseScreen() {
    const b = S.base;
    const shown = b.value !== null;
    return {
      kind: 'base',
      input: b.ed.view(!shown),
      dim: shown,
      error: b.error,
      value: shown ? E.baseFormat(b.value, b.radix) : null,
      others: shown ? [10, 16, 8, 2].filter((r) => r !== b.radix).map((r) => [RADIX_NAME[r], E.baseFormat(b.value, r)]) : [],
    };
  }

  function getScreen() {
    const v = S.view;
    let body;
    if (v && v.type === 'form') body = formScreen(v);
    else if (v && v.type === 'list') body = listScreen(v);
    else if (S.mode === 'STAT') body = statScreen();
    else if (S.mode === 'BASE') body = baseScreen();
    else body = compScreen();
    const soft = handler().soft().map(({ label, on, disabled }) => ({ label, on: !!on, disabled: !!disabled }));
    const menu = S.menu && {
      title: S.menu.title,
      items: S.menu.items.map(({ label, hint, pieces }) => ({ label, hint, pieces })),
    };
    return {
      status: status(), body, soft, menu,
      shift: S.shift, alpha: S.alpha || S.sto, vibrate: S.setup.vibrate,
    };
  }

  return {
    load, getScreen, pressKey, pressDir, pressSoft, chooseMenu, tapField, tapCell, back,
    closeMenu: () => { closeMenu(); emit(); },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}

module.exports = { createCalculator, VAR_NAMES };
