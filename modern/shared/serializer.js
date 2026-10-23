/* AEUX Modern, Apache-2.0. Public Sketch DOM -> AEUX layer schema. */
"use strict";
function color(hex) {
  var h = String(hex || "#000000ff").replace("#", "");
  if (h.length === 3 || h.length === 4)
    h = h
      .split("")
      .map(function (c) {
        return c + c;
      })
      .join("");
  if (!/^[a-f\d]{6}([a-f\d]{2})?$/i.test(h))
    throw new Error("Invalid color: " + hex);
  return [0, 2, 4, 6].map(function (i) {
    return i === 6 && h.length === 6
      ? 1
      : parseInt(h.slice(i, i + 2), 16) / 255;
  });
}
function safeName(value) {
  return (
    String(value)
      .replace(/[\/\\:\x00-\x1f<>"|?*]/g, "_")
      .replace(/^\.+/, "_")
      .slice(0, 110) || "layer"
  );
}
var blendNames = {
  Normal: "NORMAL",
  Darken: "DARKEN",
  Multiply: "MULTIPLY",
  ColorBurn: "COLOR_BURN",
  Lighten: "LIGHTEN",
  Screen: "SCREEN",
  ColorDodge: "COLOR_DODGE",
  Overlay: "OVERLAY",
  SoftLight: "SOFT_LIGHT",
  HardLight: "HARD_LIGHT",
  Difference: "DIFFERENCE",
  Exclusion: "EXCLUSION",
  Hue: "HUE",
  Saturation: "SATURATION",
  Color: "COLOR",
  Luminosity: "LUMINOSITY",
  PlusDarker: "LINEAR_BURN",
  PlusLighter: "ADD"
};
var shapeBlends = {
  Normal: 1,
  Darken: 3,
  Multiply: 4,
  ColorBurn: 5,
  Lighten: 9,
  Screen: 10,
  ColorDodge: 11,
  Overlay: 15,
  SoftLight: 16,
  HardLight: 17,
  Difference: 23,
  Exclusion: 24,
  Hue: 26,
  Saturation: 27,
  Color: 28,
  Luminosity: 29,
  PlusDarker: 6,
  PlusLighter: 12
};
function frame(layer) {
  var f = layer.frame;
  return {
    x: f.x + f.width / 2,
    y: f.y + f.height / 2,
    width: f.width,
    height: f.height
  };
}
function path(layer) {
  var f = layer.frame,
    result = {
      points: [],
      inTangents: [],
      outTangents: [],
      closed: !!layer.closed
    };
  (layer.points || []).forEach(function (p) {
    var xy = [p.point.x * f.width, p.point.y * f.height];
    function tangent(h) {
      return !h || p.pointType === "Straight"
        ? [0, 0]
        : [h.x * f.width - xy[0], h.y * f.height - xy[1]];
    }
    result.points.push(xy);
    result.inTangents.push(tangent(p.curveTo));
    result.outTangents.push(tangent(p.curveFrom));
  });
  return result;
}
function serializeSelection(document, selection, environment) {
  if (!document) throw new Error("Open a Sketch document first.");
  if (!selection || !selection.length)
    throw new Error("Select one or more frames or layers.");
  var env = environment || {},
    warnings = [],
    assets = [],
    count = 0,
    selected = {},
    required = {},
    roots = [],
    rootIds = {};
  function warn(layer, code, message) {
    warnings.push({
      layerId: String(layer.id),
      layer: layer.name || "Document",
      code: code,
      message: message
    });
  }
  selection.forEach(function (layer) {
    selected[layer.id] = true;
    var p = layer,
      top = layer;
    while (p && p.type !== "Page" && p.type !== "Document") {
      required[p.id] = true;
      top = p;
      p = p.parent;
    }
    if (!rootIds[top.id]) {
      roots.push(top);
      rootIds[top.id] = true;
    }
    var mask = layer.closestMaskingLayer;
    while (mask) {
      required[mask.id] = true;
      selected[mask.id] = true;
      mask = mask.closestMaskingLayer;
    }
  });
  if (String(document.colorSpace) === "P3")
    warn(
      document,
      "COLOR_SPACE",
      "P3 colors need matching color management in AE; verify against the reference."
    );
  function shadows(list) {
    var values = (list || [])
      .filter(function (v) {
        return v.enabled;
      })
      .map(function (v) {
        return {
          color: color(v.color),
          position: [v.x || 0, v.y || 0],
          blur: v.blur || 0,
          spread: v.spread || 0
        };
      });
    return values.length ? values : null;
  }
  function common(layer) {
    var s = layer.style || {},
      t = layer.transform || {};
    return {
      id: String(layer.id),
      name: layer.name,
      frame: frame(layer),
      isVisible: !layer.hidden,
      opacity: Math.round((s.opacity === undefined ? 1 : s.opacity) * 100),
      rotation: t.rotation || 0,
      flip: [
        t.flippedHorizontally ? -100 : 100,
        t.flippedVertically ? -100 : 100
      ],
      blendMode: "BlendingMode." + (blendNames[s.blendingMode] || "NORMAL"),
      hasClippingMask: !!layer.masksSiblings,
      maskMode: layer.maskMode || "Outline",
      shouldBreakMaskChain: !!layer.breaksMaskChain,
      shadow: shadows(s.shadows),
      innerShadow: shadows(s.innerShadows),
      blur: null
    };
  }
  function paints(layer, list, stroke) {
    var f = layer.frame,
      opts = (layer.style || {}).borderOptions || {};
    var values = (list || [])
      .filter(function (v) {
        return v.enabled !== false;
      })
      .map(function (v) {
        var c = color(v.color || "#000000ff");
        var o = {
          type: "fill",
          enabled: true,
          color: c,
          opacity: c[3] * 100 * (v.opacity === undefined ? 1 : v.opacity),
          blendMode: shapeBlends[v.blendingMode] || 1
        };
        if (v.fillType === "Gradient") {
          var g = v.gradient;
          if (g.gradientType !== "Linear" && g.gradientType !== "Radial")
            throw new Error("Unsupported gradient");
          if (g.stops.length < 2 || g.stops.length > 8)
            throw new Error("Gradient needs 2–8 stops");
          o.type = "gradient";
          o.opacity = 100 * (v.opacity === undefined ? 1 : v.opacity);
          o.gradType = g.gradientType === "Radial" ? 2 : 1;
          o.startPoint = [
            (g.from.x - 0.5) * f.width,
            (g.from.y - 0.5) * f.height
          ];
          o.endPoint = [(g.to.x - 0.5) * f.width, (g.to.y - 0.5) * f.height];
          o.gradient = {
            length: g.stops.length,
            points: g.stops.map(function (stop) {
              var c = color(stop.color);
              return {
                color: c,
                opacity: c[3],
                midPoint: 0.5,
                rampPoint: stop.position
              };
            })
          };
        }
        if (stroke) {
          o.width = v.thickness;
          o.cap = { Butt: 0, Round: 1, Projecting: 2 }[opts.lineEnd] || 0;
          o.join = { Miter: 0, Round: 1, Bevel: 2 }[opts.lineJoin] || 0;
          o.strokeDashes = (opts.dashPattern || []).map(Number);
          if (v.position && v.position !== "Center")
            warn(
              layer,
              "STROKE_ALIGNMENT",
              "AE centers editable strokes. Use a raster fallback if inside/outside alignment must match exactly."
            );
        }
        return o;
      });
    return values.length ? values : null;
  }
  function needsRaster(layer) {
    var s = layer.style || {},
      list = (s.fills || []).concat(s.borders || []);
    if (String(layer.name).charAt(0) === "*")
      return "Explicit raster export (*)";
    if (s.tint || s.progressiveAlpha) return "Tint or progressive alpha";
    if (
      (s.blurs || []).some(function (b) {
        return b.enabled;
      })
    )
      return "Blur or glass appearance";
    if (
      list.some(function (p) {
        return (
          p.enabled !== false &&
          (p.fillType === "Pattern" ||
            (p.fillType === "Gradient" &&
              (!p.gradient ||
                ["Linear", "Radial"].indexOf(p.gradient.gradientType) < 0 ||
                p.gradient.stops.length > 8)))
        );
      })
    )
      return "Image fill or unsupported gradient";
    if (
      layer.type === "Text" &&
      list.some(function (p) {
        return p.enabled !== false && p.fillType === "Gradient";
      })
    )
      return "Gradient text";
    if (["HotSpot", "Slice"].indexOf(layer.type) >= 0) return null;
    if (
      [
        "Text",
        "Image",
        "Shape",
        "ShapePath",
        "Group",
        "Artboard",
        "SymbolMaster",
        "SymbolInstance"
      ].indexOf(layer.type) < 0
    )
      return "Unsupported layer type: " + layer.type;
    return null;
  }
  function raster(layer, reason) {
    if (!env.rasterize)
      throw new Error(
        layer.name + ": " + reason + ". Raster export is unavailable."
      );
    var asset = env.rasterize(layer),
      o = common(layer);
    o.type = "Image";
    o.assetName = safeName(layer.id).slice(0, 100) + "-" + assets.length;
    o.rotation = 0;
    o.flip = [100, 100];
    o.opacity = 100;
    o.shadow = null;
    o.innerShadow = null;
    if (asset.frame) o.frame = asset.frame;
    o.rasterScale = env.rasterScale || 2;
    o.preserveImageSize = env.forceRaster
      ? env.preserveImageSize !== false
      : true;
    assets.push({
      name: o.assetName + ".png",
      label: layer.name,
      imgData: asset.imgData
    });
    if (layer.type !== "Image" && reason !== "Image export mode")
      warn(
        layer,
        "RASTERIZED",
        reason + "; exported as a PNG. Other layers remain editable."
      );
    return o;
  }
  function radius(layer) {
    var s = layer.style || {},
      radii = s.corners && s.corners.radii;
    if (radii && radii.length) return Number(radii[0]) || 0;
    if (layer.type === "SymbolInstance" && layer.master)
      return radius(layer.master);
    return layer.points && layer.points.length
      ? Number(layer.points[0].cornerRadius) || 0
      : 0;
  }
  function rect(layer, suffix, fill, stroke) {
    var o = common(layer),
      w = layer.frame.width,
      h = layer.frame.height;
    o.id += suffix;
    o.name += suffix;
    o.type = "Rect";
    o.frame = { x: w / 2, y: h / 2, width: w, height: h };
    o.rotation = 0;
    o.flip = [100, 100];
    o.opacity = 100;
    o.shadow = null;
    o.innerShadow = null;
    o.hasClippingMask = false;
    o.shouldBreakMaskChain = false;
    o.blendMode = "BlendingMode.NORMAL";
    o.fill = fill;
    o.stroke = stroke;
    o.roundness = radius(layer);
    o.path = {
      points: [
        [0, 0],
        [w, 0],
        [w, h],
        [0, h]
      ],
      inTangents: [
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0]
      ],
      outTangents: [
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0]
      ],
      closed: true
    };
    count++;
    return o;
  }
  function walk(layer, all, depth) {
    if (depth > 100) throw new Error("Layer nesting exceeds 100 levels.");
    if (layer.hidden || ["HotSpot", "Slice"].indexOf(layer.type) >= 0)
      return null;
    if (!all && !required[layer.id]) return null;
    all = all || !!selected[layer.id];
    count++;
    if (count > 10000)
      throw new Error(
        "Transfer exceeds 10,000 layers. Select a smaller section."
      );
    var reason =
      env.forceRaster && selected[layer.id]
        ? "Image export mode"
        : needsRaster(layer);
    if (reason) return raster(layer, reason);
    var o = common(layer),
      s = layer.style || {};
    if (layer.type === "Image") return raster(layer, "Bitmap layer");
    if (layer.type === "Text") {
      var info = env.textInfo ? env.textInfo(layer) : {};
      o.type = "Text";
      o.kind = layer.fixedWidth ? "Area" : "Point";
      o.stringValue = String(layer.text).replace(/\u2028/g, "\n");
      if (s.textTransform === "uppercase")
        o.stringValue = o.stringValue.toUpperCase();
      if (s.textTransform === "lowercase")
        o.stringValue = o.stringValue.toLowerCase();
      o.fontName = info.fontName || s.fontFamily || "Helvetica";
      o.fontSize = s.fontSize || 16;
      o.textColor = color(s.textColor);
      o.tracking = s.kerning || 0;
      o.trackingAdjusted = (o.tracking / o.fontSize) * 1000;
      o.justification =
        { left: 0, right: 1, center: 2, justify: 3 }[s.alignment] || 0;
      o.lineHeight = s.lineHeight || null;
      o.fill = paints(layer, s.fills);
      o.stroke = paints(layer, s.borders, true);
      o.textRuns = info.runs || [];
      o.baseline = info.baseline;
      o.verticalAlignment = s.verticalAlignment || "top";
      o.paragraphSpacing = s.paragraphSpacing || 0;
      if (info.warning) warn(layer, "TEXT_STYLE", info.warning);
      if (
        s.textTransform &&
        s.textTransform !== "none" &&
        o.stringValue.length !== String(layer.text).length
      ) {
        o.textRuns = [];
        warn(
          layer,
          "TEXT_TRANSFORM",
          "Case conversion changed character count; review mixed styling."
        );
      }
      o.textOrigin = [layer.frame.x, layer.frame.y];
      if (Object.keys(s.fontAxes || {}).length)
        warn(
          layer,
          "VARIABLE_FONT",
          "Variable font axes need a visual check in AE."
        );
      return o;
    }
    if (layer.type === "ShapePath" || layer.type === "Shape") {
      o.type =
        layer.type === "Shape"
          ? "CompoundShape"
          : !layer.edited && layer.shapeType === "Rectangle"
            ? "Rect"
            : !layer.edited && layer.shapeType === "Oval"
              ? "Ellipse"
              : "Path";
      o.fill = paints(layer, s.fills);
      o.stroke = paints(layer, s.borders, true);
      o.path = path(layer);
      o.roundness = radius(layer);
      if (o.type === "CompoundShape") {
        o.layers = (layer.layers || [])
          .map(function (child) {
            var c = walk(child, true, depth + 1);
            if (c) {
              c.frame.x -= c.frame.width / 2;
              c.frame.y -= c.frame.height / 2;
              c.booleanOperation =
                { Union: 0, Subtract: 1, Intersect: 2, Difference: 3 }[
                  child.booleanOperation
                ] || 0;
            }
            return c;
          })
          .filter(Boolean);
        o.booleanOperation = o.layers.length ? o.layers[0].booleanOperation : 0;
      }
      return o;
    }
    o.type = "Group";
    o.clipsContents =
      !!layer.clipsContents ||
      (layer.type === "SymbolInstance" && layer.master
        ? !!layer.master.clipsContents
        : false);
    var children =
      layer.type === "SymbolInstance" ? layer.expandedLayers : layer.layers;
    if (!children)
      throw new Error(layer.name + ": cannot read container contents.");
    o.layers = Array.from(children)
      .map(function (child) {
        return walk(child, all, depth + 1);
      })
      .filter(Boolean);
    if (all) {
      var sourceStyle =
        layer.type === "SymbolInstance" && layer.master
          ? layer.master.style
          : s;
      var fill = paints(
          layer,
          (s.fills || []).length ? s.fills : sourceStyle.fills
        ),
        stroke = paints(
          layer,
          (s.borders || []).length ? s.borders : sourceStyle.borders,
          true
        );
      if (fill) o.layers.unshift(rect(layer, " / Background", fill, null));
      if (stroke) o.layers.push(rect(layer, " / Border", null, stroke));
    }
    if (o.clipsContents) {
      var clip = rect(
        layer,
        " / Clip",
        [
          {
            type: "fill",
            enabled: true,
            color: [1, 1, 1, 1],
            opacity: 100,
            blendMode: 1
          }
        ],
        null
      );
      clip.hasClippingMask = true;
      clip.maskMode = "Outline";
      clip.isFrameClip = true;
      o.layers.unshift(clip);
    }
    return o.layers.length ? o : null;
  }
  var batches = roots
    .map(function (root) {
      var before = count,
        content,
        compositionSize = [root.frame.width, root.frame.height],
        isContainer =
          ["Artboard", "SymbolMaster"].indexOf(root.type) >= 0 ||
          !!root.isFrame;
      if (isContainer) {
        var container = walk(root, !!selected[root.id], 0);
        content = container ? container.layers || [container] : [];
        if (container && !container.layers) {
          container.frame.x = root.frame.width / 2;
          container.frame.y = root.frame.height / 2;
        }
      } else {
        var item = walk(root, !!selected[root.id], 0);
        content = item ? [item] : [];
        if (item) {
          if (item.type === "Image")
            compositionSize = [item.frame.width, item.frame.height];
          item.frame.x = compositionSize[0] / 2;
          item.frame.y = compositionSize[1] / 2;
          if (item.textOrigin) item.textOrigin = [0, 0];
        }
      }
      function nodes(list) {
        return list.reduce(function (n, l) {
          return n + 1 + (l.layers ? nodes(l.layers) : 0);
        }, 0);
      }
      return [
        {
          type: "Artboard",
          hostApp: "Sketch",
          aeuxVersion: 0.81,
          name: root.name,
          id: String(root.id),
          size: compositionSize,
          bgColor: [0, 0, 0, 0],
          layerCount: nodes(content)
        }
      ].concat(content);
    })
    .filter(function (batch) {
      return batch.length > 1;
    });
  if (!batches.length)
    throw new Error("The selection contains no visible exportable layers.");
  return {
    format: "aeux-modern",
    schemaVersion: 1,
    pluginVersion: "0.1.0",
    documentId: String(document.id),
    batches: batches,
    images: assets,
    warnings: warnings
  };
}
module.exports = {
  serializeSelection: serializeSelection,
  color: color,
  safeName: safeName,
  path: path
};
