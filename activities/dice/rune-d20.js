/* A standalone WebGL2 d20 custom element, made for Tabletop Retro (MIT,
 * see LICENSE) and kept as a single bundle (eslint ignores it). Importing
 * it defines <rune-d20>; see d20.tsx beside it. Changes marked "TTR patch"
 * let every screen land the same roll: roll(forced) takes the face, and
 * "roll-start" carries it (detail.value). */
/* <rune-d20> — dependency-free WebGL2 rune d20 (no three.js).
 * Attributes: dice-style="rune|scifi|steampunk|nature"  glow="#7fe6ff"  hide-ui
 * API: el.roll() → Promise<number>; el.value; events "roll-start" (detail.value, TTR patch), "roll" (detail.value)
 * Size it with CSS (default 100% × 420px). Theme: --d20-ink, --d20-muted, --d20-line, --d20-btn
 */
(() => {
const PHI = (1 + Math.sqrt(5)) / 2;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => mul(a, 1 / Math.hypot(a[0], a[1], a[2]));
const qAxis = (ax, t) => { const s = Math.sin(t / 2); return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(t / 2)]; };
const qMul = (a, b) => [a[0] * b[3] + a[3] * b[0] + a[1] * b[2] - a[2] * b[1], a[1] * b[3] + a[3] * b[1] + a[2] * b[0] - a[0] * b[2], a[2] * b[3] + a[3] * b[2] + a[0] * b[1] - a[1] * b[0], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qNorm = q => { const l = Math.hypot(...q); return q.map(x => x / l); };
const qFromUnit = (f, t) => {
  let r = dot(f, t) + 1;
  if (r < 1e-6) return qNorm(Math.abs(f[0]) > Math.abs(f[2]) ? [-f[1], f[0], 0, 0] : [0, -f[2], f[1], 0]);
  const c = cross(f, t); return qNorm([c[0], c[1], c[2], r]);
};
const qRot = (q, v) => { const u = [q[0], q[1], q[2]], t = mul(cross(u, v), 2); return add(add(v, mul(t, q[3])), cross(u, t)); };
const mCompose = (q, p) => {
  const [x, y, z, w] = q, x2 = x + x, y2 = y + y, z2 = z + z, xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
  return [1 - (yy + zz), xy + wz, xz - wy, 0, xy - wz, 1 - (xx + zz), yz + wx, 0, xz + wy, yz - wx, 1 - (xx + yy), 0, p[0], p[1], p[2], 1];
};
const mPersp = (fy, a, n, f) => { const t = 1 / Math.tan(fy / 2); return [t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]; };
const mLook = (e, c) => { const z = norm(sub(e, c)), x = norm(cross([0, 1, 0], z)), y = cross(z, x); return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1]; };
const mMul = (a, b) => { const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; };

// ---------------- geometry (meters, ~24 mm die)
const R = 0.012, A = R / 0.9510565, INR = A / (2 * Math.sqrt(3));
const RAW = [[-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0], [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI], [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1]].map(p => mul(norm(p), R));
const IDX = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
const faces = IDX.map(([i, j, k]) => {
  let a = RAW[i], b = RAW[j], c = RAW[k], n = norm(cross(sub(b, a), sub(c, a)));
  const ctr = mul(add(add(a, b), c), 1 / 3);
  if (dot(n, ctr) < 0) { [b, c] = [c, b]; [j, k] = [k, j]; n = mul(n, -1); }
  return { v: [a, b, c], i: [i, j, k], n, c: ctr };
});
faces[0].num = 1;
const opp = f => faces.find(g => dot(g.n, f.n) < -0.999);
opp(faces[0]).num = 20;
{ let k = 2; for (const f of faces) if (!f.num) { f.num = k; opp(f).num = 21 - k; k++; } }
const faceByNum = {}; faces.forEach(f => faceByNum[f.num] = f);
const slerp = (a, b, t) => { const th = Math.acos(Math.min(1, Math.max(-1, dot(a, b)))); if (th < 1e-5) return a; const s = Math.sin(th); return add(mul(a, Math.sin((1 - t) * th) / s), mul(b, Math.sin(t * th) / s)); };
const frame = d => { const e1 = norm(cross(d, Math.abs(d[1]) < .9 ? [0, 1, 0] : [1, 0, 0])); return [e1, cross(d, e1)]; };

// ---- 2D glyph toolkit (convex polygons; glyph units: height 1, y ∈ [-.5,.5])
const segPoly = (p, q, t) => { const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L * t / 2, ny = dx / L * t / 2; return [[p[0] + nx, p[1] + ny], [q[0] + nx, q[1] + ny], [q[0] - nx, q[1] - ny], [p[0] - nx, p[1] - ny]]; };
const oct = (p, t) => [...Array(8)].map((_, i) => [p[0] + Math.cos(i * Math.PI / 4 + Math.PI / 8) * t / 2, p[1] + Math.sin(i * Math.PI / 4 + Math.PI / 8) * t / 2]);
const rect = (cx, cy, w, hh) => [[cx - w / 2, cy - hh / 2], [cx + w / 2, cy - hh / 2], [cx + w / 2, cy + hh / 2], [cx - w / 2, cy + hh / 2]];
const diamond = (cx, cy, w, hh) => [[cx, cy - hh / 2], [cx + w / 2, cy], [cx, cy + hh / 2], [cx - w / 2, cy]];
function strokes(lines, t, caps = 'all', taper = false) {
  const o = [];
  for (const pl of lines) {
    const n = pl.length - 1, closed = n > 1 && Math.hypot(pl[0][0] - pl[n][0], pl[0][1] - pl[n][1]) < 1e-6;
    const tw = i => taper ? t * (.45 + .55 * Math.sin(Math.PI * (i + .5) / n)) : t;
    for (let i = 0; i < n; i++) o.push(segPoly(pl[i], pl[i + 1], tw(i)));
    pl.forEach((p, i) => { const end = !closed && (i === 0 || i === n); if (caps === 'all' || (caps === 'joints' && !end)) o.push(oct(p, Math.min(tw(Math.max(0, i - 1)), tw(Math.min(n - 1, i))))); });
  }
  return o;
}
const chaikin = (pl, it) => { let p = pl; for (let k = 0; k < it; k++) { const n = p.length - 1, closed = Math.hypot(p[0][0] - p[n][0], p[0][1] - p[n][1]) < 1e-6, o = closed ? [] : [p[0]];
  for (let i = 0; i < n; i++) { const a = p[i], b = p[i + 1]; o.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]); }
  o.push(closed ? o[0] : p[n]); p = o; } return p; };
