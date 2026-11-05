// The catalogue. Each dress is a flat, front-on product image plus measurements in cm.
// A real product photo with a transparent background can replace draw() later;
// the fitting code only needs the image and these measurements.
const PX_PER_CM = 12;
const SHEET_W_CM = 90; // image width, wide enough for the fullest hem

const DRESSES = [
  { id: 'solveig', name: 'Solveig', blurb: 'A floral midi with a fitted waist and an easy skirt.',
    fabric: 'Cotton lawn', colour: 'Bottle green floral', length: 118, swatch: '#1e4a3e',
    cut: { neck: 15, strapIn: 7, strapOut: 10, bust: 24, waist: 37, hip: 56, bustW: 19, waistW: 15, hipW: 21, hemW: 33 }, print: 'floral' },
  { id: 'astrid', name: 'Astrid', blurb: 'A short gingham sundress with a flared hem.',
    fabric: 'Yarn-dyed cotton', colour: 'Cobalt and white check', length: 84, swatch: '#2747c7',
    cut: { neck: 13, strapIn: 8, strapOut: 11, bust: 23, waist: 36, hip: 54, bustW: 19, waistW: 15, hipW: 23, hemW: 31 }, print: 'gingham' },
  { id: 'ingrid', name: 'Ingrid', blurb: 'A long bias-cut slip that falls to the ankle.',
    fabric: 'Silk satin', colour: 'Oxblood', length: 136, swatch: '#5c1423',
    cut: { neck: 17, strapIn: 9, strapOut: 10, bust: 25, waist: 39, hip: 58, bustW: 18, waistW: 15, hipW: 20, hemW: 30 }, print: 'satin' },
  { id: 'liv', name: 'Liv', blurb: 'A washed linen shift that stops at the knee.',
    fabric: 'Washed linen', colour: 'Faded sky blue', length: 94, swatch: '#8fb2cf',
    cut: { neck: 12, strapIn: 7, strapOut: 12, bust: 24, waist: 38, hip: 56, bustW: 20, waistW: 18, hipW: 21, hemW: 25 }, print: 'linen' },
];

function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

function dressOutline(ctx, d) {
  const c = d.cut, L = d.length;
  const side = (s) => {
    ctx.bezierCurveTo(s * (c.strapOut + 1), 9, s * (c.bustW - 3), c.bust - 8, s * c.bustW, c.bust);
    ctx.bezierCurveTo(s * c.bustW, c.bust + 6, s * c.waistW, c.waist - 6, s * c.waistW, c.waist);
    ctx.bezierCurveTo(s * c.waistW, c.waist + 7, s * c.hipW, c.hip - 8, s * c.hipW, c.hip);
    ctx.bezierCurveTo(s * (c.hipW + (c.hemW - c.hipW) * .3), c.hip + (L - c.hip) * .35, s * (c.hemW - 2), L - (L - c.hip) * .3, s * c.hemW, L - 2);
  };
  ctx.beginPath();
  ctx.moveTo(c.strapOut, 0);
  side(1);
  ctx.quadraticCurveTo(0, L + 2, -c.hemW, L - 2);
  // Back up the left side: the same curves in reverse order.
  ctx.bezierCurveTo(-(c.hemW - 2), L - (L - c.hip) * .3, -(c.hipW + (c.hemW - c.hipW) * .3), c.hip + (L - c.hip) * .35, -c.hipW, c.hip);
  ctx.bezierCurveTo(-c.hipW, c.hip - 8, -c.waistW, c.waist + 7, -c.waistW, c.waist);
  ctx.bezierCurveTo(-c.waistW, c.waist - 6, -c.bustW, c.bust + 6, -c.bustW, c.bust);
  ctx.bezierCurveTo(-(c.bustW - 3), c.bust - 8, -(c.strapOut + 1), 9, -c.strapOut, 0);
  ctx.lineTo(-c.strapIn, 0);
  ctx.quadraticCurveTo(-c.strapIn, c.neck * .8, 0, c.neck);
  ctx.quadraticCurveTo(c.strapIn, c.neck * .8, c.strapIn, 0);
  ctx.closePath();
}

