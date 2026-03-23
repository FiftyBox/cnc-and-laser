import { createOffsetRectanglePath, createPanelGeometry, createStandardBottomPanelGeometry, createStandardDividerPanelGeometry, createStandardRailProfilePath, createStandardWallPanelGeometry } from "./geometry.js";
import type { Box50Config, Box50Dimensions, Box50FabricationPlan, Box50Project, ClosedPath, FabricationPlanDefinition, FillerDefinition, PanelDefinition, PanelGeometry, StandardLayoutDefinition, StandardSeparatorDefinition } from "./types.js";
import { validateProjectGeometry } from "./validation.js";

const BOX_GRID_MM = 50;
const DEFAULT_MATERIAL_THICKNESS = 3;
const DEFAULT_KERF = 0.1;
const DEFAULT_LID_CLEARANCE = 0.25;
const DEFAULT_DIVIDER_CLEARANCE = 0.5;
const STANDARD_SEPARATOR_TENON_DEPTH = 2.9;
const STANDARD_SEPARATOR_TENON_HEIGHT = 3.5;
const STANDARD_SEPARATOR_MORTISE_WIDTH = 3.1;
const STANDARD_SEPARATOR_MORTISE_HEIGHT = 4.5;
const STANDARD_SEPARATOR_BOTTOM_SLOT_LENGTH = 4.5;
const STANDARD_SEPARATOR_BOTTOM_ANCHOR_INSET = 12;
const STANDARD_SEPARATOR_MIN_PRIMARY_END_MARGIN = 8;
const STANDARD_SEPARATOR_SIDE_LOCK_GAP = 2;
const STANDARD_SEPARATOR_MIN_SPAN_LENGTH = 30;
const STANDARD_SEPARATOR_MIN_AXIS_GAP = 18;
const STANDARD_PRIMARY_MIN_JOINT_SPACING = 24;

interface ResolvedStandardSeparator {
  definition: StandardSeparatorDefinition;
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

interface ResolvedStandardLayout {
  layout: StandardLayoutDefinition;
  separators: ResolvedStandardSeparator[];
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

  const additionalFabricationPlanIds = new Set<string>();

  for (const fabricationPlan of config.fabricationPlans ?? []) {
    if (fabricationPlan.id === "main") {
      throw new Error("fabricationPlans cannot redefine the reserved main plan id.");
    }

    if (additionalFabricationPlanIds.has(fabricationPlan.id)) {
      throw new Error(`fabrication plan id ${fabricationPlan.id} must be unique.`);
    }

    additionalFabricationPlanIds.add(fabricationPlan.id);

    if (!Number.isFinite(fabricationPlan.materialThickness) || fabricationPlan.materialThickness <= 0) {
      throw new Error(`fabrication plan ${fabricationPlan.id} materialThickness must be a positive number.`);
    }

    if (!Number.isFinite(fabricationPlan.kerf) || fabricationPlan.kerf <= 0) {
      throw new Error(`fabrication plan ${fabricationPlan.id} kerf must be a positive number.`);
    }
  }

  const fillerIds = new Set<string>();

