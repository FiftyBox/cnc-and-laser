export type BoxProfile = "standard" | "preset";

export type SeparatorOrientation = "vertical" | "horizontal";
export type SeparatorRole = "primary" | "secondary";

export interface StandardSeparatorBottomJoint {
  enabled: boolean;
  tenonDepth: number;
  tenonHeight: number;
}

export interface StandardSeparatorCrossJoint {
  with: string;
  mode: "mortise-primary-tenon-secondary";
}

export interface StandardSeparatorDefinition {
  id: string;
  orientation: SeparatorOrientation;
  role: SeparatorRole;
  position: number;
  spanStart: number;
  spanEnd: number;
  bottomJoint: StandardSeparatorBottomJoint;
  crossJoints?: StandardSeparatorCrossJoint[];
}

export interface StandardLayoutDefinition {
  id: string;
  kind: "standard-layout";
  referenceFrame: "internal";
  separators: StandardSeparatorDefinition[];
}

export interface FabricationPlanDefinition {
  id: string;
  materialThickness: number;
  kerf: number;
  note?: string;
}

export interface FillerDefinition {
  id: string;
  width: number;
  height: number;
  quantity: number;
  targetPlan?: string;
  note?: string;
}

export interface Box50Config {
  type: BoxProfile;
  widthUnits: number;
  depthUnits: number;
  heightUnits: number;
  materialThickness: number;
  kerf: number;
  lidClearance: number;
  dividerClearance: number;
  standardLayout?: StandardLayoutDefinition;
  fabricationPlans?: FabricationPlanDefinition[];
  fillers?: FillerDefinition[];
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

export interface Box50FabricationPlan {
  id: string;
  materialThickness: number;
  kerf: number;
  note?: string;
  panels: PanelDefinition[];
  panelGeometries: PanelGeometry[];
  fileStem: string;
}

export interface Box50Project {
  config: Box50Config;
  dimensions: Box50Dimensions;
  panels: PanelDefinition[];
  panelGeometries: PanelGeometry[];
  fileStem: string;
  fabricationPlans?: Box50FabricationPlan[];
}