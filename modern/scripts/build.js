"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execFileSync } = require("child_process");
const root = path.resolve(__dirname, "../.."),
  dist = path.join(root, "dist");
fs.rmSync(dist, { recursive: true, force: true });
const sketch = path.join(
  dist,
  "AEUX Modern.sketchplugin",
  "Contents",
  "Sketch"
);
const ae = path.join(dist, "AEUX Modern");
fs.mkdirSync(sketch, { recursive: true });
fs.mkdirSync(path.join(ae, "CSXS"), { recursive: true });
const resources = path.join(sketch, "../Resources");
fs.mkdirSync(resources, { recursive: true });
function copy(from, to) {
  fs.copyFileSync(path.join(root, from), to);
}
["plugin.js", "manifest.json"].forEach((f) =>
  copy("modern/sketch/" + f, path.join(sketch, f))
);
copy("modern/shared/serializer.js", path.join(sketch, "serializer.js"));
["index.html", "panel.css", "panel.js", "receiver.js"].forEach((f) =>
  copy("modern/ae/" + f, path.join(ae, f))
);
copy("modern/ae/manifest.xml", path.join(ae, "CSXS", "manifest.xml"));
copy("Ae/AEUX/public/CSInterface.js", path.join(ae, "CSInterface.js"));
const patch = require("../ae/patch-renderer");
const renderer = patch(
  fs.readFileSync(path.join(root, "Ae/AEUX/src/host/AEFT/host.jsx"), "utf8")
);
const host =
  renderer +
  "\n" +
  fs.readFileSync(path.join(root, "modern/ae/host.jsx"), "utf8");
new vm.Script(host, { filename: "host.jsx" });
fs.writeFileSync(path.join(ae, "host.jsx"), host);
copy("LICENSE.md", path.join(ae, "LICENSE.md"));
copy("modern/NOTICE.md", path.join(ae, "NOTICE.md"));
copy("LICENSE.md", path.join(resources, "LICENSE.md"));
copy("modern/NOTICE.md", path.join(resources, "NOTICE.md"));
copy("modern/INSTALL.md", path.join(dist, "INSTALL.md"));
copy(
  "modern/scripts/install-macos.command",
  path.join(dist, "install-macos.command")
);
fs.chmodSync(path.join(dist, "install-macos.command"), 0o755);
if (process.platform === "darwin")
  execFileSync("/usr/bin/ditto", [
    "-c",
    "-k",
    "--sequesterRsrc",
    "--keepParent",
    path.join(dist, "AEUX Modern.sketchplugin"),
    path.join(dist, "AEUX-Modern-Sketch.zip")
  ]);
else
  execFileSync(
    "zip",
    ["-qr", "AEUX-Modern-Sketch.zip", "AEUX Modern.sketchplugin"],
    { cwd: dist }
  );
execFileSync("zip", ["-qr", "AEUX-Modern-AE.zip", "AEUX Modern"], {
  cwd: dist
});
execFileSync(
  "zip",
  [
    "-qr",
    "AEUX-Modern-0.1.0-macOS.zip",
    "AEUX Modern.sketchplugin",
    "AEUX Modern",
    "install-macos.command",
    "INSTALL.md"
  ],
  { cwd: dist }
);
console.log(
  "Built Sketch plugin and AE CEP panel in dist/ (no runtime packages)."
);
