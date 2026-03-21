import type { ClosedPath, PanelDefinition, PanelGeometry, Point } from "./types.js";

type EdgeJointStyle = "straight" | "mortise" | "tenon";

const TYPE_A_VERTICAL_JOINT_PITCH = 12.5;

export function createRectanglePath(width: number, height: number): ClosedPath {
  return createOffsetRectanglePath(0, 0, width, height);
}

export function createOffsetRectanglePath(x: number, y: number, width: number, height: number): ClosedPath {
  return {
    points: [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ],
  };
}

export function createPanelGeometry(panel: PanelDefinition): PanelGeometry {
  return {
    ...panel,
    cutPaths: [createRectanglePath(panel.width, panel.height)],
  };
}

export function createTypeABottomPanelGeometry(options: {
  name: string;
  width: number;
  height: number;
  quantity: number;
  note: string;
  materialThickness: number;
}): PanelGeometry {
  return {
    ...options,
    cutPaths: [
      createJointedRectanglePath({
        width: options.width,
        height: options.height,
        materialThickness: options.materialThickness,
        topEdge: "tenon",
        rightEdge: "tenon",
        bottomEdge: "tenon",
        leftEdge: "tenon",
      }),
    ],
  };
}

export function createTypeARailProfilePath(options: {
  panelWidth: number;
  materialThickness: number;
  topOffset: number;
  grooveHeight: number;
  loadingPocketWidth: number;
  loadingPocketExtraDepth: number;
  trailingMargin: number;
}): ClosedPath {
  const startX = options.materialThickness;
  const topY = options.topOffset;
  const endX = options.panelWidth - options.trailingMargin;
  const pocketEndX = startX + options.loadingPocketWidth;
  const grooveBottomY = topY + options.grooveHeight;
  const pocketBottomY = grooveBottomY + options.loadingPocketExtraDepth;

  if (endX <= startX) {
    throw new Error("Rail profile width must be positive.");
  }

  if (pocketEndX >= endX) {
    throw new Error("Rail loading pocket must fit within the side panel width.");
  }

  return {
    points: [
      { x: startX, y: topY },
      { x: endX, y: topY },
      { x: endX, y: grooveBottomY },
      { x: pocketEndX, y: grooveBottomY },
      { x: pocketEndX, y: pocketBottomY },
      { x: startX, y: pocketBottomY },
    ],
  };
}

export function createTypeADividerMortisePaths(options: {
  panelWidth: number;
  panelHeight: number;
  slotWidth: number;
  slotHeight: number;
  gridSpacing: number;
  firstCenterX: number;
  bottomOffset: number;
}): ClosedPath[] {
  const paths: ClosedPath[] = [];
  const slotY = options.panelHeight - options.bottomOffset - options.slotHeight;

  for (let centerX = options.firstCenterX; centerX < options.panelWidth; centerX += options.gridSpacing) {
    const slotX = centerX - (options.slotWidth / 2);

    if (slotX < 0 || slotX + options.slotWidth > options.panelWidth) {
      continue;
    }

    paths.push(createOffsetRectanglePath(slotX, slotY, options.slotWidth, options.slotHeight));
  }

  return paths;
}

export function createTypeADividerPanelGeometry(options: {
  name: string;
  width: number;
  height: number;
  quantity: number;
  note: string;
  tenonDepth: number;
  tenonHeight: number;
  tenonBottomOffset: number;
}): PanelGeometry {
  const bodyLeft = options.tenonDepth;
  const bodyRight = options.width - options.tenonDepth;
  const tenonTopY = options.height - options.tenonBottomOffset - options.tenonHeight;
  const tenonBottomY = options.height - options.tenonBottomOffset;

  return {
    ...options,
    cutPaths: [
      {
        points: dedupeSequentialPoints([
          { x: bodyLeft, y: 0 },
          { x: bodyRight, y: 0 },
          { x: bodyRight, y: tenonTopY },
          { x: options.width, y: tenonTopY },
          { x: options.width, y: tenonBottomY },
          { x: bodyRight, y: tenonBottomY },
          { x: bodyRight, y: options.height },
          { x: bodyLeft, y: options.height },
          { x: bodyLeft, y: tenonBottomY },
          { x: 0, y: tenonBottomY },
          { x: 0, y: tenonTopY },
          { x: bodyLeft, y: tenonTopY },
        ]),
      },
    ],
  };
}

