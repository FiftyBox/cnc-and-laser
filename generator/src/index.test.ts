import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateDimensions,
  createRectanglePath,
  createDefaultConfig,
  createProject,
  createStandardRailProfilePath,
  offsetOrthogonalClosedPath,
  renderProjectSvg,
  renderProjectSvgWithMode,
  validateConfig,
  validatePanelGeometry,
} from "./index.js";

test("calculateDimensions computes external and internal dimensions for Standard", () => {
  const config = createDefaultConfig({
    type: "standard",
    widthUnits: 2,
    depthUnits: 4,
    heightUnits: 2,
  });

  const dimensions = calculateDimensions(config);

  assert.deepEqual(dimensions, {
    externalWidth: 100,
    externalDepth: 200,
    externalHeight: 100,
    internalWidth: 94,
    internalDepth: 194,
    internalHeight: 90.75,
  });
});

test("validateConfig rejects non-positive unit counts", () => {
  const config = createDefaultConfig({
    type: "standard",
    widthUnits: 0,
    depthUnits: 2,
    heightUnits: 1,
  });

  assert.throws(
    () => validateConfig(config),
    /widthUnits, depthUnits, and heightUnits must be positive integers/,
  );
});

test("createProject builds expected Standard panel set with internal cuts", () => {
  const project = createProject(createDefaultConfig({
    type: "standard",
    widthUnits: 2,
    depthUnits: 4,
    heightUnits: 2,
  }));

  assert.equal(project.fileStem, "box50-100x200x100-standard");
  assert.equal(project.panels.length, 5);
  assert.equal(project.panelGeometries.length, 5);

  const bottom = project.panelGeometries.find((panel) => panel.name === "bottom");
  const frontBack = project.panelGeometries.find((panel) => panel.name === "front-back");
  const leftRight = project.panelGeometries.find((panel) => panel.name === "left-right");
  const divider = project.panelGeometries.find((panel) => panel.name === "divider-depth-template");

  assert.ok(bottom);
  assert.ok(frontBack);
  assert.ok(leftRight);
  assert.ok(divider);

  assert.equal(bottom.quantity, 1);
  assert.equal(bottom.cutPaths.length, 1);
  assert.equal(frontBack.quantity, 2);
  assert.equal(frontBack.cutPaths.length, 1);
  assert.equal(leftRight.quantity, 2);
  assert.equal(leftRight.cutPaths.length, 2);
  assert.equal(divider.quantity, 1);
  assert.equal(divider.cutPaths.length, 1);
});

test("createProject builds Standard layout separators and bottom mortises from a bento layout", () => {
  const project = createProject(createDefaultConfig({
    type: "standard",
    widthUnits: 2,
    depthUnits: 4,
    heightUnits: 2,
    standardLayout: {
      id: "bento-3-right-split",
      kind: "standard-layout",
      referenceFrame: "internal",
      separators: [
        {
          id: "main-vertical",
          orientation: "vertical",
          role: "primary",
          position: 60,
          spanStart: 0,
          spanEnd: 194,
          bottomJoint: {
            enabled: true,
            tenonDepth: 2.9,
            tenonHeight: 3.5,
          },
          crossJoints: [
            {
              with: "right-horizontal",
              mode: "mortise-primary-tenon-secondary",
            },
          ],
        },
        {
          id: "right-horizontal",
          orientation: "horizontal",
          role: "secondary",
          position: 97,
          spanStart: 60,
          spanEnd: 94,
          bottomJoint: {
            enabled: true,
            tenonDepth: 2.9,
            tenonHeight: 3.5,
          },
          crossJoints: [
            {
              with: "main-vertical",
              mode: "mortise-primary-tenon-secondary",
            },
          ],
        },
      ],
    },
  }));

  assert.equal(project.panels.length, 6);
  assert.equal(project.panelGeometries.length, 6);

  const bottom = project.panelGeometries.find((panel) => panel.name === "bottom");
  const frontBack = project.panelGeometries.find((panel) => panel.name === "front-back");
  const leftRight = project.panelGeometries.find((panel) => panel.name === "left-right");
  const primarySeparator = project.panelGeometries.find((panel) => panel.name === "separator:main-vertical");
  const secondarySeparator = project.panelGeometries.find((panel) => panel.name === "separator:right-horizontal");
  const legacyDivider = project.panelGeometries.find((panel) => panel.name === "divider-depth-template");

  assert.ok(bottom);
  assert.ok(frontBack);
  assert.ok(leftRight);
  assert.ok(primarySeparator);
  assert.ok(secondarySeparator);
  assert.equal(legacyDivider, undefined);

  assert.equal(bottom.cutPaths.length, 5);
  assert.equal(frontBack.cutPaths.length, 2);
  assert.equal(leftRight.cutPaths.length, 3);
  assert.equal(primarySeparator.cutPaths.length, 2);
  assert.equal(secondarySeparator.cutPaths.length, 1);
});

