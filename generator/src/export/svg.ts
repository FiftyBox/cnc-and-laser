import { compensatePanelKerf, toSvgPathData, translateClosedPath } from "../core/geometry.js";
import { formatMillimeters } from "../core/box50.js";
import type { Box50Project, PanelGeometry } from "../core/types.js";

export type SvgRenderMode = "layout" | "cut";

interface PositionedPanelGeometry extends PanelGeometry {
  x: number;
  y: number;
  originalWidth: number;
  originalHeight: number;
  rotated: boolean;
}

interface PreviewPanelPlacement extends PositionedPanelGeometry {
  previewNumber: number;
}

interface PreviewPictogram {
  kind: "lid" | "separator";
  label?: "P" | "S";
  orientation?: "horizontal" | "vertical";
}

const PAGE_MARGIN = 12;
const PANEL_GAP = 10;
const HEADER_HEIGHT = 58;
const LEGEND_GAP = 16;
const LEGEND_WIDTH = 168;
const MARKER_RADIUS = 4.5;
const SIDEBAR_SECTION_GAP = 10;
const HEADER_LOGO_SIZE = 26;
const HEADER_CONTENT_X = PAGE_MARGIN + HEADER_LOGO_SIZE + 10;

export function renderProjectSvg(project: Box50Project): string {
  return renderProjectSvgWithMode(project, "layout");
}

export function renderProjectSvgWithMode(project: Box50Project, mode: SvgRenderMode): string {
  return mode === "cut"
    ? renderCutSvg(project)
    : renderLayoutSvg(project);
}

function renderLayoutSvg(project: Box50Project): string {
  const positionedPanels = layoutPanelGeometries(project.panelGeometries, PAGE_MARGIN, PAGE_MARGIN + HEADER_HEIGHT)
    .map((panel, index) => ({
      ...panel,
      previewNumber: index + 1,
    } satisfies PreviewPanelPlacement));

  const layoutBounds = getPositionedPanelsBounds(positionedPanels);
  const sheetWidth = layoutBounds.maxX - PAGE_MARGIN;
  const sheetHeight = layoutBounds.maxY - (PAGE_MARGIN + HEADER_HEIGHT);
  const legendX = PAGE_MARGIN + sheetWidth + LEGEND_GAP;
  const legendBottom = renderLegendBottom(positionedPanels);
  const assemblyPlan = renderAssemblyPlan(project, positionedPanels, legendX, legendBottom + SIDEBAR_SECTION_GAP);
  const width = legendX + LEGEND_WIDTH + PAGE_MARGIN;
  const height = Math.max(layoutBounds.maxY + PAGE_MARGIN, assemblyPlan.bottom + PAGE_MARGIN);

  const panelMarkup = positionedPanels.map((panel) => renderPreviewPanel(panel)).join("\n");
  const summaryMarkup = renderSummary(project, sheetWidth, sheetHeight);
  const envelopeMarkup = renderSheetEnvelope(sheetWidth, sheetHeight);
  const legendMarkup = renderLegend(positionedPanels, legendX);

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}">`,
    `<style>`,
    `text { font-family: "Segoe UI", sans-serif; fill: #1f2937; }`,
    `.title { font-size: 8px; font-weight: 700; }`,
    `.subtitle { font-size: 6px; font-weight: 700; fill: #0f172a; }`,
    `.meta { font-size: 4.2px; }`,
    `.label { font-size: 5px; font-weight: 600; }`,
    `.note { font-size: 3.2px; }`,
    `.logo-frame { fill: #ffffff; stroke: #0f172a; stroke-width: 0.8; }`,
    `.logo-solid { fill: #0f172a; }`,
    `.logo-line { fill: none; stroke: #0f172a; stroke-width: 0.8; stroke-linecap: round; stroke-linejoin: round; }`,
    `.sheet { fill: #f8fafc; stroke: #64748b; stroke-width: 0.5; stroke-dasharray: 3 2; }`,
    `.part { fill: #e2e8f0; stroke: #0f172a; stroke-width: 0.4; }`,
    `.inner-cut { fill: rgba(148, 163, 184, 0.18); stroke: #475569; stroke-width: 0.25; }`,
    `.marker-line { stroke: #64748b; stroke-width: 0.35; }`,
    `.marker-badge { fill: #ffffff; stroke: #0f172a; stroke-width: 0.35; }`,
    `.marker-text { font-size: 3.2px; font-weight: 700; text-anchor: middle; dominant-baseline: central; }`,
    `.pictogram-line { fill: none; stroke: #0f172a; stroke-width: 0.8; stroke-linecap: round; stroke-linejoin: round; opacity: 0.9; }`,
    `.pictogram-chip { fill: #ffffff; stroke: #0f172a; stroke-width: 0.5; }`,
    `.pictogram-text { font-size: 4px; font-weight: 700; text-anchor: middle; dominant-baseline: central; fill: #0f172a; }`,
    `.legend-box { fill: #ffffff; stroke: #cbd5e1; stroke-width: 0.4; }`,
    `.legend-title { font-size: 5px; font-weight: 700; }`,
    `.legend-item { font-size: 3.4px; }`,
    `</style>`,
    `<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />`,
    summaryMarkup,
    envelopeMarkup,
    panelMarkup,
    legendMarkup,
    assemblyPlan.markup,
    `</svg>`,
  ].join("\n");
}