export function createTypeAWallPanelGeometry(options: {
  name: string;
  width: number;
  height: number;
  quantity: number;
  note: string;
  materialThickness: number;
  topEdge: EdgeJointStyle;
  bottomEdge: EdgeJointStyle;
  leftEdge: EdgeJointStyle;
  rightEdge: EdgeJointStyle;
  extraCutPaths?: ClosedPath[];
}): PanelGeometry {
  return {
    ...options,
    cutPaths: [
      createJointedRectanglePath({
        width: options.width,
        height: options.height,
        materialThickness: options.materialThickness,
        topEdge: options.topEdge,
        rightEdge: options.rightEdge,
        bottomEdge: options.bottomEdge,
        leftEdge: options.leftEdge,
      }),
      ...(options.extraCutPaths ?? []),
    ],
  };
}

export function translateClosedPath(path: ClosedPath, offset: Point): ClosedPath {
  return {
    points: path.points.map((point) => ({
      x: point.x + offset.x,
      y: point.y + offset.y,
    })),
  };
}

export function compensatePanelKerf(panel: PanelGeometry, kerf: number): PanelGeometry {
  if (kerf <= 0) {
    return {
      ...panel,
      cutPaths: panel.cutPaths.map((path) => ({
        points: path.points.map((point) => ({ ...point })),
      })),
    };
  }

  const halfKerf = kerf / 2;

  return {
    ...panel,
    cutPaths: panel.cutPaths.map((path, index) => offsetOrthogonalClosedPath(path, index === 0 ? halfKerf : -halfKerf)),
  };
}

export function offsetOrthogonalClosedPath(path: ClosedPath, distance: number): ClosedPath {
  if (distance === 0) {
    return {
      points: path.points.map((point) => ({ ...point })),
    };
  }

  const points = normalizeClosedPathPoints(path.points);

  if (points.length < 4) {
    throw new Error("Kerf compensation requires a closed path with at least 4 points.");
  }

  const orientation = signedArea(points);

  if (orientation === 0) {
    throw new Error("Kerf compensation requires a non-degenerate closed path.");
  }

  const edges = points.map((point, index) => {
    const next = points[(index + 1) % points.length];

    if (next === undefined) {
      throw new Error("Closed path must contain a next point.");
    }

    return createOffsetEdge(point, next, orientation, distance);
  });

  const compensatedPoints = edges.map((edge, index) => {
    const previous = edges[(index - 1 + edges.length) % edges.length];

    if (previous === undefined) {
      throw new Error("Closed path must contain a previous edge.");
    }

    return intersectOffsetEdges(previous, edge);
  });

  return {
    points: dedupeSequentialPoints(compensatedPoints),
  };
}

export function toSvgPathData(path: ClosedPath): string {
  const [firstPoint, ...otherPoints] = path.points;

  if (firstPoint === undefined) {
    throw new Error("ClosedPath must contain at least one point.");
  }

  const commands = [`M ${formatNumber(firstPoint.x)} ${formatNumber(firstPoint.y)}`];

  for (const point of otherPoints) {
    commands.push(`L ${formatNumber(point.x)} ${formatNumber(point.y)}`);
  }

  commands.push("Z");
  return commands.join(" ");
}

function formatNumber(value: number): string {
  return Number(value.toFixed(3)).toString();
}

function signedArea(points: Point[]): number {
  let area = 0;

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];

    if (current === undefined || next === undefined) {
      continue;
    }

    area += (current.x * next.y) - (current.y * next.x);
  }

  return area / 2;
}

