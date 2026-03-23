import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createDefaultConfig, createProject } from "./core/box50.js";
import { renderProjectFabricationPlanSvgWithMode, renderProjectSvgWithMode } from "./export/svg.js";
import type { Box50Config, StandardLayoutDefinition } from "./index.js";

type CliRenderMode = "layout" | "cut";

interface CliArgs {
  type: "standard" | "preset";
  widthUnits: number;
  depthUnits: number;
  heightUnits: number;
  mode: CliRenderMode;
  outputPath?: string;
  layoutJsonPath?: string;
  configJsonPath?: string;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const config = await resolveConfigFromCliArgs(args);

  const project = createProject(config);
  const fabricationPlans = project.fabricationPlans ?? [];

  if (fabricationPlans.length <= 1) {
    const svg = renderProjectSvgWithMode(project, args.mode);
    const outputPath = args.outputPath
      ? path.resolve(process.cwd(), args.outputPath)
      : path.resolve(process.cwd(), "output", `${project.fileStem}-${args.mode}.svg`);

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, svg, "utf8");
    process.stdout.write(`Generated ${outputPath}\n`);
  } else {
    const outputDirectory = resolveMultiPlanOutputDirectory(args.outputPath);
    await mkdir(outputDirectory, { recursive: true });

    for (const fabricationPlan of fabricationPlans) {
      const svg = renderProjectFabricationPlanSvgWithMode(project, fabricationPlan.id, args.mode);
      const outputPath = path.join(outputDirectory, `${fabricationPlan.fileStem}-${args.mode}.svg`);
      await writeFile(outputPath, svg, "utf8");
      process.stdout.write(`Generated ${outputPath}\n`);
    }
  }

  process.stdout.write(`Mode: ${args.mode}\n`);
  process.stdout.write(`External: ${project.dimensions.externalWidth}x${project.dimensions.externalDepth}x${project.dimensions.externalHeight} mm\n`);
  process.stdout.write(`Internal: ${project.dimensions.internalWidth.toFixed(2)}x${project.dimensions.internalDepth.toFixed(2)}x${project.dimensions.internalHeight.toFixed(2)} mm\n`);
}

function parseArgs(argv: string[]): CliArgs {
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  const type = readOption(argv, "--type");
  const widthUnits = Number.parseInt(readOption(argv, "--w"), 10);
  const depthUnits = Number.parseInt(readOption(argv, "--d"), 10);
  const heightUnits = Number.parseInt(readOption(argv, "--h"), 10);
  const mode = normalizeMode(readOptionalOption(argv, "--mode") ?? "layout");
  const outputPath = readOptionalOption(argv, "--out");
  const layoutJsonPath = readOptionalOption(argv, "--layout-json");
  const configJsonPath = readOptionalOption(argv, "--config-json");

  if (type !== "standard" && type !== "preset") {
    throw new Error("--type must be standard or preset.");
  }

  const cliArgs: CliArgs = {
    type,
    widthUnits,
    depthUnits,
    heightUnits,
    mode,
  };

  if (outputPath !== undefined) {
    cliArgs.outputPath = outputPath;
  }

  if (layoutJsonPath !== undefined) {
    cliArgs.layoutJsonPath = layoutJsonPath;
  }

  if (configJsonPath !== undefined) {
    cliArgs.configJsonPath = configJsonPath;
  }

  return cliArgs;
}

export async function resolveConfigFromCliArgs(args: CliArgs): Promise<Box50Config> {
  let config: Box50Config = createDefaultConfig({
    type: args.type,
    widthUnits: args.widthUnits,
    depthUnits: args.depthUnits,
    heightUnits: args.heightUnits,
  });

  if (args.configJsonPath !== undefined) {
    config = {
      ...config,
      ...await loadConfigFromJson(args.configJsonPath),
    };
  }

  if (args.layoutJsonPath === undefined) {
    return config;
  }

  if (config.type !== "standard") {
    throw new Error("--layout-json is only supported with --type standard.");
  }

  const layout = await loadStandardLayoutFromJson(args.layoutJsonPath);
  return {
    ...config,
    standardLayout: layout,
  };
}

export async function loadConfigFromJson(configJsonPath: string): Promise<Partial<Box50Config>> {
  const resolvedPath = path.resolve(process.cwd(), configJsonPath);
  const content = await readFile(resolvedPath, "utf8");

  try {
    return JSON.parse(content) as Partial<Box50Config>;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse config JSON ${resolvedPath}: ${message}`);
  }
}

export async function loadStandardLayoutFromJson(layoutJsonPath: string): Promise<StandardLayoutDefinition> {
  const resolvedPath = path.resolve(process.cwd(), layoutJsonPath);
  const content = await readFile(resolvedPath, "utf8");

  try {
    return JSON.parse(content) as StandardLayoutDefinition;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse layout JSON ${resolvedPath}: ${message}`);
  }
}

function readOption(argv: string[], name: string): string {
  const value = readOptionalOption(argv, name);

  if (value === undefined) {
    throw new Error(`Missing required option ${name}.`);
  }

  return value;
}

function readOptionalOption(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);

  if (index === -1) {
    return undefined;
  }

  return argv[index + 1];
}

function normalizeMode(mode: string): CliRenderMode {
  if (mode === "layout" || mode === "preview") {
    return "layout";
  }

  if (mode === "cut" || mode === "production") {
    return "cut";
  }

  throw new Error("--mode must be layout or cut. preview and production are still accepted as legacy aliases.");
}

function resolveMultiPlanOutputDirectory(outputPath: string | undefined): string {
  if (outputPath === undefined) {
    return path.resolve(process.cwd(), "output");
  }

  const resolvedPath = path.resolve(process.cwd(), outputPath);

  if (path.extname(resolvedPath).toLowerCase() === ".svg") {
    throw new Error("--out must point to a directory when the project produces multiple fabrication plans.");
  }

  return resolvedPath;
}

function printHelp(): void {
  process.stdout.write([
    "Box50 generator",
    "",
    "Required:",
    "  --type standard|preset",
    "                  Output family",
    "  --w <int>       Width in 50 mm units",
    "  --d <int>       Depth in 50 mm units",
    "  --h <int>       Height in 50 mm units",
    "",
    "Optional:",
    "  --mode <mode>   layout or cut (default: layout)",
    "                  legacy aliases: preview -> layout, production -> cut",
    "  --config-json <path>",
    "                  JSON file describing the full project config, including fillers and fabrication plans",
    "  --layout-json <path>",
    "                  JSON file describing a standard internal layout",
    "  --out <path>    Output SVG path",
  ].join("\n"));
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}

export { parseArgs };