const PRINTS = {
  floral(ctx, d, r) {
    ctx.fillStyle = '#1e4a3e'; ctx.fillRect(-45, 0, 90, d.length);
    const flower = (x, y, s, col) => {
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * 6.283 + x;
        ctx.fillStyle = col; ctx.beginPath();
        ctx.ellipse(x + Math.cos(a) * s, y + Math.sin(a) * s, s * .95, s * .6, a, 0, 6.283); ctx.fill();
      }
      ctx.fillStyle = '#e9b949'; ctx.beginPath(); ctx.arc(x, y, s * .5, 0, 6.283); ctx.fill();
    };
    for (let i = 0; i < 420; i++) {
      const x = r() * 90 - 45, y = r() * d.length, a = r() * 6.283;
      ctx.fillStyle = r() > .5 ? '#4f8f6b' : '#2f6d54'; ctx.beginPath();
      ctx.ellipse(x, y, 1.9, .7, a, 0, 6.283); ctx.fill();
    }
    const cols = ['#f4d9dc', '#f1efe2', '#e58fa0', '#f4d9dc'];
    for (let i = 0; i < 190; i++) flower(r() * 90 - 45, r() * d.length, .8 + r() * 1.1, cols[i % 4]);
  },
  gingham(ctx, d) {
    ctx.fillStyle = '#f7f7fb'; ctx.fillRect(-45, 0, 90, d.length);
    ctx.fillStyle = 'rgba(39,71,199,.62)';
    for (let x = -46; x < 46; x += 3) ctx.fillRect(x, 0, 1.5, d.length);
    for (let y = 0; y < d.length; y += 3) ctx.fillRect(-45, y, 90, 1.5);
  },
  satin(ctx, d, r) {
    ctx.fillStyle = '#5c1423'; ctx.fillRect(-45, 0, 90, d.length);
    for (let i = 0; i < 10; i++) {
      const x = r() * 80 - 40, w = 1.5 + r() * 3.5;
      const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
      g.addColorStop(0, 'rgba(226,104,120,0)'); g.addColorStop(.5, 'rgba(226,104,120,.2)'); g.addColorStop(1, 'rgba(226,104,120,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x - w, 0); ctx.lineTo(x + w, 0);
      const dx = (r() - .5) * 26;
      ctx.lineTo(x + dx + w * 1.4, d.length); ctx.lineTo(x + dx - w * 1.4, d.length); ctx.fill();
    }
  },
  linen(ctx, d, r) {
    ctx.fillStyle = '#8fb2cf'; ctx.fillRect(-45, 0, 90, d.length);
    ctx.lineWidth = .07;
    for (let i = 0; i < 2600; i++) {
      ctx.strokeStyle = r() > .5 ? 'rgba(236,244,250,.26)' : 'rgba(58,92,122,.2)';
      const x = r() * 90 - 45, y = r() * d.length, len = 1 + r() * 6;
      ctx.beginPath(); ctx.moveTo(x, y);
      if (i % 2) ctx.lineTo(x + len, y); else ctx.lineTo(x, y + len);
      ctx.stroke();
    }
  },
};

function drawDress(d) {
  const cv = document.createElement('canvas');
  cv.width = SHEET_W_CM * PX_PER_CM; cv.height = (d.length + 3) * PX_PER_CM;
  const ctx = cv.getContext('2d');
  ctx.scale(PX_PER_CM, PX_PER_CM); ctx.translate(SHEET_W_CM / 2, 0);
  const r = rng(d.length * 7919);
  ctx.save();
  dressOutline(ctx, d); ctx.clip();
  PRINTS[d.print](ctx, d, r);

  // Folds fall from the waist and open toward the hem.
  const c = d.cut, folds = d.print === 'satin' ? 9 : 13;
  for (let i = 0; i < folds; i++) {
    const t = (i + .5) / folds * 2 - 1 + (r() - .5) * .1;
    const top = t * c.waistW, bottom = t * c.hemW, w = 1.2 + r() * 2.4, a = .1 + r() * .16;
    const g = ctx.createLinearGradient(bottom - w, 0, bottom + w, 0);
    g.addColorStop(0, 'rgba(10,6,20,0)'); g.addColorStop(.5, `rgba(10,6,20,${a})`); g.addColorStop(.62, `rgba(255,255,255,${a * .55})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath();
    ctx.moveTo(top - .4, c.waist); ctx.lineTo(top + .4, c.waist);
    ctx.lineTo(bottom + w, d.length + 2); ctx.lineTo(bottom - w, d.length + 2); ctx.fill();
  }
  // Bust shaping, waist seam and hem stitching.
  [-1, 1].forEach((s) => {
    ctx.strokeStyle = 'rgba(10,6,20,.2)'; ctx.lineWidth = .28;
    ctx.beginPath(); ctx.moveTo(s * (c.bustW - .5), c.bust + 1); ctx.quadraticCurveTo(s * c.bustW * .7, c.bust + 1, s * c.bustW * .48, c.bust - 3); ctx.stroke();
  });
  if (d.print !== 'satin' && d.print !== 'linen') {
    ctx.strokeStyle = 'rgba(10,6,20,.34)'; ctx.lineWidth = .3;
    ctx.beginPath(); ctx.moveTo(-c.waistW, c.waist); ctx.quadraticCurveTo(0, c.waist + 1.2, c.waistW, c.waist); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(10,6,20,.24)'; ctx.lineWidth = .16;
  ctx.beginPath(); ctx.moveTo(-c.hemW, d.length - 4); ctx.quadraticCurveTo(0, d.length, c.hemW, d.length - 4); ctx.stroke();
  ctx.restore();
  return cv;
}
