"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const MAX_BYTES = 128 * 1024 * 1024;
const TYPES = new Set([
  "Group",
  "Component",
  "Rect",
  "Ellipse",
  "Path",
  "CompoundShape",
  "Text",
  "Image"
]);
const BLENDS = new Set(
  "NORMAL DARKEN MULTIPLY COLOR_BURN LIGHTEN SCREEN COLOR_DODGE OVERLAY SOFT_LIGHT HARD_LIGHT DIFFERENCE EXCLUSION HUE SATURATION COLOR LUMINOSITY LINEAR_BURN ADD".split(
    " "
  )
);

function validateTransfer(data) {
  function fail(msg) {
    throw new Error("Invalid transfer: " + msg);
  }
  function number(n) {
    return (
      typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 1000000
    );
  }
  function numbers(a, n) {
    return Array.isArray(a) && a.length === n && a.every(number);
  }
  if (!data || data.format !== "aeux-modern" || data.schemaVersion !== 1)
    fail("unsupported format or schema version");
  if (
    !Array.isArray(data.batches) ||
    !data.batches.length ||
    data.batches.length > 100
  )
    fail("expected 1–100 compositions");
  if (!Array.isArray(data.images) || data.images.length > 10000)
    fail("invalid images");
  if (!Array.isArray(data.warnings) || data.warnings.length > 20000)
    fail("invalid warnings");
  data.warnings.forEach((w) => {
    if (!w || typeof w.layer !== "string" || typeof w.message !== "string")
      fail("invalid warning");
  });
  const images = new Set();
  let bytes = 0,
    layerCount = 0;
  data.images.forEach((image) => {
    if (
      !image ||
      typeof image.name !== "string" ||
      !/^[\w-]{1,110}\.png$/.test(image.name) ||
      images.has(image.name)
    )
      fail("invalid or duplicate image name");
    if (
      typeof image.imgData !== "string" ||
      !/^[A-Za-z\d+/]*={0,2}$/.test(image.imgData) ||
      image.imgData.length % 4
    )
      fail("invalid base64 image");
    bytes += image.imgData.length;
    if (bytes > MAX_BYTES) fail("images exceed 128 MB");
    const buffer = Buffer.from(image.imgData, "base64");
    if (
      buffer.length < 24 ||
      buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a"
    )
      fail("expected a PNG image");
    images.add(image.name);
  });
  function paints(list) {
    if (list == null) return;
    if (!Array.isArray(list) || list.length > 100) fail("invalid paints");
    list.forEach((p) => {
      if (
        !p ||
        !["fill", "gradient"].includes(p.type) ||
        !number(p.opacity) ||
        !number(p.blendMode)
      )
        fail("invalid paint");
      if (p.type === "fill" && !numbers(p.color, 4)) fail("invalid color");
      if (p.type === "gradient") {
        if (
          ![1, 2].includes(p.gradType) ||
          !numbers(p.startPoint, 2) ||
          !numbers(p.endPoint, 2)
        )
          fail("invalid gradient");
        const g = p.gradient;
        if (
          !g ||
          !Array.isArray(g.points) ||
          g.points.length < 2 ||
          g.points.length > 8 ||
          g.length !== g.points.length
        )
          fail("invalid gradient stops");
        g.points.forEach((s) => {
          if (
            !numbers(s.color, 4) ||
            !number(s.rampPoint) ||
            !number(s.opacity) ||
            !number(s.midPoint)
          )
            fail("invalid gradient stop");
        });
      }
      if (
        p.strokeDashes &&
        (!Array.isArray(p.strokeDashes) ||
          p.strokeDashes.length > 6 ||
          !p.strokeDashes.every(number))
      )
        fail("invalid stroke dashes");
      ["width", "cap", "join"].forEach((k) => {
        if (p[k] !== undefined && !number(p[k])) fail("invalid stroke");
      });
    });
  }
  function layer(l, depth) {
    if (depth > 100 || ++layerCount > 10000) fail("layer limits exceeded");
    if (
      !l ||
      !TYPES.has(l.type) ||
      typeof l.name !== "string" ||
      typeof l.id !== "string"
    )
      fail("invalid layer");
    if (
      !l.frame ||
      !["x", "y", "width", "height"].every((k) => number(l.frame[k])) ||
      l.frame.width < 0 ||
      l.frame.height < 0
    )
      fail("invalid frame");
    if (!numbers(l.flip, 2) || !number(l.opacity) || !number(l.rotation))
      fail("invalid transforms");
    if (
      typeof l.blendMode !== "string" ||
      !BLENDS.has(l.blendMode.replace(/^BlendingMode\./, "")) ||
      !l.blendMode.startsWith("BlendingMode.")
    )
      fail("invalid blend mode");
    paints(l.fill);
    paints(l.stroke);
    ["shadow", "innerShadow"].forEach((k) => {
      if (l[k] != null && (!Array.isArray(l[k]) || l[k].length > 100))
        fail("invalid shadows");
      (l[k] || []).forEach((s) => {
        if (
          !numbers(s.color, 4) ||
          !numbers(s.position, 2) ||
          !number(s.blur) ||
          !number(s.spread)
        )
          fail("invalid shadow");
      });
    });
    if (l.type === "Text") {
      if (
        !["Area", "Point"].includes(l.kind) ||
        typeof l.stringValue !== "string" ||
        l.stringValue.length > 100000 ||
        typeof l.fontName !== "string" ||
        !number(l.fontSize) ||
        l.fontSize <= 0 ||
        !numbers(l.textColor, 4) ||
        !numbers(l.textOrigin, 2)
      )
        fail("invalid text");
      if (
        !number(l.trackingAdjusted) ||
        !number(l.justification) ||
        (l.lineHeight != null && !number(l.lineHeight))
      )
        fail("invalid text metrics");
      if (!Array.isArray(l.textRuns) || l.textRuns.length > 100000)
        fail("invalid text runs");
      l.textRuns.forEach((r) => {
        if (
          !Number.isInteger(r.start) ||
          !Number.isInteger(r.end) ||
          r.start < 0 ||
          r.end <= r.start ||
          r.end > l.stringValue.length ||
          typeof r.font !== "string" ||
          !number(r.size) ||
          r.size <= 0 ||
          !numbers(r.color, 3)
        )
          fail("invalid text run");
      });
    }
    if (
      l.type === "Image" &&
      (typeof l.assetName !== "string" || !images.has(l.assetName + ".png"))
    )
      fail("missing image asset");
    if (
      l.type === "Image" &&
      (typeof l.preserveImageSize !== "boolean" ||
        !number(l.rasterScale) ||
        l.rasterScale < 0.25 ||
        l.rasterScale > 8)
    )
      fail("invalid image sizing");
    if (["Rect", "Ellipse", "Path", "CompoundShape"].includes(l.type)) {
      const p = l.path;
      if (
        !p ||
        !Array.isArray(p.points) ||
        p.points.length > 100000 ||
        !Array.isArray(p.inTangents) ||
        !Array.isArray(p.outTangents) ||
        p.points.length !== p.inTangents.length ||
        p.points.length !== p.outTangents.length
      )
        fail("invalid path");
      [p.points, p.inTangents, p.outTangents].forEach((a) => {
        if (!a.every((v) => numbers(v, 2))) fail("invalid path points");
      });
      if (l.roundness != null && !number(l.roundness)) fail("invalid corners");
    }
    if (["Group", "Component", "CompoundShape"].includes(l.type)) {
      if (!Array.isArray(l.layers)) fail("missing container layers");
      l.layers.forEach((child) => layer(child, depth + 1));
    }
  }
  data.batches.forEach((batch) => {
    if (!Array.isArray(batch) || batch.length < 2) fail("empty composition");
    const a = batch[0];
    if (
      !a ||
      a.type !== "Artboard" ||
      a.hostApp !== "Sketch" ||
      a.aeuxVersion !== 0.81 ||
      typeof a.name !== "string" ||
      !numbers(a.size, 2) ||
      a.size.some((n) => n < 1 || n > 30000) ||
      !numbers(a.bgColor, 4)
    )
      fail("invalid composition header");
    batch.slice(1).forEach((l) => layer(l, 0));
  });
  return data;
}

