# Type A Library

Store universal pre-generated boxes here, grouped by external dimensions.

## Generated Starter Set

The repository currently includes these Type A sizes:

- 50x50x50
- 50x50x100
- 50x50x150
- 50x50x200
- 50x100x50
- 50x100x100
- 50x100x150
- 50x100x200
- 100x100x50
- 100x100x100
- 100x100x150
- 100x100x200
- 100x200x50
- 100x200x100
- 100x200x150
- 100x200x200

## Naming

Directory name:

50x50x50/
100x100x50/
100x200x100/

Recommended contents:

- box50-<L>x<P>x<H>-typeA-layout.svg
- box50-<L>x<P>x<H>-typeA-cut.svg
- box50-<L>x<P>x<H>-typeA.dxf
- README.md

Current generated folders contain:

- an SVG layout export with numbered callouts and external legend
- an SVG kerf-compensated cut export with cut paths only
- a README with dimensions and generation assumptions

Reference layouts may also be stored under:

- examples/

Current reference example:

- examples/bento-3-right-split-150x200x100/

Each folder should describe the box dimensions, internal dimensions, material assumptions, and any generation parameters.