const xf = (poly, sx, sy, rot, tx, ty) => { const c = Math.cos(rot), s = Math.sin(rot); return poly.map(([x, y]) => [c * sx * x - s * sy * y + tx, s * sx * x + c * sy * y + ty]); };

// runic digits (rune + nature)
const DIG = {
  0: { w: .6, l: [[[.3, .5], [.56, .22], [.56, -.22], [.3, -.5], [.04, -.22], [.04, .22], [.3, .5]]] },
  1: { w: .36, l: [[[.24, -.5], [.24, .5], [.04, .28]]] },
  2: { w: .6, l: [[[.04, .28], [.3, .5], [.56, .28], [.04, -.5], [.56, -.5]]] },
  3: { w: .6, l: [[[.04, .5], [.56, .5], [.22, .04], [.56, -.22], [.3, -.5], [.04, -.36]]] },
  4: { w: .6, l: [[[.42, -.5], [.42, .5], [.04, -.14], [.58, -.14]]] },
  5: { w: .6, l: [[[.56, .5], [.08, .5], [.06, .04], [.42, .08], [.56, -.22], [.3, -.5], [.04, -.38]]] },
  6: { w: .6, l: [[[.46, .5], [.06, .02], [.06, -.3], [.3, -.5], [.54, -.3], [.54, -.12], [.3, .06], [.06, -.1]]] },
  7: { w: .6, l: [[[.04, .5], [.56, .5], [.2, -.5]], [[.18, -.02], [.5, -.02]]] },
  8: { w: .6, l: [[[.3, .5], [.56, .25], [.04, -.25], [.3, -.5], [.56, -.25], [.04, .25], [.3, .5]]] },
};
DIG[9] = { w: .6, l: DIG[6].l.map(pl => pl.map(([x, y]) => [.6 - x, -y])) };
const G_RUNE = {}, G_NAT = {}, G_SEG = {};
for (const d in DIG) {
  G_RUNE[d] = { w: DIG[d].w, p: strokes(DIG[d].l, .12) };
  G_NAT[d] = { w: DIG[d].w, p: strokes(DIG[d].l.map(pl => chaikin(pl, 2)), .15, 'all', true) };
}
// seven-segment (sci-fi), slight italic
const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
for (let d = 0; d < 10; d++) {
  const one = d === 1, xl = one ? .08 : .05, xr = one ? .08 : .51, yt = .45, yb = -.45, t = .1, g = .035;
  const hb = (y, x0, x1) => [[x0, y], [x0 + t / 2, y + t / 2], [x1 - t / 2, y + t / 2], [x1, y], [x1 - t / 2, y - t / 2], [x0 + t / 2, y - t / 2]];
  const vb = (x, y0, y1) => [[x, y0], [x + t / 2, y0 + t / 2], [x + t / 2, y1 - t / 2], [x, y1], [x - t / 2, y1 - t / 2], [x - t / 2, y0 + t / 2]];
  const S = { a: hb(yt, xl + g, xr - g), d: hb(yb, xl + g, xr - g), g: hb(0, xl + g, xr - g), f: vb(xl, g, yt - g), b: vb(xr, g, yt - g), e: vb(xl, yb + g, -g), c: vb(xr, yb + g, -g) };
  G_SEG[d] = { w: one ? .16 : .56, p: [...SEG[d]].map(k => S[k].map(([x, y]) => [x + y * .12, y])) };
}
// roman capitals (steampunk)
const TK = .17, TN = .075, SH = .075, SY = .5 - SH / 2;
const par = (xt, xb, t) => [[xt - t / 2, .5], [xt + t / 2, .5], [xb + t / 2, -.5], [xb - t / 2, -.5]];
const ROMAN = {
  I: { w: .36, p: [par(.18, .18, TK), rect(.18, SY, .36, SH), rect(.18, -SY, .36, SH)] },
  V: { w: .76, p: [par(.13, .355, TK), par(.64, .40, TN), rect(.13, SY, .34, SH), rect(.64, SY, .24, SH)] },
  X: { w: .76, p: [par(.13, .63, TK), par(.63, .13, TN), rect(.13, SY, .34, SH), rect(.63, SY, .24, SH), rect(.13, -SY, .26, SH), rect(.63, -SY, .34, SH)] },
};
const roman = n => [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']].reduce((s, [v, r]) => { while (n >= v) { s += r; n -= v; } return s; }, '');
// corner ornaments (unit, pointing +y toward the vertex)
const RUNES = [
  [[[0, -.5], [0, .5]], [[0, .18], [.32, .5]], [[0, -.1], [.32, .22]]],
  [[[0, -.5], [0, .5]], [[0, .5], [.3, .24]], [[0, .2], [.3, -.06]]],
  [[[0, -.5], [0, .5]], [[0, .3], [.3, 0], [0, -.3]]],
  [[[.26, .5], [-.14, 0], [.26, -.5]]],
  [[[0, -.5], [0, .5]], [[0, .1], [-.3, .5]], [[0, .1], [.3, .5]]],
  [[[0, -.5], [0, .5]], [[0, .5], [-.3, .18]], [[0, .5], [.3, .18]]],
  [[[-.3, -.5], [.3, .1], [0, .5], [-.3, .1], [.3, -.5]]],
  [[[-.3, .5], [.3, -.5]], [[.3, .5], [-.3, -.5]]],
  [[[-.3, .5], [-.3, -.5], [.3, .5], [.3, -.5], [-.3, .5]]],
  [[[.2, .5], [-.2, .12], [.2, -.12], [-.2, -.5]]],
  [[[0, .5], [.3, 0], [0, -.5], [-.3, 0], [0, .5]]],
  [[[-.24, -.5], [-.24, .5]], [[.24, -.5], [.24, .5]], [[-.24, .24], [.24, -.24]]],
].map(l => strokes(l, .12));
const CHEV = [
  strokes([[[-.38, -.15], [0, .25], [.38, -.15]]], .16, 'joints'),
  strokes([[[-.38, .05], [0, .45], [.38, .05]], [[-.38, -.45], [0, -.05], [.38, -.45]]], .14, 'joints'),
  strokes([[[-.34, -.35], [0, .3], [.34, -.35], [-.34, -.35]]], .12, 'all'),
  [...strokes([[[0, -.45], [0, .15]]], .14, 'none'), rect(0, .38, .16, .16)],
];
const GEAR = (() => {
  const o = [], N = 18, ri = .19, ro = .33;
  for (let k = 0; k < N; k++) { const a0 = k / N * 2 * Math.PI, a1 = (k + 1) / N * 2 * Math.PI; o.push([[Math.cos(a0) * ri, Math.sin(a0) * ri], [Math.cos(a0) * ro, Math.sin(a0) * ro], [Math.cos(a1) * ro, Math.sin(a1) * ro], [Math.cos(a1) * ri, Math.sin(a1) * ri]]); }
  for (let k = 0; k < 8; k++) { const a = k / 8 * 2 * Math.PI, c = Math.cos(a), s = Math.sin(a), px = -s, py = c; o.push([[c * .3 + px * .1, s * .3 + py * .1], [c * .5 + px * .065, s * .5 + py * .065], [c * .5 - px * .065, s * .5 - py * .065], [c * .3 - px * .1, s * .3 - py * .1]]); }
  for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + Math.PI / 4; o.push(segPoly([0, 0], [Math.cos(a) * .22, Math.sin(a) * .22], .07)); }
  o.push(oct([0, 0], .15));
  return o;
})();
const leaf = (len, w) => { const p = []; for (let k = 0; k <= 10; k++) p.push([w / 2 * Math.sin(Math.PI * k / 10), len * k / 10]); for (let k = 9; k > 0; k--) p.push([-w / 2 * Math.sin(Math.PI * k / 10), len * k / 10]); return p; };
const SPRIG = [
  ...strokes([chaikin([[0, -.5], [.05, -.25], [0, -.05]], 2)], .07, 'all'),
  xf(leaf(.62, .32), 1, 1, 0, 0, -.14),
  xf(leaf(.42, .24), 1, 1, .95, -.01, -.3),
  xf(leaf(.42, .24), 1, 1, -.95, .01, -.3),
];

