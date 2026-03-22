# Box Library

This folder stores pre-generated Box50 outputs.

## Structure

- standard/: configurable standard boxes, grouped by external size
- templates/: finalized game templates, grouped by publisher then game

## Why this layout

Standard boxes are dimension-driven and configurable, so size is the natural entry point.

Template boxes are looked up primarily by the specific game. Using publisher as the first grouping avoids a flat directory with hundreds of game names, while staying less subjective than classifying by game genre.

If genre browsing becomes useful later, it should be added through metadata or an index, not as the primary folder structure.