test("Standard layout separators with bottom mortises generate real bottom tenons", () => {
  const project = createProject(createDefaultConfig({
    type: "standard",
    widthUnits: 2,
    depthUnits: 4,
    heightUnits: 2,
    standardLayout: {
      id: "bento-3-right-split",
      kind: "standard-layout",
      referenceFrame: "internal",
      separators: [
        {
          id: "main-vertical",
          orientation: "vertical",
          role: "primary",
          position: 60,
          spanStart: 0,
          spanEnd: 194,
          bottomJoint: {
            enabled: true,
            tenonDepth: 2.9,
            tenonHeight: 3.5,
          },
          crossJoints: [
            {
              with: "right-horizontal",
              mode: "mortise-primary-tenon-secondary",
            },
          ],
        },
        {
          id: "right-horizontal",
          orientation: "horizontal",
          role: "secondary",
          position: 97,
          spanStart: 60,
          spanEnd: 94,
          bottomJoint: {
            enabled: true,
            tenonDepth: 2.9,
            tenonHeight: 3.5,
          },
          crossJoints: [
            {
              with: "main-vertical",
              mode: "mortise-primary-tenon-secondary",
            },
          ],
        },
      ],
    },
  }));

  const separator = project.panelGeometries.find((panel) => panel.name === "separator:right-horizontal");

  assert.ok(separator);

  const outerPath = separator.cutPaths[0];
  assert.ok(outerPath);
  const maxY = Math.max(...outerPath.points.map((point) => point.y));
  const pointsBelowBottomEdge = outerPath.points.filter((point) => point.y > separator.height);

  assert.equal(maxY, separator.height + 2.9);
  assert.ok(pointsBelowBottomEdge.length > 0);
  assert.ok(pointsBelowBottomEdge.some((point) => point.x > 0 && point.x < separator.width));
});

test("createProject rejects non-traversing primary separators in Standard layouts", () => {
  assert.throws(
    () => createProject(createDefaultConfig({
      type: "standard",
      widthUnits: 2,
      depthUnits: 4,
      heightUnits: 2,
      standardLayout: {
        id: "invalid-layout",
        kind: "standard-layout",
        referenceFrame: "internal",
        separators: [
          {
            id: "bad-main",
            orientation: "vertical",
            role: "primary",
            position: 60,
            spanStart: 20,
            spanEnd: 150,
            bottomJoint: {
              enabled: true,
              tenonDepth: 2.9,
              tenonHeight: 3.5,
            },
          },
        ],
      },
    })),
    /must be traversing/,
  );
});

test("createProject rejects Standard separators with spans shorter than the mechanical minimum", () => {
  assert.throws(
    () => createProject(createDefaultConfig({
      type: "standard",
      widthUnits: 2,
      depthUnits: 4,
      heightUnits: 2,
      standardLayout: {
        id: "invalid-short-secondary",
        kind: "standard-layout",
        referenceFrame: "internal",
        separators: [
          {
            id: "main-vertical",
            orientation: "vertical",
            role: "primary",
            position: 60,
            spanStart: 0,
            spanEnd: 194,
            bottomJoint: {
              enabled: true,
              tenonDepth: 2.9,
              tenonHeight: 3.5,
            },
            crossJoints: [
              {
                with: "short-secondary",
                mode: "mortise-primary-tenon-secondary",
              },
            ],
          },
          {
            id: "short-secondary",
            orientation: "horizontal",
            role: "secondary",
            position: 97,
            spanStart: 60,
            spanEnd: 84,
            bottomJoint: {
              enabled: true,
              tenonDepth: 2.9,
              tenonHeight: 3.5,
            },
            crossJoints: [
              {
                with: "main-vertical",
                mode: "mortise-primary-tenon-secondary",
              },
            ],
          },
        ],
      },
    })),
    /span must be at least 30 mm/,
  );
});

