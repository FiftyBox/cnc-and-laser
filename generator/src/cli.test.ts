import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs, resolveConfigFromCliArgs } from "./cli.js";

test("resolveConfigFromCliArgs loads a Standard layout from JSON", async () => {
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "box50-cli-"));

  try {
    const layoutPath = path.join(temporaryDirectory, "layout.json");
    await writeFile(layoutPath, JSON.stringify({
      id: "layout-from-json",
      kind: "standard-layout",
      referenceFrame: "internal",
      separators: [
        {
          id: "main-vertical",
          orientation: "vertical",
          role: "primary",
          position: 60,
          spanStart: 0,
          spanEnd: 194,
          bottomJoint: {
            enabled: true,
            tenonDepth: 2.9,
            tenonHeight: 3.5,
          },
        },
      ],
    }), "utf8");

    const parsedArgs = parseArgs([
      "--type", "standard",
      "--w", "2",
      "--d", "4",
      "--h", "2",
      "--layout-json", layoutPath,
    ]);
    const currentDirectory = process.cwd();

    process.chdir(temporaryDirectory);

    try {
      const config = await resolveConfigFromCliArgs(parsedArgs);

      assert.equal(config.standardLayout?.id, "layout-from-json");
      assert.equal(config.standardLayout?.separators.length, 1);
      assert.equal(config.standardLayout?.separators[0]?.id, "main-vertical");
    } finally {
      process.chdir(currentDirectory);
    }
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("resolveConfigFromCliArgs rejects layout JSON with Template", async () => {
  await assert.rejects(
    () => resolveConfigFromCliArgs(parseArgs([
      "--type", "template",
      "--w", "2",
      "--d", "2",
      "--h", "1",
      "--layout-json", "layout.json",
    ])),
    /only supported with --type standard/,
  );
});