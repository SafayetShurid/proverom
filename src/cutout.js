// Turns a flat photo of a dress, T-shirt, glasses or hat into an item the fitting code can use.
// Everything happens in the browser. The photo is never uploaded.

class CutoutError extends Error {}

function cutOutPhoto(bitmap, { clearHoles = false } = {}) {
  const scale = Math.min(1, 1500 / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h), px = img.data, n = w * h;

  let clear = 0;
  for (let i = 0; i < n; i++) if (px[i * 4 + 3] < 16) clear++;
  const keep = new Uint8Array(n);
  if (clear > n * .05) {
    for (let i = 0; i < n; i++) keep[i] = px[i * 4 + 3] > 127 ? 1 : 0;   // already a transparent cut-out
  } else {
    floodBackground(px, w, h, keep, clearHoles);
  }

  const box = largestShape(keep, w, h);
  const share = box.count / n;
  if (share < .015 || share > .85 || box.bottom - box.top < 40) {
    throw new CutoutError('I could not separate the item from that background. Use a flat photo of the whole item on a plain background.');
  }

  // Soften the edge, then trim the photo to the dress.
  const soft = new Uint8ClampedArray(n);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    soft[i] = (keep[i] * 4 + (keep[i - 1] + keep[i + 1] + keep[i - w] + keep[i + w]) * 2
      + keep[i - w - 1] + keep[i - w + 1] + keep[i + w - 1] + keep[i + w + 1]) * 255 / 16;
  }
  for (let i = 0; i < n; i++) px[i * 4 + 3] = soft[i];
  ctx.putImageData(img, 0, 0);
  const tw = box.right - box.left + 1, th = box.bottom - box.top + 1;
  const out = document.createElement('canvas'); out.width = tw; out.height = th;
  out.getContext('2d').drawImage(cv, -box.left, -box.top);
  return out;
}

