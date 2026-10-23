"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { serializeSelection, color } = require("../shared/serializer");
const {
  validateTransfer,
  prepareTransfer,
  createReceiver
} = require("../ae/receiver");
const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jH1sAAAAASUVORK5CYII=";
let serial = 0;
function layer(type, props = {}) {
  return Object.assign(
    {
      type,
      id: "layer-" + ++serial,
      name: type,
      frame: { x: 0, y: 0, width: 100, height: 100 },
      style: {
        opacity: 1,
        fills: [],
        borders: [],
        shadows: [],
        innerShadows: [],
        blurs: [],
        blendingMode: "Normal"
      },
      transform: { rotation: 0 },
      hidden: false
    },
    props
  );
}
function add(parent, child) {
  parent.layers.push(child);
  child.parent = parent;
  return child;
}
function fixture() {
  const page = layer("Page", { layers: [] });
  const root = add(
    page,
    layer("Artboard", {
      name: "Screen",
      layers: [],
      isFrame: true,
      frame: { x: 500, y: 300, width: 640, height: 480 }
    })
  );
  const rect = add(
    root,
    layer("ShapePath", {
      shapeType: "Rectangle",
      closed: true,
      points: [
        { point: { x: 0, y: 0 }, pointType: "Straight" },
        { point: { x: 1, y: 0 }, pointType: "Straight" },
        { point: { x: 1, y: 1 }, pointType: "Straight" },
        { point: { x: 0, y: 1 }, pointType: "Straight" }
      ]
    })
  );
  return { doc: { id: "doc", colorSpace: "sRGB" }, page, root, rect };
}
const env = {
  rasterize: (l) => ({
    imgData: PNG,
    frame: { x: 50, y: 50, width: 100, height: 100 }
  }),
  textInfo: () => ({ fontName: "HelveticaNeue", baseline: 23, runs: [] })
};
function transfer() {
  const f = fixture();
  return serializeSelection(f.doc, [f.root], env);
}

