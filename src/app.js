const $ = (id) => document.getElementById(id);
const view = $('view'), stage = $('stage'), statusEl = $('status');
const say = (msg) => { statusEl.textContent = msg; };

/* ---------- WebGL: the camera picture, then the dress on top ---------- */
const gl = view.getContext('webgl2', { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: true });
const VS = `#version 300 es
in vec2 p; in vec2 uv; in float shade; uniform vec2 size; out vec2 v; out float s;
void main(){ v=uv; s=shade; gl_Position=vec4(p.x/size.x*2.-1., 1.-p.y/size.y*2., 0, 1); }`;
const FS = `#version 300 es
precision mediump float; in vec2 v; in float s; uniform sampler2D tex; out vec4 o;
void main(){ vec4 c=texture(tex,v); o=vec4(c.rgb*s,c.a); }`;
function shader(type, src) { const x = gl.createShader(type); gl.shaderSource(x, src); gl.compileShader(x); return x; }
const prog = gl.createProgram();
gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
gl.linkProgram(prog); gl.useProgram(prog);
const STRIDE = 5 * 4;
const aP = gl.getAttribLocation(prog, 'p'), aUv = gl.getAttribLocation(prog, 'uv'), aS = gl.getAttribLocation(prog, 'shade');
const uSize = gl.getUniformLocation(prog, 'size');
const quadBuf = gl.createBuffer(), meshBuf = gl.createBuffer(), idxBuf = gl.createBuffer();
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
const indices = meshIndices();
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
const meshVerts = new Float32Array((ROWS + 1) * (COLS + 1) * 5);
function attrs(buf) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  [[aP, 2, 0], [aUv, 2, 8], [aS, 1, 16]].forEach(([a, n, off]) => { gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, n, gl.FLOAT, false, STRIDE, off); });
}
const bgTex = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, bgTex);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

function dressTexture(canvas) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const ext = gl.getExtension('EXT_texture_filter_anisotropic');
  if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, 8);
  return t;
}

function render(source, w, h, mirror, lm) {
  if (view.width !== w || view.height !== h) { view.width = w; view.height = h; }
  gl.viewport(0, 0, w, h); gl.uniform2f(uSize, w, h);
  gl.disable(gl.BLEND);
  gl.bindTexture(gl.TEXTURE_2D, bgTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  const u0 = mirror ? 1 : 0, u1 = mirror ? 0 : 1;
  attrs(quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, u0, 0, 1, w, 0, u1, 0, 1, 0, h, u0, 1, 1, w, h, u1, 1, 1]), gl.DYNAMIC_DRAW);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  if (!lm) { window.__tryon.fit = null; return; }
  const pts = lm.map((p) => ({ x: (mirror ? 1 - p.x : p.x) * w, y: p.y * h, visibility: p.visibility }));
  const fit = buildMesh(pts, dress, heightCm, meshVerts);
  window.__tryon.fit = { hemY: fit.hemY, h, chain: fit.body.chain, T: fit.body.T, ankleY: pts[27].y };
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.bindTexture(gl.TEXTURE_2D, dress.tex);
  attrs(meshBuf);
  gl.bufferData(gl.ARRAY_BUFFER, meshVerts, gl.DYNAMIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
  gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
}

/* ---------- The mannequin shown before the camera is on ---------- */
const figure = document.createElement('canvas'); figure.width = 880; figure.height = 1100;
const fx = figure.getContext('2d');
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

function mannequinPose(t) {
  const W = figure.width, H = figure.height, tall = H * .86, x0 = W / 2, foot = H * .955;
  const sway = calm ? 0 : Math.sin(t / 1400) * 9, tilt = calm ? 0 : Math.sin(t / 1400) * 7;
  const y = (f) => foot - f * tall;
  const P = (x, f) => ({ x: x / W, y: y(f) / H, visibility: 1 });
  const sw = tall * .115, hw = tall * .062;
  const lm = new Array(33).fill(null).map(() => P(x0, .9));
  const sx = x0 + sway * .5, hx = x0 + sway;
  lm[12] = { ...P(sx - sw, .818), y: (y(.818) + tilt * .3) / H }; lm[11] = { ...P(sx + sw, .818), y: (y(.818) - tilt * .3) / H };
  lm[24] = { ...P(hx - hw, .53), y: (y(.53) - tilt * .3) / H }; lm[23] = { ...P(hx + hw, .53), y: (y(.53) + tilt * .3) / H };
  lm[26] = P(hx - hw * .95, .285); lm[25] = P(hx + hw * .95, .285);
  lm[28] = P(x0 - hw * .85, .04); lm[27] = P(x0 + hw * .85, .04);
  lm[14] = P(sx - sw - 22, .625); lm[13] = P(sx + sw + 22, .625);
  lm[16] = P(sx - sw - 34, .47); lm[15] = P(sx + sw + 34, .47);
  return lm;
}