function floodBackground(px, w, h, keep, clearHoles) {
  const n = w * h, R = [], G = [], B = [];
  const sample = (x, y) => { const i = (y * w + x) * 4; R.push(px[i]); G.push(px[i + 1]); B.push(px[i + 2]); };
  for (let x = 0; x < w; x += 2) { sample(x, 0); sample(x, h - 1); }
  for (let y = 0; y < h; y += 2) { sample(0, y); sample(w - 1, y); }
  const median = (a) => a.slice().sort((p, q) => p - q)[a.length >> 1];
  const r = median(R), g = median(G), b = median(B);
  const spread = median(R.map((v, i) => Math.abs(v - r) + Math.abs(G[i] - g) + Math.abs(B[i] - b)));
  if (spread > 40) throw new CutoutError('That photo has a busy background. Use a flat photo of the whole item on a plain background.');
  const tol = Math.min(70, 42 + spread * 2);

  const isBack = (i) => Math.abs(px[i * 4] - r) + Math.abs(px[i * 4 + 1] - g) + Math.abs(px[i * 4 + 2] - b) < tol;
  const seen = new Uint8Array(n), stack = new Int32Array(n);
  let top = 0;
  const push = (i) => { if (!seen[i] && isBack(i)) { seen[i] = 1; stack[top++] = i; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (top) {
    const i = stack[--top], x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < n - w) push(i + w);
  }
  // Lenses are see-through, so background colour inside the frame is removed as well.
  for (let i = 0; i < n; i++) keep[i] = seen[i] || (clearHoles && isBack(i)) ? 0 : 1;
}

// Keeps the biggest connected shape, which drops specks, tags and shadows.
function largestShape(keep, w, h) {
  const n = w * h, label = new Int32Array(n), stack = new Int32Array(n);
  let best = { count: 0 }, id = 0;
  for (let start = 0; start < n; start++) {
    if (!keep[start] || label[start]) continue;
    id++;
    let top = 0, count = 0, left = w, right = 0, up = h, down = 0;
    stack[top++] = start; label[start] = id;
    while (top) {
      const i = stack[--top], x = i % w, y = (i - x) / w;
      count++;
      if (x < left) left = x; if (x > right) right = x;
      if (y < up) up = y; if (y > down) down = y;
      const go = (j) => { if (keep[j] && !label[j]) { label[j] = id; stack[top++] = j; } };
      if (x > 0) go(i - 1);
      if (x < w - 1) go(i + 1);
      if (i >= w) go(i - w);
      if (i < n - w) go(i + w);
    }
    if (count > best.count) best = { id, count, left, right, top: up, bottom: down };
  }
  for (let i = 0; i < n; i++) keep[i] = label[i] === best.id ? 1 : 0;
  return best;
}

function spanReader(cutout, lengthCm) {
  const w = cutout.width, h = cutout.height, pxPerCm = h / lengthCm;
  const a = cutout.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  return (yCm) => {
    const y = Math.min(h - 1, Math.max(0, Math.round(yCm * pxPerCm)));
    let l = w, r = -1;
    for (let x = 0; x < w; x++) if (a[(y * w + x) * 4 + 3] > 127) { if (x < l) l = x; r = x; }
    return r < 0 ? { half: 0, mid: w / 2 } : { half: (r - l + 1) / 2 / pxPerCm, mid: (l + r + 1) / 2 };
  };
}

function layOnSheet(cutout, lengthCm, centrePx) {
  const sheet = document.createElement('canvas');
  sheet.width = SHEET_W_CM * PX_PER_CM; sheet.height = (lengthCm + 3) * PX_PER_CM;
  const scale = PX_PER_CM / (cutout.height / lengthCm);
  sheet.getContext('2d').drawImage(cutout, sheet.width / 2 - centrePx * scale, 0, cutout.width * scale, cutout.height * scale);
  return sheet;
}

// A T-shirt: the chest is measured below the sleeves, and the armpit is where the sleeves end.
function topFromCutout(cutout, lengthCm) {
  const span = spanReader(cutout, lengthCm);
  const lower = span(lengthCm * .7), chestW = Math.max(lower.half, 8);
  let armpit = lengthCm * .3;
  for (let y = 4; y < lengthCm * .6; y += 1) if (span(y).half <= chestW * 1.12) { armpit = y; }
  for (let y = lengthCm * .6; y > 4; y -= 1) if (span(y).half > chestW * 1.12) { armpit = y + 1; break; }
  return { sheet: layOnSheet(cutout, lengthCm, lower.mid), cut: { chestW, armpit } };
}

// Measures the cut-out at a known length and lays it on the sheet the fitting code expects.
function dressFromCutout(cutout, lengthCm) {
  const span = spanReader(cutout, lengthCm);

  // The waist is the narrowest row in the upper body.
  let waist = 38, narrow = Infinity;
  for (let y = lengthCm * .22; y <= lengthCm * .5; y += 1) {
    const s = span(y).half;
    if (s > 0 && s < narrow) { narrow = s; waist = y; }
  }
  const bust = Math.max(10, waist - 14), hip = Math.min(lengthCm - 6, waist + 18);
  const waistW = Math.max(narrow, 6);
  const bustW = Math.min(Math.max(span(bust).half, waistW), waistW * 1.5);   // sleeves must not set the bust
  const hipW = Math.max(span(hip).half, waistW);
  let hemW = hipW * .8;   // a curved hem only reaches the last row at its centre, so look a little higher too
  for (let y = lengthCm - 7; y < lengthCm; y += 1) hemW = Math.max(hemW, span(y).half);
  const strapOut = clamp(span(1.5).half, 6, bustW);

  const sheet = layOnSheet(cutout, lengthCm, span(waist).mid);
  return { sheet, cut: { neck: 12, strapIn: strapOut * .7, strapOut, bust, waist, hip, bustW, waistW, hipW, hemW } };
}
