// Cloud build (Vercel runs this; see vercel.json): copy the three.js files the
// labs import from node_modules into public/vendor, which the CDN serves.
// Locally server.js serves them straight from node_modules instead.
import { cpSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'node_modules/three'), OUT = join(ROOT, 'public/vendor/three');
rmSync(OUT, { recursive: true, force: true });
for (const f of ['build/three.module.js', 'examples/jsm/controls/OrbitControls.js', 'examples/jsm/environments/RoomEnvironment.js',
  'examples/jsm/geometries/RoundedBoxGeometry.js', 'examples/jsm/renderers/CSS2DRenderer.js']) cpSync(join(SRC, f), join(OUT, f));
console.log('public/vendor/three ready');
