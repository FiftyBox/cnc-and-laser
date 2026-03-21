import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createDefaultConfig, createProject } from "./core/box50.js";
import { renderProjectSvgWithMode } from "./export/svg.js";

type CliRenderMode = "layout" | "cut";

interface CliArgs {
  type: "A" | "B";
  widthUnits: number;
  depthUnits: number;
  heightUnits: number;
  mode: CliRenderMode;
  outputPath?: string;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const config = createDefaultConfig({
    type: args.type,
    widthUnits: args.widthUnits,
    depthUnits: args.depthUnits,
    heightUnits: args.heightUnits,
  });

  const project = createProject(config);
  const svg = renderProjectSvgWithMode(project, args.mode);

  const outputPath = args.outputPath
    ? path.resolve(process.cwd(), args.outputPath)
    : path.resolve(process.cwd(), "output", `${project.fileStem}-${args.mode}.svg`);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, svg, "utf8");

  process.stdout.write(`Generated ${outputPath}\n`);
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

  if (type !== "A" && type !== "B") {
    throw new Error("--type must be A or B.");
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

  return cliArgs;
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

function printHelp(): void {
  process.stdout.write([
    "Box50 generator",
    "",
    "Required:",
    "  --type A|B      Box type",
    "  --w <int>       Width in 50 mm units",
    "  --d <int>       Depth in 50 mm units",
    "  --h <int>       Height in 50 mm units",
    "",
    "Optional:",
    "  --mode <mode>   layout or cut (default: layout)",
    "                  legacy aliases: preview -> layout, production -> cut",
    "  --out <path>    Output SVG path",
  ].join("\n"));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});