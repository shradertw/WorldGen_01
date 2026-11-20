# WorldGen_01

A world generator that builds believable terrain from a seed and a few simple rules.

## How a map is made

1. **Continents.** Warped noise decides where land and ocean basins go. Sea level is set so a fixed share of the map is land.
2. **Mountain belts.** Ridged noise draws long chains, and only inland areas rise.
3. **Uplift and rain.** Over many steps, mountain belts are pushed up while water wears the land down. Places where more water collects cut down faster (the stream power law). This carves valleys, ridges and branching river networks.
4. **Coarse to fine.** The steps run on a 256-cell grid, then 512, then 1024, adding finer detail each time.
5. **Water.** Every cell drains to its lowest neighbour. Enough drainage makes a river, and closed basins fill into lakes.

The same seed always gives the same map. All seed-dependent math uses integer hashing and basic arithmetic, so results match across browsers.

## Running it

- **Online:** GitHub Pages serves the `dev` branch.
- **Locally:** serve the folder with any static server (for example `python3 -m http.server`) and open `index.html`. Opening the file directly doesn't work, because browsers block modules on `file://`.
- **Seed in the address:** `index.html?seed=hello`

## Layout

| Path | What it holds |
| --- | --- |
| `src/core/` | Seeded hash, noise, min-heap |
| `src/gen/params.js` | All tunable settings and their units |
| `src/gen/terrain.js` | Continents, mountain belts, uplift, detail noise |
| `src/gen/erosion.js` | Ocean, drainage routing, erosion, slope smoothing |
| `src/gen/generate.js` | The pipeline; `generate(seed)` returns the finished map |
| `src/gen/worker.js` | Runs generation off the page's main thread |
| `src/view/` | Map colours, hillshade, page controls |
| `tools/shot.py` | Headless screenshots of chosen seeds for review |

## Output

`generate(seed)` returns typed arrays on a square grid: `height` (m), `ocean` (0/1), `area` (km² draining through each cell) and `lake` (water depth, m), plus `cellKm` and `worldKm`.
