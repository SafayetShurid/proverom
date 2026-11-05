// Turns body landmarks into a mesh that wraps the flat dress image around the wearer.
// Vertical placement is true to the garment: its length in cm is measured against the
// wearer's body using their height, so a shorter person sees the same dress fall lower.

const BODY = {
  // Share of standing height, from standard body proportions.
  shoulderToAnkle: 0.778,
  highShoulder: 0.83,
  torso: 0.288,        // shoulder joint to hip joint
  legSegment: 0.245,   // hip to knee, and knee to ankle
};

// Where the hem lands, for the shop card.
function fallsTo(lengthCm, heightCm) {
  const off = Math.max(0, BODY.highShoulder * heightCm - lengthCm);
  const f = off / heightCm;
  const where = f >= .38 ? 'at mid-thigh' : f >= .31 ? 'above the knee' : f >= .26 ? 'at the knee'
    : f >= .17 ? 'just below the knee' : f >= .10 ? 'at mid-calf' : f >= .05 ? 'above the ankle'
    : f >= .012 ? 'at the ankle' : 'on the floor';
  return { where, floorCm: Math.round(off) };
}

const lerp = (a, b, t) => a + (b - a) * t;
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function pieces(table, x) { // piecewise-linear lookup through [x, y] pairs
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (x <= table[i][0]) {
      const [x0, y0] = table[i - 1], [x1, y1] = table[i];
      return lerp(y0, y1, (x - x0) / (x1 - x0 || 1));
    }
  }
  return table[table.length - 1][1];
}

function catmull(p0, p1, p2, p3, t) {
  const f = (a, b, c, d) => .5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
  return { x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) };
}

// Landmarks are in pixels. Lower-body points the camera cannot see are predicted from the torso.
function readBody(lm) {
  const ls = lm[11], rs = lm[12], lh = lm[23], rh = lm[24];
  const shoulder = mid(ls, rs), hip = mid(lh, rh);
  const T = Math.max(dist(shoulder, hip), 1);
  const down = { x: (hip.x - shoulder.x) / T, y: (hip.y - shoulder.y) / T };
  const seg = T * BODY.legSegment / BODY.torso;
  const seen = (p) => (p.visibility ?? 1) > .6;

  const kneesSeen = seen(lm[25]) && seen(lm[26]);
  const anklesSeen = kneesSeen && seen(lm[27]) && seen(lm[28]);
  const knee = kneesSeen ? mid(lm[25], lm[26]) : { x: hip.x + down.x * seg, y: hip.y + down.y * seg };
  const ankle = anklesSeen ? mid(lm[27], lm[28]) : { x: knee.x + down.x * seg, y: knee.y + down.y * seg };

  const pts = [shoulder, hip, knee, ankle];
  const before = { x: shoulder.x - down.x * T * .3, y: shoulder.y - down.y * T * .3 };
  const further = { x: shoulder.x - down.x * T * .6, y: shoulder.y - down.y * T * .6 };
  const after = { x: ankle.x * 1.8 - knee.x * .8, y: ankle.y * 1.8 - knee.y * .8 };
  const beyond = { x: ankle.x * 2.5 - knee.x * 1.5, y: ankle.y * 2.5 - knee.y * 1.5 };
  const ctrl = [further, before, ...pts, after, beyond];

  // Sample the centre line and measure along it, starting at the shoulder line.
  const line = [];
  for (let i = 0; i + 3 < ctrl.length; i++) {
    for (let k = 0; k < 10; k++) line.push(catmull(ctrl[i], ctrl[i + 1], ctrl[i + 2], ctrl[i + 3], k / 10));
  }
  let s = 0, startS = 0, ankleS = 0;
  line[0].s = 0;
  for (let i = 1; i < line.length; i++) {
    s += dist(line[i], line[i - 1]); line[i].s = s;
    if (i === 10) startS = s;  // the shoulder line
    if (i === 40) ankleS = s;  // the ankle
  }
  const chain = ankleS - startS;
  const unit = (a, b) => { const l = dist(a, b) || 1; return { x: (b.x - a.x) / l, y: (b.y - a.y) / l }; };
  return { T, line, startS, chain, shoulderW: dist(ls, rs), hipW: dist(lh, rh),
    acrossTop: unit(rs, ls), acrossHip: unit(rh, lh), kneeGap: kneesSeen ? dist(lm[25], lm[26]) : 0,
    ankleGap: anklesSeen ? dist(lm[27], lm[28]) : 0, kneesSeen, anklesSeen };
}

function pointAt(body, s) {
  const { line } = body;
  const target = s + body.startS;
  let lo = 0, hi = line.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (line[m].s < target) lo = m; else hi = m; }
  const a = line[lo], b = line[hi], t = (target - a.s) / ((b.s - a.s) || 1);
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

