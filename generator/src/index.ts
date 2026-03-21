export { buildPanelGeometries, calculateDimensions, createDefaultConfig, createProject, validateConfig } from "./core/box50.js";
export { compensatePanelKerf, createPanelGeometry, createRectanglePath, createTypeARailProfilePath, offsetOrthogonalClosedPath, toSvgPathData, translateClosedPath } from "./core/geometry.js";
export type {
	Box50Config,
	Box50Dimensions,
	Box50Project,
	BoxType,
	ClosedPath,
	PanelDefinition,
	PanelGeometry,
	Point,
	SeparatorOrientation,
	SeparatorRole,
	TypeALayoutDefinition,
	TypeASeparatorBottomJoint,
	TypeASeparatorCrossJoint,
	TypeASeparatorDefinition,
} from "./core/types.js";
export { validatePanelGeometry, validateProjectGeometry } from "./core/validation.js";
export type { GeometryValidationIssue } from "./core/validation.js";
export { renderProjectSvg, renderProjectSvgWithMode } from "./export/svg.js";
export type { SvgRenderMode } from "./export/svg.js";