function drawMannequin(lm) {
  const W = figure.width, H = figure.height, q = (i) => ({ x: lm[i].x * W, y: lm[i].y * H });
  const g = fx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2b2536'); g.addColorStop(.86, '#3a3247'); g.addColorStop(.861, '#231e2c'); g.addColorStop(1, '#1b1722');
  fx.fillStyle = g; fx.fillRect(0, 0, W, H);
  fx.lineCap = 'round'; fx.lineJoin = 'round';
  const skin = '#c9c0ca', limb = (pts, w) => {
    fx.strokeStyle = skin; fx.lineWidth = w; fx.beginPath();
    pts.forEach((p, i) => (i ? fx.lineTo(p.x, p.y) : fx.moveTo(p.x, p.y))); fx.stroke();
  };
  const shoulder = mid(q(11), q(12));
  limb([q(24), q(26), q(28)], 44); limb([q(23), q(25), q(27)], 44);
  limb([q(12), q(14), q(16)], 26); limb([q(11), q(13), q(15)], 26);
  [q(28), q(27)].forEach((a, i) => { fx.fillStyle = skin; fx.beginPath(); fx.ellipse(a.x + (i ? 8 : -8), a.y + 16, 28, 11, 0, 0, 6.3); fx.fill(); });
  fx.fillStyle = skin; fx.beginPath();
  const l = q(11), r = q(12), a = q(23), b = q(24);
  fx.moveTo(r.x, r.y); fx.lineTo(l.x, l.y); fx.lineTo(a.x + 34, a.y); fx.lineTo(b.x - 34, b.y); fx.closePath(); fx.fill();
  limb([{ x: shoulder.x, y: shoulder.y }, { x: shoulder.x, y: shoulder.y - 54 }], 42);
  fx.beginPath(); fx.ellipse(shoulder.x, shoulder.y - 104, 44, 56, 0, 0, 6.3); fx.fill();
  limb([r, l], 30);
}

/* ---------- Catalogue and shop card ---------- */
let dress, heightCm = 168;
window.__tryon = { fit: null };
DRESSES.forEach((d) => { d.sheet = drawDress(d); d.tex = dressTexture(d.sheet); });