function createOffsetEdge(start: Point, end: Point, orientation: number, distance: number): OffsetEdge {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if ((dx === 0 && dy === 0) || (dx !== 0 && dy !== 0)) {
    throw new Error("Kerf compensation currently supports only non-zero orthogonal segments.");
  }

  const length = Math.hypot(dx, dy);
  const rightNormal = { x: dy / length, y: -dx / length };
  const outwardNormal = orientation > 0
    ? rightNormal
    : { x: -rightNormal.x, y: -rightNormal.y };
  const offset = {
    x: outwardNormal.x * distance,
    y: outwardNormal.y * distance,
  };
  const offsetStart = {
    x: start.x + offset.x,
    y: start.y + offset.y,
  };
  const offsetEnd = {
    x: end.x + offset.x,
    y: end.y + offset.y,
  };

  return dx === 0
    ? { axis: "vertical", value: offsetStart.x, start: offsetStart, end: offsetEnd }
    : { axis: "horizontal", value: offsetStart.y, start: offsetStart, end: offsetEnd };
}

function intersectOffsetEdges(left: OffsetEdge, right: OffsetEdge): Point {
  if (left.axis === right.axis) {
    throw new Error("Kerf compensation requires orthogonal corner transitions.");
  }

  return left.axis === "vertical"
    ? { x: left.value, y: right.value }
    : { x: right.value, y: left.value };
}

function createJointedRectanglePath(options: {
  width: number;
  height: number;
  materialThickness: number;
  topEdge: EdgeJointStyle;
  rightEdge: EdgeJointStyle;
  bottomEdge: EdgeJointStyle;
  leftEdge: EdgeJointStyle;
}): ClosedPath {
  const { width, height, materialThickness, topEdge, rightEdge, bottomEdge, leftEdge } = options;

  const leftInset = leftEdge === "tenon" ? materialThickness : 0;
  const rightInset = rightEdge === "tenon" ? materialThickness : 0;
  const topInset = topEdge === "tenon" ? materialThickness : 0;
  const bottomInset = bottomEdge === "tenon" ? materialThickness : 0;

  const topLeft: Point = { x: leftInset, y: topInset };
  const topRight: Point = { x: width - rightInset, y: topInset };
  const bottomRight: Point = { x: width - rightInset, y: height - bottomInset };
  const bottomLeft: Point = { x: leftInset, y: height - bottomInset };

  return {
    points: dedupeSequentialPoints([
      topLeft,
      ...createHorizontalEdgePoints({
        side: "top",
        start: topLeft,
        length: topRight.x - topLeft.x,
        direction: "ltr",
        materialThickness,
        style: topEdge,
      }),
      ...createVerticalEdgePoints({
        side: "right",
        top: topRight,
        height: bottomRight.y - topRight.y,
        materialThickness,
        style: rightEdge,
      }),
      ...createHorizontalEdgePoints({
        side: "bottom",
        start: bottomRight,
        length: bottomRight.x - bottomLeft.x,
        direction: "rtl",
        materialThickness,
        style: bottomEdge,
      }),
      ...createVerticalEdgePoints({
        side: "left",
        top: topLeft,
        height: bottomLeft.y - topLeft.y,
        materialThickness,
        style: leftEdge,
      }).reverse(),
    ]),
  };
}

function createHorizontalEdgePoints(options: {
  side: "top" | "bottom";
  start: Point;
  length: number;
  direction: "ltr" | "rtl";
  materialThickness: number;
  style: EdgeJointStyle;
}): Point[] {
  const { side, start, length, direction, materialThickness, style } = options;

  if (style === "straight") {
    return [{ x: advanceX(start.x, length, direction), y: start.y }];
  }

  const points: Point[] = [];
  const segmentCount = Math.max(1, Math.round(length / TYPE_A_VERTICAL_JOINT_PITCH));
  const segmentLength = length / segmentCount;
  const restY = start.y;
  const activeY = resolveActiveY(side, style, restY, materialThickness);

  for (let index = 0; index < segmentCount; index += 1) {
    const isActiveSegment = index % 2 === 0;
    const segmentStartX = advanceX(start.x, index * segmentLength, direction);
    const segmentEndX = advanceX(start.x, (index + 1) * segmentLength, direction);

    if (isActiveSegment) {
      points.push({ x: segmentStartX, y: activeY });
      points.push({ x: segmentEndX, y: activeY });
      points.push({ x: segmentEndX, y: restY });
      continue;
    }

    points.push({ x: segmentEndX, y: restY });
  }

  return dedupeSequentialPoints(points);
}

