import type { Box50Project, ClosedPath, PanelGeometry, Point } from "./types.js";

export interface GeometryValidationIssue {
  panelName: string;
  pathIndex: number;
  message: string;
}

const FRONT_BACK_MORTISE_WIDTH = 3.1;
const FRONT_BACK_MORTISE_HEIGHT = 4.5;
const SIDE_RAIL_GROOVE_HEIGHT = 3.2;
const SIDE_RAIL_LOADING_POCKET_WIDTH = 6;
const DIMENSION_TOLERANCE = 0.05;

export function validateProjectGeometry(project: Box50Project): void {
  const issues: GeometryValidationIssue[] = [];

  for (const panel of project.panelGeometries) {
    issues.push(...validatePanelGeometry(panel, project.config.materialThickness));
  }

  if (issues.length > 0) {
    const message = issues
      .map((issue) => `${issue.panelName} [path ${issue.pathIndex}]: ${issue.message}`)
      .join("\n");

    throw new Error(`Geometry validation failed:\n${message}`);
  }
}

export function validatePanelGeometry(panel: PanelGeometry, materialThickness: number): GeometryValidationIssue[] {
  const issues: GeometryValidationIssue[] = [];

  if (panel.cutPaths.length === 0) {
    issues.push({
      panelName: panel.name,
      pathIndex: -1,
      message: "panel must contain at least one cut path.",
    });
    return issues;
  }

  for (const [pathIndex, path] of panel.cutPaths.entries()) {
    issues.push(...validatePathPoints(panel.name, pathIndex, path));
    issues.push(...validatePathTopology(panel.name, pathIndex, path));
    issues.push(...validatePathBounds(panel.name, pathIndex, path, panel, materialThickness, pathIndex === 0));
  }

  const [outerPath, ...innerPaths] = panel.cutPaths;

  if (outerPath !== undefined) {
    issues.push(...validatePanelConventions(panel, materialThickness));

    for (const [innerIndex, innerPath] of innerPaths.entries()) {
      const pathIndex = innerIndex + 1;
      issues.push(...validateInternalPathPlacement(panel.name, pathIndex, innerPath, outerPath));
    }

    for (let leftIndex = 0; leftIndex < innerPaths.length; leftIndex += 1) {
      const leftPath = innerPaths[leftIndex];

      if (leftPath === undefined) {
        continue;
      }

      for (let rightIndex = leftIndex + 1; rightIndex < innerPaths.length; rightIndex += 1) {
        const rightPath = innerPaths[rightIndex];

        if (rightPath === undefined || !pathsIntersect(leftPath, rightPath)) {
          continue;
        }

        issues.push({
          panelName: panel.name,
          pathIndex: leftIndex + 1,
          message: `internal cut path intersects internal cut path ${rightIndex + 1}.`,
        });
      }
    }
  }

  return issues;
}

function validatePanelConventions(panel: PanelGeometry, materialThickness: number): GeometryValidationIssue[] {
  const issues: GeometryValidationIssue[] = [];
  const outerPath = panel.cutPaths[0];

  if (outerPath === undefined) {
    return issues;
  }

  if (panel.name === "front-back") {
    issues.push(...validateStraightTopEdge(panel, outerPath, panel.width, 0));

    for (const [index, path] of panel.cutPaths.slice(1).entries()) {
      const bounds = getPathBounds(path);

      if (!approxEqual(bounds.width, FRONT_BACK_MORTISE_WIDTH) || !approxEqual(bounds.height, FRONT_BACK_MORTISE_HEIGHT)) {
        issues.push({
          panelName: panel.name,
          pathIndex: index + 1,
          message: `front/back mortise must measure ${FRONT_BACK_MORTISE_WIDTH} x ${FRONT_BACK_MORTISE_HEIGHT} mm.`,
        });
      }
    }
  }

  if (panel.name === "left-right") {
    issues.push(...validateStraightTopEdge(panel, outerPath, panel.width - (2 * materialThickness), materialThickness));
    issues.push(...validateSideRailProfile(panel, materialThickness));
  }

  return issues;
}

