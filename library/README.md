# Box Library

This folder stores pre-generated Box50 outputs.

## Structure

- type-a/: universal boxes, grouped by external size
- type-b/: game-specific boxes, grouped by publisher then game

## Why this layout

Type A boxes are dimension-driven, so size is the natural entry point.

Type B boxes are looked up primarily by the specific game. Using publisher as the first grouping avoids a flat directory with hundreds of game names, while staying less subjective than classifying by game genre.

If genre browsing becomes useful later, it should be added through metadata or an index, not as the primary folder structure.