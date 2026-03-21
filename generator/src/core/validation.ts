import type { Box50Project, ClosedPath, PanelGeometry, Point } from "./types.js";

export interface GeometryValidationIssue {
  panelName: string;
  pathIndex: number;
  message: string;
}

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
    issues.push(...validatePathBounds(panel.name, pathIndex, path, panel, materialThickness, pathIndex === 0));
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

function samePoint(left: Point, right: Point): boolean {
  return left.x === right.x && left.y === right.y;
}