function createVerticalEdgePoints(options: {
  side: "left" | "right";
  top: Point;
  height: number;
  materialThickness: number;
  style: EdgeJointStyle;
}): Point[] {
  const { side, top, height, materialThickness, style } = options;

  if (style === "straight") {
    return [{ x: top.x, y: top.y + height }];
  }

  const points: Point[] = [];
  const segmentCount = Math.max(1, Math.round(height / TYPE_A_VERTICAL_JOINT_PITCH));
  const segmentHeight = height / segmentCount;
  const restX = top.x;
  const activeX = resolveActiveX(side, style, restX, materialThickness);

  for (let index = 0; index < segmentCount; index += 1) {
    const isActiveSegment = index % 2 === 0;
    const segmentStartY = top.y + (index * segmentHeight);
    const segmentEndY = top.y + ((index + 1) * segmentHeight);

    if (isActiveSegment) {
      points.push({ x: activeX, y: segmentStartY });
      points.push({ x: activeX, y: segmentEndY });
      points.push({ x: restX, y: segmentEndY });
      continue;
    }

    points.push({ x: restX, y: segmentEndY });
  }

  return dedupeSequentialPoints(points);
}

function resolveActiveX(side: "left" | "right", style: Exclude<EdgeJointStyle, "straight">, restX: number, materialThickness: number): number {
  if (style === "tenon") {
    return side === "left"
      ? restX - materialThickness
      : restX + materialThickness;
  }

  return side === "left"
    ? restX + materialThickness
    : restX - materialThickness;
}

function dedupeSequentialPoints(points: Point[]): Point[] {
  return points.filter((point, index) => {
    const previous = points[index - 1];
    return previous === undefined || previous.x !== point.x || previous.y !== point.y;
  });
}

function normalizeClosedPathPoints(points: Point[]): Point[] {
  const deduped = dedupeSequentialPoints(points);

  if (deduped.length < 3) {
    return deduped;
  }

  let normalized = deduped;
  let changed = true;

  while (changed && normalized.length >= 3) {
    changed = false;
    const next: Point[] = [];

    for (let index = 0; index < normalized.length; index += 1) {
      const previous = normalized[(index - 1 + normalized.length) % normalized.length];
      const current = normalized[index];
      const following = normalized[(index + 1) % normalized.length];

      if (previous === undefined || current === undefined || following === undefined) {
        continue;
      }

      if (isCollinearOrthogonal(previous, current, following)) {
        changed = true;
        continue;
      }

      next.push(current);
    }

    normalized = next;
  }

  return normalized;
}

function isCollinearOrthogonal(previous: Point, current: Point, following: Point): boolean {
  return (previous.x === current.x && current.x === following.x)
    || (previous.y === current.y && current.y === following.y);
}

function resolveActiveY(side: "top" | "bottom", style: Exclude<EdgeJointStyle, "straight">, restY: number, materialThickness: number): number {
  if (style === "tenon") {
    return side === "top"
      ? restY - materialThickness
      : restY + materialThickness;
  }

  return side === "top"
    ? restY + materialThickness
    : restY - materialThickness;
}

function advanceX(startX: number, offset: number, direction: "ltr" | "rtl"): number {
  return direction === "ltr"
    ? startX + offset
    : startX - offset;
}

interface OffsetEdge {
  axis: "horizontal" | "vertical";
  value: number;
  start: Point;
  end: Point;
}