function renderCutSvg(project: Box50Project): string {
  const positionedPanels = layoutPanelGeometries(project.panelGeometries);
  const translatedPaths = positionedPanels.flatMap((panel) => {
    const compensatedPanel = compensatePanelKerf(panel, project.config.kerf);

    return compensatedPanel.cutPaths.map((path) => translateClosedPath(path, { x: panel.x, y: panel.y }));
  });
  const pathBounds = translatedPaths.flatMap((path) => path.points);
  const maxX = pathBounds.reduce((max, point) => Math.max(max, point.x), 0);
  const maxY = pathBounds.reduce((max, point) => Math.max(max, point.y), 0);
  const width = maxX + PAGE_MARGIN;
  const height = maxY + PAGE_MARGIN;

  const pathMarkup = translatedPaths.map((path) => `<path d="${toSvgPathData(path)}" class="cut" />`).join("\n");

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}">`,
    `<style>`,
    `.cut { fill: none; stroke: #000000; stroke-width: 0.15; vector-effect: non-scaling-stroke; }`,
    `</style>`,
    `<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />`,
    pathMarkup,
    `</svg>`,
  ].join("\n");
}

function renderSummary(project: Box50Project, sheetWidth: number, sheetHeight: number): string {
  const { config, dimensions } = project;
  const projectName = formatProjectName(project);

  return [
    renderBox50Logo(PAGE_MARGIN, PAGE_MARGIN - 2),
    `<text x="${HEADER_CONTENT_X}" y="${PAGE_MARGIN + 5}" class="subtitle">${escapeXml(projectName)}</text>`,
    `<text x="${HEADER_CONTENT_X}" y="${PAGE_MARGIN + 12}" class="meta">Profile ${config.type} • Material ${formatMillimeters(config.materialThickness)} • Kerf ${formatMillimeters(config.kerf)}</text>`,
    `<text x="${HEADER_CONTENT_X}" y="${PAGE_MARGIN + 18}" class="meta">External ${dimensions.externalWidth} × ${dimensions.externalDepth} × ${dimensions.externalHeight} mm</text>`,
    `<text x="${HEADER_CONTENT_X}" y="${PAGE_MARGIN + 24}" class="meta">Internal ${dimensions.internalWidth.toFixed(2)} × ${dimensions.internalDepth.toFixed(2)} × ${dimensions.internalHeight.toFixed(2)} mm</text>`,
    `<text x="${HEADER_CONTENT_X}" y="${PAGE_MARGIN + 30}" class="meta">Required sheet envelope ${sheetWidth.toFixed(2)} × ${sheetHeight.toFixed(2)} mm</text>`,
    `<text x="${HEADER_CONTENT_X}" y="${PAGE_MARGIN + 36}" class="meta">Layout shows placed parts and internal cuts for sheet-size estimation.</text>`,
  ].join("\n");
}

