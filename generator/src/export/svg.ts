import { compensatePanelKerf, toSvgPathData, translateClosedPath } from "../core/geometry.js";
import { formatMillimeters } from "../core/box50.js";
import type { Box50Project, PanelGeometry } from "../core/types.js";

export type SvgRenderMode = "layout" | "cut";

interface PositionedPanelGeometry extends PanelGeometry {
  x: number;
  y: number;
}

interface PreviewPanelPlacement extends PositionedPanelGeometry {
  previewNumber: number;
}

const PAGE_MARGIN = 12;
const PANEL_GAP = 10;
const HEADER_HEIGHT = 58;
const LEGEND_GAP = 16;
const LEGEND_WIDTH = 150;
const MARKER_RADIUS = 4.5;

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

  const contentWidth = positionedPanels.reduce((max, panel) => Math.max(max, panel.x + panel.width), 0);
  const contentHeight = positionedPanels.reduce((max, panel) => Math.max(max, panel.y + panel.height), 0);
  const sheetWidth = contentWidth - PAGE_MARGIN;
  const sheetHeight = contentHeight - (PAGE_MARGIN + HEADER_HEIGHT);
  const legendX = PAGE_MARGIN + sheetWidth + LEGEND_GAP;
  const legendBottom = renderLegendBottom(positionedPanels);
  const width = legendX + LEGEND_WIDTH + PAGE_MARGIN;
  const height = Math.max(contentHeight + PAGE_MARGIN, legendBottom + PAGE_MARGIN);

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
    `.meta { font-size: 4.2px; }`,
    `.label { font-size: 5px; font-weight: 600; }`,
    `.note { font-size: 3.2px; }`,
    `.sheet { fill: #f8fafc; stroke: #64748b; stroke-width: 0.5; stroke-dasharray: 3 2; }`,
    `.part { fill: #e2e8f0; stroke: #0f172a; stroke-width: 0.4; }`,
    `.inner-cut { fill: rgba(148, 163, 184, 0.18); stroke: #475569; stroke-width: 0.25; }`,
    `.marker-line { stroke: #64748b; stroke-width: 0.35; }`,
    `.marker-badge { fill: #ffffff; stroke: #0f172a; stroke-width: 0.35; }`,
    `.marker-text { font-size: 3.2px; font-weight: 700; text-anchor: middle; dominant-baseline: central; }`,
    `.legend-box { fill: #ffffff; stroke: #cbd5e1; stroke-width: 0.4; }`,
    `.legend-title { font-size: 5px; font-weight: 700; }`,
    `.legend-item { font-size: 3.4px; }`,
    `</style>`,
    `<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />`,
    summaryMarkup,
    envelopeMarkup,
    panelMarkup,
    legendMarkup,
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

  return [
    `<text x="${PAGE_MARGIN}" y="${PAGE_MARGIN}" class="title">Box50 Layout</text>`,
    `<text x="${PAGE_MARGIN}" y="${PAGE_MARGIN + 8}" class="meta">Type ${config.type} • Material ${formatMillimeters(config.materialThickness)} • Kerf ${formatMillimeters(config.kerf)}</text>`,
    `<text x="${PAGE_MARGIN}" y="${PAGE_MARGIN + 14}" class="meta">External ${dimensions.externalWidth} × ${dimensions.externalDepth} × ${dimensions.externalHeight} mm</text>`,
    `<text x="${PAGE_MARGIN}" y="${PAGE_MARGIN + 20}" class="meta">Internal ${dimensions.internalWidth.toFixed(2)} × ${dimensions.internalDepth.toFixed(2)} × ${dimensions.internalHeight.toFixed(2)} mm</text>`,
    `<text x="${PAGE_MARGIN}" y="${PAGE_MARGIN + 26}" class="meta">Required sheet envelope ${sheetWidth.toFixed(2)} × ${sheetHeight.toFixed(2)} mm</text>`,
    `<text x="${PAGE_MARGIN}" y="${PAGE_MARGIN + 32}" class="meta">Layout shows placed parts and internal cuts for sheet-size estimation.</text>`,
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
  const markerMarkup = renderPreviewMarker(panel);

  return [
    `<g>`,
    `<path d="${toSvgPathData(translatedOuterPath)}" class="part" />`,
    innerCutMarkup,
    markerMarkup,
    `</g>`,
  ].join("\n");
}