function prepareTransfer(data, basePath, jobId) {
  validateTransfer(data);
  if (!/^[a-f\d-]{36}$/i.test(jobId)) throw new Error("Invalid job ID");
  fs.mkdirSync(basePath, { recursive: true });
  const folder = path.join(basePath, jobId);
  fs.mkdirSync(folder);
  try {
    data.images.forEach((image) =>
      fs.writeFileSync(
        path.join(folder, image.name),
        Buffer.from(image.imgData, "base64"),
        { flag: "wx" }
      )
    );
    const prepared = JSON.parse(JSON.stringify(data));
    prepared.images = [];
    prepared.batches.forEach((batch) => {
      batch[0].folderPath = folder;
    });
    const file = path.join(folder, "transfer.json");
    fs.writeFileSync(file, JSON.stringify(prepared), { flag: "wx" });
    return file;
  } catch (e) {
    fs.rmSync(folder, { recursive: true, force: true });
    throw e;
  }
}

function createReceiver(options) {
  const jobs = new Map(),
    requests = new Map();
  let active = false;
  const update = options.onUpdate || (() => {});
  const server = http.createServer((req, res) => {
    function reply(status, data) {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      });
      res.end(JSON.stringify(data));
    }
    if (req.headers.origin)
      return reply(403, { error: "Browser origins are not accepted" });
    if (req.method === "GET" && req.url === "/health")
      return reply(200, {
        name: "AEUX Modern",
        version: "0.1.0",
        busy: active
      });
    if (req.method === "GET" && req.url.startsWith("/jobs/")) {
      const job = jobs.get(req.url.slice(6));
      return job ? reply(200, job) : reply(404, { error: "Unknown transfer" });
    }
    if (req.method !== "POST" || req.url !== "/transfer")
      return reply(404, { error: "Unknown endpoint" });
    if (
      req.headers["x-aeux-client"] !== "aeux-modern" ||
      !String(req.headers["content-type"]).startsWith("application/json")
    )
      return reply(415, {
        error: "Use the AEUX Modern Sketch plugin or portable import"
      });
    let bytes = 0,
      chunks = [],
      ended = false;
    req.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_BYTES) {
        if (!ended) {
          ended = true;
          reply(413, { error: "Transfer exceeds 128 MB" });
        }
        chunks = [];
      } else if (!ended) chunks.push(chunk);
    });
    req.on("end", () => {
      if (ended) return;
      try {
        const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (
          typeof data.requestId !== "string" ||
          !/^[\w-]{1,100}$/.test(data.requestId)
        )
          throw new Error("Invalid request ID");
        if (requests.has(data.requestId))
          return reply(202, { id: requests.get(data.requestId) });
        if (active)
          return reply(409, {
            error: "An import is already running. Wait for it to finish."
          });
        validateTransfer(data);
        const id = crypto.randomUUID(),
          job = { id, status: "queued" };
        jobs.set(id, job);
        requests.set(data.requestId, id);
        active = true;
        reply(202, { id });
        update(job);
        setImmediate(async () => {
          job.status = "importing";
          update(job);
          try {
            job.result = await options.importTransfer(data, id);
            job.status = "completed";
          } catch (e) {
            job.error = String(e.message || e);
            job.status = "failed";
          } finally {
            active = false;
            update(job);
          }
          if (jobs.size > 50) {
            const oldest = jobs.keys().next().value;
            jobs.delete(oldest);
            for (const [key, value] of requests)
              if (value === oldest) requests.delete(key);
          }
        });
      } catch (e) {
        reply(400, { error: String(e.message || e) });
      }
    });
    req.on("error", () => {});
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 10000;
  server.on("error", (e) =>
    update({
      status: "offline",
      error:
        e.code === "EADDRINUSE"
          ? "Port 7242 is in use. Close the other AEUX Modern panel or AE instance, then reopen this panel."
          : String(e.message)
    })
  );
  return {
    server,
    jobs,
    listen: () =>
      server.listen(
        options.port === undefined ? 7242 : options.port,
        "127.0.0.1"
      )
  };
}
module.exports = {
  validateTransfer,
  prepareTransfer,
  createReceiver,
  MAX_BYTES
};
