export type BoxType = "A" | "B";

export interface Box50Config {
  type: BoxType;
  widthUnits: number;
  depthUnits: number;
  heightUnits: number;
  materialThickness: number;
  kerf: number;
  lidClearance: number;
  dividerClearance: number;
}

export interface Box50Dimensions {
  externalWidth: number;
  externalDepth: number;
  externalHeight: number;
  internalWidth: number;
  internalDepth: number;
  internalHeight: number;
}

export interface PanelDefinition {
  name: string;
  width: number;
  height: number;
  quantity: number;
  note: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface ClosedPath {
  points: Point[];
}

export interface PanelGeometry {
  name: string;
  width: number;
  height: number;
  quantity: number;
  note: string;
  cutPaths: ClosedPath[];
}

export interface Box50Project {
  config: Box50Config;
  dimensions: Box50Dimensions;
  panels: PanelDefinition[];
  panelGeometries: PanelGeometry[];
  fileStem: string;
}