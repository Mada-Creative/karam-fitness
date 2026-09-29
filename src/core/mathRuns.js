// Turns numbers into display "runs": arrays of parts the UI renders.
//   string                    plain text
//   { t: 'frac', n, d }       stacked fraction (n and d are runs)
//   { t: 'sqrt', r }          square root with an overline (r is a run)
//   { t: 'sup', s }           superscript text (exponents)
//   { t: 'i' }                imaginary unit
//   { t: 'err', s }           error marker
const E = require('./engine');

const frac = (n, d) => ({ t: 'frac', n, d });
const sqrt = (r) => ({ t: 'sqrt', r: [String(r)] });
const I = { t: 'i' };

// "1.2×10⁻³" → ['1.2', '×10', { t: 'sup', s: '−3' }]
const SUP_MAP = { '⁻': '−', '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };
function sciRun(s) {
  const m = /^(.*)×10([⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/.exec(s);
  if (!m) return [s];
  return [m[1], '×10', { t: 'sup', s: m[2].split('').map((c) => SUP_MAP[c]).join('') }];
}

function exactRun(ef) {
  const coeff = ef.num === 1 && (ef.root > 1 || ef.pi) ? [] : [String(ef.num)];
  const top = [...coeff, ...(ef.root > 1 ? [sqrt(ef.root)] : []), ...(ef.pi ? ['π'] : [])];
  const sign = ef.sign < 0 ? ['−'] : [];
  return ef.den === 1 ? [...sign, ...top] : [...sign, frac(top, [String(ef.den)])];
}

// fmt: { mode, digits }; exact: prefer fraction / surd / π forms.
function numRun(x, fmt, exact) {
  if (exact) {
    const ef = E.exactForm(x);
    if (ef && (ef.den !== 1 || ef.root > 1 || ef.pi)) return exactRun(ef);
  }
  return sciRun(E.formatNumber(x, fmt));
}

function complexRun(z, fmt, exact) {
  if (z.im === 0) return numRun(z.re, fmt, exact);
  const re = z.re === 0 ? [] : numRun(z.re, fmt, exact);
  let sign = [];
  if (z.im < 0) sign = [re.length ? ' − ' : '−'];
  else if (re.length) sign = [' + '];
  const mag = Math.abs(z.im);
  const im = mag === 1 ? [] : numRun(mag, fmt, exact);
  return [...re, ...sign, ...im, I];
}

// (p ± q√m [i]) / d from Engine.quadExact
function surdSumRun(r) {
  if (r.q === 0) {
    const neg = r.p < 0 ? ['−'] : [];
    const v = String(Math.abs(r.p));
    return r.d === 1 ? [...neg, v] : [...neg, frac([v], [String(r.d)])];
  }
  const qa = Math.abs(r.q);
  let rad = [...(qa === 1 ? [] : [String(qa)]), ...(r.m > 1 ? [sqrt(r.m)] : []), ...(r.imag ? [I] : [])];
  if (!rad.length) rad = ['1'];
  let top;
  if (r.p === 0) top = [...(r.q < 0 ? ['−'] : []), ...rad];
  else top = [`${r.p < 0 ? '−' : ''}${Math.abs(r.p)} ${r.q < 0 ? '−' : '+'} `, ...rad];
  return r.d === 1 ? top : [frac(top, [String(r.d)])];
}

module.exports = { numRun, sciRun, complexRun, surdSumRun, exactRun };