function renderBox50Logo(x: number, y: number): string {
  return [
    `<g transform="translate(${x} ${y})">`,
    `<rect x="0" y="0" width="${HEADER_LOGO_SIZE}" height="${HEADER_LOGO_SIZE}" rx="4" class="logo-frame" />`,
    `<path d="M 5.5 10.5 L 13 6.5 L 20.5 10.5 L 13 14.5 Z" class="logo-line" />`,
    `<path d="M 5.5 10.5 L 5.5 18.2 L 13 22 L 13 14.5" class="logo-line" />`,
    `<path d="M 20.5 10.5 L 20.5 18.2 L 13 22 L 13 14.5" class="logo-line" />`,
    `<path d="M 8.2 12.1 L 8.2 16.3 L 10.6 17.5 L 10.6 13.4 Z" class="logo-line" />`,
    `<path d="M 15.4 13.4 L 15.4 17.5 L 17.8 16.3 L 17.8 12.1 Z" class="logo-line" />`,
    `<path d="M 11.6 15.6 L 14.4 17" class="logo-line" />`,
    `<rect x="6.2" y="6.2" width="2.1" height="2.1" class="logo-solid" rx="0.5" />`,
    `<rect x="17.7" y="6.2" width="2.1" height="2.1" class="logo-solid" rx="0.5" />`,
    `</g>`,
  ].join("\n");
}

function renderSheetEnvelope(sheetWidth: number, sheetHeight: number): string {
  return `<rect x="${PAGE_MARGIN}" y="${PAGE_MARGIN + HEADER_HEIGHT}" width="${sheetWidth}" height="${sheetHeight}" class="sheet" />`;
}

function renderPreviewPanel(panel: PreviewPanelPlacement): string {
  const outerPath = panel.cutPaths[0];
  const translatedOuterPath = outerPath === undefined
    ? undefined
    : translateClosedPath(outerPath, { x: panel.x, y: panel.y });

  if (translatedOuterPath === undefined) {
    throw new Error(`Panel ${panel.name} must contain an outer path.`);
  }

  const innerCutMarkup = panel.cutPaths.slice(1).map((path) => {
    const translatedPath = translateClosedPath(path, { x: panel.x, y: panel.y });
    return `<path d="${toSvgPathData(translatedPath)}" class="inner-cut" />`;
  }).join("\n");
  const pictogramMarkup = renderPreviewPictogram(panel, translatedOuterPath);
  const markerMarkup = renderPreviewMarker(panel, translatedOuterPath);

  return [
    `<g>`,
    `<path d="${toSvgPathData(translatedOuterPath)}" class="part" />`,
    innerCutMarkup,
    pictogramMarkup,
    markerMarkup,
    `</g>`,
  ].join("\n");
}