function validateStraightTopEdge(
  panel: PanelGeometry,
  outerPath: ClosedPath,
  expectedLength: number,
  expectedStartX: number,
): GeometryValidationIssue[] {
  const issues: GeometryValidationIssue[] = [];
  const topY = getPathBounds(outerPath).minY;
  const topSegments = getClosedPathSegments(outerPath)
    .filter((segment) => segment.start.y === segment.end.y && segment.start.y === topY)
    .map((segment) => ({
      startX: Math.min(segment.start.x, segment.end.x),
      endX: Math.max(segment.start.x, segment.end.x),
      length: Math.abs(segment.end.x - segment.start.x),
    }));

  const hasExpectedOpeningSegment = topSegments.some((segment) => approxEqual(segment.startX, expectedStartX) && approxEqual(segment.length, expectedLength));

  if (!hasExpectedOpeningSegment) {
    issues.push({
      panelName: panel.name,
      pathIndex: 0,
      message: "top wall edge must include the expected straight opening segment.",
    });
  }

  return issues;
}

function validateSideRailProfile(panel: PanelGeometry, materialThickness: number): GeometryValidationIssue[] {
  const issues: GeometryValidationIssue[] = [];
  const railPath = panel.cutPaths[1];

  if (railPath === undefined) {
    issues.push({
      panelName: panel.name,
      pathIndex: 1,
      message: "side panel must contain a lid rail cut path.",
    });
    return issues;
  }

  const bounds = getPathBounds(railPath);
  const uniqueXs = getUniqueCoordinateValues(railPath.points.map((point) => point.x));
  const uniqueYs = getUniqueCoordinateValues(railPath.points.map((point) => point.y));

  if (!approxEqual(bounds.minX, materialThickness) || !approxEqual(bounds.minY, materialThickness)) {
    issues.push({
      panelName: panel.name,
      pathIndex: 1,
      message: "side rail profile must start at the nominal top and leading material offsets.",
    });
  }

  if (uniqueXs.length !== 3 || uniqueYs.length !== 3) {
    issues.push({
      panelName: panel.name,
      pathIndex: 1,
      message: "side rail profile must remain a stepped groove with one loading pocket.",
    });
    return issues;
  }

  const [railStartX, pocketEndX] = uniqueXs;
  const [railTopY, grooveBottomY, pocketBottomY] = uniqueYs;

  if (railStartX === undefined || pocketEndX === undefined || railTopY === undefined || grooveBottomY === undefined || pocketBottomY === undefined) {
    return issues;
  }

  const pocketWidth = pocketEndX - railStartX;
  const grooveHeight = grooveBottomY - railTopY;
  const pocketExtraDepth = pocketBottomY - grooveBottomY;

  if (!approxEqual(pocketWidth, SIDE_RAIL_LOADING_POCKET_WIDTH)) {
    issues.push({
      panelName: panel.name,
      pathIndex: 1,
      message: `side rail loading pocket must be ${SIDE_RAIL_LOADING_POCKET_WIDTH} mm long.`,
    });
  }

  if (!approxEqual(grooveHeight, SIDE_RAIL_GROOVE_HEIGHT)) {
    issues.push({
      panelName: panel.name,
      pathIndex: 1,
      message: `side rail groove must be ${SIDE_RAIL_GROOVE_HEIGHT} mm high.`,
    });
  }

  if (!approxEqual(pocketExtraDepth, materialThickness)) {
    issues.push({
      panelName: panel.name,
      pathIndex: 1,
      message: "side rail loading pocket depth must match the material thickness.",
    });
  }

  return issues;
}

function validatePathPoints(panelName: string, pathIndex: number, path: ClosedPath): GeometryValidationIssue[] {
  const issues: GeometryValidationIssue[] = [];

  if (path.points.length < 4) {
    issues.push({
      panelName,
      pathIndex,
      message: "closed path must contain at least 4 points.",
    });
  }

  for (const point of path.points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      issues.push({
        panelName,
        pathIndex,
        message: "path contains a non-finite coordinate.",
      });
      break;
    }
  }

  for (let index = 1; index < path.points.length; index += 1) {
    const previous = path.points[index - 1];
    const current = path.points[index];

    if (previous !== undefined && current !== undefined && samePoint(previous, current)) {
      issues.push({
        panelName,
        pathIndex,
        message: "path contains duplicate sequential points.",
      });
      break;
    }
  }

  return issues;
}

function validatePathTopology(panelName: string, pathIndex: number, path: ClosedPath): GeometryValidationIssue[] {
  const issues: GeometryValidationIssue[] = [];
  const segments = getClosedPathSegments(path);

  if (Math.abs(signedArea(path)) <= 0.000001) {
    issues.push({
      panelName,
      pathIndex,
      message: "path must enclose a non-zero area.",
    });
  }

  for (const segment of segments) {
    if (!isAxisAlignedSegment(segment)) {
      issues.push({
        panelName,
        pathIndex,
        message: "path contains a non-orthogonal segment.",
      });
      break;
    }

    if (samePoint(segment.start, segment.end)) {
      issues.push({
        panelName,
        pathIndex,
        message: "path contains a zero-length segment.",
      });
      break;
    }
  }

  if (hasSelfIntersection(path)) {
    issues.push({
      panelName,
      pathIndex,
      message: "path contains a self-intersection.",
    });
  }

  return issues;
}