test("createProject rejects parallel Standard separators that are too close", () => {
  assert.throws(
    () => createProject(createDefaultConfig({
      type: "standard",
      widthUnits: 4,
      depthUnits: 4,
      heightUnits: 2,
      standardLayout: {
        id: "invalid-parallel-gap",
        kind: "standard-layout",
        referenceFrame: "internal",
        separators: [
          {
            id: "main-a",
            orientation: "vertical",
            role: "primary",
            position: 60,
            spanStart: 0,
            spanEnd: 194,
            bottomJoint: {
              enabled: true,
              tenonDepth: 2.9,
              tenonHeight: 3.5,
            },
          },
          {
            id: "main-b",
            orientation: "vertical",
            role: "primary",
            position: 72,
            spanStart: 0,
            spanEnd: 194,
            bottomJoint: {
              enabled: true,
              tenonDepth: 2.9,
              tenonHeight: 3.5,
            },
          },
        ],
      },
    })),
    /too close on parallel axes/,
  );
});

test("createProject rejects non-reciprocal Standard joints", () => {
  assert.throws(
    () => createProject(createDefaultConfig({
      type: "standard",
      widthUnits: 2,
      depthUnits: 4,
      heightUnits: 2,
      standardLayout: {
        id: "invalid-non-reciprocal-joint",
        kind: "standard-layout",
        referenceFrame: "internal",
        separators: [
          {
            id: "main-vertical",
            orientation: "vertical",
            role: "primary",
            position: 60,
            spanStart: 0,
            spanEnd: 194,
            bottomJoint: {
              enabled: true,
              tenonDepth: 2.9,
              tenonHeight: 3.5,
            },
            crossJoints: [
              {
                with: "right-horizontal",
                mode: "mortise-primary-tenon-secondary",
              },
            ],
          },
          {
            id: "right-horizontal",
            orientation: "horizontal",
            role: "secondary",
            position: 97,
            spanStart: 60,
            spanEnd: 94,
            bottomJoint: {
              enabled: true,
              tenonDepth: 2.9,
              tenonHeight: 3.5,
            },
          },
        ],
      },
    })),
    /must be declared on both separators/,
  );
});

test("createProject rejects primary separators with joints that are too tightly packed", () => {
  assert.throws(
    () => createProject(createDefaultConfig({
      type: "standard",
      widthUnits: 3,
      depthUnits: 4,
      heightUnits: 2,
      standardLayout: {
        id: "invalid-tight-joints",
        kind: "standard-layout",
        referenceFrame: "internal",
        separators: [
          {
            id: "main-vertical",
            orientation: "vertical",
            role: "primary",
            position: 90,
            spanStart: 0,
            spanEnd: 194,
            bottomJoint: {
              enabled: true,
              tenonDepth: 2.9,
              tenonHeight: 3.5,
            },
            crossJoints: [
              {
                with: "right-top",
                mode: "mortise-primary-tenon-secondary",
              },
              {
                with: "right-bottom",
                mode: "mortise-primary-tenon-secondary",
              },
            ],
          },
          {
            id: "right-top",
            orientation: "horizontal",
            role: "secondary",
            position: 97,
            spanStart: 90,
            spanEnd: 144,
            bottomJoint: {
              enabled: true,
              tenonDepth: 2.9,
              tenonHeight: 3.5,
            },
            crossJoints: [
              {
                with: "main-vertical",
                mode: "mortise-primary-tenon-secondary",
              },
            ],
          },
          {
            id: "right-bottom",
            orientation: "horizontal",
            role: "secondary",
            position: 117,
            spanStart: 90,
            spanEnd: 144,
            bottomJoint: {
              enabled: true,
              tenonDepth: 2.9,
              tenonHeight: 3.5,
            },
            crossJoints: [
              {
                with: "main-vertical",
                mode: "mortise-primary-tenon-secondary",
              },
            ],
          },
        ],
      },
    })),
    /must keep at least 24 mm between secondary joints/,
  );
});

