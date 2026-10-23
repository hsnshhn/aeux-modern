/* AEUX Modern, Apache-2.0. Native Sketch commands; no webview dependencies. */
var sketch = require("sketch/dom");
var UI = require("sketch/ui");
var serializer = require("./serializer");
var ENDPOINT = "http://127.0.0.1:7242";

function textInfo(layer) {
  var info = { runs: [] };
  // Isolated native typography adapter: the public DOM does not expose exact
  // PostScript names or attributed runs. All document traversal uses the DOM.
  try {
    var native = layer.sketchObject;
    info.fontName = String(native.font().fontName());
    var attributed = native.attributedStringValue(),
      last = null;
    for (var i = 0; i < layer.text.length; i++) {
      var attrs = attributed.attributesAtIndex_effectiveRange(i, null);
      var font = attrs.objectForKey("NSFont");
      var c = attrs.objectForKey("MSAttributedStringColorAttribute");
      var run = {
        start: i,
        end: i + 1,
        font: font ? String(font.fontName()) : info.fontName,
        size: font ? Number(font.pointSize()) : layer.style.fontSize,
        color: c
          ? [Number(c.red()), Number(c.green()), Number(c.blue())]
          : serializer.color(layer.style.textColor).slice(0, 3)
      };
      var key = JSON.stringify([run.font, run.size, run.color]);
      if (last && last.key === key) last.run.end = i + 1;
      else {
        info.runs.push(run);
        last = { key: key, run: run };
      }
    }
  } catch (e) {
    info.runs = [];
    info.warning = "Attributed text styling could not be read: " + String(e);
  }
  var fragments = layer.fragments;
  if (fragments && fragments.length) {
    var f = fragments[0];
    info.baseline =
      Number(f.rect.y) + Number(f.rect.height) - Number(f.baselineOffset);
  }
  return info;
}
function rasterize(layer, scale) {
  // Export from a temporary duplicate so transform/style normalization never
  // changes the designer's layer. A frame fixes the crop and alpha dimensions.
  var doc = sketch.getSelectedDocument(),
    page = doc.selectedPage,
    selected = doc.selectedLayers.layers.slice();
  var duplicate = null,
    crop = null;
  try {
    duplicate = layer.duplicate();
    var t = layer.transform || {},
      angle = ((t.rotation || 0) * Math.PI) / 180;
    var w = layer.frame.width,
      h = layer.frame.height;
    var bw = Math.abs(Math.cos(angle) * w) + Math.abs(Math.sin(angle) * h);
    var bh = Math.abs(Math.sin(angle) * w) + Math.abs(Math.cos(angle) * h);
    var pad = 0;
    (layer.style.shadows || []).forEach(function (s) {
      if (s.enabled)
        pad = Math.max(
          pad,
          Math.abs(s.x) + Math.abs(s.y) + s.blur * 2 + Math.abs(s.spread)
        );
    });
    (layer.style.blurs || []).forEach(function (b) {
      if (b.enabled) pad = Math.max(pad, b.radius * 4);
    });
    var width = Math.ceil(bw + pad * 2),
      height = Math.ceil(bh + pad * 2);
    crop = new sketch.Group.Frame({
      name: "AEUX Modern temporary export",
      parent: page,
      frame: { x: 0, y: 0, width: width, height: height },
      clipsContents: true
    });
    crop.style.fills = [];
    duplicate.parent = crop;
    duplicate.frame.x = (width - w) / 2;
    duplicate.frame.y = (height - h) / 2;
    duplicate.masksSiblings = false;
    duplicate.breaksMaskChain = true;
    if (Math.max(width, height) * (scale || 2) > 32768)
      throw new Error(
        "Image exceeds 32,768 pixels at this resolution. Reduce the resolution multiplier."
      );
    var buffer = sketch.export(crop, {
      formats: "png",
      output: false,
      scales: String(scale || 2)
    });
    return {
      imgData: buffer.toString("base64"),
      frame: {
        x: layer.frame.x + w / 2,
        y: layer.frame.y + h / 2,
        width: width,
        height: height
      }
    };
  } finally {
    if (crop) crop.remove();
    else if (duplicate) duplicate.remove();
    doc.selectedLayers.layers = selected;
  }
}
function imageSettings() {
  var settings = require("sketch/settings"),
    scale = Number(settings.settingForKey("aeux-modern.imageScale")) || 2;
  return {
    scale: scale,
    preserve: settings.settingForKey("aeux-modern.preserveImageSize") !== false
  };
}
function makeTransfer(options) {
  options = options || {};
  var doc = sketch.getSelectedDocument();
  var image = imageSettings();
  if (options.rasterScale !== undefined) image.scale = options.rasterScale;
  if (options.preserveImageSize !== undefined)
    image.preserve = options.preserveImageSize;
  return serializer.serializeSelection(
    doc,
    doc ? doc.selectedLayers.layers : [],
    {
      textInfo: textInfo,
      rasterScale: image.scale,
      forceRaster: !!options.imagesOnly,
      preserveImageSize: image.preserve,
      rasterize: function (layer) {
        return rasterize(layer, image.scale);
      }
    }
  );
}
function request(method, path, data) {
  var req = NSMutableURLRequest.requestWithURL(
    NSURL.URLWithString(ENDPOINT + path)
  );
  req.setHTTPMethod(method);
  req.setTimeoutInterval(4);
  req.setValue_forHTTPHeaderField("application/json", "Content-Type");
  req.setValue_forHTTPHeaderField("aeux-modern", "X-AEUX-Client");
  if (data)
    req.setHTTPBody(
      NSString.stringWithString(JSON.stringify(data)).dataUsingEncoding(
        NSUTF8StringEncoding
      )
    );
  var result = NSURLConnection.sendSynchronousRequest_returningResponse_error(
    req,
    null,
    null
  );
  if (!result)
    throw new Error(
      "Open Window → Extensions → AEUX Modern in After Effects, then try again."
    );
  var parsed = JSON.parse(
    String(NSString.alloc().initWithData_encoding(result, NSUTF8StringEncoding))
  );
  if (parsed.error) throw new Error(parsed.error);
  return parsed;
}
function guarded(fn) {
  try {
    fn();
  } catch (e) {
    UI.alert("AEUX Modern", String(e.message || e));
  }
}
function send(options) {
  guarded(function () {
    var health = request("GET", "/health");
    if (health.name !== "AEUX Modern")
      throw new Error("A different service is using port 7242.");
    var transfer = makeTransfer(options);
    transfer.requestId = String(NSUUID.UUID().UUIDString());
    var receipt = request("POST", "/transfer", transfer);
    require("sketch/settings").setSettingForKey(
      "aeux-modern.lastTransferId",
      receipt.id
    );
    UI.message(
      "AEUX Modern: transfer queued. See the AE panel for completion."
    );
  });
}
function onSend() {
  send();
}
function onSendImages() {
  send({ imagesOnly: true });
}
function onPreflight() {
  guarded(function () {
    var t = makeTransfer(),
      total = t.batches.reduce(function (n, b) {
        return n + b[0].layerCount;
      }, 0);
    var lines = [
      t.batches.length +
        " composition(s), " +
        total +
        " layer(s), " +
        t.images.length +
        " image(s)."
    ];
    t.warnings.forEach(function (w) {
      lines.push(w.layer + ": " + w.message);
    });
    if (!t.warnings.length) lines.push("No export warnings.");
    UI.alert("AEUX Modern · Preflight", lines.join("\n\n"));
  });
}
function onExport() {
  guarded(function () {
    var t = makeTransfer(),
      panel = NSSavePanel.savePanel();
    panel.setNameFieldStringValue(
      serializer.safeName(t.batches[0][0].name) + ".aeux.json"
    );
    panel.setCanCreateDirectories(true);
    if (panel.runModal() !== NSModalResponseOK) return;
    var ok = NSString.stringWithString(
      JSON.stringify(t)
    ).writeToURL_atomically_encoding_error(
      panel.URL(),
      true,
      NSUTF8StringEncoding,
      null
    );
    if (!ok) throw new Error("Could not save the transfer file.");
    UI.message("AEUX Modern: portable transfer saved, including image data.");
  });
}
function onLastTransfer() {
  guarded(function () {
    var id = require("sketch/settings").settingForKey(
      "aeux-modern.lastTransferId"
    );
    if (!id) throw new Error("No transfer has been sent in this session.");
    var job = request("GET", "/jobs/" + id);
    UI.alert(
      "AEUX Modern · Last transfer",
      job.status === "completed"
        ? job.result.layerCount + " layers imported successfully."
        : job.error || job.status
    );
  });
}
function onHealth() {
  guarded(function () {
    var h = request("GET", "/health");
    UI.alert(
      "AEUX Modern",
      "Receiver " + h.version + " is ready in After Effects."
    );
  });
}
function onImageSettings() {
  guarded(function () {
    var prefs = imageSettings(),
      alert = NSAlert.alloc().init();
    alert.setMessageText("Image export settings");
    alert.setInformativeText(
      "Resolution multiplier: 0.25–8×.\n\nKeep size enabled: 2× pixels import at 50% scale; 4× at 25%. Disabled: images import at 100%. The layer center stays at the design position."
    );
    var view = NSView.alloc().initWithFrame(NSMakeRect(0, 0, 300, 62));
    var input = NSComboBox.alloc().initWithFrame(NSMakeRect(0, 36, 110, 26));
    input.addItemsWithObjectValues(["1", "2", "3", "4"]);
    input.setStringValue(String(prefs.scale));
    view.addSubview(input);
    var keep = NSButton.alloc().initWithFrame(NSMakeRect(0, 0, 300, 26));
    keep.setButtonType(NSSwitchButton);
    keep.setTitle("Keep original size and position in AE");
    keep.setState(
      prefs.preserve ? NSControlStateValueOn : NSControlStateValueOff
    );
    view.addSubview(keep);
    alert.setAccessoryView(view);
    alert.addButtonWithTitle("Save");
    alert.addButtonWithTitle("Cancel");
    if (alert.runModal() !== NSAlertFirstButtonReturn) return;
    var scale = Number(String(input.stringValue()));
    if (!isFinite(scale) || scale < 0.25 || scale > 8)
      throw new Error("Choose a resolution multiplier from 0.25 to 8.");
    var settings = require("sketch/settings");
    settings.setSettingForKey("aeux-modern.imageScale", scale);
    settings.setSettingForKey(
      "aeux-modern.preserveImageSize",
      Number(keep.state()) === 1
    );
  });
}
function onExportImages() {
  guarded(function () {
    var t = makeTransfer({ imagesOnly: true }),
      panel = NSOpenPanel.openPanel();
    panel.setCanChooseFiles(false);
    panel.setCanChooseDirectories(true);
    panel.setCanCreateDirectories(true);
    panel.setMessage(
      "Choose a folder for PNG images and a portable transfer file"
    );
    if (panel.runModal() !== NSModalResponseOK) return;
    var url = panel
      .URL()
      .URLByAppendingPathComponent(
        "AEUX Images - " + String(NSUUID.UUID().UUIDString()).slice(0, 8)
      );
    if (
      !NSFileManager.defaultManager().createDirectoryAtURL_withIntermediateDirectories_attributes_error(
        url,
        true,
        null,
        null
      )
    )
      throw new Error("Cannot create export folder.");
    t.images.forEach(function (image) {
      var data = NSData.alloc().initWithBase64EncodedString_options(
        image.imgData,
        0
      );
      var name =
        serializer.safeName(image.label || "Image") + "__" + image.name;
      if (
        !data.writeToURL_atomically(url.URLByAppendingPathComponent(name), true)
      )
        throw new Error("Could not save " + name);
    });
    NSString.stringWithString(
      JSON.stringify(t)
    ).writeToURL_atomically_encoding_error(
      url.URLByAppendingPathComponent("transfer.aeux.json"),
      true,
      NSUTF8StringEncoding,
      null
    );
    NSWorkspace.sharedWorkspace().activateFileViewerSelectingURLs([url]);
    UI.message(
      "AEUX Modern: " +
        t.images.length +
        " PNG images exported at " +
        imageSettings().scale +
        "×."
    );
  });
}
// Named exports are Sketch command handlers, not a Node ES module.
module.exports = {
  onSend: onSend,
  onSendImages: onSendImages,
  onPreflight: onPreflight,
  onExport: onExport,
  onExportImages: onExportImages,
  onImageSettings: onImageSettings,
  onHealth: onHealth,
  onLastTransfer: onLastTransfer,
  textInfo: textInfo,
  rasterize: rasterize,
  makeTransfer: makeTransfer
};
