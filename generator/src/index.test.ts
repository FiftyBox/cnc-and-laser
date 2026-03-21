import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateDimensions,
  createRectanglePath,
  createDefaultConfig,
  createProject,
  createTypeARailProfilePath,
  offsetOrthogonalClosedPath,
  renderProjectSvg,
  renderProjectSvgWithMode,
  validateConfig,
  validatePanelGeometry,
} from "./index.js";

test("calculateDimensions computes external and internal dimensions for Type A", () => {
  const config = createDefaultConfig({
    type: "A",
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
    type: "A",
    widthUnits: 0,
    depthUnits: 2,
    heightUnits: 1,
  });

  assert.throws(
    () => validateConfig(config),
    /widthUnits, depthUnits, and heightUnits must be positive integers/,
  );
});

test("createProject builds expected Type A panel set with internal cuts", () => {
  const project = createProject(createDefaultConfig({
    type: "A",
    widthUnits: 2,
    depthUnits: 4,
    heightUnits: 2,
  }));

  assert.equal(project.fileStem, "box50-100x200x100-typeA");
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

test("createProject builds Type A layout separators and bottom mortises from a bento layout", () => {
  const project = createProject(createDefaultConfig({
    type: "A",
    widthUnits: 2,
    depthUnits: 4,
    heightUnits: 2,
    typeALayout: {
      id: "bento-3-right-split",
      kind: "type-a-layout",
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

test("createProject rejects non-traversing primary separators in Type A layouts", () => {
  assert.throws(
    () => createProject(createDefaultConfig({
      type: "A",
      widthUnits: 2,
      depthUnits: 4,
      heightUnits: 2,
      typeALayout: {
        id: "invalid-layout",
        kind: "type-a-layout",
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

test("renderProjectSvg defaults to layout mode", () => {
  const project = createProject(createDefaultConfig({
    type: "A",
    widthUnits: 1,
    depthUnits: 1,
    heightUnits: 1,
  }));

  const svg = renderProjectSvg(project);

  assert.match(svg, /Standard Type A/);
  assert.match(svg, /logo-frame/);
  assert.match(svg, /Placed Parts/);
  assert.match(svg, /marker-badge/);
  assert.doesNotMatch(svg, /class="cut"/);
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

test("createTypeARailProfilePath creates a stepped loading pocket rail", () => {
  const rail = createTypeARailProfilePath({
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
    type: "A",
    widthUnits: 1,
    depthUnits: 1,
    heightUnits: 1,
  }));

  const svg = renderProjectSvgWithMode(project, "cut");

  assert.match(svg, /class="cut"/);
  assert.match(svg, /14\.95/);
  assert.match(svg, /18\.15/);
  assert.doesNotMatch(svg, /Box50 Layout Preview/);
  assert.doesNotMatch(svg, /Placed Parts/);
  assert.doesNotMatch(svg, /marker-badge/);
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
    type: "A",
    widthUnits: 2,
    depthUnits: 4,
    heightUnits: 2,
    typeALayout: {
      id: "wall-lock-reference",
      kind: "type-a-layout",
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
    type: "A",
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
      createTypeARailProfilePath({
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