test("renderProjectSvg defaults to layout mode", () => {
  const project = createProject(createDefaultConfig({
    type: "standard",
    widthUnits: 1,
    depthUnits: 1,
    heightUnits: 1,
  }));

  const svg = renderProjectSvg(project);

  assert.match(svg, /Standard Layout/);
  assert.match(svg, /logo-frame/);
  assert.match(svg, /Placed Parts/);
  assert.match(svg, /Assembly Plan/);
  assert.match(svg, /Lay part 1 flat on the bench as/);
  assert.match(svg, /the base\./);
  assert.match(svg, /Do a full dry-fit before glue,/);
  assert.match(svg, /screws, or final clamping\./);
  assert.match(svg, /class="pictogram-line"/);
  assert.match(svg, /marker-badge/);
  assert.doesNotMatch(svg, /class="cut"/);
});

test("renderProjectSvg renders pictograms for lid and Standard separators", () => {
  const project = createProject(createDefaultConfig({
    type: "standard",
    widthUnits: 3,
    depthUnits: 4,
    heightUnits: 2,
    standardLayout: {
      id: "bento-3-right-split",
      kind: "standard-layout",
      referenceFrame: "internal",
      separators: [
        {
          id: "main-vertical",
          orientation: "vertical",
          role: "primary",
          position: 60,
          spanStart: 0,
          spanEnd: 194,
          bottomJoint: {
            enabled: true,
            tenonDepth: 2.9,
            tenonHeight: 3.5,
          },
          crossJoints: [
            {
              with: "right-horizontal",
              mode: "mortise-primary-tenon-secondary",
            },
          ],
        },
        {
          id: "right-horizontal",
          orientation: "horizontal",
          role: "secondary",
          position: 97,
          spanStart: 60,
          spanEnd: 94,
          bottomJoint: {
            enabled: true,
            tenonDepth: 2.9,
            tenonHeight: 3.5,
          },
          crossJoints: [
            {
              with: "main-vertical",
              mode: "mortise-primary-tenon-secondary",
            },
          ],
        },
      ],
    },
  }));

  const svg = renderProjectSvg(project);

  assert.match(svg, /class="pictogram-chip"/);
  assert.match(svg, /class="pictogram-text">P<\/text>/);
  assert.match(svg, /class="pictogram-text">S<\/text>/);
});

test("offsetOrthogonalClosedPath expands and contracts axis-aligned rectangles", () => {
  const rectangle = createRectanglePath(10, 20);

  const expanded = offsetOrthogonalClosedPath(rectangle, 0.5);
  const contracted = offsetOrthogonalClosedPath(rectangle, -0.5);

  assert.deepEqual(expanded.points, [
    { x: -0.5, y: -0.5 },
    { x: 10.5, y: -0.5 },
    { x: 10.5, y: 20.5 },
    { x: -0.5, y: 20.5 },
  ]);
  assert.deepEqual(contracted.points, [
    { x: 0.5, y: 0.5 },
    { x: 9.5, y: 0.5 },
    { x: 9.5, y: 19.5 },
    { x: 0.5, y: 19.5 },
  ]);
});

test("createStandardRailProfilePath creates a stepped loading pocket rail", () => {
  const rail = createStandardRailProfilePath({
    panelWidth: 100,
    materialThickness: 3,
    topOffset: 3,
    grooveHeight: 3.2,
    loadingPocketWidth: 6,
    loadingPocketExtraDepth: 3,
    trailingMargin: 3,
  });

  assert.deepEqual(rail.points, [
    { x: 3, y: 3 },
    { x: 97, y: 3 },
    { x: 97, y: 6.2 },
    { x: 9, y: 6.2 },
    { x: 9, y: 9.2 },
    { x: 3, y: 9.2 },
  ]);
});