// ---- styles (all glow frost; materials + glyph language vary)
const STYLES = {
  rune:      { rho: .06, bd: [.004, .0036, .0055], bf: .045, br: .3,  ed: [0, 0, 0], ef: [.66, .46, .24], er: .34, pat: 1, pa: .5, pc: [.012, .012, .02], ps: 900, bloom: 1 },
  scifi:     { rho: .028, bd: [.018, .021, .027], bf: .04, br: .5,  ed: [0, 0, 0], ef: [.62, .64, .68], er: .15, pat: 0, pa: 0, pc: [0, 0, 0], ps: 1, bloom: .8 },
  steampunk: { rho: .06, bd: [.03, .01, .004], bf: .04, br: .42, ed: [0, 0, 0], ef: [.92, .7, .32], er: .27, pat: 2, pa: .4, pc: [.014, .005, .002], ps: 700, bloom: .6 },
  nature:    { rho: .1,  bd: [.006, .012, .008], bf: .025, br: .6, ed: [.035, .1, .075], ef: [.04, .05, .045], er: .6, pat: 1, pa: .85, pc: [.022, .05, .028], ps: 520, bloom: 1.15 },
};
const RELIEF = 0.0002, LIFT = 0.00002, MESHES = {};
function buildMesh(key) {
  if (MESHES[key]) return MESHES[key];
  const S = STYLES[key], D = [];
  const push = (p, n, m, f) => D.push(p[0], p[1], p[2], n[0], n[1], n[2], m, f);
  const tri = (a, b, c, n, m, f) => { push(a, n, m, f); push(b, n, m, f); push(c, n, m, f); };
  // rounded body: inner icosahedron ⊕ sphere(RHO); edge rolls + corner caps take the edge material
  const RHO = A * S.rho, DF = dot(faces[0].c, faces[0].n), VI = RAW.map(p => mul(p, (DF - RHO) / DF)), ES = 10, CL = 5;
  faces.forEach(f => tri(...f.i.map(k => add(VI[k], mul(f.n, RHO))), f.n, 0, 0));
  for (let x = 0; x < 20; x++) for (let y = x + 1; y < 20; y++) {
    const sh = faces[x].i.filter(k => faces[y].i.includes(k)); if (sh.length !== 2) continue;
    const [i, j] = sh, n1 = faces[x].n, n2 = faces[y].n;
    for (let s = 0; s < ES; s++) {
      const m0 = slerp(n1, n2, s / ES), m1 = slerp(n1, n2, (s + 1) / ES);
      const a0 = add(VI[i], mul(m0, RHO)), a1 = add(VI[i], mul(m1, RHO)), b0 = add(VI[j], mul(m0, RHO)), b1 = add(VI[j], mul(m1, RHO));
      push(a0, m0, 1, 0); push(b0, m0, 1, 0); push(b1, m1, 1, 0); push(a0, m0, 1, 0); push(b1, m1, 1, 0); push(a1, m1, 1, 0);
    }
  }
  VI.forEach((V, vi) => {
    const c = norm(V), [e1, e2] = frame(c), ang = f => Math.atan2(dot(f.n, e2), dot(f.n, e1));
    const adj = faces.filter(f => f.i.includes(vi)).sort((f, g) => ang(f) - ang(g));
    adj.forEach((fa, k) => {
      const na = fa.n, nb = adj[(k + 1) % adj.length].n;
      const P = (s, l) => norm(add(mul(c, 1 - l / CL), mul(slerp(na, nb, s / ES), l / CL)));
      for (let s = 0; s < ES; s++) for (let l = 0; l < CL; l++)
        [P(s, l), P(s, l + 1), P(s + 1, l + 1), P(s, l), P(s + 1, l + 1), P(s + 1, l)].forEach(p => push(add(V, mul(p, RHO)), p, 1, 0));
    });
  });
  // face inlays — mat 1 = edge metal, 2 = glow, 3 = dim glow
  const prism = (poly, B, m, num, depth) => {
    const area = poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
    if (area < 0) poly = poly.slice().reverse();
    const P = (p, z) => add(add(add(B.o, mul(B.r, p[0])), mul(B.u, p[1])), mul(B.n, z));
    for (let i = 1; i < poly.length - 1; i++) tri(P(poly[0], depth), P(poly[i], depth), P(poly[i + 1], depth), B.n, m, num);
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], n = norm(sub(mul(B.r, b[1] - a[1]), mul(B.u, b[0] - a[0])));
      tri(P(a, 0), P(b, 0), P(b, depth), n, m, num); tri(P(a, 0), P(b, depth), P(a, depth), n, m, num);
    }
  };
  for (const f of faces) {
    const u = norm(sub(f.v[0], f.c)), r = norm(cross(u, f.n)), B = { o: add(f.c, mul(f.n, LIFT)), r, u, n: f.n }, num = f.num;
    const put = (polys, m, sx, sy, rot, tx, ty, depth = RELIEF) => polys.forEach(p => prism(xf(p, sx, sy, rot, tx, ty), B, m, num, depth));
    const row = (gl, hh, gap, cy, m, sx = 1) => { let x = -(gl.reduce((s, g) => s + g.w, 0) + gap * (gl.length - 1)) * hh * sx / 2; for (const g of gl) { put(g.p, m, hh * sx, hh, 0, x, cy); x += (g.w + gap) * hh * sx; } };
    const corners = fn => f.v.forEach((v, i) => { const d = sub(v, f.c), lx = dot(d, r), ly = dot(d, u), L = Math.hypot(lx, ly); fn(i, Math.atan2(ly, lx) - Math.PI / 2, lx / L, ly / L, lx, ly); });
    const digits = lib => String(num).split('').map(d => lib[d]);
    const pip = (cy, hh) => { if (num === 6 || num === 9) put([diamond(0, cy - hh * .5 - A * .06, A * .05, A * .05)], 2, 1, 1, 0, 0, 0); };
    if (key === 'rune') {
      const hh = A * .3, cy = -A * .025; row(digits(G_RUNE), hh, .14, cy, 2); pip(cy, hh);
      corners((i, rot, ux, uy) => put(RUNES[(num * 5 + i * 7) % RUNES.length], 2, A * .085, A * .085, rot, ux * A * .39, uy * A * .39));
    } else if (key === 'scifi') {
      const hh = A * .26, cy = -A * .02; row(digits(G_SEG), hh, .16, cy, 2); pip(cy, hh);
      corners((i, rot, ux, uy) => put(CHEV[(num + i * 2) % CHEV.length], 2, A * .075, A * .075, rot, ux * A * .41, uy * A * .41));
      const pts = f.v.map(v => { const d = sub(v, f.c); return [dot(d, r) * .8, dot(d, u) * .8]; });
      const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      for (let k = 0; k < 3; k++) { const a = pts[k], b = pts[(k + 1) % 3];
        put([segPoly(lerp2(a, b, .24), lerp2(a, b, .42), A * .01), segPoly(lerp2(a, b, .58), lerp2(a, b, .76), A * .01), rect(...lerp2(a, b, .5), A * .016, A * .016)], 3, 1, 1, 0, 0, 0); }
    } else if (key === 'steampunk') {
      const txt = roman(num), gl = [...txt].map(c => ROMAN[c]), uw = gl.reduce((s, g) => s + g.w, 0) + .05 * (gl.length - 1);
      let hh = A * .26; const maxW = A * .5, sx = Math.max(.8, Math.min(1, maxW / (uw * hh))); hh = Math.min(hh, maxW / (uw * sx));
      row(gl, hh, .05, -INR + A * .205 + hh / 2, 2, sx);
      const ry = -INR + A * .15, rw = A * (num === 20 ? .4 : .3);
      put([rect(0, ry, rw, A * .018), diamond(0, ry, A * .075, A * .05)], 1, 1, 1, 0, 0, 0, RELIEF * 1.3);
      if (num === 20 || num === 1) put([diamond(-rw / 2 - A * .035, ry, A * .045, A * .035), diamond(rw / 2 + A * .035, ry, A * .045, A * .035)], 1, 1, 1, 0, 0, 0, RELIEF * 1.3);
      corners((i, rot, ux, uy) => put(GEAR, 1, A * .12, A * .12, rot + num * .7 + i, ux * A * .37, uy * A * .37, RELIEF * 1.8));
    } else {
      const hh = A * .3, cy = -A * .025; row(digits(G_NAT), hh, .12, cy, 2); pip(cy, hh);
      corners((i, rot, ux, uy) => put(SPRIG, 3, A * .11, A * .11, rot + ((num + i) % 3 - 1) * .18, ux * A * .38, uy * A * .38));
    }
  }
  let rMax = 0, minY = 0; const q = qFromUnit(faces[0].n, [0, -1, 0]);
  for (let i = 0; i < D.length; i += 8) { const p = [D[i], D[i + 1], D[i + 2]]; rMax = Math.max(rMax, Math.hypot(...p)); minY = Math.min(minY, qRot(q, p)[1]); }
  return MESHES[key] = { data: new Float32Array(D), count: D.length / 8, restY: -minY, rMax, S };
}