function refreshCard() {
  const r = fallsTo(dress.length, heightCm);
  $('name').textContent = dress.name;
  $('blurb').textContent = dress.blurb;
  $('fabric').textContent = dress.fabric;
  $('colour').textContent = dress.colour;
  $('length').textContent = `${dress.length} cm, shoulder to hem`;
  $('onyou').textContent = `Falls ${r.where}, ${r.floorCm} cm off the floor`;
}
function pick(d) {
  dress = d;
  document.querySelectorAll('#rail button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === d.id)));
  $('ownTile').classList.toggle('picked', d.id === 'own');
  $('ownLengthRow').hidden = d.id !== 'own';
  refreshCard();
  if (mode === 'photo') showPhoto();
}
let mode = 'mannequin';
DRESSES.forEach((d) => {
  const b = document.createElement('button');
  b.type = 'button'; b.dataset.id = d.id; b.id = 'dress-' + d.id;
  const thumb = document.createElement('canvas');
  thumb.width = 200; thumb.height = 260;
  const c = thumb.getContext('2d'), s = 260 / ((136 + 3) * PX_PER_CM) * .94;   // same scale, so lengths compare
  const dw = d.sheet.width * s, dh = d.sheet.height * s;
  c.drawImage(d.sheet, (200 - dw) / 2, 8, dw, dh);
  b.append(thumb, d.name);
  b.addEventListener('click', () => pick(d));
  $('rail').append(b);
});

/* ---------- A dress from the visitor's own photo ---------- */
let ownDress, ownCutout;
const ownTile = document.createElement('label');
ownTile.id = 'ownTile';
const ownThumb = document.createElement('canvas');
ownThumb.width = 200; ownThumb.height = 260;
function drawAddSign() {
  const c = ownThumb.getContext('2d');
  c.clearRect(0, 0, 200, 260);
  c.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim();
  c.font = '300 96px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('+', 100, 130);
}
drawAddSign();
const ownInput = document.createElement('input');
ownInput.type = 'file'; ownInput.accept = 'image/*'; ownInput.id = 'ownPhoto';
const ownName = document.createElement('span');
ownName.textContent = 'Add dress';
ownTile.append(ownThumb, ownName, ownInput);
$('rail').append(ownTile);
ownTile.addEventListener('click', (e) => {
  if (ownDress && dress !== ownDress) { e.preventDefault(); pick(ownDress); }
});

function fitOwnDress(lengthCm) {
  const made = dressFromCutout(ownCutout, lengthCm);
  if (ownDress) gl.deleteTexture(ownDress.tex);
  ownDress = { id: 'own', name: 'Your dress', blurb: 'From your photo. It stays on this device.',
    fabric: 'As photographed', colour: 'As photographed', length: lengthCm,
    cut: made.cut, sheet: made.sheet, tex: dressTexture(made.sheet) };
  const c = ownThumb.getContext('2d'), s = 260 / ((136 + 3) * PX_PER_CM) * .94;
  const dw = made.sheet.width * s, dh = made.sheet.height * s;
  c.clearRect(0, 0, 200, 260);
  c.drawImage(made.sheet, (200 - dw) / 2, 8, dw, dh);
  ownName.textContent = 'Yours';
  pick(ownDress);
}
ownInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    ownCutout = cutOutDress(bitmap);
    fitOwnDress(+$('ownLength').value);
    say('Set the dress length so the hem lands in the right place.');
  } catch (err) {
    console.warn(err);
    say(err instanceof CutoutError ? err.message : 'That file could not be opened. Try a JPG or PNG photo.');
  }
});
$('ownLength').addEventListener('input', (e) => {
  $('ownLengthOut').textContent = e.target.value + ' cm';
  if (ownCutout) fitOwnDress(+e.target.value);
});

pick(DRESSES[0]);
$('height').addEventListener('input', (e) => {
  heightCm = +e.target.value; $('heightOut').textContent = heightCm + ' cm'; refreshCard();
  if (mode === 'photo') showPhoto();
});

/* ---------- Mannequin loop ---------- */
let mannequinRunning = false;
function mannequinLoop(t) {
  if (mode !== 'mannequin') { mannequinRunning = false; return; }
  const lm = mannequinPose(t);
  drawMannequin(lm);
  render(figure, figure.width, figure.height, false, lm);
  requestAnimationFrame(mannequinLoop);
}
function showMannequin() {
  stopCamera(); mode = 'mannequin'; stage.classList.remove('photo');
  $('stop').hidden = true; $('flip').hidden = true; say('');
  if (!mannequinRunning) { mannequinRunning = true; requestAnimationFrame(mannequinLoop); }
}

/* ---------- Body tracking ---------- */
let pose, engineReady, onPose = () => {};
function loadEngine() {
  if (engineReady) return engineReady;
  say('Loading body tracking…');
  engineReady = (async () => {
    if (typeof ENGINE_PRELOAD !== 'undefined') await ENGINE_PRELOAD();
    pose = new Pose({ locateFile: (f) => ENGINE_URL(f) });
    pose.setOptions({ modelComplexity: 0, smoothLandmarks: true, enableSegmentation: false, minDetectionConfidence: .5, minTrackingConfidence: .5 });
    pose.onResults((r) => onPose(r));
    await pose.initialize();
  })().catch((e) => { engineReady = null; throw e; });
  return engineReady;
}