function getPositionedPanelsBounds(panels: PositionedPanelGeometry[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  const translatedPoints = panels.flatMap((panel) => panel.cutPaths.flatMap((path) => translateClosedPath(path, { x: panel.x, y: panel.y }).points));

  if (translatedPoints.length === 0) {
    return {
      minX: PAGE_MARGIN,
      minY: PAGE_MARGIN + HEADER_HEIGHT,
      maxX: PAGE_MARGIN,
      maxY: PAGE_MARGIN + HEADER_HEIGHT,
    };
  }

  return getPointsBounds(translatedPoints);
}

function renderPreviewMarker(panel: PreviewPanelPlacement, translatedOuterPath: { points: Array<{ x: number; y: number }> }): string {
  const outerBounds = getPointsBounds(translatedOuterPath.points);
  const anchorX = (outerBounds.minX + outerBounds.maxX) / 2;
  const anchorY = outerBounds.minY;
  const badgeCenterY = Math.max(PAGE_MARGIN + HEADER_HEIGHT - 6, anchorY - (MARKER_RADIUS + 3));
  const connectorTopY = badgeCenterY + MARKER_RADIUS;

  return [
    `<line x1="${anchorX}" y1="${connectorTopY}" x2="${anchorX}" y2="${anchorY}" class="marker-line" />`,
    `<circle cx="${anchorX}" cy="${badgeCenterY}" r="${MARKER_RADIUS}" class="marker-badge" />`,
    `<text x="${anchorX}" y="${badgeCenterY}" class="marker-text">${panel.previewNumber}</text>`,
  ].join("\n");
}

function renderPreviewPictogram(panel: PreviewPanelPlacement, translatedOuterPath: { points: Array<{ x: number; y: number }> }): string {
  const pictogram = resolvePreviewPictogram(panel);

  if (pictogram === undefined) {
    return "";
  }

  const bounds = getPointsBounds(translatedOuterPath.points);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const availableWidth = bounds.maxX - bounds.minX;
  const availableHeight = bounds.maxY - bounds.minY;

  if (pictogram.kind === "lid") {
    return renderLidPictogram(centerX, centerY, availableWidth, availableHeight);
  }

  return renderSeparatorPictogram(centerX, centerY, availableWidth, availableHeight, pictogram);
}

function resolvePreviewPictogram(panel: PreviewPanelPlacement): PreviewPictogram | undefined {
  if (panel.name === "lid") {
    return { kind: "lid" };
  }

  if (!panel.name.startsWith("separator:")) {
    return undefined;
  }

  const label = panel.note.includes("primary separator") ? "P" : panel.note.includes("secondary separator") ? "S" : undefined;
  const orientation = panel.note.includes(", vertical span")
    ? "vertical"
    : panel.note.includes(", horizontal span")
      ? "horizontal"
      : undefined;

  if (label === undefined || orientation === undefined) {
    return undefined;
  }

  return {
    kind: "separator",
    label,
    orientation,
  };
}

function renderLidPictogram(centerX: number, centerY: number, availableWidth: number, availableHeight: number): string {
  const horizontal = availableWidth >= availableHeight;
  const length = Math.max(16, Math.min(horizontal ? availableWidth - 16 : availableHeight - 16, 34));
  const arrowSize = 3.5;

  if (horizontal) {
    const startX = centerX - (length / 2);
    const endX = centerX + (length / 2);

    return [
      `<line x1="${startX}" y1="${centerY}" x2="${endX}" y2="${centerY}" class="pictogram-line" />`,
      `<path d="M ${startX + arrowSize} ${centerY - arrowSize} L ${startX} ${centerY} L ${startX + arrowSize} ${centerY + arrowSize}" class="pictogram-line" />`,
      `<path d="M ${endX - arrowSize} ${centerY - arrowSize} L ${endX} ${centerY} L ${endX - arrowSize} ${centerY + arrowSize}" class="pictogram-line" />`,
    ].join("\n");
  }

  const startY = centerY - (length / 2);
  const endY = centerY + (length / 2);

  return [
    `<line x1="${centerX}" y1="${startY}" x2="${centerX}" y2="${endY}" class="pictogram-line" />`,
    `<path d="M ${centerX - arrowSize} ${startY + arrowSize} L ${centerX} ${startY} L ${centerX + arrowSize} ${startY + arrowSize}" class="pictogram-line" />`,
    `<path d="M ${centerX - arrowSize} ${endY - arrowSize} L ${centerX} ${endY} L ${centerX + arrowSize} ${endY - arrowSize}" class="pictogram-line" />`,
  ].join("\n");
}

function renderSeparatorPictogram(
  centerX: number,
  centerY: number,
  availableWidth: number,
  availableHeight: number,
  pictogram: PreviewPictogram,
): string {
  const chipRadius = 5;
  const lineLength = Math.max(16, Math.min((pictogram.orientation === "horizontal" ? availableWidth : availableHeight) - 18, 28));

  if (pictogram.orientation === "horizontal") {
    const startX = centerX - (lineLength / 2);
    const endX = centerX + (lineLength / 2);

    return [
      `<line x1="${startX}" y1="${centerY}" x2="${endX}" y2="${centerY}" class="pictogram-line" />`,
      `<circle cx="${centerX}" cy="${centerY}" r="${chipRadius}" class="pictogram-chip" />`,
      `<text x="${centerX}" y="${centerY}" class="pictogram-text">${pictogram.label ?? "?"}</text>`,
    ].join("\n");
  }

  const startY = centerY - (lineLength / 2);
  const endY = centerY + (lineLength / 2);

  return [
    `<line x1="${centerX}" y1="${startY}" x2="${centerX}" y2="${endY}" class="pictogram-line" />`,
    `<circle cx="${centerX}" cy="${centerY}" r="${chipRadius}" class="pictogram-chip" />`,
    `<text x="${centerX}" y="${centerY}" class="pictogram-text">${pictogram.label ?? "?"}</text>`,
  ].join("\n");
}

function getPointsBounds(points: Array<{ x: number; y: number }>): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  return points.reduce((bounds, point) => ({
    minX: Math.min(bounds.minX, point.x),
    minY: Math.min(bounds.minY, point.y),
    maxX: Math.max(bounds.maxX, point.x),
    maxY: Math.max(bounds.maxY, point.y),
  }), {
    minX: points[0]!.x,
    minY: points[0]!.y,
    maxX: points[0]!.x,
    maxY: points[0]!.y,
  });
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function layoutPanelGeometries(panels: PanelGeometry[], startX = PAGE_MARGIN, startY = PAGE_MARGIN): PositionedPanelGeometry[] {
  const expandedPanels = panels.flatMap((panel) => Array.from({ length: panel.quantity }, () => ({
    ...panel,
    quantity: 1,
    x: 0,
    y: 0,
    originalWidth: panel.width,
    originalHeight: panel.height,
    rotated: false,
  } satisfies PositionedPanelGeometry)));
  const packedPanels = packPanelGeometries(expandedPanels);

  return packedPanels.map((panel) => ({
    ...panel,
    x: panel.x + startX,
    y: panel.y + startY,
  }));
}

interface PackedShelf {
  y: number;
  height: number;
  usedWidth: number;
}

interface PackedLayout {
  panels: PositionedPanelGeometry[];
  score: number;
}

interface SidebarSectionMarkup {
  markup: string;
  bottom: number;
}

function packPanelGeometries(panels: PositionedPanelGeometry[]): PositionedPanelGeometry[] {
  if (panels.length === 0) {
    return [];
  }

  const sortedPanels = [...panels].sort(comparePanelsForPacking);
  const candidateWidths = buildPackingWidthCandidates(sortedPanels);
  let bestLayout: PackedLayout | undefined;

  for (const candidateWidth of candidateWidths) {
    const packedLayout = packPanelsForWidth(sortedPanels, candidateWidth);

    if (packedLayout === undefined) {
      continue;
    }

    if (bestLayout === undefined || packedLayout.score < bestLayout.score) {
      bestLayout = packedLayout;
    }
  }

  if (bestLayout === undefined) {
    throw new Error("Failed to place panel geometries on the layout sheet.");
  }

  return bestLayout.panels;
}

function packPanelsForWidth(panels: PositionedPanelGeometry[], sheetWidth: number): PackedLayout | undefined {
  const shelves: PackedShelf[] = [];
  const packedPanels: PositionedPanelGeometry[] = [];

  for (const panel of panels) {
    const variants = createPackingVariants(panel);
    let selectedPlacement: {
      variant: PositionedPanelGeometry;
      shelfIndex: number;
      x: number;
      y: number;
      isNewShelf: boolean;
    } | undefined;

    for (const variant of variants) {
      for (let shelfIndex = 0; shelfIndex < shelves.length; shelfIndex += 1) {
        const shelf = shelves[shelfIndex];

        if (shelf === undefined || variant.height > shelf.height) {
          continue;
        }

        const x = shelf.usedWidth === 0 ? 0 : shelf.usedWidth + PANEL_GAP;

        if ((x + variant.width) > sheetWidth) {
          continue;
        }

        if (selectedPlacement === undefined) {
          selectedPlacement = {
            variant,
            shelfIndex,
            x,
            y: shelf.y,
            isNewShelf: false,
          };
          continue;
        }

        const currentRight = selectedPlacement.x + selectedPlacement.variant.width;
        const candidateRight = x + variant.width;

        if (candidateRight < currentRight || (candidateRight === currentRight && shelf.y < selectedPlacement.y)) {
          selectedPlacement = {
            variant,
            shelfIndex,
            x,
            y: shelf.y,
            isNewShelf: false,
          };
        }
      }
    }

    if (selectedPlacement === undefined) {
      for (const variant of variants) {
        if (variant.width > sheetWidth) {
          continue;
        }

        const y = shelves.length === 0
          ? 0
          : shelves[shelves.length - 1]!.y + shelves[shelves.length - 1]!.height + PANEL_GAP;

        if (selectedPlacement === undefined || variant.height < selectedPlacement.variant.height || (variant.height === selectedPlacement.variant.height && variant.width < selectedPlacement.variant.width)) {
          selectedPlacement = {
            variant,
            shelfIndex: shelves.length,
            x: 0,
            y,
            isNewShelf: true,
          };
        }
      }
    }

    if (selectedPlacement === undefined) {
      return undefined;
    }

    packedPanels.push({
      ...selectedPlacement.variant,
      x: selectedPlacement.x,
      y: selectedPlacement.y,
    });

    if (selectedPlacement.isNewShelf) {
      shelves.push({
        y: selectedPlacement.y,
        height: selectedPlacement.variant.height,
        usedWidth: selectedPlacement.variant.width,
      });
      continue;
    }

    const shelf = shelves[selectedPlacement.shelfIndex];

    if (shelf === undefined) {
      throw new Error("Packing shelf must exist.");
    }

    shelf.usedWidth = selectedPlacement.x + selectedPlacement.variant.width;
  }

  const usedWidth = shelves.reduce((max, shelf) => Math.max(max, shelf.usedWidth), 0);
  const usedHeight = shelves.length === 0
    ? 0
    : shelves[shelves.length - 1]!.y + shelves[shelves.length - 1]!.height;

  return {
    panels: packedPanels,
    score: calculatePackingScore(usedWidth, usedHeight),
  };
}

function calculatePackingScore(width: number, height: number): number {
  if (width <= 0 || height <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  const area = width * height;
  const aspectRatio = Math.max(width, height) / Math.min(width, height);
  return area * aspectRatio;
}

function buildPackingWidthCandidates(panels: PositionedPanelGeometry[]): number[] {
  const maxPanelWidth = panels.reduce((max, panel) => Math.max(max, panel.width, panel.height), 0);
  const totalArea = panels.reduce((sum, panel) => sum + (panel.width * panel.height), 0);
  const dominantWidths = [...panels]
    .map((panel) => Math.max(panel.width, panel.height))
    .sort((left, right) => right - left);
  const narrowWidths = [...panels]
    .map((panel) => Math.min(panel.width, panel.height))
    .sort((left, right) => right - left);
  const candidates = new Set<number>([
    maxPanelWidth,
    Math.ceil(Math.sqrt(totalArea)),
    Math.ceil(Math.sqrt(totalArea) * 1.15),
    Math.ceil(Math.sqrt(totalArea) * 1.3),
  ]);

  let dominantCumulative = 0;

  for (let index = 0; index < dominantWidths.length; index += 1) {
    dominantCumulative += dominantWidths[index] ?? 0;
    candidates.add(dominantCumulative + (index * PANEL_GAP));
  }

  let narrowCumulative = 0;

  for (let index = 0; index < narrowWidths.length; index += 1) {
    narrowCumulative += narrowWidths[index] ?? 0;
    candidates.add(Math.max(maxPanelWidth, narrowCumulative + (index * PANEL_GAP)));
  }

  return [...candidates]
    .filter((candidate) => Number.isFinite(candidate) && candidate >= maxPanelWidth)
    .sort((left, right) => left - right);
}

function comparePanelsForPacking(left: PositionedPanelGeometry, right: PositionedPanelGeometry): number {
  const leftMaxDimension = Math.max(left.width, left.height);
  const rightMaxDimension = Math.max(right.width, right.height);

  if (leftMaxDimension !== rightMaxDimension) {
    return rightMaxDimension - leftMaxDimension;
  }

  if (left.height !== right.height) {
    return right.height - left.height;
  }

  if (left.width !== right.width) {
    return right.width - left.width;
  }

  return left.name.localeCompare(right.name);
}

function createPackingVariants(panel: PositionedPanelGeometry): PositionedPanelGeometry[] {
  const variants = [panel];

  if (panel.width !== panel.height) {
    variants.push(rotatePanelGeometry(panel));
  }

  return variants;
}

function rotatePanelGeometry(panel: PositionedPanelGeometry): PositionedPanelGeometry {
  return {
    ...panel,
    width: panel.height,
    height: panel.width,
    rotated: !panel.rotated,
    cutPaths: panel.cutPaths.map((path) => ({
      points: path.points.map((point) => ({
        x: panel.height - point.y,
        y: point.x,
      })),
    })),
  };
}

function renderLegend(panels: PreviewPanelPlacement[], legendX: number): string {
  const titleY = PAGE_MARGIN + HEADER_HEIGHT;
  const itemStartY = titleY + 20;
  const itemGap = 17;
  const height = renderLegendBottom(panels) - titleY;
  const textColumnX = legendX + 20;

  const items = panels.map((panel, index) => {
    const itemY = itemStartY + (index * itemGap);
    const badgeX = legendX + 8;
    const name = `${formatLegendPanelName(panel.name)} ×${panel.quantity}`;
    const dims = `${formatDisplayNumber(panel.originalWidth)} × ${formatDisplayNumber(panel.originalHeight)} mm`;
    const note = truncateText(panel.note, 34);

    return [
      `<circle cx="${badgeX}" cy="${itemY}" r="${MARKER_RADIUS}" class="marker-badge" />`,
      `<text x="${badgeX}" y="${itemY}" class="marker-text">${panel.previewNumber}</text>`,
      `<text x="${textColumnX}" y="${itemY - 2}" class="legend-item">${escapeXml(name)}</text>`,
      `<text x="${textColumnX}" y="${itemY + 3}" class="legend-item">${escapeXml(dims)}</text>`,
      `<text x="${textColumnX}" y="${itemY + 8}" class="legend-item">${escapeXml(note)}</text>`,
    ].join("\n");
  }).join("\n");

  return [
    `<g>`,
    `<rect x="${legendX}" y="${titleY}" width="${LEGEND_WIDTH}" height="${height}" rx="3" class="legend-box" />`,
    `<text x="${textColumnX}" y="${titleY + 9}" class="legend-title">Placed Parts</text>`,
    items,
    `</g>`,
  ].join("\n");
}

function renderAssemblyPlan(
  project: Box50Project,
  panels: PreviewPanelPlacement[],
  legendX: number,
  startY: number,
): SidebarSectionMarkup {
  const steps = buildAssemblySteps(project, panels);
  const stepBadgeX = legendX + 8;
  const textColumnX = legendX + 20;
  let currentY = startY + 20;

  const items = steps.map((step, index) => {
    const lines = wrapText(step, 34, 3);
    const badgeY = currentY;
    const markup = [
      `<circle cx="${stepBadgeX}" cy="${badgeY}" r="${MARKER_RADIUS}" class="marker-badge" />`,
      `<text x="${stepBadgeX}" y="${badgeY}" class="marker-text">${index + 1}</text>`,
      ...lines.map((line, lineIndex) => `<text x="${textColumnX}" y="${currentY - 2 + (lineIndex * 5)}" class="legend-item">${escapeXml(line)}</text>`),
    ].join("\n");

    currentY += (lines.length * 5) + 8;
    return markup;
  }).join("\n");

  const bottom = currentY + 2;
  const height = bottom - startY;

  return {
    markup: [
      `<g>`,
      `<rect x="${legendX}" y="${startY}" width="${LEGEND_WIDTH}" height="${height}" rx="3" class="legend-box" />`,
      `<text x="${textColumnX}" y="${startY + 9}" class="legend-title">Assembly Plan</text>`,
      items,
      `</g>`,
    ].join("\n"),
    bottom,
  };
}

function renderLegendBottom(panels: PreviewPanelPlacement[]): number {
  const titleY = PAGE_MARGIN + HEADER_HEIGHT;
  const itemStartY = titleY + 20;
  const itemGap = 17;
  const lastItemBaseline = itemStartY + Math.max(0, (panels.length - 1) * itemGap);
  return lastItemBaseline + 14;
}

function formatLegendPanelName(name: string): string {
  if (name === "bottom") {
    return "Bottom";
  }

  if (name === "front-back") {
    return "Front/back wall";
  }

  if (name === "left-right") {
    return "Left/right wall";
  }

  if (name === "lid") {
    return "Sliding lid";
  }

  if (name.startsWith("separator:")) {
    const separatorId = name.slice("separator:".length).replaceAll("-", " ");
    return `Separator ${separatorId}`;
  }

  return name.replaceAll("-", " ");
}

function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  if (text.length <= maxChars) {
    return [text];
  }

  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine.length === 0 ? word : `${currentLine} ${word}`;

    if (candidate.length <= maxChars) {
      currentLine = candidate;
      continue;
    }

    if (currentLine.length > 0) {
      lines.push(currentLine);
    }

    currentLine = word;

    if (lines.length === maxLines - 1) {
      break;
    }
  }

  if (lines.length < maxLines && currentLine.length > 0) {
    lines.push(currentLine);
  }

  if (lines.length === 0) {
    return [truncateText(text, maxChars)];
  }

  if (lines.length === maxLines) {
    const lastLine = lines[maxLines - 1];

    if (lastLine !== undefined) {
      lines[maxLines - 1] = truncateText(lastLine, maxChars);
    }
  }

  return lines;
}

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }

  if (maxChars <= 1) {
    return text.slice(0, maxChars);
  }

  return `${text.slice(0, Math.max(0, maxChars - 1))}…`;
}