// ---------------- shaders
const VS_MESH = `#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in float aM; layout(location=3) in float aF;
uniform mat4 uModel, uVP; out vec3 vN, vW, vO; flat out float vM, vF;
void main(){ vec4 w = uModel * vec4(aP, 1.); vW = w.xyz; vO = aP; vN = mat3(uModel) * aN; vM = aM; vF = aF; gl_Position = uVP * w; }`;
const FS_MESH = `#version 300 es
precision highp float;
in vec3 vN, vW, vO; flat in float vM, vF; out vec4 o;
uniform vec3 uEye, uGlow, uBD, uED, uEF, uPC; uniform float uMode, uEmis, uFlash, uWin, uBase, uHot, uBF, uBR, uER, uPat, uPA, uPS;
float h3(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
float fbm(vec3 p){ return vn(p) * .5 + vn(p * 2.03) * .25 + vn(p * 4.1) * .125 + vn(p * 8.3) * .0625; }
vec3 env(vec3 r, float k){                       // procedural studio: overhead softbox, key strip, cool fill, horizon
  float top = smoothstep(.9 - k * .4, .995, r.y) * (1. - smoothstep(.998, 1., r.y) * .6);
  float key = smoothstep(.985 - k * .12, .9995, dot(r, normalize(vec3(.62, .38, .68))));
  float fill = smoothstep(.84 - k * .5, .985, dot(r, normalize(vec3(-.8, .18, -.4))));
  float hor = exp(-abs(r.y) * 7.) * .1;
  return vec3(1., .97, .93) * (top * .55 + key * 2.2) + vec3(.8, .9, 1.) * fill * .7 + hor + .015;
}
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
void main(){
  bool rune = vM > 1.5, win = abs(vF - uWin) < .5; float gk = vM > 2.5 ? .45 : 1.;
  if (uMode > .5) { o = vec4(rune ? uGlow * gk * (win ? uHot : uBase) : vec3(0.), 1.); return; }
  vec3 n = normalize(vN), V = normalize(uEye - vW), Rf = reflect(-V, n);
  float NdV = max(dot(n, V), 0.);
  vec3 L1 = normalize(vec3(.45, .8, .55)), L2 = normalize(vec3(-.6, .3, -.5));
  vec3 dif = uBD, F0 = vec3(uBF); float rough = uBR;
  if (vM < .5 && uPat > .5) {
    vec3 q = vO * uPS;
    if (uPat < 1.5) { float m = smoothstep(.32, .78, fbm(q)); dif = mix(dif, uPC, m * uPA); rough += m * uPA * .15; }
    else { float gr = pow(sin((q.y + fbm(q * .35) * 3.5) * 9.) * .5 + .5, 2.5); dif = mix(dif, uPC, gr * uPA); rough += gr * .12; }
  }
  if (vM > .5 && vM < 1.5) { dif = uED; F0 = uEF; rough = uER; }
  if (rune) { dif = vec3(.01); F0 = vec3(.03); rough = .85; }
  vec3 c = dif * (mix(.25, .6, n.y * .5 + .5) + 2.4 * max(dot(n, L1), 0.) + .5 * max(dot(n, L2), 0.));
  vec3 F = F0 + (1. - F0) * pow(1. - NdV, 5.) * (1. - rough * .7);
  c += F * env(Rf, rough);
  c += F * pow(max(dot(n, normalize(L1 + V)), 0.), mix(500., 30., rough)) * 1.6;
  if (vM < .5) c += uGlow * .006;
  if (rune) c += uGlow * 1.9 * gk * (uEmis + (win ? uFlash : 0.));
  o = vec4(pow(aces(c * 1.15), vec3(1. / 2.2)), 1.);
}`;
const VS_FS = `#version 300 es
layout(location=0) in vec2 aP; out vec2 vUv; void main(){ vUv = aP * .5 + .5; gl_Position = vec4(aP, 0., 1.); }`;
const FS_BLUR = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D uT; uniform vec2 uD;
void main(){ vec3 c = texture(uT, vUv).rgb * .227;
  c += (texture(uT, vUv + uD * 1.385).rgb + texture(uT, vUv - uD * 1.385).rgb) * .316;
  c += (texture(uT, vUv + uD * 3.231).rgb + texture(uT, vUv - uD * 3.231).rgb) * .070; o = vec4(c, 1.); }`;
const FS_COMP = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D b0, b1, b2; uniform float uS;
void main(){ vec3 g = (texture(b0, vUv).rgb * 1.1 + texture(b1, vUv).rgb + texture(b2, vUv).rgb * .9) * uS;
  g = 1. - exp(-g * 1.15); o = vec4(g, max(g.r, max(g.g, g.b))); }`;
