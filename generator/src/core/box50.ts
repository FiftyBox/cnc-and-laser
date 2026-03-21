import { createPanelGeometry, createTypeABottomPanelGeometry, createTypeADividerMortisePaths, createTypeADividerPanelGeometry, createTypeARailSlotPath, createTypeAWallPanelGeometry } from "./geometry.js";
import type { Box50Config, Box50Dimensions, Box50Project, PanelDefinition, PanelGeometry } from "./types.js";
import { validateProjectGeometry } from "./validation.js";

const BOX_GRID_MM = 50;
const DEFAULT_MATERIAL_THICKNESS = 3;
const DEFAULT_KERF = 0.1;
const DEFAULT_LID_CLEARANCE = 0.25;
const DEFAULT_DIVIDER_CLEARANCE = 0.5;

export function createDefaultConfig(partial: Partial<Box50Config> & Pick<Box50Config, "type" | "widthUnits" | "depthUnits" | "heightUnits">): Box50Config {
  return {
    materialThickness: DEFAULT_MATERIAL_THICKNESS,
    kerf: DEFAULT_KERF,
    lidClearance: DEFAULT_LID_CLEARANCE,
    dividerClearance: DEFAULT_DIVIDER_CLEARANCE,
    ...partial,
  };
}

export function validateConfig(config: Box50Config): void {
  const integerFields = [config.widthUnits, config.depthUnits, config.heightUnits];

  if (integerFields.some((value) => !Number.isInteger(value) || value <= 0)) {
    throw new Error("widthUnits, depthUnits, and heightUnits must be positive integers.");
  }

  const metricFields = [
    ["materialThickness", config.materialThickness],
    ["kerf", config.kerf],
    ["lidClearance", config.lidClearance],
    ["dividerClearance", config.dividerClearance],
  ] as const;

  for (const [name, value] of metricFields) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`${name} must be a positive number.`);
    }
  }
}

export function calculateDimensions(config: Box50Config): Box50Dimensions {
  const externalWidth = config.widthUnits * BOX_GRID_MM;
  const externalDepth = config.depthUnits * BOX_GRID_MM;
  const externalHeight = config.heightUnits * BOX_GRID_MM;

  const internalWidth = externalWidth - (2 * config.materialThickness);
  const internalDepth = externalDepth - (2 * config.materialThickness);
  const internalHeight = externalHeight - (3 * config.materialThickness) - config.lidClearance;

  return {
    externalWidth,
    externalDepth,
    externalHeight,
    internalWidth,
    internalDepth,
    internalHeight,
  };
}

export function buildPanels(dimensions: Box50Dimensions, config: Box50Config): PanelDefinition[] {
  const typeLabel = config.type === "A"
    ? `Universal layout, removable dividers clearance ${formatMillimeters(config.dividerClearance)}`
    : "Specific layout, fixed divider geometry to be added";
  const panels: PanelDefinition[] = [
    {
      name: "bottom",
      width: dimensions.externalWidth,
      height: dimensions.externalDepth,
      quantity: 1,
      note: "Base panel",
    },
    {
      name: "front-back",
      width: dimensions.externalWidth,
      height: dimensions.externalHeight,
      quantity: 2,
      note: `Main walls. ${typeLabel}`,
    },
    {
      name: "left-right",
      width: dimensions.externalDepth,
      height: dimensions.externalHeight,
      quantity: 2,
      note: "Side walls with future lid-rail geometry",
    },
    {
      name: "lid",
      width: dimensions.internalWidth,
      height: dimensions.externalDepth,
      quantity: 1,
      note: `Sliding lid with clearance ${formatMillimeters(config.lidClearance)}`,
    },
  ];

  if (config.type === "A") {
    panels.push({
      name: "divider-depth-template",
      width: dimensions.internalDepth + 5.8,
      height: dimensions.internalHeight - config.dividerClearance,
      quantity: 1,
      note: "First removable divider template spanning internal depth",
    });
  }

  return panels;
}

export function buildPanelGeometries(panels: PanelDefinition[]): PanelGeometry[] {
  return panels.map((panel) => createPanelGeometry(panel));
}

export function buildTypeAPanelGeometries(dimensions: Box50Dimensions, config: Box50Config, panels: PanelDefinition[]): PanelGeometry[] {
  return panels.map((panel) => {
    if (panel.name === "bottom") {
      return createTypeABottomPanelGeometry({
        ...panel,
        width: dimensions.externalWidth,
        height: dimensions.externalDepth,
        materialThickness: config.materialThickness,
      });
    }

    if (panel.name === "front-back") {
      return createTypeAWallPanelGeometry({
        ...panel,
        width: dimensions.externalWidth,
        height: dimensions.externalHeight,
        materialThickness: config.materialThickness,
        topEdge: "straight",
        bottomEdge: "mortise",
        leftEdge: "mortise",
        rightEdge: "mortise",
        extraCutPaths: createTypeADividerMortisePaths({
          panelWidth: dimensions.externalWidth,
          panelHeight: dimensions.externalHeight,
          slotWidth: 3.1,
          slotHeight: 4.5,
          gridSpacing: 25,
          firstCenterX: 25,
          bottomOffset: 6,
        }),
      });
    }

    if (panel.name === "left-right") {
      return createTypeAWallPanelGeometry({
        ...panel,
        width: dimensions.externalDepth,
        height: dimensions.externalHeight,
        materialThickness: config.materialThickness,
        topEdge: "straight",
        bottomEdge: "mortise",
        leftEdge: "tenon",
        rightEdge: "tenon",
        extraCutPaths: [
          createTypeARailSlotPath({
            panelWidth: dimensions.externalDepth,
            materialThickness: config.materialThickness,
            topOffset: config.materialThickness,
            slotHeight: 3.2,
            trailingMargin: config.materialThickness,
          }),
        ],
      });
    }

    if (panel.name === "divider-depth-template") {
      return createTypeADividerPanelGeometry({
        ...panel,
        width: dimensions.internalDepth + 5.8,
        height: dimensions.internalHeight - config.dividerClearance,
        tenonDepth: 2.9,
        tenonHeight: 3.5,
        tenonBottomOffset: config.materialThickness,
      });
    }

    return createPanelGeometry(panel);
  });
}

export function createProject(config: Box50Config): Box50Project {
  validateConfig(config);
  const dimensions = calculateDimensions(config);
  const panels = buildPanels(dimensions, config);
  const panelGeometries = config.type === "A"
    ? buildTypeAPanelGeometries(dimensions, config, panels)
    : buildPanelGeometries(panels);

  const project: Box50Project = {
    config,
    dimensions,
    panels,
    panelGeometries,
    fileStem: buildFileStem(dimensions, config.type),
  };

  validateProjectGeometry(project);

  return project;
}

export function buildFileStem(dimensions: Box50Dimensions, type: Box50Config["type"]): string {
  return `box50-${dimensions.externalWidth}x${dimensions.externalDepth}x${dimensions.externalHeight}-type${type}`;
}

export function formatMillimeters(value: number): string {
  const rounded = Number(value.toFixed(2));
  return `${rounded} mm`;
}