/* ---------- Live camera ---------- */
const video = document.createElement('video');
video.playsInline = true; video.muted = true; video.setAttribute('playsinline', '');
let stream, facing = 'user', live = false;
const steady = new Steady();

function stopCamera() {
  live = false; steady.reset();
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = null; video.srcObject = null;
}
function cameraTrouble(e) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return 'This page has no camera access here. Open it from a secure address (https) or from your computer. You can still try a photo.';
  if (e.name === 'NotAllowedError') return 'The camera is blocked here. Allow it in your browser settings, or use a photo instead.';
  if (e.name === 'NotFoundError') return 'No camera found on this device. You can try a photo instead.';
  if (e.name === 'NotReadableError') return 'Another app is using the camera. Close it and try again.';
  return 'The camera or body tracking did not start. Check your connection and try again.';
}
async function openCamera() {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('none');
    stopCamera();
    say('Waiting for the camera…');
    stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } } });
    mode = 'camera'; stage.classList.remove('photo');
    $('stop').hidden = false; $('flip').hidden = false;
    video.srcObject = stream; await video.play();
    await loadEngine();
    say('Step back until your whole body is in frame.');
    live = true;
    onPose = onLiveResult;
    trackLoop();
  } catch (e) {
    console.warn(e);
    showMannequin();
    say(e && e.name ? cameraTrouble(e) : cameraTrouble({}));
  }
}
function coach(lm) {
  if (!lm) return 'Step into the frame so I can find you.';
  if (lm[27].visibility < .5 || lm[28].visibility < .5) return lm[25].visibility < .5
    ? 'Step back. I can only see your upper body, so the hem is an estimate.'
    : 'Step back a little to get your feet in frame and check the hem.';
  return '';
}
function onLiveResult(r) {
  if (!live) return;
  const src = r.image, w = src.width || video.videoWidth, h = src.height || video.videoHeight;
  let lm = r.poseLandmarks || null;
  if (lm) lm = steady.push(lm, performance.now()); else steady.reset();
  render(src, w, h, facing === 'user', lm);
  say(coach(lm));
}
let sentAt = -1;
async function trackLoop() {
  if (!live) return;
  if (video.readyState >= 2 && video.currentTime !== sentAt) {
    sentAt = video.currentTime;
    try { await pose.send({ image: video }); } catch (e) { console.warn(e); }
  }
  requestAnimationFrame(trackLoop);
}
$('camera').addEventListener('click', openCamera);
$('stop').addEventListener('click', showMannequin);
$('flip').addEventListener('click', () => { facing = facing === 'user' ? 'environment' : 'user'; openCamera(); });

/* ---------- Photo ---------- */
let photo, photoPose;
function showPhoto() {
  const scale = Math.min(1, 1600 / Math.max(photo.width, photo.height));
  const w = Math.round(photo.width * scale), h = Math.round(photo.height * scale);
  const flat = document.createElement('canvas'); flat.width = w; flat.height = h;
  flat.getContext('2d').drawImage(photo, 0, 0, w, h);
  render(flat, w, h, false, photoPose);
}
$('photo').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  stopCamera(); mode = 'photo';
  try {
    photo = await createImageBitmap(file, { imageOrientation: 'from-image' });
    await loadEngine();
    say('Finding your body in the photo…');
    const found = new Promise((res) => { onPose = (r) => res(r.poseLandmarks || null); });
    pose.setOptions({ selfieMode: false });
    pose.reset();
    await pose.send({ image: photo });
    photoPose = await found;
    stage.classList.add('photo');
    $('stop').hidden = false; $('flip').hidden = true;
    showPhoto();
    say(photoPose ? coach(photoPose) : 'No person found in this photo. Try one where your whole body is visible.');
  } catch (err) {
    console.warn(err);
    showMannequin();
    say('Body tracking did not load. Check your connection and try again.');
  }
  e.target.value = '';
});

if (typeof PHOTO_ONLY !== 'undefined') {
  $('camera').hidden = true;
  $('photoBtn').classList.add('primary');
  $('hint').textContent = 'This published version tries dresses on a photo. The live camera runs in the standalone page. Use a photo showing your whole body. These dresses are drawn for the demo.';
}
showMannequin();
