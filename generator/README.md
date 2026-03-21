# Box50 Generator

This folder contains the first TypeScript implementation of the Box50 generator.

Current scope:
- Box50 dimension calculations
- Type A / Type B parameter handling
- SVG layout export for sheet estimation
- SVG cut export foundation
- CLI generation from terminal arguments

Current limitations:
- Finger-joint geometry is not generated yet
- Divider placement is not generated yet
- DXF export is not generated yet
- Sliding lid rail production geometry is not generated yet

## Commands

Install dependencies:

```bash
npm install
```

Build the generator:

```bash
npm run build
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

## Notes

The current layout SVG is a material-layout view:
- it shows the placed parts
- it shows the required sheet envelope
- it helps estimate the minimum plate size required
- it uses numbered markers and an external legend so text does not sit inside the cut geometry

The current cut SVG is the first fabrication-oriented foundation: it outputs only closed panel contours without annotations.

Currently implemented in cut mode:
- rectangular lid contour
- Type A vertical wall finger-joints using a 12.5 mm pitch convention
- Type A wall-to-bottom joints on the lower wall edges
- Type A bottom panel with matching tenon edges
- Type A side-panel rail slots as closed rectangular cuts
- Type A front/back mortise grid at 25 mm spacing
- first removable Type A divider template with side tenons
- automatic geometry validation during project generation

Still missing:
- top and bottom wall finger-joints
- divider placement presets and counts
- final sliding-lid rail profile
- kerf compensation in exported contours
- stronger topology validation beyond bounds and numeric checks

Legacy compatibility:
- `--mode preview` is accepted as an alias for `--mode layout`
- `--mode production` is accepted as an alias for `--mode cut`