function formatDisplayNumber(value: number): string {
  return Number(value.toFixed(2)).toString();
}

function formatProjectName(project: Box50Project): string {
  const layoutId = project.config.standardLayout?.id;

  if (layoutId !== undefined) {
    return humanizeIdentifier(layoutId);
  }

  return project.config.type === "standard"
    ? "Standard Layout"
    : "Finalized Preset";
}

function humanizeIdentifier(value: string): string {
  return value
    .split(/[-_]+/)
    .filter((segment) => segment.length > 0)
    .map((segment) => segment[0]?.toUpperCase() === segment[0]
      ? segment
      : `${segment[0]?.toUpperCase() ?? ""}${segment.slice(1)}`)
    .join(" ");
}

function buildAssemblySteps(project: Box50Project, panels: PreviewPanelPlacement[]): string[] {
  const layoutSeparators = new Map((project.config.standardLayout?.separators ?? []).map((separator) => [separator.id, separator]));
  const bottomRefs = collectPreviewNumbers(panels, (panel) => panel.name === "bottom");
  const wallRefs = collectPreviewNumbers(panels, (panel) => panel.name === "front-back" || panel.name === "left-right");
  const primarySeparatorRefs = collectPreviewNumbers(panels, (panel) => {
    if (!panel.name.startsWith("separator:")) {
      return false;
    }

    const separatorId = panel.name.slice("separator:".length);
    return layoutSeparators.get(separatorId)?.role === "primary";
  });
  const secondarySeparatorRefs = collectPreviewNumbers(panels, (panel) => {
    if (!panel.name.startsWith("separator:")) {
      return false;
    }

    const separatorId = panel.name.slice("separator:".length);
    return layoutSeparators.get(separatorId)?.role === "secondary";
  });
  const lidRefs = collectPreviewNumbers(panels, (panel) => panel.name === "lid");

  const steps: string[] = [];

  if (bottomRefs.length > 0) {
    steps.push(`Lay ${formatPreviewReferences(bottomRefs)} flat on the bench as the base.`);
  }

  if (wallRefs.length > 0) {
    steps.push(`Fit ${formatPreviewReferences(wallRefs)} into the bottom slots and keep the shell square.`);
  }

  if (primarySeparatorRefs.length > 0) {
    steps.push(`Insert ${formatPreviewReferences(primarySeparatorRefs)} into the bottom mortises first.`);
  }

  if (secondarySeparatorRefs.length > 0) {
    steps.push(`Lock ${formatPreviewReferences(secondarySeparatorRefs)} into the primaries and side walls.`);
  }

  if (lidRefs.length > 0) {
    steps.push(`Check the rail path, then slide ${formatPreviewReferences(lidRefs)} into place.`);
  }

  steps.push("Do a full dry-fit before glue, screws, or final clamping.");
  return steps;
}

function collectPreviewNumbers(
  panels: PreviewPanelPlacement[],
  predicate: (panel: PreviewPanelPlacement) => boolean,
): number[] {
  return panels
    .filter(predicate)
    .map((panel) => panel.previewNumber)
    .sort((left, right) => left - right);
}

function formatPreviewReferences(numbers: number[]): string {
  if (numbers.length === 0) {
    return "the matching parts";
  }

  if (numbers.length === 1) {
    return `part ${numbers[0]}`;
  }

  return `parts ${numbers.join(", ")}`;
}