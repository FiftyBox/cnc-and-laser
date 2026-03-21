# Box50 Generator

This folder contains the first TypeScript implementation of the Box50 generator.

Current scope:
- Box50 dimension calculations
- Type A / Type B parameter handling
- SVG layout export for sheet estimation
- SVG cut export foundation
- CLI generation from terminal arguments
- Programmatic Type A separator layouts with primary/secondary dividers

Current limitations:
- Finger-joint geometry is not yet complete on every potential edge convention
- CLI layout authoring is not implemented yet
- DXF export is not generated yet

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
npm run generate -- --type A --w 2 --d 4 --h 2 --mode layout --out output/box50-100x200x100-typeA-layout.svg
```

Generate a cut SVG foundation:

```bash
node dist/cli.js --type A --w 2 --d 4 --h 2 --mode cut --out output/box50-100x200x100-typeA-cut.svg
```

Custom output path:

```bash
npm run generate -- --type B --w 2 --d 2 --h 1 --mode layout --out output/box50-100x100x50-typeB-layout.svg
```

Generate from a Type A layout JSON file:

```bash
npm run generate -- --type A --w 2 --d 4 --h 2 --layout-json layouts/bento.json --mode cut --out output/box50-bento-cut.svg
```

## Notes

The current layout SVG is a material-layout view:
- it shows the placed parts
- it shows the required sheet envelope
- it helps estimate the minimum plate size required
- it uses numbered markers and an external legend so text does not sit inside the cut geometry

The current cut SVG is the first fabrication-oriented foundation: it outputs only closed panel contours without annotations and applies kerf compensation at export time.

The upper wall edges stay straight by design in the current Type A model so the sliding-lid opening remains unobstructed.

Currently implemented in cut mode:
- kerf compensation using the configured kerf value
- rectangular lid contour
- Type A vertical wall finger-joints using a 12.5 mm pitch convention
- Type A wall-to-bottom joints on the lower wall edges
- Type A bottom panel with matching tenon edges
- Type A side-panel rail profile as a stepped loading-pocket cut
- legacy removable Type A divider template with side tenons when no explicit layout is provided
- programmatic Type A layouts with traversing primary separators, partial secondary separators, bottom mortises, primary mortises, and secondary edge tenons
- wall-lock mortises for separators that reach a box wall
- automatic geometry validation during project generation

Current Type A layout validation includes:
- minimum separator span length
- minimum spacing between parallel separator axes
- reciprocal declaration of separator joints
- minimum spacing between multiple secondary joints on one primary

Still missing:
- configurable wall-lock profiles beyond the current rectangular mortise convention
- additional topology validation beyond the current orthogonal/self-intersection checks

CLI notes:
- `--layout-json` loads a JSON file matching the programmatic `TypeALayoutDefinition` shape
- `--layout-json` is supported only for `--type A`

Legacy compatibility:
- `--mode preview` is accepted as an alias for `--mode layout`
- `--mode production` is accepted as an alias for `--mode cut`