import { createOffsetRectanglePath, createPanelGeometry, createTypeABottomPanelGeometry, createTypeADividerPanelGeometry, createTypeARailProfilePath, createTypeAWallPanelGeometry } from "./geometry.js";
import type { Box50Config, Box50Dimensions, Box50Project, ClosedPath, PanelDefinition, PanelGeometry, TypeALayoutDefinition, TypeASeparatorDefinition } from "./types.js";
import { validateProjectGeometry } from "./validation.js";

const BOX_GRID_MM = 50;
const DEFAULT_MATERIAL_THICKNESS = 3;
const DEFAULT_KERF = 0.1;
const DEFAULT_LID_CLEARANCE = 0.25;
const DEFAULT_DIVIDER_CLEARANCE = 0.5;
const TYPE_A_SEPARATOR_TENON_DEPTH = 2.9;
const TYPE_A_SEPARATOR_TENON_HEIGHT = 3.5;
const TYPE_A_SEPARATOR_MORTISE_WIDTH = 3.1;
const TYPE_A_SEPARATOR_MORTISE_HEIGHT = 4.5;
const TYPE_A_SEPARATOR_BOTTOM_SLOT_LENGTH = 4.5;
const TYPE_A_SEPARATOR_BOTTOM_ANCHOR_INSET = 12;
const TYPE_A_SEPARATOR_MIN_PRIMARY_END_MARGIN = 8;
const TYPE_A_SEPARATOR_SIDE_LOCK_GAP = 2;

interface ResolvedTypeASeparator {
  definition: TypeASeparatorDefinition;
  panelName: string;
  spanLength: number;
  panelWidth: number;
  panelHeight: number;
  bottomAnchorCenters: number[];
  mortisePositions: number[];
  edgeTenons: Array<{
    edge: "start" | "end";
    depth: number;
    height: number;
    bottomOffset: number;
  }>;
}

interface ResolvedTypeALayout {
  layout: TypeALayoutDefinition;
  separators: ResolvedTypeASeparator[];
  bottomMortisePaths: ClosedPath[];
  frontBackWallMortisePaths: ClosedPath[];
  leftRightWallMortisePaths: ClosedPath[];
}

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
  return buildPanelsWithLayout(dimensions, config);
}

function buildPanelsWithLayout(dimensions: Box50Dimensions, config: Box50Config, resolvedLayout?: ResolvedTypeALayout): PanelDefinition[] {
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
      note: "Side walls with stepped lid-rail profile",
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
    if (resolvedLayout !== undefined) {
      panels.push(...resolvedLayout.separators.map((separator) => ({
        name: separator.panelName,
        width: separator.panelWidth,
        height: separator.panelHeight,
        quantity: 1,
        note: buildTypeASeparatorNote(separator.definition),
      })));
    } else {
      panels.push({
        name: "divider-depth-template",
        width: dimensions.internalDepth + 5.8,
        height: dimensions.internalHeight - config.dividerClearance,
        quantity: 1,
        note: "First removable divider template spanning internal depth",
      });
    }
  }

  return panels;
}

export function buildPanelGeometries(panels: PanelDefinition[]): PanelGeometry[] {
  return panels.map((panel) => createPanelGeometry(panel));
}