test("renderProjectSvgWithMode emits a cut-only SVG in cut mode", () => {
  const project = createProject(createDefaultConfig({
    type: "standard",
    widthUnits: 1,
    depthUnits: 1,
    heightUnits: 1,
  }));

  const svg = renderProjectSvgWithMode(project, "cut");

  assert.match(svg, /class="cut"/);
  assert.match(svg, /14\.95/);
  assert.match(svg, /viewBox="0 0 [0-9.]+ [0-9.]+"/);
  assert.doesNotMatch(svg, /Box50 Layout Preview/);
  assert.doesNotMatch(svg, /Placed Parts/);
  assert.doesNotMatch(svg, /marker-badge/);
});

test("renderProjectSvg packs panels by size to reduce wasted shelf height", () => {
  const config = createDefaultConfig({
    type: "standard",
    widthUnits: 1,
    depthUnits: 1,
    heightUnits: 1,
  });

  const project = {
    config,
    dimensions: calculateDimensions(config),
    panels: [],
    panelGeometries: [
      {
        name: "tall-a",
        width: 150,
        height: 200,
        quantity: 1,
        note: "Tall panel A",
        cutPaths: [createRectanglePath(150, 200)],
      },
      {
        name: "short-a",
        width: 150,
        height: 40,
        quantity: 1,
        note: "Short panel A",
        cutPaths: [createRectanglePath(150, 40)],
      },
      {
        name: "tall-b",
        width: 150,
        height: 200,
        quantity: 1,
        note: "Tall panel B",
        cutPaths: [createRectanglePath(150, 200)],
      },
      {
        name: "short-b",
        width: 150,
        height: 40,
        quantity: 1,
        note: "Short panel B",
        cutPaths: [createRectanglePath(150, 40)],
      },
    ],
    fileStem: "packing-check",
  };

  const svg = renderProjectSvg(project);

  assert.match(svg, /Required sheet envelope 250\.00 × 310\.00 mm/);
});

test("renderProjectSvg includes downward protruding tenons in the layout envelope", () => {
  const config = createDefaultConfig({
    type: "standard",
    widthUnits: 1,
    depthUnits: 1,
    heightUnits: 1,
  });

  const project = {
    config,
    dimensions: calculateDimensions(config),
    panels: [],
    panelGeometries: [
      {
        name: "bottom-tenon-check",
        width: 20,
        height: 20,
        quantity: 1,
        note: "Panel with bottom tenon extension",
        cutPaths: [
          {
            points: [
              { x: 0, y: 0 },
              { x: 20, y: 0 },
              { x: 20, y: 20 },
              { x: 14, y: 20 },
              { x: 14, y: 25 },
              { x: 6, y: 25 },
              { x: 6, y: 20 },
              { x: 0, y: 20 },
            ],
          },
        ],
      },
    ],
    fileStem: "bottom-tenon-envelope-check",
  };

  const svg = renderProjectSvg(project);

  assert.match(svg, /Required sheet envelope 20\.00 × 25\.00 mm/);
  assert.match(svg, /<rect x="12" y="70" width="20" height="25" class="sheet" \/>/);
});

test("renderProjectSvg positions preview markers from the real outer contour bounds", () => {
  const config = createDefaultConfig({
    type: "standard",
    widthUnits: 1,
    depthUnits: 1,
    heightUnits: 1,
  });

  const project = {
    config,
    dimensions: calculateDimensions(config),
    panels: [],
    panelGeometries: [
      {
        name: "marker-bounds-check",
        width: 20,
        height: 20,
        quantity: 1,
        note: "Panel with top and right protrusions",
        cutPaths: [
          {
            points: [
              { x: 0, y: 0 },
              { x: 20, y: 0 },
              { x: 20, y: -5 },
              { x: 25, y: -5 },
              { x: 25, y: 20 },
              { x: 0, y: 20 },
            ],
          },
        ],
      },
    ],
    fileStem: "marker-bounds-check",
  };

  const svg = renderProjectSvg(project);

  assert.match(svg, /<line x1="24\.5" y1="68\.5" x2="24\.5" y2="65" class="marker-line" \/>/);
  assert.match(svg, /<circle cx="24\.5" cy="64" r="4\.5" class="marker-badge" \/>/);
});

