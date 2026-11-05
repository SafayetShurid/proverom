#!/usr/bin/env python3
"""Builds the demo two ways from one source:
  dist/standalone/Proverom.html  one self-contained file that opens by double-click
  dist/artifact/                 page plus engine files for publishing
"""
import base64, json, pathlib, shutil

root = pathlib.Path(__file__).parent
src, eng = root / 'src', root / 'engine'
out = root / 'dist'
shutil.rmtree(out, ignore_errors=True)
(out / 'standalone').mkdir(parents=True)
(out / 'artifact' / 'engine').mkdir(parents=True)

ENGINE = ['pose_landmark_lite.tflite', 'pose_solution_packed_assets.data', 'pose_solution_packed_assets_loader.js',
          'pose_solution_simd_wasm_bin.js', 'pose_solution_simd_wasm_bin.wasm', 'pose_web.binarypb']

page = (src / 'page.html').read_text()
app = ''.join((src / f).read_text() + '\n' for f in ['dresses.js', 'fit.js', 'cutout.js', 'app.js'])
pose_js = (eng / 'pose.js').read_text()
assert '</script' not in app and '</script' not in pose_js

def fill(setup):
    return (page.replace('/*__POSE_JS__*/', pose_js)
                .replace('/*__ENGINE_SETUP__*/', setup)
                .replace('/*__APP_JS__*/', app))

# Standalone: the engine travels inside the page as base64 and becomes blob URLs on demand.
data = {n: base64.b64encode((eng / n).read_bytes()).decode() for n in ENGINE}
types = {'.js': 'text/javascript', '.wasm': 'application/wasm'}
setup = '''
const ENGINE_DATA = %s;
const ENGINE_TYPES = %s;
const engineUrls = {};
function ENGINE_URL(name) {
  if (engineUrls[name]) return engineUrls[name];
  const bin = atob(ENGINE_DATA[name]), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const ext = name.slice(name.lastIndexOf('.'));
  return engineUrls[name] = URL.createObjectURL(new Blob([bytes], { type: ENGINE_TYPES[ext] || 'application/octet-stream' }));
}
''' % (json.dumps(data), json.dumps(types))
html = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'
        + fill(setup) + '</body></html>')
(out / 'standalone' / 'Proverom.html').write_text(html)

# Published page: code files sit beside it; model data travels as base64 in JSON, a type artifacts serve.
direct = [n for n in ENGINE if n.endswith(('.js', '.wasm'))]
packed = [n for n in ENGINE if n not in direct]
setup = """
const PHOTO_ONLY = true;
const PACKED = %s, packedUrls = {};
function ENGINE_URL(name) { return packedUrls[name] || 'engine/' + name; }
async function ENGINE_PRELOAD() {
  await Promise.all(PACKED.map(async (name) => {
    const res = await fetch('engine/' + name + '.json');
    if (!res.ok) throw new Error('Could not load ' + name);
    const bin = atob((await res.json()).base64), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    packedUrls[name] = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
  }));
}
""" % json.dumps(packed)
(out / 'artifact' / 'index.html').write_text(fill(setup))
for n in direct:
    shutil.copy(eng / n, out / 'artifact' / 'engine' / n)
for n in packed:
    (out / 'artifact' / 'engine' / (n + '.json')).write_text(json.dumps({'base64': data[n]}))

# Vercel: small hosted site. The tracking engine loads from jsDelivr, pinned to one version.
CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/'
web = out / 'vercel'
web.mkdir()
setup = 'function ENGINE_URL(name) { return %r + name; }' % CDN
html = (page.replace('<script>/*__POSE_JS__*/</script>', '<script src="%spose.js" crossorigin="anonymous"></script>' % CDN)
            .replace('/*__ENGINE_SETUP__*/', setup)
            .replace('<script>/*__APP_JS__*/</script>', '<script src="dresses.js"></script>\n<script src="fit.js"></script>\n<script src="cutout.js"></script>\n<script src="app.js"></script>'))
html = html.replace('<title>Prøverom</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n', '')
(web / 'index.html').write_text('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<title>Prøverom</title>\n</head>\n<body>\n' + html + '\n</body>\n</html>\n')
for f in ['dresses.js', 'fit.js', 'cutout.js', 'app.js']:
    shutil.copy(src / f, web / f)

for p in sorted(out.rglob('*')):
    if p.is_file():
        print(f'{p.stat().st_size / 1e6:7.2f} MB  {p.relative_to(out)}')
