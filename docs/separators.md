# Separators — Box50

## Standard (removable)
Tenons:
- 2.9 mm × 3–3.5 mm

Mortises:
- 3.1 mm × 4–5 mm
- 25 mm spacing

Optional bottom grooves.

Normative rules for the first production SVG phase:
- The first production SVG implementation includes one default removable divider spanning the internal depth.
- Divider body height is Hint − 0.5 mm.
- Divider side tenons are 2.9 mm deep and 3.5 mm high.
- Divider tenon bottom edge is positioned 3 mm above the divider bottom edge.
- Bottom grooves remain optional and excluded from the first production SVG milestone.

Normative rules for the first programmable Standard layout phase:
- A Standard layout may declare primary and secondary separators in the internal coordinate frame.
- A primary separator is always traversing across the full internal axis in its orientation.
- A secondary separator may be partial.
- Every separator keeps a bottom joint in V1.
- Bottom anchoring is generated as rectangular mortises in the bottom panel.
- Primary separators receive separator-to-separator mortises.
- Secondary separators receive the corresponding edge tenons.
- In V1, a secondary separator must meet its primary separator at its start edge or end edge.
- When a separator reaches a box wall, the corresponding wall-lock mortise is generated in that wall panel.
- Every separator span must be at least 30 mm.
- Parallel separator axes must remain at least 18 mm apart.
- A declared separator-to-separator joint must be present on both participating separators.
- A secondary separator without any separator joint must reach both walls in its axis.
- Multiple secondary joints on the same primary separator must remain at least 24 mm apart.

## Preset (fixed)
- Finger‑jointed
- Game-specific

Normative rule:
- Preset separator geometry is out of scope for the first production SVG milestone.