function validatePathBounds(
  panelName: string,
  pathIndex: number,
  path: ClosedPath,
  panel: PanelGeometry,
  materialThickness: number,
  isOuterContour: boolean,
): GeometryValidationIssue[] {
  const issues: GeometryValidationIssue[] = [];
  const xs = path.points.map((point) => point.x);
  const ys = path.points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  if (isOuterContour) {
    const outerTolerance = materialThickness + 0.001;

    if (minX < -outerTolerance || maxX > panel.width + outerTolerance || minY < -outerTolerance || maxY > panel.height + outerTolerance) {
      issues.push({
        panelName,
        pathIndex,
        message: "outer contour exceeds allowed fabrication envelope.",
      });
    }

    return issues;
  }

  if (minX < 0 || maxX > panel.width || minY < 0 || maxY > panel.height) {
    issues.push({
      panelName,
      pathIndex,
      message: "internal cut path must stay within panel bounds.",
    });
  }

  return issues;
}

function validateInternalPathPlacement(
  panelName: string,
  pathIndex: number,
  path: ClosedPath,
  outerPath: ClosedPath,
): GeometryValidationIssue[] {
  const issues: GeometryValidationIssue[] = [];
  const firstPoint = path.points[0];

  if (firstPoint === undefined) {
    return issues;
  }

  if (!isPointStrictlyInsideClosedPath(firstPoint, outerPath)) {
    issues.push({
      panelName,
      pathIndex,
      message: "internal cut path must remain strictly inside the outer contour.",
    });
  }

  if (pathsIntersect(path, outerPath)) {
    issues.push({
      panelName,
      pathIndex,
      message: "internal cut path intersects the outer contour.",
    });
  }

  return issues;
}

function samePoint(left: Point, right: Point): boolean {
  return left.x === right.x && left.y === right.y;
}

function signedArea(path: ClosedPath): number {
  let area = 0;

  for (let index = 0; index < path.points.length; index += 1) {
    const current = path.points[index];
    const next = path.points[(index + 1) % path.points.length];

    if (current === undefined || next === undefined) {
      continue;
    }

    area += (current.x * next.y) - (current.y * next.x);
  }

  return area / 2;
}

function getClosedPathSegments(path: ClosedPath): Segment[] {
  return path.points.map((start, index) => {
    const end = path.points[(index + 1) % path.points.length];

    if (end === undefined) {
      throw new Error("Closed path segment is missing an end point.");
    }

    return { start, end };
  });
}

function isAxisAlignedSegment(segment: Segment): boolean {
  return segment.start.x === segment.end.x || segment.start.y === segment.end.y;
}

function hasSelfIntersection(path: ClosedPath): boolean {
  const segments = getClosedPathSegments(path);

  for (let leftIndex = 0; leftIndex < segments.length; leftIndex += 1) {
    const left = segments[leftIndex];

    if (left === undefined) {
      continue;
    }

    for (let rightIndex = leftIndex + 1; rightIndex < segments.length; rightIndex += 1) {
      if (areAdjacentSegments(leftIndex, rightIndex, segments.length)) {
        continue;
      }

      const right = segments[rightIndex];

      if (right !== undefined && segmentsCreateInvalidSelfIntersection(left, right)) {
        return true;
      }
    }
  }

  return false;
}

function areAdjacentSegments(leftIndex: number, rightIndex: number, segmentCount: number): boolean {
  return Math.abs(leftIndex - rightIndex) === 1 || (leftIndex === 0 && rightIndex === segmentCount - 1);
}

function pathsIntersect(leftPath: ClosedPath, rightPath: ClosedPath): boolean {
  const leftSegments = getClosedPathSegments(leftPath);
  const rightSegments = getClosedPathSegments(rightPath);

  for (const leftSegment of leftSegments) {
    for (const rightSegment of rightSegments) {
      if (segmentsIntersect(leftSegment, rightSegment)) {
        return true;
      }
    }
  }

  return false;
}

function segmentsCreateInvalidSelfIntersection(left: Segment, right: Segment): boolean {
  if (segmentsProperlyCross(left, right)) {
    return true;
  }

  return collinearSegmentsOverlap(left, right);
}