export function buildTypeAPanelGeometries(
  dimensions: Box50Dimensions,
  config: Box50Config,
  panels: PanelDefinition[],
  resolvedLayout?: ResolvedTypeALayout,
): PanelGeometry[] {
  const separatorLookup = new Map(resolvedLayout?.separators.map((separator) => [separator.panelName, separator]) ?? []);

  return panels.map((panel) => {
    if (panel.name === "bottom") {
      const extraCutPaths = resolvedLayout?.bottomMortisePaths;

      return createTypeABottomPanelGeometry({
        ...panel,
        width: dimensions.externalWidth,
        height: dimensions.externalDepth,
        materialThickness: config.materialThickness,
        ...(extraCutPaths === undefined ? {} : { extraCutPaths }),
      });
    }

    if (panel.name === "front-back") {
      const extraCutPaths = resolvedLayout?.frontBackWallMortisePaths ?? [];

      return createTypeAWallPanelGeometry({
        ...panel,
        width: dimensions.externalWidth,
        height: dimensions.externalHeight,
        materialThickness: config.materialThickness,
        topEdge: "straight",
        bottomEdge: "mortise",
        leftEdge: "mortise",
        rightEdge: "mortise",
        ...(extraCutPaths.length === 0 ? {} : { extraCutPaths }),
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
          createTypeARailProfilePath({
            panelWidth: dimensions.externalDepth,
            materialThickness: config.materialThickness,
            topOffset: config.materialThickness,
            grooveHeight: 3.2,
            loadingPocketWidth: 6,
            loadingPocketExtraDepth: config.materialThickness,
            trailingMargin: config.materialThickness,
          }),
          ...(resolvedLayout?.leftRightWallMortisePaths ?? []),
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

    const resolvedSeparator = separatorLookup.get(panel.name);

    if (resolvedSeparator !== undefined) {
      const mortiseCutPaths = resolvedSeparator.mortisePositions.map((position) => createOffsetRectanglePath(
        TYPE_A_SEPARATOR_TENON_DEPTH + position - (TYPE_A_SEPARATOR_MORTISE_WIDTH / 2),
        resolvedSeparator.panelHeight - config.materialThickness - config.materialThickness - TYPE_A_SEPARATOR_MORTISE_HEIGHT,
        TYPE_A_SEPARATOR_MORTISE_WIDTH,
        TYPE_A_SEPARATOR_MORTISE_HEIGHT,
      ));

      return createTypeADividerPanelGeometry({
        ...panel,
        width: resolvedSeparator.panelWidth,
        height: resolvedSeparator.panelHeight,
        tenonDepth: resolvedSeparator.definition.bottomJoint.tenonDepth,
        tenonHeight: resolvedSeparator.definition.bottomJoint.tenonHeight,
        tenonBottomOffset: config.materialThickness,
        ...(resolvedSeparator.edgeTenons.length === 0 ? {} : { edgeTenons: resolvedSeparator.edgeTenons }),
        ...(mortiseCutPaths.length === 0 ? {} : { mortiseCutPaths }),
      });
    }

    return createPanelGeometry(panel);
  });
}

export function createProject(config: Box50Config): Box50Project {
  validateConfig(config);
  const dimensions = calculateDimensions(config);
  const resolvedLayout = config.type === "A" && config.typeALayout !== undefined
    ? resolveTypeALayout(config.typeALayout, dimensions, config)
    : undefined;
  const panels = buildPanelsWithLayout(dimensions, config, resolvedLayout);
  const panelGeometries = config.type === "A"
    ? buildTypeAPanelGeometries(dimensions, config, panels, resolvedLayout)
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

function resolveTypeALayout(layout: TypeALayoutDefinition, dimensions: Box50Dimensions, config: Box50Config): ResolvedTypeALayout {
  const sideLockBottomOffset = resolveSideLockBottomOffset(config);
  const separatorsById = new Map(layout.separators.map((separator) => [separator.id, separator]));

  if (separatorsById.size !== layout.separators.length) {
    throw new Error("Type A layout separator ids must be unique.");
  }

  for (const separator of layout.separators) {
    validateTypeASeparatorDefinition(separator, dimensions);
  }

  const mortisePositionsById = new Map<string, number[]>();
  const edgeTenonsById = new Map<string, ResolvedTypeASeparator["edgeTenons"]>();
  const seenPairs = new Set<string>();

  for (const separator of layout.separators) {
    for (const joint of separator.crossJoints ?? []) {
      const target = separatorsById.get(joint.with);

      if (target === undefined) {
        throw new Error(`Type A layout separator ${separator.id} references unknown separator ${joint.with}.`);
      }

      const pairKey = [separator.id, target.id].sort().join("::");

      if (seenPairs.has(pairKey)) {
        continue;
      }

      seenPairs.add(pairKey);

      const primary = separator.role === "primary" ? separator : target;
      const secondary = separator.role === "secondary" ? separator : target;

      if (primary.role !== "primary" || secondary.role !== "secondary") {
        throw new Error(`Type A layout joint ${separator.id} -> ${target.id} must connect one primary separator and one secondary separator.`);
      }

      if (primary.orientation === secondary.orientation) {
        throw new Error(`Type A layout joint ${primary.id} -> ${secondary.id} must connect orthogonal separators.`);
      }

      const primaryLocalPosition = getIntersectionLocalPosition(primary, secondary);
      const secondaryLocalPosition = getIntersectionLocalPosition(secondary, primary);

      if (primaryLocalPosition <= TYPE_A_SEPARATOR_MIN_PRIMARY_END_MARGIN || primaryLocalPosition >= getSeparatorSpanLength(primary) - TYPE_A_SEPARATOR_MIN_PRIMARY_END_MARGIN) {
        throw new Error(`Type A layout primary separator ${primary.id} intersection must stay at least ${TYPE_A_SEPARATOR_MIN_PRIMARY_END_MARGIN} mm from both ends.`);
      }

      if (approxEqual(secondaryLocalPosition, 0)) {
        registerEdgeTenon(edgeTenonsById, secondary.id, {
          edge: "start",
          depth: secondary.bottomJoint.tenonDepth,
          height: TYPE_A_SEPARATOR_MORTISE_HEIGHT,
          bottomOffset: sideLockBottomOffset,
        });
      } else if (approxEqual(secondaryLocalPosition, getSeparatorSpanLength(secondary))) {
        registerEdgeTenon(edgeTenonsById, secondary.id, {
          edge: "end",
          depth: secondary.bottomJoint.tenonDepth,
          height: TYPE_A_SEPARATOR_MORTISE_HEIGHT,
          bottomOffset: sideLockBottomOffset,
        });
      } else {
        throw new Error(`Type A layout secondary separator ${secondary.id} must meet the primary ${primary.id} at its start or end edge.`);
      }

      const currentMortisePositions = mortisePositionsById.get(primary.id) ?? [];
      currentMortisePositions.push(primaryLocalPosition);
      mortisePositionsById.set(primary.id, currentMortisePositions);
    }
  }

  const separators = layout.separators.map((separator) => {
    const spanLength = getSeparatorSpanLength(separator);
    const wallLockEdges = resolveWallLockEdges(separator, dimensions);

    for (const edge of wallLockEdges) {
      registerEdgeTenon(edgeTenonsById, separator.id, {
        edge,
        depth: separator.bottomJoint.tenonDepth,
        height: TYPE_A_SEPARATOR_MORTISE_HEIGHT,
          bottomOffset: sideLockBottomOffset,
      });
    }

    return {
      definition: separator,
      panelName: `separator:${separator.id}`,
      spanLength,
      panelWidth: spanLength + (2 * separator.bottomJoint.tenonDepth),
      panelHeight: dimensions.internalHeight - config.dividerClearance,
      bottomAnchorCenters: separator.bottomJoint.enabled
        ? resolveBottomAnchorCenters(spanLength)
        : [],
      mortisePositions: mortisePositionsById.get(separator.id) ?? [],
      edgeTenons: edgeTenonsById.get(separator.id) ?? [],
    } satisfies ResolvedTypeASeparator;
  });

  return {
    layout,
    separators,
    bottomMortisePaths: buildBottomMortisePaths(separators, config.materialThickness),
    frontBackWallMortisePaths: buildWallMortisePaths(separators, config.materialThickness, dimensions.externalHeight, "front-back", sideLockBottomOffset),
    leftRightWallMortisePaths: buildWallMortisePaths(separators, config.materialThickness, dimensions.externalHeight, "left-right", sideLockBottomOffset),
  };
}

function validateTypeASeparatorDefinition(separator: TypeASeparatorDefinition, dimensions: Box50Dimensions): void {
  const maxPosition = separator.orientation === "vertical"
    ? dimensions.internalWidth
    : dimensions.internalDepth;
  const maxSpan = separator.orientation === "vertical"
    ? dimensions.internalDepth
    : dimensions.internalWidth;

  if (!Number.isFinite(separator.position) || separator.position < 0 || separator.position > maxPosition) {
    throw new Error(`Type A layout separator ${separator.id} position must stay within the internal volume.`);
  }

  if (!Number.isFinite(separator.spanStart) || !Number.isFinite(separator.spanEnd) || separator.spanEnd <= separator.spanStart) {
    throw new Error(`Type A layout separator ${separator.id} must have a strictly positive span.`);
  }

  if (separator.spanStart < 0 || separator.spanEnd > maxSpan) {
    throw new Error(`Type A layout separator ${separator.id} span must stay within the internal volume.`);
  }

  if (separator.role === "primary") {
    if (!approxEqual(separator.spanStart, 0) || !approxEqual(separator.spanEnd, maxSpan)) {
      throw new Error(`Type A primary separator ${separator.id} must be traversing across the full internal ${separator.orientation === "vertical" ? "depth" : "width"}.`);
    }
  }

  if (!separator.bottomJoint.enabled) {
    throw new Error(`Type A separator ${separator.id} must keep its bottom joint enabled in V1.`);
  }
}

function getSeparatorSpanLength(separator: TypeASeparatorDefinition): number {
  return separator.spanEnd - separator.spanStart;
}

function getIntersectionLocalPosition(separator: TypeASeparatorDefinition, other: TypeASeparatorDefinition): number {
  return separator.orientation === "vertical"
    ? other.position - separator.spanStart
    : other.position - separator.spanStart;
}

function resolveBottomAnchorCenters(spanLength: number): number[] {
  if (spanLength <= (2 * TYPE_A_SEPARATOR_BOTTOM_ANCHOR_INSET) + TYPE_A_SEPARATOR_BOTTOM_SLOT_LENGTH) {
    return [spanLength / 2];
  }

  return [TYPE_A_SEPARATOR_BOTTOM_ANCHOR_INSET, spanLength - TYPE_A_SEPARATOR_BOTTOM_ANCHOR_INSET];
}

function buildBottomMortisePaths(separators: ResolvedTypeASeparator[], materialThickness: number): ClosedPath[] {
  const paths: ClosedPath[] = [];

  for (const separator of separators) {
    const slotWidth = TYPE_A_SEPARATOR_MORTISE_WIDTH;
    const slotLength = TYPE_A_SEPARATOR_BOTTOM_SLOT_LENGTH;

    for (const anchorCenter of separator.bottomAnchorCenters) {
      if (separator.definition.orientation === "vertical") {
        const centerX = materialThickness + separator.definition.position;
        const centerY = materialThickness + separator.definition.spanStart + anchorCenter;

        paths.push(createOffsetRectanglePath(
          centerX - (slotWidth / 2),
          centerY - (slotLength / 2),
          slotWidth,
          slotLength,
        ));

        continue;
      }

      const centerX = materialThickness + separator.definition.spanStart + anchorCenter;
      const centerY = materialThickness + separator.definition.position;

      paths.push(createOffsetRectanglePath(
        centerX - (slotLength / 2),
        centerY - (slotWidth / 2),
        slotLength,
        slotWidth,
      ));
    }
  }

  return paths;
}

function buildWallMortisePaths(
  separators: ResolvedTypeASeparator[],
  materialThickness: number,
  panelHeight: number,
  wallFamily: "front-back" | "left-right",
  sideLockBottomOffset: number,
): ClosedPath[] {
  const paths: ClosedPath[] = [];
  const mortiseY = panelHeight - sideLockBottomOffset - TYPE_A_SEPARATOR_MORTISE_HEIGHT;

  for (const separator of separators) {
    if (wallFamily === "front-back" && separator.definition.orientation !== "vertical") {
      continue;
    }

    if (wallFamily === "left-right" && separator.definition.orientation !== "horizontal") {
      continue;
    }

    const reachedEdges = new Set(separator.edgeTenons.map((edgeTenon) => edgeTenon.edge));

    if (reachedEdges.size === 0) {
      continue;
    }

    const centerX = materialThickness + separator.definition.position;
    paths.push(createOffsetRectanglePath(
      centerX - (TYPE_A_SEPARATOR_MORTISE_WIDTH / 2),
      mortiseY,
      TYPE_A_SEPARATOR_MORTISE_WIDTH,
      TYPE_A_SEPARATOR_MORTISE_HEIGHT,
    ));
  }

  return paths;
}

function resolveWallLockEdges(separator: TypeASeparatorDefinition, dimensions: Box50Dimensions): Array<"start" | "end"> {
  const maxSpan = separator.orientation === "vertical"
    ? dimensions.internalDepth
    : dimensions.internalWidth;
  const edges: Array<"start" | "end"> = [];

  if (approxEqual(separator.spanStart, 0)) {
    edges.push("start");
  }

  if (approxEqual(separator.spanEnd, maxSpan)) {
    edges.push("end");
  }

  return edges;
}

function registerEdgeTenon(
  edgeTenonsById: Map<string, ResolvedTypeASeparator["edgeTenons"]>,
  separatorId: string,
  edgeTenon: ResolvedTypeASeparator["edgeTenons"][number],
): void {
  const current = edgeTenonsById.get(separatorId) ?? [];

  if (current.some((existing) => existing.edge === edgeTenon.edge)) {
    return;
  }

  current.push(edgeTenon);
  edgeTenonsById.set(separatorId, current);
}

function resolveSideLockBottomOffset(config: Box50Config): number {
  return config.materialThickness + TYPE_A_SEPARATOR_TENON_HEIGHT + TYPE_A_SEPARATOR_SIDE_LOCK_GAP;
}

function buildTypeASeparatorNote(separator: TypeASeparatorDefinition): string {
  const roleLabel = separator.role === "primary" ? "Primary" : "Secondary";
  const orientationLabel = separator.orientation === "vertical" ? "vertical" : "horizontal";
  return `Type A ${roleLabel.toLowerCase()} separator, ${orientationLabel} span ${formatMillimeters(separator.spanEnd - separator.spanStart)}`;
}

function approxEqual(left: number, right: number, tolerance = 0.05): boolean {
  return Math.abs(left - right) <= tolerance;
}