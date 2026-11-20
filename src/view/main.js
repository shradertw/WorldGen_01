import { renderMap } from './render.js';

const $ = (id) => document.getElementById(id);
const canvas = $('map');
const ctx = canvas.getContext('2d');
const seedBox = $('seed');
const goBtn = $('go');
const info = $('info');
const fill = $('fill');
const layers = { shade: $('shade'), rivers: $('rivers'), water: $('water') };

let world = null;
let image = null;
let worker = null;

function draw() {
  if (!world) return;
  if (!image || image.width !== world.size) {
    canvas.width = canvas.height = world.size;
    image = ctx.createImageData(world.size, world.size);
  }
  renderMap(
    world,
    { shade: layers.shade.checked, rivers: layers.rivers.checked, water: layers.water.checked },
    image,
  );
  ctx.putImageData(image, 0, 0);
}

function run() {
  const seed = seedBox.value.trim() || '1';
  seedBox.value = seed;
  const url = new URL(location.href);
  url.searchParams.set('seed', seed);
  history.replaceState(null, '', url);

  if (worker) worker.terminate();
  worker = new Worker(new URL('../gen/worker.js', import.meta.url), { type: 'module' });
  goBtn.disabled = true;
  fill.style.width = '0%';
  document.body.dataset.state = 'busy';
  worker.onmessage = (e) => {
    const m = e.data;
    if (m.type === 'progress') {
      fill.style.width = `${(m.p * 100).toFixed(1)}%`;
    } else if (m.type === 'done') {
      world = m.world;
      draw();
      goBtn.disabled = false;
      fill.style.width = '0%';
      info.textContent = `${(world.ms / 1000).toFixed(1)} s`;
      document.body.dataset.state = 'done';
    }
  };
  worker.onerror = (err) => {
    goBtn.disabled = false;
    info.textContent = 'Error';
    document.body.dataset.state = 'error';
    console.error(err);
  };
  worker.postMessage({ seed, overrides: {} });
}

function randomSeed() {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return String(n[0] % 1000000);
}

canvas.addEventListener('mousemove', (e) => {
  if (!world) return;
  const r = canvas.getBoundingClientRect();
  const x = Math.floor(((e.clientX - r.left) / r.width) * world.size);
  const y = Math.floor(((e.clientY - r.top) / r.height) * world.size);
  if (x < 0 || y < 0 || x >= world.size || y >= world.size) return;
  const i = y * world.size + x;
  const km = (v) => (v * world.cellKm).toFixed(1);
  const h = Math.round(world.height[i]);
  info.textContent = `${km(x)}, ${km(y)} km · ${h} m`;
});
canvas.addEventListener('mouseleave', () => {
  if (world) info.textContent = `${(world.ms / 1000).toFixed(1)} s`;
});

goBtn.addEventListener('click', run);
seedBox.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') run();
});
$('dice').addEventListener('click', () => {
  seedBox.value = randomSeed();
  run();
});
for (const el of Object.values(layers)) el.addEventListener('change', draw);

seedBox.value = new URL(location.href).searchParams.get('seed') || '1';
run();
