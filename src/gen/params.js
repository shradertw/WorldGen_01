// Default generator settings. Units: km for distance, m for height,
// "steps" for erosion time.

export const DEFAULTS = {
  size: 1024,          // final grid cells per side
  worldKm: 200,        // map width in km
  landFraction: 0.38,  // share of the map above sea level

  // Continents
  continentFreq: 2.6,  // continent-scale noise frequency (cycles per map)
  warp: 0.18,          // domain warp strength (bends coastlines)
  edgeStart: 0.62,     // where the map edge starts pulling land under the sea
  edgeDrop: 1.1,
  landScale: 900,      // m of height per unit of continent noise above sea level
  oceanScale: 9000,    // m of depth per unit below sea level
  maxDepth: 5000,

  // Mountains: ridged noise gives long chains; they only rise inland
  mountainFreq: 4.2,
  beltLo: 0.42,
  beltHi: 0.82,
  inlandRamp: 0.12,
  mountainInit: 1800,  // starting height of mountain belts (m)

  // Uplift per step (m): keeps mountains rising while rain wears them down
  upliftBase: 0.15,
  upliftMountain: 9,

  // Erosion (stream power law: rate = K * sqrt(drainage area) * slope)
  K: 0.06,
  diffusion: 0.08,     // hillslope smoothing per step (fraction toward neighbour mean)
  talus: 900,          // steepest allowed slope (m per km), about 42 degrees
  fillEps: 0.001,      // m: tiny slope added across filled basins so water keeps moving

  // Coarse-to-fine levels: grid size and erosion steps at each
  levels: [
    { size: 256, steps: 120 },
    { size: 512, steps: 45 },
    { size: 1024, steps: 18 },
  ],
  detailAmp: 40,       // m of fresh noise added at each finer level

  // Output
  riverMinKm2: 40,     // drainage area where a river is drawn
  lakeMinDepth: 1.5,   // m of standing water before a cell counts as lake
};
