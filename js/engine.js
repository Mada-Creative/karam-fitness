/*
 * Calculator engine: tokenizer, parser, evaluator, formatting and numeric
 * solvers. It has no DOM dependencies so it can be unit-tested in Node.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Engine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SYNTAX = 'Syntax ERROR';
  const MATH = 'Math ERROR';
  const ARG = 'Argument ERROR';
  const SOLVE = "Can't Solve";

  class CalcError extends Error {
    constructor(kind) {
      super(kind);
      this.kind = kind;
    }
  }
  const fail = (kind) => { throw new CalcError(kind); };

  const VARS = ['A', 'B', 'C', 'D', 'E', 'F', 'M', 'X', 'Y'];
  const LIMIT = 1e100;

  // ---------------------------------------------------------------------------
  // Tokenizer
  // ---------------------------------------------------------------------------

  // Longest match wins, so the table is sorted by length before use.
  const NAMED = [
    ['sinh⁻¹(', 'fn', 'asinh'], ['cosh⁻¹(', 'fn', 'acosh'], ['tanh⁻¹(', 'fn', 'atanh'],
    ['sin⁻¹(', 'fn', 'asin'], ['cos⁻¹(', 'fn', 'acos'], ['tan⁻¹(', 'fn', 'atan'],
    ['sinh(', 'fn', 'sinh'], ['cosh(', 'fn', 'cosh'], ['tanh(', 'fn', 'tanh'],
    ['sin(', 'fn', 'sin'], ['cos(', 'fn', 'cos'], ['tan(', 'fn', 'tan'],
    ['log(', 'fn', 'log'], ['ln(', 'fn', 'ln'], ['√(', 'fn', 'sqrt'], ['∛(', 'fn', 'cbrt'],
    ['Abs(', 'fn', 'abs'], ['Pol(', 'fn', 'pol'], ['Rec(', 'fn', 'rec'],
    ['GCD(', 'fn', 'gcd'], ['LCM(', 'fn', 'lcm'], ['Int(', 'fn', 'int'], ['Intg(', 'fn', 'intg'],
    ['Rnd(', 'fn', 'rnd'], ['RanInt#(', 'fn', 'ranint'],
    ['∫(', 'fn', 'integ'], ['d/dx(', 'fn', 'deriv'], ['Σ(', 'fn', 'sum'], ['Π(', 'fn', 'prod'],
    ['Ran#', 'const', 'ran'], ['Ans', 'var', 'Ans'], ['π', 'const', 'pi'], ['e', 'const', 'e'],
    ['𝐏', 'nPr'], ['𝐂', 'nCr'], ['ˣ√', 'xroot'], ['⁻¹', 'inv'], ['²', 'sq'], ['³', 'cube'],
    ['ᴇ', 'exp10'], ['!', 'fact'], ['%', 'pct'],
    ['+', '+'], ['−', '-'], ['-', '-'], ['×', '*'], ['*', '*'], ['÷', '/'], ['/', '/'],
    ['^', '^'], ['(', '('], [')', ')'], [',', ','], ['=', '='],
  ].sort((a, b) => b[0].length - a[0].length);

  const ARITY = {
    sin: [1, 1], cos: [1, 1], tan: [1, 1], asin: [1, 1], acos: [1, 1], atan: [1, 1],
    sinh: [1, 1], cosh: [1, 1], tanh: [1, 1], asinh: [1, 1], acosh: [1, 1], atanh: [1, 1],
    log: [1, 2], ln: [1, 1], sqrt: [1, 1], cbrt: [1, 1], abs: [1, 1],
    pol: [2, 2], rec: [2, 2], gcd: [2, 2], lcm: [2, 2], int: [1, 1], intg: [1, 1],
    rnd: [1, 1], ranint: [2, 2], integ: [3, 3], deriv: [2, 2], sum: [3, 3], prod: [3, 3],
  };

  function tokenizeString(src, out) {
    let i = 0;
    while (i < src.length) {
      const ch = src[i];
      if (ch === ' ') { i++; continue; }
      const num = /^(\d+\.?\d*|\.\d+)/.exec(src.slice(i));
      if (num) {
        i += num[0].length;
        if (src[i] === '.') fail(SYNTAX);
        out.push({ t: 'num', v: parseFloat(num[0]) });
        continue;
      }
      let matched = false;
      for (const [text, t, v] of NAMED) {
        if (src.startsWith(text, i)) {
          out.push(v === undefined ? { t } : { t, v });
          if (text.length > 1 && text.endsWith('(')) out.push({ t: '(' });
          i += text.length;
          matched = true;
          break;
        }
      }
      if (matched) continue;
      if (VARS.includes(ch)) {
        out.push({ t: 'var', v: ch });
        i++;
        continue;
      }
      fail(SYNTAX);
    }
    return out;
  }

  // Accepts either a string or an array of editor pieces. Consecutive
  // single-character digit pieces are merged so "1","2" reads as 12 while a
  // multi-character piece such as "10^(" is never glued onto a previous digit.
  function tokenize(input) {
    const out = [];
    if (typeof input === 'string') return tokenizeString(input, out);
    let run = '';
    for (const piece of input) {
      if (/^[0-9.]$/.test(piece)) { run += piece; continue; }
      if (run) { tokenizeString(run, out); run = ''; }
      tokenizeString(piece, out);
    }
    if (run) tokenizeString(run, out);
    return out;
  }

  // ---------------------------------------------------------------------------
  // Parser (recursive descent)
  //   equation  := expr ['=' expr]
  //   expr      := mul (('+'|'-') mul)*
  //   mul       := comb (('*'|'/') comb)*
  //   comb      := implicit (('nPr'|'nCr') implicit)*
  //   implicit  := unary power*            (implicit multiplication binds tighter than × ÷)
  //   unary     := ('-'|'+') unary | power
  //   power     := postfix [('^'|'xroot') unary]
  //   postfix   := primary ('sq'|'cube'|'inv'|'fact'|'pct')*
  // ---------------------------------------------------------------------------

  const PRIMARY_START = new Set(['num', 'exp10', '(', 'fn', 'const', 'var']);

  function parse(input) {
    const tokens = Array.isArray(input) && input.length && typeof input[0] === 'object'
      ? input : tokenize(input);
    if (!tokens.length) fail(SYNTAX);
    let i = 0;
    const peek = () => tokens[i];
    const is = (t) => i < tokens.length && tokens[i].t === t;
    const atEnd = () => i >= tokens.length;

    function closeParen() {
      if (is(')')) { i++; return; }
      if (atEnd()) return; // missing closing parentheses at the end are implied
      fail(SYNTAX);
    }

    function equation() {
      const l = expr();
      if (is('=')) {
        i++;
        return { type: 'eq', l, r: expr() };
      }
      return l;
    }

    function expr() {
      let n = mul();
      while (is('+') || is('-')) {
        const op = tokens[i++].t;
        n = { type: 'bin', op, l: n, r: mul() };
      }
      return n;
    }

    function mul() {
      let n = comb();
      while (is('*') || is('/')) {
        const op = tokens[i++].t;
        n = { type: 'bin', op, l: n, r: comb() };
      }
      return n;
    }

    function comb() {
      let n = implicit();
      while (is('nPr') || is('nCr')) {
        const op = tokens[i++].t;
        n = { type: 'bin', op, l: n, r: implicit() };
      }
      return n;
    }

    function implicit() {
      let n = unary();
      while (!atEnd() && PRIMARY_START.has(peek().t)) {
        n = { type: 'bin', op: '*', l: n, r: power() };
      }
      return n;
    }

    function unary() {
      if (is('-')) { i++; return { type: 'neg', a: unary() }; }
      if (is('+')) { i++; return unary(); }
      return power();
    }

    function power() {
      const base = postfix();
      if (is('^')) { i++; return { type: 'bin', op: '^', l: base, r: unary() }; }
      if (is('xroot')) { i++; return { type: 'bin', op: 'xroot', l: base, r: unary() }; }
      return base;
    }

    function postfix() {
      let n = primary();
      while (is('sq') || is('cube') || is('inv') || is('fact') || is('pct')) {
        n = { type: 'post', op: tokens[i++].t, a: n };
      }
      return n;
    }

    function exponentPart(mantissa) {
      i++; // ᴇ
      let sign = 1;
      if (is('-')) { sign = -1; i++; } else if (is('+')) i++;
      if (!is('num')) fail(SYNTAX);
      const e = tokens[i++].v;
      if (!Number.isInteger(e)) fail(SYNTAX);
      return { type: 'num', v: mantissa * Math.pow(10, sign * e) };
    }

    function primary() {
      if (atEnd()) fail(SYNTAX);
      const tk = tokens[i];
      switch (tk.t) {
        case 'num': {
          i++;
          if (is('exp10')) return exponentPart(tk.v);
          return { type: 'num', v: tk.v };
        }
        case 'exp10':
          return exponentPart(1);
        case '(': {
          i++;
          const e = expr();
          closeParen();
          return e;
        }
        case 'fn': {
          i++;
          if (!is('(')) fail(SYNTAX);
          i++;
          const args = [expr()];
          while (is(',')) { i++; args.push(expr()); }
          closeParen();
          const [min, max] = ARITY[tk.v];
          if (args.length < min || args.length > max) fail(SYNTAX);
          return { type: 'fn', f: tk.v, args };
        }
        case 'const':
          i++;
          return { type: 'const', v: tk.v };
        case 'var':
          i++;
          return { type: 'var', v: tk.v };
        default:
          fail(SYNTAX);
      }
    }

    const tree = equation();
    if (!atEnd()) fail(SYNTAX);
    return tree;
  }

  // ---------------------------------------------------------------------------
  // Numeric helpers
  // ---------------------------------------------------------------------------

  function check(x) {
    if (typeof x !== 'number' || !Number.isFinite(x) || Math.abs(x) >= LIMIT) fail(MATH);
    return x;
  }

  // Best rational approximation using continued fractions.
  function toFraction(x, maxDen = 10000, tol = 1e-12) {
    if (!Number.isFinite(x)) return null;
    const sign = x < 0 ? -1 : 1;
    const ax = Math.abs(x);
    let h0 = 0, h1 = 1, k0 = 1, k1 = 0, b = ax;
    for (let n = 0; n < 40; n++) {
      const a = Math.floor(b);
      const h2 = a * h1 + h0;
      const k2 = a * k1 + k0;
      if (k2 > maxDen) break;
      h0 = h1; h1 = h2; k0 = k1; k1 = k2;
      if (Math.abs(ax - h1 / k1) <= tol * Math.max(1, ax)) {
        return { num: sign * h1, den: k1 };
      }
      const frac = b - a;
      if (frac < 1e-15) break;
      b = 1 / frac;
    }
    return null;
  }

  function gcdInt(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) [a, b] = [b, a % b];
    return a;
  }

  function isInt(x) {
    return Number.isInteger(x) || Math.abs(x - Math.round(x)) < 1e-10 * Math.max(1, Math.abs(x));
  }

  function requireInt(x) {
    if (!isInt(x)) fail(MATH);
    return Math.round(x);
  }

  function factorial(n) {
    n = requireInt(n);
    if (n < 0 || n > 69) fail(MATH);
    let r = 1;
    for (let k = 2; k <= n; k++) r *= k;
    return r;
  }

  function nPr(n, r) {
    n = requireInt(n); r = requireInt(r);
    if (n < 0 || r < 0 || r > n || n >= 1e10) fail(MATH);
    let p = 1;
    for (let k = 0; k < r; k++) { p *= n - k; check(p); }
    return p;
  }

  function nCr(n, r) {
    n = requireInt(n); r = requireInt(r);
    if (n < 0 || r < 0 || r > n || n >= 1e10) fail(MATH);
    r = Math.min(r, n - r);
    let c = 1;
    for (let k = 1; k <= r; k++) { c = (c * (n - r + k)) / k; check(c); }
    return Math.round(c);
  }

  function pow(x, y) {
    if (x === 0 && y <= 0) fail(MATH);
    let r = Math.pow(x, y);
    if (Number.isNaN(r) && x < 0) {
      // Negative base with a rational exponent of odd denominator, e.g. (−8)^(1/3).
      const f = toFraction(y, 1000);
      if (!f || f.den % 2 === 0) fail(MATH);
      r = Math.pow(-x, y) * (f.num % 2 === 0 ? 1 : -1);
    }
    return check(r);
  }

  function addSub(a, b, op) {
    const r = op === '+' ? a + b : a - b;
    // Suppress binary floating-point residue such as 1 − 0.9 − 0.1.
    if (r !== 0 && Math.abs(r) < 1e-14 * Math.max(Math.abs(a), Math.abs(b))) return 0;
    return r;
  }

  const ANGLE_FULL = { deg: 360, rad: 2 * Math.PI, gra: 400 };
  const toRad = (x, unit) => (unit === 'rad' ? x : (x * 2 * Math.PI) / ANGLE_FULL[unit]);
  const fromRad = (x, unit) => (unit === 'rad' ? x : (x * ANGLE_FULL[unit]) / (2 * Math.PI));
  const clean = (x) => (Math.abs(x) < 1e-15 ? 0 : x);

  function trig(f, x, unit) {
    // Exact results at multiples of a quarter turn in degree/grad mode.
    if (unit !== 'rad') {
      const quarter = ANGLE_FULL[unit] / 4;
      const q = x / quarter;
      if (Number.isInteger(q)) {
        const k = ((q % 4) + 4) % 4;
        if (f === 'sin') return [0, 1, 0, -1][k];
        if (f === 'cos') return [1, 0, -1, 0][k];
        if (k % 2 === 1) fail(MATH);
        return 0;
      }
    }
    if (Math.abs(x) > 1e10) fail(MATH);
    const r = toRad(x, unit);
    if (f === 'sin') return clean(Math.sin(r));
    if (f === 'cos') return clean(Math.cos(r));
    if (Math.abs(Math.cos(r)) < 1e-15) fail(MATH);
    return clean(Math.tan(r));
  }

  // ---------------------------------------------------------------------------
  // Calculus
  // ---------------------------------------------------------------------------

  const GK_X = [
    0.991455371120812639206854697526329, 0.949107912342758524526189684047851,
    0.864864423359769072789712788640926, 0.741531185599394439863864773280788,
    0.586087235467691130294144845693013, 0.405845151377397166906606412076961,
    0.207784955007898467600689403773245, 0,
  ];
  const GK_WK = [
    0.022935322010529224963732008058970, 0.063092092629978553290700663189204,
    0.104790010322250183839876322541518, 0.140653259715525918745189590510238,
    0.169004726639267902826583426598550, 0.190350578064785409913256402421014,
    0.204432940075298892414161999234649, 0.209482141084727828012999174891714,
  ];
  const GK_WG = [
    0.129484966168869693270611432679082, 0.279705391489276667901467771423780,
    0.381830050505118944950369775488975, 0.417959183673469387755102040816327,
  ];

  function gk15(f, a, b) {
    const c = (a + b) / 2, h = (b - a) / 2;
    const fc = f(c);
    let k = fc * GK_WK[7], g = fc * GK_WG[3];
    for (let j = 0; j < 7; j++) {
      const dx = h * GK_X[j];
      const s = f(c - dx) + f(c + dx);
      k += GK_WK[j] * s;
      if (j % 2 === 1) g += GK_WG[(j - 1) / 2] * s;
    }
    return { value: k * h, err: Math.abs((k - g) * h) };
  }

  function integrate(f, a, b) {
    if (a === b) return 0;
    let total = 0;
    const stack = [[a, b, 0]];
    let evals = 0;
    while (stack.length) {
      const [lo, hi, depth] = stack.pop();
      const { value, err } = gk15(f, lo, hi);
      evals++;
      const tol = Math.max(1e-11, 1e-11 * Math.abs(value));
      if (err <= tol || depth > 40 || evals > 4000) {
        total += value;
      } else {
        const mid = (lo + hi) / 2;
        stack.push([lo, mid, depth + 1], [mid, hi, depth + 1]);
      }
    }
    return check(total);
  }

  function differentiate(f, x) {
    // Ridders' extrapolation of central differences.
    let h = 0.1 * Math.max(1, Math.abs(x));
    const n = 10;
    const tab = [];
    let best = NaN, bestErr = Infinity;
    tab[0] = [(f(x + h) - f(x - h)) / (2 * h)];
    for (let i = 1; i < n; i++) {
      h /= 1.4;
      tab[i] = [(f(x + h) - f(x - h)) / (2 * h)];
      let fac = 1.96;
      for (let j = 1; j <= i; j++) {
        tab[i][j] = (tab[i][j - 1] * fac - tab[i - 1][j - 1]) / (fac - 1);
        fac *= 1.96;
        const e = Math.max(Math.abs(tab[i][j] - tab[i][j - 1]), Math.abs(tab[i][j] - tab[i - 1][j - 1]));
        if (e <= bestErr) { bestErr = e; best = tab[i][j]; }
      }
      if (Math.abs(tab[i][i] - tab[i - 1][i - 1]) >= 2 * bestErr) break;
    }
    if (!Number.isFinite(best)) fail(MATH);
    return clean(best);
  }

  // ---------------------------------------------------------------------------
  // Evaluator
  // ---------------------------------------------------------------------------

  function makeContext(opts = {}) {
    return {
      vars: opts.vars || {},
      ans: opts.ans || 0,
      angle: opts.angle || 'deg',
      random: opts.random || Math.random,
      round: opts.round || ((x) => x),
      multi: null, // set by Pol / Rec
    };
  }

  function evaluate(node, ctx) {
    return evalNode(node, ctx);
  }

  function withX(node, ctx, name = 'X') {
    return (x) => {
      const saved = ctx.vars[name];
      ctx.vars[name] = x;
      try {
        return evalNode(node, ctx);
      } finally {
        ctx.vars[name] = saved;
      }
    };
  }

  function evalNode(n, ctx) {
    switch (n.type) {
      case 'num':
        return check(n.v);
      case 'const':
        if (n.v === 'pi') return Math.PI;
        if (n.v === 'e') return Math.E;
        return Math.round(ctx.random() * 1000) / 1000;
      case 'var':
        if (n.v === 'Ans') return ctx.ans;
        return ctx.vars[n.v] || 0;
      case 'neg':
        return -evalNode(n.a, ctx);
      case 'eq':
        return addSub(evalNode(n.l, ctx), evalNode(n.r, ctx), '-');
      case 'post': {
        const a = evalNode(n.a, ctx);
        switch (n.op) {
          case 'sq': return check(a * a);
          case 'cube': return check(a * a * a);
          case 'inv': if (a === 0) fail(MATH); return check(1 / a);
          case 'fact': return factorial(a);
          case 'pct': return a / 100;
        }
        break;
      }
      case 'bin': {
        const a = evalNode(n.l, ctx);
        const b = evalNode(n.r, ctx);
        switch (n.op) {
          case '+': case '-': return check(addSub(a, b, n.op));
          case '*': return check(a * b);
          case '/': if (b === 0) fail(MATH); return check(a / b);
          case '^': return pow(a, b);
          case 'xroot': if (a === 0) fail(MATH); return pow(b, 1 / a);
          case 'nPr': return nPr(a, b);
          case 'nCr': return nCr(a, b);
        }
        break;
      }
      case 'fn':
        return check(evalFn(n, ctx));
    }
    fail(SYNTAX);
  }

  function evalFn(n, ctx) {
    const { f, args } = n;
    if (f === 'integ' || f === 'deriv' || f === 'sum' || f === 'prod') {
      const g = withX(args[0], ctx);
      const a = evalNode(args[1], ctx);
      if (f === 'deriv') return differentiate(g, a);
      const b = evalNode(args[2], ctx);
      if (f === 'integ') return integrate(g, a, b);
      const lo = requireInt(a), hi = requireInt(b);
      if (hi < lo || hi - lo > 1e6) fail(MATH);
      let acc = f === 'sum' ? 0 : 1;
      for (let k = lo; k <= hi; k++) {
        acc = f === 'sum' ? acc + g(k) : acc * g(k);
        check(acc);
      }
      return acc;
    }

    const v = args.map((a) => evalNode(a, ctx));
    const x = v[0];
    const unit = ctx.angle;
    switch (f) {
      case 'sin': case 'cos': case 'tan': return trig(f, x, unit);
      case 'asin': if (x < -1 || x > 1) fail(MATH); return fromRad(Math.asin(x), unit);
      case 'acos': if (x < -1 || x > 1) fail(MATH); return fromRad(Math.acos(x), unit);
      case 'atan': return fromRad(Math.atan(x), unit);
      case 'sinh': return Math.sinh(x);
      case 'cosh': return Math.cosh(x);
      case 'tanh': return Math.tanh(x);
      case 'asinh': return Math.asinh(x);
      case 'acosh': if (x < 1) fail(MATH); return Math.acosh(x);
      case 'atanh': if (x <= -1 || x >= 1) fail(MATH); return Math.atanh(x);
      case 'log':
        if (v.length === 2) {
          if (v[0] <= 0 || v[0] === 1 || v[1] <= 0) fail(MATH);
          const r = Math.log(v[1]) / Math.log(v[0]);
          return isInt(r) && Math.abs(r) < 1e15 ? Math.round(r) : r;
        }
        if (x <= 0) fail(MATH);
        return Math.log10(x);
      case 'ln': if (x <= 0) fail(MATH); return Math.log(x);
      case 'sqrt': if (x < 0) fail(MATH); return Math.sqrt(x);
      case 'cbrt': return Math.cbrt(x);
      case 'abs': return Math.abs(x);
      case 'int': return Math.trunc(x);
      case 'intg': return Math.floor(x);
      case 'rnd': return ctx.round(x);
      case 'gcd': case 'lcm': {
        const a = requireInt(v[0]), b = requireInt(v[1]);
        const g = gcdInt(a, b);
        if (f === 'gcd') return g;
        if (g === 0) return 0;
        return Math.abs((a / g) * b);
      }
      case 'ranint': {
        const a = requireInt(v[0]), b = requireInt(v[1]);
        if (a > b) fail(MATH);
        return a + Math.floor(ctx.random() * (b - a + 1));
      }
      case 'pol': {
        const r = Math.hypot(v[0], v[1]);
        if (r === 0) fail(MATH);
        const th = fromRad(Math.atan2(v[1], v[0]), unit);
        ctx.multi = [['r', r], ['θ', th]];
        ctx.vars.X = r; ctx.vars.Y = th;
        return r;
      }
      case 'rec': {
        const px = clean(v[0] * trig('cos', v[1], unit));
        const py = clean(v[0] * trig('sin', v[1], unit));
        ctx.multi = [['x', px], ['y', py]];
        ctx.vars.X = px; ctx.vars.Y = py;
        return px;
      }
    }
    fail(SYNTAX);
  }

  // Convenience: evaluate an input (string or pieces) in one call.
  function calc(input, opts) {
    const ctx = makeContext(opts);
    const tree = parse(input);
    const value = evalNode(tree, ctx);
    return { value, multi: ctx.multi, tree };
  }

  // ---------------------------------------------------------------------------
  // SOLVE: find X so that the expression (or L − R of an equation) is zero.
  // ---------------------------------------------------------------------------

  function solveFor(tree, opts, guess = 0, name = 'X') {
    const ctx = makeContext(opts);
    const g = withX(tree, ctx, name);
    const f = (x) => {
      try {
        const y = g(x);
        return Number.isFinite(y) ? y : NaN;
      } catch (e) {
        return NaN;
      }
    };
    const accept = (x) => {
      const y = f(x);
      return Number.isFinite(y) ? { x: clean(x), lr: clean(y) } : null;
    };

    // Newton's method with a numeric derivative.
    let x = guess;
    for (let k = 0; k < 150; k++) {
      const y = f(x);
      if (!Number.isFinite(y)) break;
      if (y === 0) return accept(x);
      const h = 1e-6 * Math.max(1, Math.abs(x));
      const d = (f(x + h) - f(x - h)) / (2 * h);
      if (!Number.isFinite(d) || d === 0) break;
      const step = y / d;
      x -= step;
      if (Math.abs(step) <= 1e-14 * Math.max(1, Math.abs(x))) {
        const yy = f(x);
        if (Number.isFinite(yy) && Math.abs(yy) < 1e-9 * Math.max(1, Math.abs(y) + 1)) return accept(x);
        break;
      }
    }

    // Fall back to scanning outward from the guess for a sign change, then bisect.
    for (let s = 1e-3; s < 1e12; s *= 1.6) {
      for (const cand of [guess + s, guess - s]) {
        const y = f(cand);
        if (!Number.isFinite(y)) continue;
        if (y === 0) return accept(cand);
        const ref = cand > guess ? f(guess + s / 1.6) : f(guess - s / 1.6);
        const refX = cand > guess ? guess + s / 1.6 : guess - s / 1.6;
        if (Number.isFinite(ref) && Math.sign(ref) !== Math.sign(y)) {
          let lo = refX, hi = cand, flo = ref;
          for (let k = 0; k < 200; k++) {
            const mid = (lo + hi) / 2;
            const fm = f(mid);
            if (!Number.isFinite(fm)) break;
            if (Math.sign(fm) === Math.sign(flo)) { lo = mid; flo = fm; } else hi = mid;
            if (Math.abs(hi - lo) <= 1e-15 * Math.max(1, Math.abs(mid))) break;
          }
          const root = (lo + hi) / 2;
          // Reject pole crossings (e.g. 1/X) where |f| blows up.
          if (Math.abs(f(root)) < 1e-6 * Math.max(1, Math.abs(y), Math.abs(ref))) return accept(root);
        }
      }
    }
    fail(SOLVE);
  }

  // ---------------------------------------------------------------------------
  // Formatting
  // ---------------------------------------------------------------------------

  const SUP = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  const sup = (n) => String(n).split('').map((c) => SUP[c] || c).join('');
  const MINUS = '−';
  const withMinus = (s) => s.replace(/^-/, MINUS);

  function trimZeros(s) {
    if (s.indexOf('.') < 0) return s;
    return s.replace(/0+$/, '').replace(/\.$/, '');
  }

  function sciParts(x, digits) {
    // Returns mantissa string and exponent for `digits` significant digits.
    const s = x.toExponential(digits - 1);
    const [m, e] = s.split('e');
    return { m, e: parseInt(e, 10) };
  }

  function sciString(x, digits, trim) {
    const { m, e } = sciParts(x, digits);
    return withMinus(trim ? trimZeros(m) : m) + '×10' + sup(e);
  }

  // fmt: { mode: 'norm1' | 'norm2' | 'fix' | 'sci', digits }
  function formatNumber(x, fmt = { mode: 'norm1' }) {
    if (!Number.isFinite(x)) return MATH;
    if (Object.is(x, -0)) x = 0;
    if (fmt.mode === 'fix') {
      const n = fmt.digits ?? 0;
      if (Math.abs(x) >= 1e10) return sciString(x, 10, true);
      let s = x.toFixed(n);
      if (/^-0\.?0*$/.test(s)) s = s.slice(1);
      return withMinus(s);
    }
    if (fmt.mode === 'sci') {
      const n = fmt.digits || 10;
      if (x === 0) return sciString(0, n, false);
      return sciString(x, n, false);
    }
    if (x === 0) return '0';
    const small = fmt.mode === 'norm2' ? 1e-9 : 1e-2;
    const r = parseFloat(x.toPrecision(10));
    const ar = Math.abs(r);
    if (ar >= 1e10 || ar < small) return sciString(r, 10, true);
    let s = r.toPrecision(10);
    if (s.includes('e')) s = String(r);
    return withMinus(trimZeros(s));
  }

  // Engineering notation. `shift` moves the exponent down in steps of 3.
  function formatEng(x, shift = 0) {
    if (!Number.isFinite(x)) return MATH;
    if (x === 0) return '0';
    const r = parseFloat(x.toPrecision(10));
    const e = Math.floor(Math.log10(Math.abs(r)) / 3) * 3 - 3 * shift;
    const m = parseFloat((r / Math.pow(10, e)).toPrecision(10));
    let ms = String(m);
    if (ms.includes('e')) ms = m.toFixed(0);
    return withMinus(ms) + '×10' + sup(e);
  }

  // ---------------------------------------------------------------------------
  // Exact forms: integers, fractions, multiples of π and simple surds.
  // Returns a descriptor: { sign, num, den, root, pi } meaning
  //   sign · num · √root · π^pi / den
  // ---------------------------------------------------------------------------

  const SQUAREFREE = [];
  for (let r = 2; r <= 200; r++) {
    let ok = true;
    for (let p = 2; p * p <= r; p++) if (r % (p * p) === 0) { ok = false; break; }
    if (ok) SQUAREFREE.push(r);
  }

  function exactForm(x) {
    if (!Number.isFinite(x) || Math.abs(x) >= 1e10) return null;
    if (x === 0) return { sign: 1, num: 0, den: 1, root: 1, pi: 0 };
    const sign = x < 0 ? -1 : 1;
    const ax = Math.abs(x);
    const f = toFraction(ax, 10000, 1e-12);
    if (f && f.num < 1e10 && f.den * f.num < 1e13) return { sign, num: f.num, den: f.den, root: 1, pi: 0 };
    for (const r of SQUAREFREE) {
      const g = toFraction(ax / Math.sqrt(r), 100, 1e-12);
      if (g && g.num <= 1000) return { sign, num: g.num, den: g.den, root: r, pi: 0 };
    }
    const p = toFraction(ax / Math.PI, 100, 1e-12);
    if (p && p.num <= 1000) return { sign, num: p.num, den: p.den, root: 1, pi: 1 };
    return null;
  }

  // Plain-text rendering of an exact form (used for history and tests).
  function exactText(ef) {
    if (!ef) return null;
    let n = '';
    const coeff = ef.num === 1 && (ef.root > 1 || ef.pi) ? '' : String(ef.num);
    n = coeff + (ef.root > 1 ? '√' + ef.root : '') + (ef.pi ? 'π' : '');
    const s = ef.sign < 0 ? MINUS : '';
    return ef.den === 1 ? s + n : s + n + '/' + ef.den;
  }

  // ---------------------------------------------------------------------------
  // Equations
  // ---------------------------------------------------------------------------

  // Solves A·x = b. Returns { status: 'unique', x } or 'none' / 'infinite'.
  function solveLinear(A, b) {
    const n = A.length;
    const M = A.map((row, i) => [...row, b[i]]);
    const scale = Math.max(1, ...M.flat().map(Math.abs));
    let rank = 0;
    const pivCols = [];
    for (let c = 0; c < n && rank < n; c++) {
      let p = rank;
      for (let r = rank + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-12 * scale) continue;
      [M[rank], M[p]] = [M[p], M[rank]];
      for (let r = 0; r < n; r++) {
        if (r === rank) continue;
        const k = M[r][c] / M[rank][c];
        for (let j = c; j <= n; j++) M[r][j] -= k * M[rank][j];
      }
      pivCols.push(c);
      rank++;
    }
    if (rank < n) {
      for (let r = rank; r < n; r++) if (Math.abs(M[r][n]) > 1e-10 * scale) return { status: 'none' };
      return { status: 'infinite' };
    }
    const x = new Array(n);
    for (let r = 0; r < n; r++) x[pivCols[r]] = clean(M[r][n] / M[r][pivCols[r]]);
    return { status: 'unique', x };
  }

  // Complex helpers for polynomial roots.
  const cx = (re, im = 0) => ({ re, im });
  const cadd = (a, b) => cx(a.re + b.re, a.im + b.im);
  const csub = (a, b) => cx(a.re - b.re, a.im - b.im);
  const cmul = (a, b) => cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
  const cdiv = (a, b) => {
    const d = b.re * b.re + b.im * b.im;
    return cx((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
  };
  const cabs = (a) => Math.hypot(a.re, a.im);

  function polyEval(coeffs, z) {
    let r = cx(0);
    for (const c of coeffs) r = cadd(cmul(r, z), cx(c));
    return r;
  }

  // Roots of a polynomial given highest-degree coefficient first.
  function polyRoots(coeffs) {
    if (!coeffs.length || coeffs[0] === 0) fail(MATH);
    const a0 = coeffs[0];
    const c = coeffs.map((v) => v / a0);
    const n = c.length - 1;
    if (n === 1) return [cx(clean(-c[1]))];
    if (n === 2) return quadRoots(coeffs[0], coeffs[1], coeffs[2]);
    let z = [];
    for (let k = 0; k < n; k++) z.push(cmul(cx(1), powc(cx(0.4, 0.9), k)));
    for (let it = 0; it < 2000; it++) {
      let delta = 0;
      for (let i = 0; i < n; i++) {
        let den = cx(1);
        for (let j = 0; j < n; j++) if (j !== i) den = cmul(den, csub(z[i], z[j]));
        const step = cdiv(polyEval(c, z[i]), den);
        z[i] = csub(z[i], step);
        delta = Math.max(delta, cabs(step));
      }
      if (delta < 1e-16) break;
    }
    // Newton polish on the original polynomial.
    const dc = c.slice(0, -1).map((v, i) => v * (n - i));
    z = z.map((r) => {
      for (let k = 0; k < 5; k++) {
        const d = polyEval(dc, r);
        if (cabs(d) === 0) break;
        const s = cdiv(polyEval(c, r), d);
        if (!Number.isFinite(s.re) || !Number.isFinite(s.im)) break;
        r = csub(r, s);
      }
      return r;
    });
    return sortRoots(z.map(tidyComplex));
  }

  function powc(z, k) {
    let r = cx(1);
    for (let i = 0; i < k; i++) r = cmul(r, z);
    return r;
  }

  function tidyComplex(z) {
    const m = Math.max(1, cabs(z));
    let re = Math.abs(z.re) < 1e-11 * m ? 0 : z.re;
    let im = Math.abs(z.im) < 1e-9 * m ? 0 : z.im;
    // Snap values that are within rounding noise of a short decimal.
    const snap = (v) => {
      const r = parseFloat(v.toPrecision(12));
      return Math.abs(r - v) < 1e-12 * Math.max(1, Math.abs(v)) ? r : v;
    };
    return cx(snap(re), snap(im));
  }

  function sortRoots(z) {
    return z.sort((a, b) => {
      const ar = a.im === 0, br = b.im === 0;
      if (ar !== br) return ar ? -1 : 1;
      if (a.re !== b.re) return b.re - a.re;
      return b.im - a.im;
    });
  }

  function quadRoots(a, b, c) {
    const D = b * b - 4 * a * c;
    const scale = Math.max(b * b, Math.abs(4 * a * c));
    if (Math.abs(D) <= 1e-14 * scale) return [cx(clean(-b / (2 * a))), cx(clean(-b / (2 * a)))];
    if (D > 0) {
      // Numerically stable form avoiding cancellation.
      const q = -0.5 * (b + Math.sign(b || 1) * Math.sqrt(D));
      const r1 = q / a, r2 = c / q;
      return sortRoots([cx(clean(r1)), cx(clean(r2))].map(tidyComplex));
    }
    const re = clean(-b / (2 * a)), im = Math.sqrt(-D) / (2 * Math.abs(a));
    return [tidyComplex(cx(re, im)), tidyComplex(cx(re, -im))];
  }

  // Exact quadratic roots when coefficients are rational.
  // Each root is { p, q, m, d, imag } meaning (p ± q·√m [i]) / d; q is signed per root.
  function quadExact(a, b, c) {
    const fr = [a, b, c].map((v) => toFraction(v, 10000, 1e-12));
    if (fr.some((f) => !f)) return null;
    let L = 1;
    for (const f of fr) L = (L * f.den) / gcdInt(L, f.den);
    const [A, B, C] = fr.map((f) => (f.num * L) / f.den);
    if (![A, B, C].every(Number.isSafeInteger)) return null;
    const D = B * B - 4 * A * C;
    if (!Number.isSafeInteger(D)) return null;
    const imag = D < 0;
    let rad = Math.abs(D), k = 1;
    for (let p = 2; p * p <= rad; p++) {
      while (rad % (p * p) === 0) { rad /= p * p; k *= p; }
    }
    const roots = [];
    for (const s of [1, -1]) {
      let p = -B, q = s * k, d = 2 * A;
      if (rad === 0) q = 0;
      if (rad === 1 && !imag) { p = p + q; q = 0; }
      let g = gcdInt(gcdInt(p, q), d);
      if (g === 0) g = 1;
      p /= g; q /= g; d /= g;
      if (d < 0) { p = -p; q = -q; d = -d; }
      roots.push({ p, q, m: q === 0 ? 1 : rad, d, imag: imag && q !== 0 });
    }
    // Order real roots descending (x1 > x2) to match the numeric ordering.
    if (!imag) {
      const val = (r) => (r.p + r.q * Math.sqrt(r.m)) / r.d;
      roots.sort((u, v) => val(v) - val(u));
    }
    return roots;
  }

  // ---------------------------------------------------------------------------
  // Statistics
  // ---------------------------------------------------------------------------

  function median(sorted) {
    const n = sorted.length;
    if (!n) return NaN;
    const h = Math.floor(n / 2);
    return n % 2 ? sorted[h] : (sorted[h - 1] + sorted[h]) / 2;
  }

  function stats1(xs) {
    const n = xs.length;
    if (!n) fail(MATH);
    const sx = xs.reduce((s, v) => s + v, 0);
    const sx2 = xs.reduce((s, v) => s + v * v, 0);
    const mean = sx / n;
    const ss = xs.reduce((s, v) => s + (v - mean) ** 2, 0);
    const sorted = [...xs].sort((a, b) => a - b);
    const h = Math.floor(n / 2);
    return {
      n, mean, sum: sx, sum2: sx2,
      popSD: Math.sqrt(ss / n),
      sampleSD: n > 1 ? Math.sqrt(ss / (n - 1)) : NaN,
      min: sorted[0], max: sorted[n - 1],
      median: median(sorted),
      q1: n > 1 ? median(sorted.slice(0, h)) : sorted[0],
      q3: n > 1 ? median(sorted.slice(n % 2 ? h + 1 : h)) : sorted[0],
    };
  }

  function stats2(xs, ys) {
    const n = xs.length;
    if (!n || ys.length !== n) fail(MATH);
    const X = stats1(xs), Y = stats1(ys);
    const sxy = xs.reduce((s, v, i) => s + v * ys[i], 0);
    const Sxx = xs.reduce((s, v) => s + (v - X.mean) ** 2, 0);
    const Syy = ys.reduce((s, v) => s + (v - Y.mean) ** 2, 0);
    const Sxy = xs.reduce((s, v, i) => s + (v - X.mean) * (ys[i] - Y.mean), 0);
    const b = Sxx === 0 ? NaN : Sxy / Sxx;
    const a = Y.mean - b * X.mean;
    const r = Sxx === 0 || Syy === 0 ? NaN : Sxy / Math.sqrt(Sxx * Syy);
    return { n, x: X, y: Y, sumXY: sxy, a, b, r };
  }

  // ---------------------------------------------------------------------------
  // Base-N (32-bit two's complement integers)
  //   or  <  xor, xnor  <  and  <  + −  <  × ÷  <  Not( Neg( / unary
  // ---------------------------------------------------------------------------

  const BASES = { DEC: 10, HEX: 16, BIN: 2, OCT: 8 };
  const INT_MIN = -2147483648, INT_MAX = 2147483647;

  function baseTokenize(src, radix) {
    const out = [];
    let i = 0;
    const words = [['Not(', 'not'], ['Neg(', 'neg'], ['xnor', 'xnor'], ['and', 'and'], ['xor', 'xor'], ['or', 'or']];
    while (i < src.length) {
      const ch = src[i];
      if (ch === ' ') { i++; continue; }
      const w = words.find(([t]) => src.startsWith(t, i));
      if (w) {
        out.push({ t: w[1] });
        if (w[0].endsWith('(')) out.push({ t: '(' });
        i += w[0].length;
        continue;
      }
      const m = /^[0-9A-F]+/.exec(src.slice(i));
      if (m) {
        const digits = m[0];
        for (const d of digits) if (parseInt(d, 16) >= radix) fail(SYNTAX);
        let v = parseInt(digits, radix);
        if (radix === 10) {
          if (v > INT_MAX + 1) fail(MATH);
        } else {
          if (v > 0xffffffff) fail(MATH);
          v = v | 0;
        }
        out.push({ t: 'num', v });
        i += digits.length;
        continue;
      }
      const map = { '+': '+', '−': '-', '-': '-', '×': '*', '*': '*', '÷': '/', '/': '/', '(': '(', ')': ')' };
      if (map[ch]) { out.push({ t: map[ch] }); i++; continue; }
      fail(SYNTAX);
    }
    return out;
  }

  function baseEval(input, radix) {
    const src = Array.isArray(input) ? input.join('') : input;
    const tk = baseTokenize(src, radix);
    if (!tk.length) fail(SYNTAX);
    let i = 0;
    const is = (t) => i < tk.length && tk[i].t === t;
    const fit = (v) => {
      if (!Number.isFinite(v) || v < INT_MIN || v > INT_MAX) {
        if (radix === 10) fail(MATH);
        // Other bases wrap around like a 32-bit register.
        return Number(BigInt.asIntN(32, BigInt(Math.trunc(v))));
      }
      return v;
    };
    const binary = (next, ops, fn) => () => {
      let v = next();
      while (ops.some(is)) {
        const op = tk[i++].t;
        v = fit(fn(op, v, next()));
      }
      return v;
    };
    function unary() {
      if (is('-')) { i++; return fit(-unary()); }
      if (is('+')) { i++; return unary(); }
      if (is('not') || is('neg')) {
        const op = tk[i++].t;
        i++; // (
        const v = orExpr();
        if (is(')')) i++; else if (i < tk.length) fail(SYNTAX);
        return op === 'not' ? ~v : fit(-v);
      }
      if (is('(')) {
        i++;
        const v = orExpr();
        if (is(')')) i++; else if (i < tk.length) fail(SYNTAX);
        return v;
      }
      if (is('num')) return tk[i++].v;
      fail(SYNTAX);
    }
    const mulExpr = binary(unary, ['*', '/'], (op, a, b) => {
      if (op === '*') return a * b;
      if (b === 0) fail(MATH);
      return Math.trunc(a / b);
    });
    const addExpr = binary(mulExpr, ['+', '-'], (op, a, b) => (op === '+' ? a + b : a - b));
    const andExpr = binary(addExpr, ['and'], (op, a, b) => a & b);
    const xorExpr = binary(andExpr, ['xor', 'xnor'], (op, a, b) => (op === 'xor' ? a ^ b : ~(a ^ b)));
    const orExpr = binary(xorExpr, ['or'], (op, a, b) => a | b);
    const v = orExpr();
    if (i < tk.length) fail(SYNTAX);
    return v | 0;
  }

  function baseFormat(v, radix) {
    if (radix === 10) return withMinus(String(v));
    const u = v >>> 0;
    const s = u.toString(radix).toUpperCase();
    if (radix === 2) return s.padStart(32, '0').replace(/(.{4})(?=.)/g, '$1 ');
    return s;
  }

  return {
    CalcError, SYNTAX, MATH, ARG, SOLVE, VARS,
    tokenize, parse, evaluate, makeContext, calc, solveFor,
    formatNumber, formatEng, exactForm, exactText, toFraction,
    solveLinear, polyRoots, quadExact, stats1, stats2,
    baseEval, baseFormat, BASES,
    integrate, differentiate,
  };
});
