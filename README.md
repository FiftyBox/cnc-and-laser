# Box50 — Open Standard for Modular CNC/Laser-Cut Boxes

Box50 is an open, modular standard for CNC/laser‑cut boxes made from 3mm MDF/Plywood, designed for storing board‑game components, hobby items, and any other small objects.

The system is:
- Modular (external dimensions are 50 mm multiples)
- Maker-friendly (laser/CNC compatible)
- Flexible (Type A: universal boxes)
- Optimized (Type B: game-specific boxes)
- Secure (sliding-lid system)

See the docs/ directory for full details.

## Features
- 50 mm grid external sizes (width, depth, height)
- Rectangular finger-joint assembly
- Sliding-lid system with dual rails
- Universal (Type A) or specific (Type B) designs
- Modular inserts (cards, tokens, dice…)
- Fully documented formulas
- Generator-ready architecture

## Library

Pre-generated boxes are stored in library/:
- Type A boxes are grouped by external size
- Type B boxes are grouped by publisher, then by game

This keeps universal boxes easy to browse by dimensions, and game-specific boxes easy to find by their canonical commercial name.

## License
MIT License. See LICENSE.

## Version
Box50 Standard v1.0