const VS_GND = `#version 300 es
layout(location=0) in vec2 aP; uniform mat4 uVP; uniform vec3 uC; uniform float uS; out vec2 vQ;
void main(){ vQ = aP; gl_Position = uVP * vec4(uC + vec3(aP.x * uS, 0., aP.y * uS), 1.); }`;
const FS_GND = `#version 300 es
precision highp float; in vec2 vQ; out vec4 o; uniform float uA;
void main(){ float a = uA * (1. - smoothstep(.1, 1., length(vQ))); o = vec4(0., 0., 0., a); }`;

const CSS = `
:host{display:block;position:relative;width:100%;height:420px;--d20-ink:#f1ece2;--d20-muted:#bdb6a8;--d20-line:#5a5664;--d20-btn:#1c1b22;--g:#7fe6ff}
canvas{position:absolute;inset:0;width:100%;height:100%;display:block;cursor:grab;touch-action:pan-y;outline:none}
canvas:active{cursor:grabbing}
.ui{position:absolute;left:50%;bottom:20px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:12px;pointer-events:none}
:host([hide-ui]) .ui{display:none}
button{pointer-events:auto;font:600 13px/1 Georgia,serif;letter-spacing:.22em;text-transform:uppercase;min-height:46px;padding:0 28px;border-radius:999px;border:1px solid var(--d20-line);background:var(--d20-btn);color:var(--d20-ink);cursor:pointer}
button:hover{border-color:var(--d20-muted)} button:disabled{opacity:.5;cursor:default}
.res{font:400 12px/1.2 Georgia,serif;letter-spacing:.2em;text-transform:uppercase;color:var(--d20-muted);text-align:center;min-height:62px;display:flex;flex-direction:column;justify-content:flex-end;gap:4px;opacity:0;transition:opacity .4s}
.res.on{opacity:1} .res.rolling{opacity:.45} .res.rolling b{filter:blur(1px)}
.res b{font:400 44px/1 Georgia,serif;letter-spacing:0;color:var(--d20-ink);display:block}
.res.reveal b{animation:pop .9s cubic-bezier(.2,1.4,.4,1) both}
.res.reveal span{animation:rise .8s .25s ease-out both}
@keyframes pop{0%{transform:scale(.4);opacity:0;text-shadow:0 0 0 var(--g)}35%{transform:scale(1.35);opacity:1;text-shadow:0 0 28px var(--g),0 0 8px var(--g)}100%{transform:scale(1);text-shadow:0 0 14px color-mix(in oklab,var(--g) 45%,transparent)}}
@keyframes rise{0%{opacity:0;transform:translateY(6px);letter-spacing:.5em}100%{opacity:1;transform:none;letter-spacing:.2em}}
.err{position:absolute;inset:0;display:none;align-items:center;justify-content:center;font:13px Georgia,serif;color:var(--d20-muted)}`;