const ROWS = 44, COLS = 16;

function buildMesh(lm, dress, heightCm, out) {
  const b = readBody(lm), c = dress.cut, T = b.T;
  const lengthPx = dress.length / (BODY.shoulderToAnkle * heightCm) * b.chain;
  const top = -T * .06;

  // Dress measurement (cm from the top of the strap) to distance along the body.
  const rowTable = [
    [0, top], [c.bust, T * .30], [c.waist, T * .66], [c.hip, T * 1.02],
    [dress.length, Math.max(top + lengthPx, T * 1.25)],
  ];
  // Body half-widths in px. The floors keep the dress from collapsing when you turn side-on.
  const bustPx = Math.max(b.shoulderW * .50, T * .24) * 1.05;
  const waistPx = Math.max(lerp(b.shoulderW * .42, b.hipW * .85, .5), T * .2) * 1.05;
  const hipPx = Math.max(b.hipW * .98, T * .25) * 1.05;
  const strapPx = Math.max(b.shoulderW * .38, T * .13);
  const scaleTable = [
    [0, strapPx / c.strapOut], [c.bust, bustPx / c.bustW], [c.waist, waistPx / c.waistW], [c.hip, hipPx / c.hipW],
  ];
  const widthTable = [[0, c.strapOut], [c.bust, c.bustW], [c.waist, c.waistW], [c.hip, c.hipW], [dress.length, c.hemW]];
  const hipS = rowTable[3][1], kneeS = b.chain * .68, ankleS = b.chain;
  const spread = [[hipS, 0], [kneeS, b.kneeGap / 2], [ankleS, b.ankleGap / 2]];

  const stride = 5, sheetH = dress.length + 3;
  const verts = out || new Float32Array((ROWS + 1) * (COLS + 1) * stride);
  let n = 0;
  for (let r = 0; r <= ROWS; r++) {
    const yCm = r / ROWS * sheetH;
    const s = pieces(rowTable, Math.min(yCm, dress.length)) + Math.max(0, yCm - dress.length) * lengthPx / dress.length;
    const ctr = pointAt(b, s);
    const hwCm = pieces(widthTable, yCm);
    let sx = pieces(scaleTable, yCm);
    const legs = pieces(spread, s);                 // keep the skirt around wide-apart legs
    if (legs > 0) sx = Math.max(sx, (legs + T * .1) / hwCm);
    const k = clamp(s / (T || 1), 0, 1);
    const ax = lerp(b.acrossTop.x, b.acrossHip.x, k), ay = lerp(b.acrossTop.y, b.acrossHip.y, k);
    for (let col = 0; col <= COLS; col++) {
      const xCm = (col / COLS - .5) * SHEET_W_CM;
      const e = Math.min(1, Math.abs(xCm) / hwCm);
      verts[n++] = ctr.x + ax * xCm * sx;
      verts[n++] = ctr.y + ay * xCm * sx;
      verts[n++] = col / COLS;
      verts[n++] = r / ROWS;
      verts[n++] = 1.04 - .34 * e * e * e;           // falls away from the light at the sides
    }
  }
  return { verts, body: b, hemY: pointAt(b, rowTable[4][1]).y };
}

function meshIndices() {
  const idx = new Uint16Array(ROWS * COLS * 6); let n = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const a = r * (COLS + 1) + c, b = a + 1, d = a + COLS + 1, e = d + 1;
    idx[n++] = a; idx[n++] = d; idx[n++] = b; idx[n++] = b; idx[n++] = d; idx[n++] = e;
  }
  return idx;
}

// Steadies tracking without adding lag when the wearer moves quickly (One Euro filter).
class Steady {
  constructor(mincut = 1.4, beta = 6) { this.mincut = mincut; this.beta = beta; this.v = null; }
  push(pts, t) {
    if (!this.v) { this.v = pts.map((p) => ({ ...p, dx: 0, dy: 0 })); this.t = t; return this.v; }
    const dt = Math.max((t - this.t) / 1000, 1e-3); this.t = t;
    const alpha = (cut) => { const tau = 1 / (6.283 * cut); return 1 / (1 + tau / dt); };
    pts.forEach((p, i) => {
      const o = this.v[i];
      const dx = (p.x - o.x) / dt, dy = (p.y - o.y) / dt, ad = alpha(1);
      o.dx = lerp(o.dx, dx, ad); o.dy = lerp(o.dy, dy, ad);
      const speed = Math.hypot(o.dx, o.dy);
      const a = alpha(this.mincut + this.beta * speed);
      o.x = lerp(o.x, p.x, a); o.y = lerp(o.y, p.y, a); o.visibility = p.visibility;
    });
    return this.v;
  }
  reset() { this.v = null; }
}
