# Template Library

Store game-specific pre-generated boxes here.

## Recommended structure

templates/
  <publisher>/
    <game>/

Examples:

- cmon/zombicide-black-plague/
- repos-production/7-wonders-duel/
- stonemaier-games/scythe/

Recommended contents per game:

- box50-<L>x<P>x<H>-template-layout.svg
- box50-<L>x<P>x<H>-template-cut.svg
- box50-<L>x<P>x<H>-template.dxf
- README.md

The README should document the target game, edition if relevant, supported inserts, sleeve assumptions, component-specific constraints, and any engraving or branding assumptions.