test("public DOM frames, clockwise transforms, paths and colors survive serialization", () => {
  const f = fixture();
  f.rect.transform = { rotation: 18, flippedHorizontally: true };
  f.rect.style.fills = [
    { fillType: "Color", color: "#c6b6ff80", enabled: true }
  ];
  const t = serializeSelection(f.doc, [f.root], env);
  validateTransfer(t);
  assert.equal(t.batches[0][1].rotation, 18);
  assert.deepEqual(t.batches[0][1].flip, [-100, 100]);
  assert.deepEqual(t.batches[0][1].path.points[2], [100, 100]);
  assert.equal(t.batches[0][1].fill[0].opacity, (128 / 255) * 100);
  assert.deepEqual(color("#fff"), [1, 1, 1, 1]);
  assert.throws(() => color("invalid"));
});
test("a partial selection retains transformed ancestors and omits unrelated siblings", () => {
  const f = fixture(),
    g = add(
      f.root,
      layer("Group", {
        layers: [],
        transform: { rotation: 32 },
        frame: { x: 25, y: 30, width: 200, height: 150 }
      })
    );
  const child = add(
    g,
    layer("Text", {
      text: "Editable",
      fixedWidth: true,
      style: { fontSize: 24, textColor: "#ffffffff" }
    })
  );
  const t = serializeSelection(f.doc, [child], env);
  validateTransfer(t);
  assert.equal(t.batches[0].length, 2);
  assert.equal(t.batches[0][1].rotation, 32);
  assert.equal(t.batches[0][1].layers[0].stringValue, "Editable");
});
test("multiple frames become distinct compositions without duplicate selected descendants", () => {
  const f = fixture(),
    second = add(f.page, layer("Artboard", { layers: [], isFrame: true }));
  add(second, layer("Text", { text: "Two", style: { fontSize: 16 } }));
  const t = serializeSelection(f.doc, [f.root, f.rect, second], env);
  validateTransfer(t);
  assert.equal(t.batches.length, 2);
  assert.equal(t.batches[0].length, 2);
});
test("expanded symbol overrides stay editable and never detach the source", () => {
  const f = fixture(),
    text = layer("Text", {
      text: "Overridden",
      style: { fontSize: 20, textColor: "#fff" }
    });
  const instance = add(
    f.root,
    layer("SymbolInstance", {
      expandedLayers: [text],
      detach() {
        throw new Error("source mutated");
      }
    })
  );
  const t = serializeSelection(f.doc, [instance], env);
  validateTransfer(t);
  assert.equal(t.batches[0][1].layers[0].stringValue, "Overridden");
});
test("frame clipping produces an editable outline matte and background", () => {
  const f = fixture();
  f.root.clipsContents = true;
  f.root.style.fills = [{ color: "#123456ff" }];
  const t = serializeSelection(f.doc, [f.root], env);
  validateTransfer(t);
  assert.equal(t.batches[0][1].hasClippingMask, true);
  assert.equal(t.batches[0][2].name, "Screen / Background");
});
test("selected masked content includes its required sibling mask", () => {
  const f = fixture(),
    mask = f.rect;
  mask.masksSiblings = true;
  const image = add(f.root, layer("Image", { closestMaskingLayer: mask }));
  const t = serializeSelection(f.doc, [image], env);
  validateTransfer(t);
  assert.equal(t.batches[0][1].hasClippingMask, true);
  assert.equal(t.images.length, 1);
});
test("hidden layers and empty selection produce clear results", () => {
  const f = fixture();
  f.rect.hidden = true;
  assert.throws(() => serializeSelection(f.doc, [f.root], env), /no visible/);
  assert.throws(() => serializeSelection(null, [], env), /Open a Sketch/);
  assert.throws(() => serializeSelection(f.doc, [], env), /Select/);
});
test("unsupported appearance creates a portable raster with a warning", () => {
  const f = fixture();
  f.rect.style.blurs = [{ enabled: true, radius: 10 }];
  const t = serializeSelection(f.doc, [f.root], env);
  validateTransfer(t);
  assert.equal(t.batches[0][1].type, "Image");
  assert.equal(t.images.length, 1);
  assert.equal(t.warnings[0].code, "RASTERIZED");
});
test("image mode keeps resolution separate from layout and allows compensation off", () => {
  const f = fixture();
  const keep = serializeSelection(f.doc, [f.root], {
    ...env,
    forceRaster: true,
    rasterScale: 4,
    preserveImageSize: true
  });
  validateTransfer(keep);
  const full = serializeSelection(f.doc, [f.root], {
    ...env,
    forceRaster: true,
    rasterScale: 4,
    preserveImageSize: false
  });
  validateTransfer(full);
  assert.equal(keep.batches[0][1].type, "Image");
  assert.equal(keep.batches[0][1].rasterScale, 4);
  assert.equal(keep.batches[0][1].preserveImageSize, true);
  assert.equal(full.batches[0][1].preserveImageSize, false);
  assert.deepEqual(keep.batches[0][1].frame, full.batches[0][1].frame);
  assert.deepEqual(keep.warnings, []);
});
test("editable-mode appearance fallbacks retain design size even with image compensation off", () => {
  const f = fixture();
  f.rect.name = "*Raster";
  const t = serializeSelection(f.doc, [f.root], {
    ...env,
    preserveImageSize: false,
    rasterScale: 3
  });
  validateTransfer(t);
  assert.equal(t.batches[0][1].preserveImageSize, true);
  assert.equal(t.batches[0][1].rasterScale, 3);
});
test("PNG assets are written before the JSON references them", () => {
  const f = fixture();
  f.rect.name = "*Raster";
  const t = serializeSelection(f.doc, [f.root], env);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "aeux-modern-test-"));
  try {
    const file = prepareTransfer(t, temp, crypto.randomUUID());
    const p = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.deepEqual(p.images, []);
    assert.equal(
      fs
        .readFileSync(path.join(p.batches[0][0].folderPath, t.images[0].name))
        .subarray(1, 4)
        .toString(),
      "PNG"
    );
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
test("rejects unsafe asset paths, missing images, invalid coordinates and injected blend code", () => {
  let t = transfer();
  t.batches[0][1].blendMode = "BlendingMode.NORMAL; app.project.close()";
  assert.throws(() => validateTransfer(t), /blend/);
  t = transfer();
  t.batches[0][1].frame.x = Infinity;
  assert.throws(() => validateTransfer(t), /frame/);
  t = transfer();
  t.images = [{ name: "../overwrite.png", imgData: PNG }];
  assert.throws(() => validateTransfer(t), /image name/);
  t = transfer();
  Object.assign(t.batches[0][1], { type: "Image", assetName: "missing" });
  assert.throws(() => validateTransfer(t), /missing image/);
});
test("receiver acknowledges, deduplicates and waits for the AE result", async (t) => {
  let resolveImport,
    calls = 0;
  const r = createReceiver({
    port: 0,
    importTransfer: () => {
      calls++;
      return new Promise((resolve) => {
        resolveImport = resolve;
      });
    }
  });
  r.listen();
  await new Promise((resolve) => r.server.once("listening", resolve));
  t.after(() => new Promise((resolve) => r.server.close(resolve)));
  const url = "http://127.0.0.1:" + r.server.address().port;
  const data = transfer();
  data.requestId = "test-request";
  async function post(d, headers = {}) {
    return fetch(url + "/transfer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AEUX-Client": "aeux-modern",
        ...headers
      },
      body: JSON.stringify(d)
    });
  }
  const receipt = await (await post(data)).json();
  assert.equal(calls, 1);
  const duplicate = await (await post(data)).json();
  assert.equal(duplicate.id, receipt.id);
  assert.equal(calls, 1);
  assert.equal((await post({ ...data, requestId: "another" })).status, 409);
  resolveImport({ ok: true, layerCount: 1, warnings: [] });
  await new Promise((resolve) => setImmediate(resolve));
  const job = await (await fetch(url + "/jobs/" + receipt.id)).json();
  assert.equal(job.status, "completed");
  assert.equal(
    (
      await post(
        { ...data, requestId: "browser" },
        { Origin: "https://example.com" }
      )
    ).status,
    403
  );
});
test("receiver reports a rejected AE operation as failed", async (t) => {
  const r = createReceiver({
    port: 0,
    importTransfer: async () => {
      throw new Error("No current composition");
    }
  });
  r.listen();
  await new Promise((resolve) => r.server.once("listening", resolve));
  t.after(() => new Promise((resolve) => r.server.close(resolve)));
  const data = transfer();
  data.requestId = "failure";
  const url = "http://127.0.0.1:" + r.server.address().port;
  const receipt = await (
    await fetch(url + "/transfer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AEUX-Client": "aeux-modern"
      },
      body: JSON.stringify(data)
    })
  ).json();
  await new Promise((resolve) => setImmediate(resolve));
  const job = await (await fetch(url + "/jobs/" + receipt.id)).json();
  assert.equal(job.status, "failed");
  assert.match(job.error, /No current/);
});