function segmentsIntersect(left: Segment, right: Segment): boolean {
  if (segmentsProperlyCross(left, right)) {
    return true;
  }

  const leftOrientationStart = orientation(left.start, left.end, right.start);
  const leftOrientationEnd = orientation(left.start, left.end, right.end);
  const rightOrientationStart = orientation(right.start, right.end, left.start);
  const rightOrientationEnd = orientation(right.start, right.end, left.end);

  if (leftOrientationStart === 0 && isPointOnSegment(right.start, left)) {
    return true;
  }

  if (leftOrientationEnd === 0 && isPointOnSegment(right.end, left)) {
    return true;
  }

  if (rightOrientationStart === 0 && isPointOnSegment(left.start, right)) {
    return true;
  }

  if (rightOrientationEnd === 0 && isPointOnSegment(left.end, right)) {
    return true;
  }

  return false;
}

function segmentsProperlyCross(left: Segment, right: Segment): boolean {
  const leftOrientationStart = orientation(left.start, left.end, right.start);
  const leftOrientationEnd = orientation(left.start, left.end, right.end);
  const rightOrientationStart = orientation(right.start, right.end, left.start);
  const rightOrientationEnd = orientation(right.start, right.end, left.end);

  return leftOrientationStart !== 0
    && leftOrientationEnd !== 0
    && rightOrientationStart !== 0
    && rightOrientationEnd !== 0
    && (leftOrientationStart > 0) !== (leftOrientationEnd > 0)
    && (rightOrientationStart > 0) !== (rightOrientationEnd > 0);
}

function collinearSegmentsOverlap(left: Segment, right: Segment): boolean {
  if (orientation(left.start, left.end, right.start) !== 0 || orientation(left.start, left.end, right.end) !== 0) {
    return false;
  }

  if (left.start.x === left.end.x && right.start.x === right.end.x && left.start.x === right.start.x) {
    const overlap = Math.min(Math.max(left.start.y, left.end.y), Math.max(right.start.y, right.end.y))
      - Math.max(Math.min(left.start.y, left.end.y), Math.min(right.start.y, right.end.y));
    return overlap > 0;
  }

  if (left.start.y === left.end.y && right.start.y === right.end.y && left.start.y === right.start.y) {
    const overlap = Math.min(Math.max(left.start.x, left.end.x), Math.max(right.start.x, right.end.x))
      - Math.max(Math.min(left.start.x, left.end.x), Math.min(right.start.x, right.end.x));
    return overlap > 0;
  }

  return false;
}

function orientation(start: Point, end: Point, point: Point): number {
  return ((end.x - start.x) * (point.y - start.y)) - ((end.y - start.y) * (point.x - start.x));
}

function isPointOnSegment(point: Point, segment: Segment): boolean {
  return point.x >= Math.min(segment.start.x, segment.end.x)
    && point.x <= Math.max(segment.start.x, segment.end.x)
    && point.y >= Math.min(segment.start.y, segment.end.y)
    && point.y <= Math.max(segment.start.y, segment.end.y)
    && orientation(segment.start, segment.end, point) === 0;
}

function isPointStrictlyInsideClosedPath(point: Point, path: ClosedPath): boolean {
  const segments = getClosedPathSegments(path);

  if (segments.some((segment) => isPointOnSegment(point, segment))) {
    return false;
  }

  let crossings = 0;

  for (const segment of segments) {
    const minY = Math.min(segment.start.y, segment.end.y);
    const maxY = Math.max(segment.start.y, segment.end.y);

    if (point.y <= minY || point.y > maxY) {
      continue;
    }

    const intersectionX = segment.start.x + (((point.y - segment.start.y) * (segment.end.x - segment.start.x)) / (segment.end.y - segment.start.y || 1));

    if (intersectionX > point.x) {
      crossings += 1;
    }
  }

  return crossings % 2 === 1;
}

function getPathBounds(path: ClosedPath): PathBounds {
  const xs = path.points.map((point) => point.x);
  const ys = path.points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function getUniqueCoordinateValues(values: number[]): number[] {
  const unique: number[] = [];

  for (const value of values) {
    if (!unique.some((candidate) => approxEqual(candidate, value))) {
      unique.push(value);
    }
  }

  return unique.sort((left, right) => left - right);
}

function approxEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= DIMENSION_TOLERANCE;
}

interface Segment {
  start: Point;
  end: Point;
}

interface PathBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}