const hexLin = h => { const n = parseInt(h.replace('#', ''), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255].map(c => Math.pow(c / 255, 2.2)); };

class RuneD20 extends HTMLElement {
  static observedAttributes = ['glow', 'dice-style'];
  constructor() {
    super();
    const s = this.attachShadow({ mode: 'open' });
    s.innerHTML = `<style>${CSS}</style><canvas part="canvas" aria-label="d20 — tap to roll"></canvas>
      <div class="ui"><div class="res" aria-live="polite"><b></b><span></span></div><button part="button" type="button">Roll</button></div><div class="err">WebGL2 is not available.</div>`;
    this._cv = s.querySelector('canvas'); this._res = s.querySelector('.res'); this._rn = s.querySelector('.res b'); this._rl = s.querySelector('.res span'); this._btn = s.querySelector('button');
    this._btn.onclick = () => this.roll();
    this._glowHex = '#7fe6ff'; this._glow = hexLin(this._glowHex);
    this.value = 20; this._winner = -1; this._flash = 0; this._roll = null;
    this._cam = { az: .6, el: .62, dist: 1 };
    this._styleKey = STYLES[this.getAttribute('dice-style')] ? this.getAttribute('dice-style') : 'rune';
    this._m = buildMesh(this._styleKey);
    this._q = this._restQuat(20, this._cam.az); this._pos = [0, this._m.restY, 0];
    this._t0 = performance.now(); this._visible = true; this._interacted = false;
    this._frame = this._frame.bind(this);
  }
  attributeChangedCallback(n, o, v) {
    if (n === 'glow' && v) { this._glowHex = v; this._glow = hexLin(v); this.style.setProperty('--g', v); }
    if (n === 'dice-style' && STYLES[v] && this._m && v !== this._styleKey) {
      this._styleKey = v; this._m = buildMesh(v);
      if (this._gl) { const gl = this._gl; gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo); gl.bufferData(gl.ARRAY_BUFFER, this._m.data, gl.STATIC_DRAW); }
      this._swap = performance.now(); this._kick();
    }
  }
  get diceStyle() { return this._styleKey; }
  set diceStyle(v) { this.setAttribute('dice-style', v); }
  connectedCallback() {
    if (!this._gl && !this._init()) return;
    this._ro = new ResizeObserver(() => this._resize()); this._ro.observe(this);
    this._io = new IntersectionObserver(e => { this._visible = e[0].isIntersecting; this._kick(); }); this._io.observe(this);
    this._vis = () => this._kick(); document.addEventListener('visibilitychange', this._vis);
    this._kick();
  }
  disconnectedCallback() { this._ro && this._ro.disconnect(); this._io && this._io.disconnect(); document.removeEventListener('visibilitychange', this._vis); cancelAnimationFrame(this._raf); this._raf = 0; }
  _kick() { if (this._visible && !document.hidden) { if (!this._raf) this._raf = requestAnimationFrame(this._frame); } else { cancelAnimationFrame(this._raf); this._raf = 0; } }

  _init() {
    const gl = this._cv.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: true });
    if (!gl) { this.shadowRoot.querySelector('.err').style.display = 'flex'; return false; }
    this._gl = gl;
    const prog = (vs, fs) => {
      const p = gl.createProgram();
      for (const [t, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
        const sh = gl.createShader(t); gl.shaderSource(sh, src); gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
        gl.attachShader(p, sh);
      }
      gl.linkProgram(p);
      const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const nm = gl.getActiveUniform(p, i).name; u[nm] = gl.getUniformLocation(p, nm); }
      return { p, u };
    };
    this._pm = prog(VS_MESH, FS_MESH); this._pb = prog(VS_FS, FS_BLUR); this._pc = prog(VS_FS, FS_COMP); this._pg = prog(VS_GND, FS_GND);
    this._vaoMesh = gl.createVertexArray(); gl.bindVertexArray(this._vaoMesh);
    this._vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo); gl.bufferData(gl.ARRAY_BUFFER, this._m.data, gl.STATIC_DRAW);
    [[0, 3, 0], [1, 3, 12], [2, 1, 24], [3, 1, 28]].forEach(([l, n, o]) => { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, 32, o); });
    const vao2 = data => { const v = gl.createVertexArray(); gl.bindVertexArray(v); gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); return v; };
    this._vaoTri = vao2([-1, -1, 3, -1, -1, 3]);
    this._vaoQuad = vao2([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]);
    gl.bindVertexArray(null);
    this._half = !!gl.getExtension('EXT_color_buffer_float');
    this._fbos = [];
    // pointer: drag to orbit, tap to roll
    const cv = this._cv;
    cv.addEventListener('pointerdown', e => { this._drag = { x: e.clientX, y: e.clientY, az: this._cam.az, el: this._cam.el, moved: false }; this._interacted = true; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', e => {
      const d = this._drag; if (!d) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (Math.hypot(dx, dy) > 4) d.moved = true;
      if (d.moved && !this._roll) { this._cam.az = d.az - dx * .008; this._cam.el = Math.min(1.5, Math.max(.15, d.el + dy * .006)); }
    });
    cv.addEventListener('pointerup', () => { if (this._drag && !this._drag.moved) this.roll(); this._drag = null; });
    cv.addEventListener('pointercancel', () => this._drag = null);
    return true;
  }
  _fbo(w, h, depth) {
    const gl = this._gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, this._half ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, this._half ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
    [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]].forEach(([k, v]) => gl.texParameteri(gl.TEXTURE_2D, k, v));
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    let rb = null;
    if (depth) { rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fb, t, w, h, rb };
  }
  _resize() {
    const gl = this._gl; if (!gl) return;
    const dpr = Math.min(devicePixelRatio || 1, 2), w = Math.max(1, Math.round(this.clientWidth * dpr)), h = Math.max(1, Math.round(this.clientHeight * dpr));
    if (w === this._cv.width && h === this._cv.height && this._fbos.length) return;
    this._cv.width = w; this._cv.height = h;
    this._fbos.forEach(f => { gl.deleteFramebuffer(f.fb); gl.deleteTexture(f.t); f.rb && gl.deleteRenderbuffer(f.rb); });
    const hw = Math.max(1, w >> 1), hh = Math.max(1, h >> 1);
    this._glowFb = this._fbo(hw, hh, true);
    this._lv = []; this._tmp = [];
    for (let i = 0; i < 3; i++) { const lw = Math.max(1, hw >> i), lh = Math.max(1, hh >> i); this._tmp.push(this._fbo(lw, lh)); this._lv.push(this._fbo(lw, lh)); }
    this._fbos = [this._glowFb, ...this._tmp, ...this._lv];
    this._kick();
  }

  _restQuat(num, az) {
    const f = faceByNum[num], land = qFromUnit(f.n, [0, 1, 0]);
    const w = qRot(land, sub(f.v[0], f.c)); const wl = Math.hypot(w[0], w[2]); const wx = w[0] / wl, wz = w[2] / wl;
    const fx = -Math.sin(az), fz = -Math.cos(az);
    return qMul(qAxis([0, 1, 0], Math.atan2(wz * fx - wx * fz, wx * fx + wz * fz)), land);
  }
  roll(forced) {
    if (this._roll) return this._roll.promise;
    // TTR patch: an optional face to land on, so a roll made elsewhere can be replayed.
    const num = Number.isInteger(forced) && forced >= 1 && forced <= 20 ? forced : 1 + Math.floor(Math.random() * 20), reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ang = Math.random() * Math.PI * 2, from = [Math.cos(ang) * .014, 0, Math.sin(ang) * .014];
    const axis = norm(add(mul(norm(cross([0, 1, 0], from)), -1), [(Math.random() - .5) * .6, (Math.random() - .5) * .6, (Math.random() - .5) * .6]));
    let res; const promise = new Promise(r => res = r);
    this._roll = { t0: performance.now(), dur: reduce ? 500 : 2100, num, qEnd: this._restQuat(num, this._cam.az), from: reduce ? [0, 0, 0] : from, axis, spin: reduce ? 0 : Math.PI * (7 + Math.random() * 4), el0: this._cam.el, res, promise, tick: 0 };
    this._interacted = true; this._winner = -1; this._btn.disabled = true;
    this._rl.textContent = ''; this._res.classList.remove('reveal'); this._res.classList.add('on', 'rolling');
    // TTR patch: the face is announced as the roll starts, so other screens can roll alongside.
    this.dispatchEvent(new CustomEvent('roll-start', { bubbles: true, composed: true, detail: { value: num } }));
    this._kick();
    return promise;
  }
  _step(now) {
    const r = this._roll;
    if (!r) { if (!this._interacted) this._cam.az += .0022; return; }
    const t = Math.min(1, (now - r.t0) / r.dur), left = Math.pow(1 - t, 3);
    this._q = qMul(qAxis(r.axis, r.spin * left * left), r.qEnd);
    const hops = [[0, .36, .007], [.36, .62, .003], [.62, .8, .001]];
    let b = 0; for (const [a, e, hh] of hops) if (t >= a && t < e) { const u = (t - a) / (e - a); b = 4 * hh * u * (1 - u); }
    const ry = this._m.restY; this._pos = [r.from[0] * left, ry + b + (this._m.rMax - ry) * Math.min(1, left * 3), r.from[2] * left];
    const ct = Math.min(1, t * 1.25), ce = ct * ct * (3 - 2 * ct);
    this._cam.el = r.el0 + (1.466 - r.el0) * ce;
    if (now - r.tick > 70) { r.tick = now; this._rn.textContent = 1 + Math.floor(Math.random() * 20); }
    if (t === 1) {
      this._q = r.qEnd; this._pos = [0, this._m.restY, 0]; this._roll = null;
      const n = this.value = r.num; this._winner = n; this._flash = 1;
      this._rn.textContent = n; this._rl.textContent = n === 20 ? 'Critical' : n === 1 ? 'Fumble' : '';
      this._res.classList.remove('rolling'); void this._res.offsetWidth; this._res.classList.add('reveal');
      this._btn.disabled = false;
      r.res(n);
      this.dispatchEvent(new CustomEvent('roll', { detail: { value: n }, bubbles: true, composed: true }));
    }
  }
  _frame(now) {
    this._raf = 0;
    const gl = this._gl; if (!gl || !this._fbos.length) return;
    this._step(now);
    this._flash *= .985;
    const p = .5 + .5 * Math.sin((now - this._t0) / 1100);
    const crit = this._winner === 20 ? 1.8 : this._winner === 1 ? .4 : 1;
    const W = this._cv.width, H = this._cv.height, asp = W / H;
    const M0 = this._m, S = M0.S, REST_Y = M0.restY;
    const tgt = [0, REST_Y, 0], c = this._cam, fov = .61;
    const dist = R * 1.02 * 1.9 / Math.tan(fov / 2) / Math.min(1, asp);
    // style swap: quick pop + spin-in
    let M;
    const sw = this._swap ? Math.min(1, (now - this._swap) / 650) : 1;
    if (sw < 1) { const e = 1 - Math.pow(1 - sw, 3), sc = .82 + .18 * e + Math.sin(sw * Math.PI) * .06;
      const qq = qMul(qAxis([0, 1, 0], (1 - e) * 1.6), this._q), base = mCompose(qq, this._pos);
      M = base.map((v, i) => (i < 12 && i % 4 < 3) ? v * sc : v); } else M = mCompose(this._q, this._pos);
    const eye = add(tgt, mul([Math.sin(c.az) * Math.cos(c.el), Math.sin(c.el), Math.cos(c.az) * Math.cos(c.el)], dist));
    const VP = mMul(mPersp(fov, asp, dist * .05, dist * 20), mLook(eye, tgt));
    const pm = this._pm, u = pm.u;
    const drawMesh = mode => {
      gl.useProgram(pm.p); gl.bindVertexArray(this._vaoMesh);
      gl.uniformMatrix4fv(u.uModel, false, M); gl.uniformMatrix4fv(u.uVP, false, VP);
      gl.uniform3fv(u.uEye, eye); gl.uniform3fv(u.uGlow, this._glow);
      gl.uniform1f(u.uMode, mode); gl.uniform1f(u.uEmis, .85 + .2 * p); gl.uniform1f(u.uFlash, this._flash * crit);
      gl.uniform3fv(u.uBD, S.bd); gl.uniform1f(u.uBF, S.bf); gl.uniform1f(u.uBR, S.br);
      gl.uniform3fv(u.uED, S.ed); gl.uniform3fv(u.uEF, S.ef); gl.uniform1f(u.uER, S.er);
      gl.uniform1f(u.uPat, S.pat); gl.uniform1f(u.uPA, S.pa); gl.uniform3fv(u.uPC, S.pc); gl.uniform1f(u.uPS, S.ps);
      gl.uniform1f(u.uWin, this._winner); gl.uniform1f(u.uBase, .9 * (1 - .6 * this._flash)); gl.uniform1f(u.uHot, 1.6 + 4.5 * this._flash * crit);
      gl.drawArrays(gl.TRIANGLES, 0, M0.count);
    };
    // glow pass (runes only; stone + bronze occlude)
    const g = this._glowFb;
    gl.bindFramebuffer(gl.FRAMEBUFFER, g.fb); gl.viewport(0, 0, g.w, g.h);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND); drawMesh(1);
    // blur chain
    gl.disable(gl.DEPTH_TEST); gl.useProgram(this._pb.p); gl.bindVertexArray(this._vaoTri); gl.activeTexture(gl.TEXTURE0); gl.uniform1i(this._pb.u.uT, 0);
    const blur = (src, dst, dx, dy) => { gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb); gl.viewport(0, 0, dst.w, dst.h); gl.bindTexture(gl.TEXTURE_2D, src.t); gl.uniform2f(this._pb.u.uD, dx / src.w, dy / src.h); gl.drawArrays(gl.TRIANGLES, 0, 3); };
    let src = g;
    for (let i = 0; i < 3; i++) { blur(src, this._tmp[i], 1, 0); blur(this._tmp[i], this._lv[i], 0, 1); src = this._lv[i]; }
    // main pass
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const lift = Math.max(0, this._pos[1] - REST_Y);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.enable(gl.DEPTH_TEST); gl.depthMask(false);
    gl.useProgram(this._pg.p); gl.bindVertexArray(this._vaoQuad);
    gl.uniformMatrix4fv(this._pg.u.uVP, false, VP); gl.uniform3f(this._pg.u.uC, this._pos[0], 0.00005, this._pos[2]);
    gl.uniform1f(this._pg.u.uS, R * 1.7 * (1 + lift / R)); gl.uniform1f(this._pg.u.uA, .55 * Math.max(0, 1 - lift / (R * .9)));
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.depthMask(true); gl.disable(gl.BLEND);
    drawMesh(0);
    // composite glow
    gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(this._pc.p); gl.bindVertexArray(this._vaoTri);
    ['b0', 'b1', 'b2'].forEach((k, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, this._lv[i].t); gl.uniform1i(this._pc.u[k], i); });
    gl.uniform1f(this._pc.u.uS, (.42 + .12 * p) * S.bloom);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND); gl.activeTexture(gl.TEXTURE0);
    this._kick();
  }
}
if (!customElements.get('rune-d20')) customElements.define('rune-d20', RuneD20);
})();