function renderPreviewMarker(panel: PreviewPanelPlacement): string {
  const anchorX = panel.x + (panel.width / 2);
  const anchorY = panel.y;
  const badgeCenterY = Math.max(PAGE_MARGIN + HEADER_HEIGHT - 6, anchorY - (MARKER_RADIUS + 3));
  const connectorTopY = badgeCenterY + MARKER_RADIUS;

  return [
    `<line x1="${anchorX}" y1="${connectorTopY}" x2="${anchorX}" y2="${anchorY}" class="marker-line" />`,
    `<circle cx="${anchorX}" cy="${badgeCenterY}" r="${MARKER_RADIUS}" class="marker-badge" />`,
    `<text x="${anchorX}" y="${badgeCenterY}" class="marker-text">${panel.previewNumber}</text>`,
  ].join("\n");
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
  const positioned: PositionedPanelGeometry[] = [];
  let currentX = startX;
  let currentY = startY;
  let rowHeight = 0;
  const maxRowWidth = 420;

  for (const panel of panels) {
    for (let index = 0; index < panel.quantity; index += 1) {
      if (currentX > startX && currentX + panel.width > maxRowWidth) {
        currentX = startX;
        currentY += rowHeight + PANEL_GAP;
        rowHeight = 0;
      }

      positioned.push({
        ...panel,
        quantity: 1,
        x: currentX,
        y: currentY,
      });

      currentX += panel.width + PANEL_GAP;
      rowHeight = Math.max(rowHeight, panel.height);
    }
  }

  return positioned;
}

function renderLegend(panels: PreviewPanelPlacement[], legendX: number): string {
  const titleY = PAGE_MARGIN + HEADER_HEIGHT;
  const itemStartY = titleY + 12;
  const itemGap = 16;
  const height = renderLegendBottom(panels) - titleY;

  const items = panels.map((panel, index) => {
    const itemY = itemStartY + (index * itemGap);
    const badgeX = legendX + 8;
    const name = `${panel.name} ×${panel.quantity}`;
    const dims = `${formatDisplayNumber(panel.width)} × ${formatDisplayNumber(panel.height)} mm`;
    const note = truncateText(panel.note, 34);

    return [
      `<circle cx="${badgeX}" cy="${itemY}" r="${MARKER_RADIUS}" class="marker-badge" />`,
      `<text x="${badgeX}" y="${itemY}" class="marker-text">${panel.previewNumber}</text>`,
      `<text x="${legendX + 18}" y="${itemY - 2}" class="legend-item">${escapeXml(name)}</text>`,
      `<text x="${legendX + 18}" y="${itemY + 3}" class="legend-item">${escapeXml(dims)}</text>`,
      `<text x="${legendX + 18}" y="${itemY + 8}" class="legend-item">${escapeXml(note)}</text>`,
    ].join("\n");
  }).join("\n");

  return [
    `<g>`,
    `<rect x="${legendX}" y="${titleY}" width="${LEGEND_WIDTH}" height="${height}" rx="3" class="legend-box" />`,
    `<text x="${legendX + 8}" y="${titleY + 8}" class="legend-title">Placed Parts</text>`,
    items,
    `</g>`,
  ].join("\n");
}

function renderLegendBottom(panels: PreviewPanelPlacement[]): number {
  const titleY = PAGE_MARGIN + HEADER_HEIGHT;
  const itemStartY = titleY + 12;
  const itemGap = 16;
  const lastItemBaseline = itemStartY + Math.max(0, (panels.length - 1) * itemGap);
  return lastItemBaseline + 12;
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