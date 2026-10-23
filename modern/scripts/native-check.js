"use strict";
const fs = require("fs"),
  path = require("path"),
  crypto = require("crypto"),
  { execFileSync } = require("child_process");
const { prepareTransfer } = require("../ae/receiver");
const root = path.resolve(__dirname, "../.."),
  output = path.join(root, "work/native-check");
if (process.platform !== "darwin")
  throw new Error("Native checks need macOS, Sketch, and After Effects.");
const sketchtool =
  process.env.AEUX_SKETCHTOOL ||
  "/Applications/Sketch.app/Contents/MacOS/sketchtool";
const ae = process.env.AEUX_AE_APP || "Adobe After Effects 2026";
fs.mkdirSync(output, { recursive: true });
const summary = {
  sketch: execFileSync(sketchtool, ["--version"], { encoding: "utf8" }).trim(),
  ae: execFileSync(
    "/usr/bin/osascript",
    ["-e", "tell application " + JSON.stringify(ae) + " to get version"],
    { encoding: "utf8" }
  ).trim(),
  fixtures: []
};
for (const fixture of [
  "basic",
  "advanced",
  "images-2x",
  "images-4x",
  "images-full"
]) {
  const options = fixture.startsWith("images")
    ? {
        imagesOnly: true,
        rasterScale: fixture === "images-4x" ? 4 : 2,
        preserveImageSize: fixture !== "images-full"
      }
    : {};
  const context = {
    fixture,
    options,
    outputDir: output,
    pluginPath: path.join(
      root,
      "dist/AEUX Modern.sketchplugin/Contents/Sketch/plugin.js"
    )
  };
  const code = fs
    .readFileSync(path.join(root, "modern/tests/native-sketch.js"), "utf8")
    .replace("__AEUX_SKETCH_CONFIG__", JSON.stringify(context));
  execFileSync(
    sketchtool,
    ["run-script", code, "--without-activating", "--timeout=30"],
    { stdio: "pipe", timeout: 40000 }
  );
  const sketch = JSON.parse(
    fs.readFileSync(path.join(output, fixture + "-sketch-result.json"), "utf8")
  );
  if (!sketch.ok) throw new Error(fixture + " Sketch fixture: " + sketch.error);
  const data = JSON.parse(
    fs.readFileSync(path.join(output, fixture + "-transfer.aeux.json"), "utf8")
  );
  const config = {
    host: path.join(root, "dist/AEUX Modern/host.jsx"),
    file: prepareTransfer(
      data,
      path.join(output, "assets"),
      crypto.randomUUID()
    ),
    report: path.join(output, fixture + "-ae-result.json"),
    png: path.join(output, fixture + "-ae.png"),
    prefs: {
      newComp: true,
      precompGroups: true,
      parametrics: true,
      compScale: 1,
      frameRate: 60,
      duration: 5
    }
  };
  const script = fs
    .readFileSync(path.join(root, "modern/tests/native-ae.jsx"), "utf8")
    .replace("__AEUX_NATIVE_CONFIG__", JSON.stringify(config));
  const scriptPath = path.join(output, fixture + "-ae.jsx");
  fs.writeFileSync(scriptPath, script);
  execFileSync(
    "/usr/bin/osascript",
    [
      "-e",
      "tell application " +
        JSON.stringify(ae) +
        " to DoScriptFile " +
        JSON.stringify(scriptPath)
    ],
    { stdio: "pipe", timeout: 60000 }
  );
  const result = JSON.parse(fs.readFileSync(config.report, "utf8"));
  if (!result.ok) throw new Error(fixture + " AE fixture: " + result.error);
  if (fixture.startsWith("images")) {
    const image = result.actual.find((l) => l.image),
      expected =
        fixture === "images-full" ? 100 : fixture === "images-4x" ? 25 : 50;
    if (
      !image ||
      Math.abs(image.scale[0] - expected) > 0.001 ||
      image.position[0] !== 320 ||
      image.position[1] !== 240
    )
      throw new Error(
        "Image resolution, scale or position mismatch: " + fixture
      );
  } else if (
    !result.actual.some((l) => l.text) ||
    !result.actual.some((l) => l.shape) ||
    !result.actual.some((l) => l.matte)
  )
    throw new Error("Missing native layer types in " + fixture);
  if (
    fixture === "advanced" &&
    !result.actual.some((l) => l.content === "Override")
  )
    throw new Error("Symbol text override was lost");
  summary.fixtures.push({
    fixture,
    layerCount: result.layerCount,
    warnings: result.warnings,
    imageScale: fixture.startsWith("images")
      ? result.actual.find((l) => l.image).scale
      : undefined
  });
  console.log(fixture + ": import and layer geometry verified.");
}
fs.writeFileSync(
  path.join(output, "summary.json"),
  JSON.stringify(summary, null, 2)
);
console.log("Reference renders and native layer reports: " + output);
