/* Native integration fixture. Executed in Sketch by native-check.js. */
var sketch = require("sketch/dom");
var config = __AEUX_SKETCH_CONFIG__;
var plugin = require(config.pluginPath);
var doc = new sketch.Document(),
  output = config.outputDir + "/",
  kind = config.fixture;
var report = { ok: false, documentId: doc.id };
try {
  if (kind !== "advanced") {
    var root = new sketch.Group.Frame({
      name: "Modern transfer fixture",
      parent: doc.selectedPage,
      frame: { x: 100, y: 100, width: 640, height: 480 },
      style: { fills: [{ color: "#17181cff" }] },
      clipsContents: true
    });
    root.style.fills = [{ fillType: "Color", color: "#17181cff" }];
    var group = new sketch.Group.Frame({
      name: "Card",
      parent: root,
      frame: { x: 32, y: 32, width: 400, height: 350 },
      style: { fills: [{ color: "#343543ff" }] },
      clipsContents: true
    });
    group.style.fills = [{ fillType: "Color", color: "#343543ff" }];
    new sketch.ShapePath({
      name: "Editable ellipse",
      parent: group,
      shapeType: sketch.ShapePath.ShapeType.Oval,
      frame: { x: 24, y: 24, width: 100, height: 100 },
      style: { fills: [{ color: "#c6b6ffff" }] }
    });
    new sketch.ShapePath({
      name: "Mask",
      parent: group,
      frame: { x: 20, y: 150, width: 100, height: 100 },
      style: { fills: [{ color: "#ffffffff" }] },
      masksSiblings: true,
      maskMode: sketch.Layer.MaskMode.Outline
    });
    new sketch.ShapePath({
      name: "Clipped rectangle",
      parent: group,
      frame: { x: 40, y: 170, width: 160, height: 100 },
      style: { fills: [{ color: "#90e3bbff" }] }
    });
    var text = new sketch.Text({
      name: "Editable title",
      parent: root,
      text: "Modern transfer",
      frame: { x: 32, y: 410, width: 500, height: 40 },
      fixedWidth: true,
      style: {
        fontFamily: "Helvetica Neue",
        fontSize: 26,
        textColor: "#ffffffff"
      },
      breaksMaskChain: true
    });
    var image = new sketch.ShapePath({
      name: "*Raster rotated",
      parent: group,
      frame: { x: 200, y: 20, width: 100, height: 70 },
      transform: { rotation: 18 },
      style: { fills: [{ color: "#edba81ff" }] },
      breaksMaskChain: true
    });
  } else {
    var root = new sketch.Group.Frame({
      name: "Advanced fidelity",
      parent: doc.selectedPage,
      frame: { x: 0, y: 0, width: 640, height: 480 },
      clipsContents: true
    });
    root.style.fills = [{ fillType: "Color", color: "#17181cff" }];
    var g = new sketch.Group({
      name: "Rotated group",
      parent: root,
      frame: { x: 40, y: 40, width: 110, height: 120 },
      transform: { rotation: 15 }
    });
    new sketch.ShapePath({
      name: "Group shape",
      parent: g,
      frame: { x: 0, y: 0, width: 110, height: 120 },
      style: { fills: [{ color: "#90e3bbff" }] }
    });
    new sketch.ShapePath({
      name: "Editable gradient",
      parent: root,
      frame: { x: 210, y: 32, width: 350, height: 110 },
      style: {
        fills: [
          {
            fillType: "Gradient",
            gradient: {
              gradientType: "Linear",
              from: { x: 0, y: 0 },
              to: { x: 1, y: 1 },
              stops: [
                { position: 0, color: "#c6b6ffff" },
                { position: 0.5, color: "#edba81ff" },
                { position: 1, color: "#90e3bbff" }
              ]
            }
          }
        ]
      }
    });
    var rounded = new sketch.ShapePath({
      name: "Rounded shadow",
      parent: root,
      frame: { x: 210, y: 190, width: 160, height: 100 },
      style: {
        fills: [{ color: "#c6b6ffff" }],
        shadows: [
          { enabled: true, color: "#00000080", x: 0, y: 5, blur: 10, spread: 0 }
        ]
      }
    });
    rounded.points.forEach(function (p) {
      p.cornerRadius = 18;
    });
    var curve = sketch.ShapePath.fromSVGPath(
      "M0 80 C0 0 160 0 160 80 C160 160 0 160 0 80 Z"
    );
    curve.name = "Editable Bezier";
    curve.parent = root;
    curve.frame = { x: 410, y: 190, width: 160, height: 100 };
    curve.style.fills = [{ color: "#edba81ff" }];
    new sketch.Text({
      name: "Point text",
      parent: root,
      text: "Point text 012",
      frame: { x: 32, y: 350, width: 300, height: 40 },
      style: { fontFamily: "Georgia", fontSize: 28, textColor: "#ffffffff" }
    });
    var text = new sketch.Text({
      name: "Mixed type",
      parent: root,
      text: "Mixed typography",
      frame: { x: 32, y: 410, width: 400, height: 40 },
      fixedWidth: true,
      style: {
        fontFamily: "Helvetica Neue",
        fontSize: 24,
        textColor: "#ffffffff"
      }
    });
    var attributed = text.sketchObject.attributedStringValue().mutableCopy();
    attributed.addAttribute_value_range(
      "NSFont",
      NSFont.fontWithName_size("HelveticaNeue-Bold", 24),
      NSMakeRange(0, 5)
    );
    text.sketchObject.setAttributedStringValue(attributed);
    var master = new sketch.SymbolMaster({
      name: "Button source",
      parent: doc.selectedPage,
      frame: { x: 900, y: 0, width: 140, height: 50 }
    });
    master.style.fills = [{ color: "#343543ff" }];
    new sketch.Text({
      parent: master,
      name: "Label",
      text: "Original",
      frame: { x: 12, y: 12, width: 110, height: 30 },
      style: {
        fontFamily: "Helvetica Neue",
        fontSize: 18,
        textColor: "#ffffffff"
      }
    });
    var instance = master.createNewInstance();
    instance.name = "Editable symbol";
    instance.parent = root;
    instance.frame.x = 32;
    instance.frame.y = 220;
    var override = instance.overrides.find(function (o) {
      return o.property === "stringValue";
    });
    override.value = "Override";
  }
  doc.selectedLayers.layers = [root];
  var transfer = plugin.makeTransfer(config.options);
  NSString.stringWithString(
    JSON.stringify(transfer)
  ).writeToFile_atomically_encoding_error(
    output + kind + "-transfer.aeux.json",
    true,
    NSUTF8StringEncoding,
    null
  );
  sketch.export(root, {
    formats: "png",
    scales: "1",
    output: output,
    filename: kind + "-sketch.png",
    overwriting: true
  });
  report.ok = true;
  report.layers = transfer.batches[0][0].layerCount;
  report.images = transfer.images.length;
  report.warnings = transfer.warnings;
} catch (e) {
  report.error = String(e);
} finally {
  doc.close();
  NSString.stringWithString(
    JSON.stringify(report)
  ).writeToFile_atomically_encoding_error(
    output + kind + "-sketch-result.json",
    true,
    NSUTF8StringEncoding,
    null
  );
}
