// Runs generation off the main thread so the page stays responsive.
import { generate } from './generate.js';

self.onmessage = (e) => {
  const { seed, overrides } = e.data;
  const world = generate(seed, overrides, (p) => self.postMessage({ type: 'progress', p }));
  self.postMessage({ type: 'done', world }, [
    world.height.buffer,
    world.ocean.buffer,
    world.area.buffer,
    world.lake.buffer,
  ]);
};
