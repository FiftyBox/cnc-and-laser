# Box50 — Technical Specification v1.0

## 1. External Dimensions
Lext = 50 × n
Pext = 50 × m
Hext = 50 × h

## 2. Material
3 mm MDF or plywood.

## 3. Internal Dimensions
Lint = Lext − 6 mm
Pint = Pext − 6 mm
Hint ≈ Hext − 9.3 mm

## 4. Assembly
Rectangular finger joints:
- Tenon: 2.9 mm
- Mortise: 3.1 mm
- Depth: 3 mm

## 5. Sliding Lid
Rail:
- 3.1 mm width
- 3.2 mm height
- 3 mm from top

Lid:
- Width = Lint
- Depth = Pext
- Thickness = 3 mm

## 6. Box Types
### Standard
- Mortises every 25 mm
- Optional bottom grooves
- Removable dividers

### Preset
- No generic mortises
- Fixed dividers only

## 7. Divider Systems
### Standard removable
- Tenons 2.9 mm
- Mortises 3.1 mm
- 25 mm spacing

### Preset fixed
- Finger-jointed mini-panels

## 8. Modules
50×50, 50×100, 100×100, 100×200, etc.

## 9. Tolerances
Kerf = ~0.1 mm
Divider clearance = 0.5 mm
Lid clearance = 0.2–0.3 mm

## 10. Normative Geometry Rules for Standard SVG Production

The following rules define the first production-oriented geometry model for Standard boxes.

### 10.1 Scope
- Applies to Standard boxes only.
- Applies to SVG production output.
- DXF export is out of scope for this phase.
- Optional bottom grooves are out of scope for this phase.

### 10.2 Reference Box
- The reference validation case is 100×200×100 Standard.
- All new geometry rules must be validated against this box before being generalized.

### 10.3 Nominal Dimensions
- Dimensions in this specification are nominal design dimensions in millimeters.
- External dimensions remain exact multiples of 50 mm.
- Internal dimensions remain derived from the formulas in section 3.
- Nominal panel geometry remains the design reference for Box50 dimensions.
- SVG cut output applies automatic kerf compensation to exported contours.
- Outer contours are offset outward by half the configured kerf.
- Internal cut contours are offset inward by half the configured kerf.

### 10.4 Production SVG Output
- Production SVG files must contain only fabrication geometry.
- No text, labels, guides, decorative fills, or preview overlays may appear in production output.
- Each exported part must be represented by one or more closed cut paths.
- Kerf compensation is applied at SVG cut export time, not by modifying the nominal project dimensions.

### 10.5 Panel Set
- Standard production output must include: bottom, front, back, left, right, lid.
- Front and back panels share the same nominal geometry.
- Left and right panels share the same nominal geometry.
- Lid width is equal to Lint.
- Lid depth is equal to Pext.

### 10.6 Finger-Joint Convention
- Finger joints are rectangular.
- Tenon nominal width is 2.9 mm.
- Mortise nominal width is 3.1 mm.
- Joint depth is 3 mm.
- The first production SVG uses a fixed joint pitch of 12.5 mm on implemented edges.
- The alternation starts from the reference start of each edge and repeats every 12.5 mm.
- Left and right side panels carry the outward tenon pattern on both vertical edges.
- Front and back panels carry the matching inward mortise pattern on both vertical edges.
- Front, back, left, and right wall panels carry inward mortise patterns on their bottom edge.
- The bottom panel carries the matching outward tenon pattern on all four edges.
- Top wall edges remain straight by design so the sliding-lid opening stays unobstructed.
- The first production SVG joint implementation is normative for Standard until a later revision replaces it.

### 10.7 Divider Mortise Convention
- Standard divider mortises are spaced on a 25 mm grid.
- In the first production SVG implementation, front and back panels receive rectangular mortise slots.
- Mortise slot width is 3.1 mm.
- Mortise slot height is 4.5 mm.
- Mortise slot centers are aligned at x = 25 mm, then every 25 mm until the last center strictly inside the panel width.
- Mortise slots are placed on a common horizontal line near the bottom of the panel.
- The mortise slot bottom edge is positioned 6 mm above the bottom outer edge of the panel.
- This mortise-grid convention is normative for the first Standard removable-divider implementation.

### 10.9 First Removable Divider Convention
- The first production SVG implementation includes one default removable divider for Standard.
- The divider spans the internal depth of the box.
- Divider body height is Hint − divider clearance.
- Divider side tenons are rectangular.
- Tenon depth is 2.9 mm.
- Tenon height is 3.5 mm.
- Tenon bottom edge is positioned 3 mm above the bottom edge of the divider.
- Divider tenons are placed on the left and right edges only in this phase.
- This divider is the normative first removable-divider geometry for Standard production SVG output.

### 10.8 Sliding Lid Convention
- Rail nominal width is 3.1 mm.
- Rail nominal height is 3.2 mm.
- Rail offset is 3 mm from the top edge.
- Rail nominal length is Pext − 3 mm.
- In the current production SVG implementation, the rail is represented as a closed stepped slot on left and right side panels.
- The groove top offset is measured from the top outer edge of the side panel.
- The running groove height is 3.2 mm.
- The running groove starts after the side-panel leading material margin and stops 3 mm before the opposite end.
- A loading pocket is added at the leading end of the groove.
- The loading pocket length is 6 mm.
- The loading pocket extends 3 mm deeper than the running groove.
- This stepped loading-pocket representation is the normative Standard rail profile for the current production SVG phase.