  for (const filler of config.fillers ?? []) {
    if (fillerIds.has(filler.id)) {
      throw new Error(`filler id ${filler.id} must be unique.`);
    }

    fillerIds.add(filler.id);

    if (!Number.isFinite(filler.width) || filler.width <= 0) {
      throw new Error(`filler ${filler.id} width must be a positive number.`);
    }

    if (!Number.isFinite(filler.height) || filler.height <= 0) {
      throw new Error(`filler ${filler.id} height must be a positive number.`);
    }

    if (!Number.isInteger(filler.quantity) || filler.quantity <= 0) {
      throw new Error(`filler ${filler.id} quantity must be a positive integer.`);
    }

    const targetPlan = filler.targetPlan ?? "main";

    if (targetPlan !== "main" && !additionalFabricationPlanIds.has(targetPlan)) {
      throw new Error(`filler ${filler.id} references unknown fabrication plan ${targetPlan}.`);
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

function buildPanelsWithLayout(dimensions: Box50Dimensions, config: Box50Config, resolvedLayout?: ResolvedStandardLayout): PanelDefinition[] {
  const typeLabel = config.type === "standard"
    ? `Standard configurable layout, divider clearance ${formatMillimeters(config.dividerClearance)}`
    : "Finalized preset geometry, engraving and game-specific features allowed";
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

  if (config.type === "standard") {
    if (resolvedLayout !== undefined) {
      panels.push(...resolvedLayout.separators.map((separator) => ({
        name: separator.panelName,
        width: separator.panelWidth,
        height: separator.panelHeight,
        quantity: 1,
        note: buildStandardSeparatorNote(separator.definition),
      })));
    } else {
      panels.push({
        name: "divider-depth-default",
        width: dimensions.internalDepth + 5.8,
        height: dimensions.internalHeight - config.dividerClearance,
        quantity: 1,
        note: "Default removable Standard divider spanning internal depth",
      });
    }
  }

  return panels;
}

export function buildPanelGeometries(panels: PanelDefinition[]): PanelGeometry[] {
  return panels.map((panel) => createPanelGeometry(panel));
}

export function buildStandardPanelGeometries(
  dimensions: Box50Dimensions,
  config: Box50Config,
  panels: PanelDefinition[],
  resolvedLayout?: ResolvedStandardLayout,
): PanelGeometry[] {
  const separatorLookup = new Map(resolvedLayout?.separators.map((separator) => [separator.panelName, separator]) ?? []);

  return panels.map((panel) => {
    if (panel.name === "bottom") {
      const extraCutPaths = resolvedLayout?.bottomMortisePaths;

      return createStandardBottomPanelGeometry({
        ...panel,
        width: dimensions.externalWidth,
        height: dimensions.externalDepth,
        materialThickness: config.materialThickness,
        ...(extraCutPaths === undefined ? {} : { extraCutPaths }),
      });
    }

    if (panel.name === "front-back") {
      const extraCutPaths = resolvedLayout?.frontBackWallMortisePaths ?? [];

      return createStandardWallPanelGeometry({
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
      return createStandardWallPanelGeometry({
        ...panel,
        width: dimensions.externalDepth,
        height: dimensions.externalHeight,
        materialThickness: config.materialThickness,
        topEdge: "straight",
        bottomEdge: "mortise",
        leftEdge: "tenon",
        rightEdge: "tenon",
        extraCutPaths: [
          createStandardRailProfilePath({
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

    if (panel.name === "divider-depth-default") {
      return createStandardDividerPanelGeometry({
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
      const startEdgeDepth = resolvedSeparator.edgeTenons.find((edgeTenon) => edgeTenon.edge === "start")?.depth ?? 0;
      const mortiseCutPaths = resolvedSeparator.mortisePositions.map((position) => createOffsetRectanglePath(
        startEdgeDepth + position - (STANDARD_SEPARATOR_MORTISE_WIDTH / 2),
        resolvedSeparator.panelHeight - config.materialThickness - config.materialThickness - STANDARD_SEPARATOR_MORTISE_HEIGHT,
        STANDARD_SEPARATOR_MORTISE_WIDTH,
        STANDARD_SEPARATOR_MORTISE_HEIGHT,
      ));

      return createStandardDividerPanelGeometry({
        ...panel,
        width: resolvedSeparator.spanLength,
        height: resolvedSeparator.panelHeight,
        tenonDepth: resolvedSeparator.definition.bottomJoint.tenonDepth,
        tenonHeight: resolvedSeparator.definition.bottomJoint.tenonHeight,
        tenonBottomOffset: config.materialThickness,
        ...(resolvedSeparator.edgeTenons.length === 0 ? {} : { edgeTenons: resolvedSeparator.edgeTenons }),
        ...(resolvedSeparator.bottomAnchorCenters.length === 0
          ? {}
          : {
            bottomTenonCenters: resolvedSeparator.bottomAnchorCenters,
            bottomTenonLength: STANDARD_SEPARATOR_BOTTOM_SLOT_LENGTH,
          }),
        ...(mortiseCutPaths.length === 0 ? {} : { mortiseCutPaths }),
      });
    }

    return createPanelGeometry(panel);
  });
}

export function createProject(config: Box50Config): Box50Project {
  validateConfig(config);
  const dimensions = calculateDimensions(config);
  const resolvedLayout = config.type === "standard" && config.standardLayout !== undefined
    ? resolveStandardLayout(config.standardLayout, dimensions, config)
    : undefined;
  const structuralPanels = buildPanelsWithLayout(dimensions, config, resolvedLayout);
  const structuralPanelGeometries = config.type === "standard"
    ? buildStandardPanelGeometries(dimensions, config, structuralPanels, resolvedLayout)
    : buildPanelGeometries(structuralPanels);
  const projectFileStem = buildFileStem(dimensions, config.type);
  const fillersByPlan = groupFillersByTargetPlan(config.fillers ?? []);
  const mainFillerPanels = buildFillerPanels(fillersByPlan.get("main") ?? []);
  const additionalFabricationPlans = buildAdditionalFabricationPlans(projectFileStem, config.fabricationPlans ?? [], fillersByPlan);
  const hasMultiplePlans = additionalFabricationPlans.length > 0;
  const mainFabricationPlan: Box50FabricationPlan = {
    id: "main",
    materialThickness: config.materialThickness,
    kerf: config.kerf,
    note: "Primary structural plan",
    panels: [...structuralPanels, ...mainFillerPanels],
    panelGeometries: [...structuralPanelGeometries, ...mainFillerPanels.map((panel) => createPanelGeometry(panel))],
    fileStem: hasMultiplePlans ? `${projectFileStem}-main` : projectFileStem,
  };
  const fabricationPlans = [mainFabricationPlan, ...additionalFabricationPlans];

  const project: Box50Project = {
    config,
    dimensions,
    panels: mainFabricationPlan.panels,
    panelGeometries: mainFabricationPlan.panelGeometries,
    fileStem: projectFileStem,
    fabricationPlans,
  };

  validateProjectGeometry(project);

  return project;
}

export function buildFileStem(dimensions: Box50Dimensions, type: Box50Config["type"]): string {
  return `box50-${dimensions.externalWidth}x${dimensions.externalDepth}x${dimensions.externalHeight}-${type}`;
}

export function formatMillimeters(value: number): string {
  const rounded = Number(value.toFixed(2));
  return `${rounded} mm`;
}

function resolveStandardLayout(layout: StandardLayoutDefinition, dimensions: Box50Dimensions, config: Box50Config): ResolvedStandardLayout {
  const sideLockBottomOffset = resolveSideLockBottomOffset(config);
  const separatorsById = new Map(layout.separators.map((separator) => [separator.id, separator]));

  if (separatorsById.size !== layout.separators.length) {
    throw new Error("Standard layout separator ids must be unique.");
  }

  for (const separator of layout.separators) {
    validateStandardSeparatorDefinition(separator, dimensions);
  }

  validateStandardLayoutBusinessRules(layout.separators);

  const mortisePositionsById = new Map<string, number[]>();
  const edgeTenonsById = new Map<string, ResolvedStandardSeparator["edgeTenons"]>();
  const seenPairs = new Set<string>();

  for (const separator of layout.separators) {
    for (const joint of separator.crossJoints ?? []) {
      const target = separatorsById.get(joint.with);

      if (target === undefined) {
        throw new Error(`Standard layout separator ${separator.id} references unknown separator ${joint.with}.`);
      }

      if (!hasReciprocalJoint(target, separator.id)) {
        throw new Error(`Standard layout joint ${separator.id} -> ${target.id} must be declared on both separators.`);
      }

      const pairKey = [separator.id, target.id].sort().join("::");

      if (seenPairs.has(pairKey)) {
        continue;
      }

      seenPairs.add(pairKey);

      const primary = separator.role === "primary" ? separator : target;
      const secondary = separator.role === "secondary" ? separator : target;

      if (primary.role !== "primary" || secondary.role !== "secondary") {
        throw new Error(`Standard layout joint ${separator.id} -> ${target.id} must connect one primary separator and one secondary separator.`);
      }

      if (primary.orientation === secondary.orientation) {
        throw new Error(`Standard layout joint ${primary.id} -> ${secondary.id} must connect orthogonal separators.`);
      }

      const primaryLocalPosition = getIntersectionLocalPosition(primary, secondary);
      const secondaryLocalPosition = getIntersectionLocalPosition(secondary, primary);

      if (primaryLocalPosition <= STANDARD_SEPARATOR_MIN_PRIMARY_END_MARGIN || primaryLocalPosition >= getSeparatorSpanLength(primary) - STANDARD_SEPARATOR_MIN_PRIMARY_END_MARGIN) {
        throw new Error(`Standard layout primary separator ${primary.id} intersection must stay at least ${STANDARD_SEPARATOR_MIN_PRIMARY_END_MARGIN} mm from both ends.`);
      }

      if (approxEqual(secondaryLocalPosition, 0)) {
        registerEdgeTenon(edgeTenonsById, secondary.id, {
          edge: "start",
          depth: secondary.bottomJoint.tenonDepth,
          height: STANDARD_SEPARATOR_MORTISE_HEIGHT,
          bottomOffset: sideLockBottomOffset,
        });
      } else if (approxEqual(secondaryLocalPosition, getSeparatorSpanLength(secondary))) {
        registerEdgeTenon(edgeTenonsById, secondary.id, {
          edge: "end",
          depth: secondary.bottomJoint.tenonDepth,
          height: STANDARD_SEPARATOR_MORTISE_HEIGHT,
          bottomOffset: sideLockBottomOffset,
        });
      } else {
        throw new Error(`Standard layout secondary separator ${secondary.id} must meet the primary ${primary.id} at its start or end edge.`);
      }

      const currentMortisePositions = mortisePositionsById.get(primary.id) ?? [];
      currentMortisePositions.push(primaryLocalPosition);
      mortisePositionsById.set(primary.id, currentMortisePositions);
    }
  }

  validateSecondaryConnectivity(layout.separators, dimensions);

  const separators = layout.separators.map((separator) => {
    const spanLength = getSeparatorSpanLength(separator);
    const wallLockEdges = resolveWallLockEdges(separator, dimensions);

    for (const edge of wallLockEdges) {
      registerEdgeTenon(edgeTenonsById, separator.id, {
        edge,
        depth: separator.bottomJoint.tenonDepth,
        height: STANDARD_SEPARATOR_MORTISE_HEIGHT,
          bottomOffset: sideLockBottomOffset,
      });
    }

    const edgeTenons = edgeTenonsById.get(separator.id) ?? [];
    const startEdgeDepth = edgeTenons.find((edgeTenon) => edgeTenon.edge === "start")?.depth ?? 0;
    const endEdgeDepth = edgeTenons.find((edgeTenon) => edgeTenon.edge === "end")?.depth ?? 0;

    return {
      definition: separator,
      panelName: `separator:${separator.id}`,
      spanLength,
      panelWidth: spanLength + startEdgeDepth + endEdgeDepth,
      panelHeight: dimensions.internalHeight - config.dividerClearance,
      bottomAnchorCenters: separator.bottomJoint.enabled
        ? resolveBottomAnchorCenters(spanLength)
        : [],
      mortisePositions: mortisePositionsById.get(separator.id) ?? [],
      edgeTenons,
    } satisfies ResolvedStandardSeparator;
  });

  validatePrimaryJointSpacing(separatorsById, mortisePositionsById);

  return {
    layout,
    separators,
    bottomMortisePaths: buildBottomMortisePaths(separators, config.materialThickness),
    frontBackWallMortisePaths: buildWallMortisePaths(separators, config.materialThickness, dimensions.externalHeight, "front-back", sideLockBottomOffset),
    leftRightWallMortisePaths: buildWallMortisePaths(separators, config.materialThickness, dimensions.externalHeight, "left-right", sideLockBottomOffset),
  };
}

function validateStandardSeparatorDefinition(separator: StandardSeparatorDefinition, dimensions: Box50Dimensions): void {
  const maxPosition = separator.orientation === "vertical"
    ? dimensions.internalWidth
    : dimensions.internalDepth;
  const maxSpan = separator.orientation === "vertical"
    ? dimensions.internalDepth
    : dimensions.internalWidth;

  if (!Number.isFinite(separator.position) || separator.position < 0 || separator.position > maxPosition) {
    throw new Error(`Standard layout separator ${separator.id} position must stay within the internal volume.`);
  }

  if (!Number.isFinite(separator.spanStart) || !Number.isFinite(separator.spanEnd) || separator.spanEnd <= separator.spanStart) {
    throw new Error(`Standard layout separator ${separator.id} must have a strictly positive span.`);
  }

  if (separator.spanStart < 0 || separator.spanEnd > maxSpan) {
    throw new Error(`Standard layout separator ${separator.id} span must stay within the internal volume.`);
  }

  if (getSeparatorSpanLength(separator) < STANDARD_SEPARATOR_MIN_SPAN_LENGTH) {
    throw new Error(`Standard layout separator ${separator.id} span must be at least ${STANDARD_SEPARATOR_MIN_SPAN_LENGTH} mm.`);
  }

  if (separator.role === "primary") {
    if (!approxEqual(separator.spanStart, 0) || !approxEqual(separator.spanEnd, maxSpan)) {
      throw new Error(`Standard primary separator ${separator.id} must be traversing across the full internal ${separator.orientation === "vertical" ? "depth" : "width"}.`);
    }
  }

  if (!separator.bottomJoint.enabled) {
    throw new Error(`Standard separator ${separator.id} must keep its bottom joint enabled in V1.`);
  }
}

function getSeparatorSpanLength(separator: StandardSeparatorDefinition): number {
  return separator.spanEnd - separator.spanStart;
}

function getIntersectionLocalPosition(separator: StandardSeparatorDefinition, other: StandardSeparatorDefinition): number {
  return separator.orientation === "vertical"
    ? other.position - separator.spanStart
    : other.position - separator.spanStart;
}

function resolveBottomAnchorCenters(spanLength: number): number[] {
  if (spanLength <= (2 * STANDARD_SEPARATOR_BOTTOM_ANCHOR_INSET) + STANDARD_SEPARATOR_BOTTOM_SLOT_LENGTH) {
    return [spanLength / 2];
  }

  return [STANDARD_SEPARATOR_BOTTOM_ANCHOR_INSET, spanLength - STANDARD_SEPARATOR_BOTTOM_ANCHOR_INSET];
}

function buildBottomMortisePaths(separators: ResolvedStandardSeparator[], materialThickness: number): ClosedPath[] {
  const paths: ClosedPath[] = [];

  for (const separator of separators) {
    const slotWidth = STANDARD_SEPARATOR_MORTISE_WIDTH;
    const slotLength = STANDARD_SEPARATOR_BOTTOM_SLOT_LENGTH;

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
  separators: ResolvedStandardSeparator[],
  materialThickness: number,
  panelHeight: number,
  wallFamily: "front-back" | "left-right",
  sideLockBottomOffset: number,
): ClosedPath[] {
  const paths: ClosedPath[] = [];
  const mortiseY = panelHeight - sideLockBottomOffset - STANDARD_SEPARATOR_MORTISE_HEIGHT;

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
      centerX - (STANDARD_SEPARATOR_MORTISE_WIDTH / 2),
      mortiseY,
      STANDARD_SEPARATOR_MORTISE_WIDTH,
      STANDARD_SEPARATOR_MORTISE_HEIGHT,
    ));
  }

  return paths;
}

function resolveWallLockEdges(separator: StandardSeparatorDefinition, dimensions: Box50Dimensions): Array<"start" | "end"> {
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
  edgeTenonsById: Map<string, ResolvedStandardSeparator["edgeTenons"]>,
  separatorId: string,
  edgeTenon: ResolvedStandardSeparator["edgeTenons"][number],
): void {
  const current = edgeTenonsById.get(separatorId) ?? [];

  if (current.some((existing) => existing.edge === edgeTenon.edge)) {
    return;
  }

  current.push(edgeTenon);
  edgeTenonsById.set(separatorId, current);
}

function resolveSideLockBottomOffset(config: Box50Config): number {
  return config.materialThickness + STANDARD_SEPARATOR_TENON_HEIGHT + STANDARD_SEPARATOR_SIDE_LOCK_GAP;
}

function buildStandardSeparatorNote(separator: StandardSeparatorDefinition): string {
  const roleLabel = separator.role === "primary" ? "Primary" : "Secondary";
  const orientationLabel = separator.orientation === "vertical" ? "vertical" : "horizontal";
  return `Standard ${roleLabel.toLowerCase()} separator, ${orientationLabel} span ${formatMillimeters(separator.spanEnd - separator.spanStart)}`;
}

function groupFillersByTargetPlan(fillers: FillerDefinition[]): Map<string, FillerDefinition[]> {
  const fillersByTargetPlan = new Map<string, FillerDefinition[]>();

  for (const filler of fillers) {
    const targetPlan = filler.targetPlan ?? "main";
    const targetFillers = fillersByTargetPlan.get(targetPlan) ?? [];
    targetFillers.push(filler);
    fillersByTargetPlan.set(targetPlan, targetFillers);
  }

  return fillersByTargetPlan;
}

function buildFillerPanels(fillers: FillerDefinition[]): PanelDefinition[] {
  return fillers.map((filler) => ({
    name: `filler:${filler.id}`,
    width: filler.width,
    height: filler.height,
    quantity: filler.quantity,
    note: filler.note ?? `Filler plate ${formatMillimeters(filler.width)} x ${formatMillimeters(filler.height)}`,
  }));
}

function buildAdditionalFabricationPlans(
  projectFileStem: string,
  fabricationPlanDefinitions: FabricationPlanDefinition[],
  fillersByPlan: Map<string, FillerDefinition[]>,
): Box50FabricationPlan[] {
  const fabricationPlans: Box50FabricationPlan[] = [];

  for (const fabricationPlanDefinition of fabricationPlanDefinitions) {
    const fillerPanels = buildFillerPanels(fillersByPlan.get(fabricationPlanDefinition.id) ?? []);

    if (fillerPanels.length === 0) {
      continue;
    }

    fabricationPlans.push({
      id: fabricationPlanDefinition.id,
      materialThickness: fabricationPlanDefinition.materialThickness,
      kerf: fabricationPlanDefinition.kerf,
      ...(fabricationPlanDefinition.note === undefined ? {} : { note: fabricationPlanDefinition.note }),
      panels: fillerPanels,
      panelGeometries: fillerPanels.map((panel) => createPanelGeometry(panel)),
      fileStem: `${projectFileStem}-${fabricationPlanDefinition.id}`,
    });
  }

  return fabricationPlans;
}

function approxEqual(left: number, right: number, tolerance = 0.05): boolean {
  return Math.abs(left - right) <= tolerance;
}

function validateStandardLayoutBusinessRules(separators: StandardSeparatorDefinition[]): void {
  for (let leftIndex = 0; leftIndex < separators.length; leftIndex += 1) {
    const left = separators[leftIndex];

    if (left === undefined) {
      continue;
    }

    for (let rightIndex = leftIndex + 1; rightIndex < separators.length; rightIndex += 1) {
      const right = separators[rightIndex];

      if (right === undefined || left.orientation !== right.orientation) {
        continue;
      }

      const axisGap = Math.abs(left.position - right.position);

      if (axisGap < STANDARD_SEPARATOR_MIN_AXIS_GAP) {
        throw new Error(`Standard layout separators ${left.id} and ${right.id} are too close on parallel axes; keep at least ${STANDARD_SEPARATOR_MIN_AXIS_GAP} mm between them.`);
      }

      if (approxEqual(axisGap, 0) && spansOverlap(left.spanStart, left.spanEnd, right.spanStart, right.spanEnd)) {
        throw new Error(`Standard layout separators ${left.id} and ${right.id} cannot overlap on the same axis.`);
      }
    }

  }
}

function validatePrimaryJointSpacing(
  separatorsById: Map<string, StandardSeparatorDefinition>,
  mortisePositionsById: Map<string, number[]>,
): void {
  for (const [separatorId, positions] of mortisePositionsById.entries()) {
    const separator = separatorsById.get(separatorId);

    if (separator === undefined || positions.length < 2) {
      continue;
    }

    const sortedPositions = [...positions].sort((left, right) => left - right);

    for (let index = 1; index < sortedPositions.length; index += 1) {
      const previous = sortedPositions[index - 1];
      const current = sortedPositions[index];

      if (previous === undefined || current === undefined) {
        continue;
      }

      if ((current - previous) < STANDARD_PRIMARY_MIN_JOINT_SPACING) {
        throw new Error(`Standard primary separator ${separator.id} must keep at least ${STANDARD_PRIMARY_MIN_JOINT_SPACING} mm between secondary joints.`);
      }
    }
  }
}

function hasReciprocalJoint(separator: StandardSeparatorDefinition, targetId: string): boolean {
  return (separator.crossJoints ?? []).some((joint) => joint.with === targetId);
}

function resolveWallCount(separator: StandardSeparatorDefinition, dimensions: Box50Dimensions): number {
  const maxSpan = separator.orientation === "vertical"
    ? dimensions.internalDepth
    : dimensions.internalWidth;
  let count = 0;

  if (approxEqual(separator.spanStart, 0)) {
    count += 1;
  }

  if (approxEqual(separator.spanEnd, maxSpan)) {
    count += 1;
  }

  return count;
}

function spansOverlap(leftStart: number, leftEnd: number, rightStart: number, rightEnd: number): boolean {
  return Math.max(leftStart, rightStart) < Math.min(leftEnd, rightEnd);
}

function validateSecondaryConnectivity(separators: StandardSeparatorDefinition[], dimensions: Box50Dimensions): void {
  for (const separator of separators) {
    if (separator.role !== "secondary") {
      continue;
    }

    if ((separator.crossJoints?.length ?? 0) === 0 && resolveWallCount(separator, dimensions) < 2) {
      throw new Error(`Standard secondary separator ${separator.id} must either connect to another separator or reach both walls.`);
    }
  }
}