test("validatePanelGeometry rejects non-orthogonal contours", () => {
  const issues = validatePanelGeometry({
    name: "invalid-diagonal",
    width: 20,
    height: 20,
    quantity: 1,
    note: "invalid",
    cutPaths: [
      {
        points: [
          { x: 0, y: 0 },
          { x: 20, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 20 },
        ],
      },
    ],
  }, 3);

  assert.ok(issues.some((issue) => issue.message.includes("non-orthogonal segment")));
});

test("validatePanelGeometry rejects self-intersecting contours", () => {
  const issues = validatePanelGeometry({
    name: "invalid-self-intersection",
    width: 20,
    height: 20,
    quantity: 1,
    note: "invalid",
    cutPaths: [
      {
        points: [
          { x: 0, y: 0 },
          { x: 20, y: 0 },
          { x: 20, y: 20 },
          { x: 10, y: 20 },
          { x: 10, y: 10 },
          { x: 20, y: 10 },
          { x: 20, y: 0 },
          { x: 0, y: 0 },
        ],
      },
    ],
  }, 3);

  assert.ok(issues.some((issue) => issue.message.includes("self-intersection")));
});

test("validatePanelGeometry rejects inner cuts that intersect the outer contour", () => {
  const issues = validatePanelGeometry({
    name: "invalid-inner-cut",
    width: 20,
    height: 20,
    quantity: 1,
    note: "invalid",
    cutPaths: [
      createRectanglePath(20, 20),
      {
        points: [
          { x: 18, y: 5 },
          { x: 22, y: 5 },
          { x: 22, y: 10 },
          { x: 18, y: 10 },
        ],
      },
    ],
  }, 3);

  assert.ok(issues.some((issue) => issue.message.includes("intersects the outer contour")));
});

test("validatePanelGeometry rejects front-back mortises with wrong dimensions", () => {
  const project = createProject(createDefaultConfig({
    type: "standard",
    widthUnits: 2,
    depthUnits: 4,
    heightUnits: 2,
    standardLayout: {
      id: "wall-lock-reference",
      kind: "standard-layout",
      referenceFrame: "internal",
      separators: [
        {
          id: "main-vertical",
          orientation: "vertical",
          role: "primary",
          position: 60,
          spanStart: 0,
          spanEnd: 194,
          bottomJoint: {
            enabled: true,
            tenonDepth: 2.9,
            tenonHeight: 3.5,
          },
        },
      ],
    },
  }));
  const frontBack = project.panelGeometries.find((panel) => panel.name === "front-back");

  assert.ok(frontBack);

  const invalidPanel = {
    ...frontBack,
    cutPaths: [
      ...frontBack.cutPaths.slice(0, 1),
      {
        points: [
          { x: 20, y: 20 },
          { x: 24, y: 20 },
          { x: 24, y: 24.5 },
          { x: 20, y: 24.5 },
        ],
      },
      ...frontBack.cutPaths.slice(2),
    ],
  };

  const issues = validatePanelGeometry(invalidPanel, 3);

  assert.ok(issues.some((issue) => issue.message.includes("front/back mortise must measure 3.1 x 4.5 mm")));
});

test("validatePanelGeometry rejects side rails with wrong stepped profile dimensions", () => {
  const project = createProject(createDefaultConfig({
    type: "standard",
    widthUnits: 2,
    depthUnits: 4,
    heightUnits: 2,
  }));
  const leftRight = project.panelGeometries.find((panel) => panel.name === "left-right");

  assert.ok(leftRight);

  const outerPath = leftRight.cutPaths[0];

  assert.ok(outerPath);

  const invalidPanel = {
    ...leftRight,
    cutPaths: [
      outerPath,
      createStandardRailProfilePath({
        panelWidth: leftRight.width,
        materialThickness: 3,
        topOffset: 3,
        grooveHeight: 4,
        loadingPocketWidth: 8,
        loadingPocketExtraDepth: 2,
        trailingMargin: 3,
      }),
    ],
  };

  const issues = validatePanelGeometry(invalidPanel, 3);

  assert.ok(issues.some((issue) => issue.message.includes("side rail loading pocket must be 6 mm long")));
  assert.ok(issues.some((issue) => issue.message.includes("side rail groove must be 3.2 mm high")));
  assert.ok(issues.some((issue) => issue.message.includes("loading pocket depth must match the material thickness")));
});
