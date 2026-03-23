# Box50 Generator

This folder contains the first TypeScript implementation of the Box50 generator.

Current scope:
- Box50 dimension calculations
- Standard / Preset parameter handling
- Multi-plan fabrication output for split materials
- SVG layout export for sheet estimation
- SVG cut export foundation
- CLI generation from terminal arguments
- Programmatic Standard separator layouts with primary/secondary dividers

Current limitations:
- Finger-joint geometry is not yet complete on every potential edge convention
- CLI layout authoring is not implemented yet
- DXF export is not generated yet
- filler and multi-plan authoring is intended to flow through full project config JSON rather than dedicated CLI flags

## Commands

Install dependencies:

```bash
npm install
```

Build the generator:

```bash
npm run build
```

Run the automated tests:

```bash
npm test
```

Generate a layout SVG:

```bash
npm run generate -- --type standard --w 2 --d 4 --h 2 --mode layout --out output/box50-100x200x100-standard-layout.svg
```

Generate a cut SVG foundation:

```bash
node dist/cli.js --type standard --w 2 --d 4 --h 2 --mode cut --out output/box50-100x200x100-standard-cut.svg
```

Custom output path:

```bash
npm run generate -- --type preset --w 2 --d 2 --h 1 --mode layout --out output/box50-100x100x50-preset-layout.svg
```

Generate from a Standard layout JSON file:

```bash
npm run generate -- --type standard --w 2 --d 4 --h 2 --layout-json layouts/bento.json --mode cut --out output/box50-bento-cut.svg
```

Generate from a full project config JSON file:

```bash
npm run generate -- --type standard --w 3 --d 4 --h 2 --config-json configs/fillers-2mm.json --mode cut --out output/
```

## Notes

The current layout SVG is a material-layout view:
- it shows the placed parts
- it shows the required sheet envelope
- it helps estimate the minimum plate size required
- it uses numbered markers and an external legend so text does not sit inside the cut geometry

The current cut SVG is the first fabrication-oriented foundation: it outputs only closed panel contours without annotations and applies kerf compensation at export time.

The upper wall edges stay straight by design in the current Standard model so the sliding-lid opening remains unobstructed.

Currently implemented in cut mode:
- kerf compensation using the configured kerf value
- rectangular lid contour
- Standard vertical wall finger-joints using a 12.5 mm pitch convention
- Standard wall-to-bottom joints on the lower wall edges
- Standard bottom panel with matching tenon edges
- Standard side-panel rail profile as a stepped loading-pocket cut
- default removable Standard divider with side tenons when no explicit layout is provided
- programmatic Standard layouts with traversing primary separators, partial secondary separators, bottom mortises, primary mortises, and secondary edge tenons
- wall-lock mortises for separators that reach a box wall
- filler plates routed to dedicated fabrication plans with their own material thickness and kerf
- automatic geometry validation during project generation

Current Standard layout validation includes:
- minimum separator span length
- minimum spacing between parallel separator axes
- reciprocal declaration of separator joints
- minimum spacing between multiple secondary joints on one primary

Still missing:
- configurable wall-lock profiles beyond the current rectangular mortise convention
- additional topology validation beyond the current orthogonal/self-intersection checks

CLI notes:
- `--config-json` loads and merges a full project config, including fillers and extra fabrication plans
- `--layout-json` loads a JSON file matching the programmatic `StandardLayoutDefinition` shape
- `--layout-json` is supported only for `--type standard`
- when a project produces multiple fabrication plans, the CLI writes one SVG file per plan; in that case `--out` must point to a directory

Legacy compatibility:
- `--mode preview` is accepted as an alias for `--mode layout`
- `--mode production` is accepted as an alias for `--mode cut`