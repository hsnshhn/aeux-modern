"use strict";
// Keep the original renderer as the attribution-preserving upstream source.
// Anchored replacements fail the build if upstream moves unexpectedly.
module.exports = function patchRenderer(source) {
  function replace(from, to) {
    if (!source.includes(from))
      throw new Error("Renderer patch anchor missing: " + from.slice(0, 70));
    source = source.replace(from, to);
  }
  function fn(name, next, body) {
    const start = source.indexOf("    function " + name + "("),
      end = source.indexOf("    function " + next + "(", start);
    if (start < 0 || end < 0)
      throw new Error("Renderer function not found: " + name);
    source = source.slice(0, start) + body + "\n" + source.slice(end);
  }
  replace(
    "console.log('Host is online');",
    "/* AEUX Modern renderer derived from google/AEUX, Apache-2.0. */"
  );
  replace(
    "var AEUX = (function () {",
    "var AEUXModernRenderer = (function () {"
  );
  replace("    var JSON;", "    var JSON = $.global.JSON;");
  replace(
    "    var scriptName = 'AEUX';",
    "    $.global.JSON = JSON;\n    var scriptName = 'AEUX Modern';"
  );
  replace("    var devName = 'sumUX';", "    var devName = 'AEUXModern';");
  source = source.replace(
    /createNamedFolder\('AEUX'\)/g,
    "createNamedFolder('AEUX Modern')"
  );
  source = source.replace(
    /createNamedFolder\(compName\)/g,
    "createNamedFolder(compName, aeuxFolder)"
  );
  replace(
    "    var maskLayer = {};",
    "    var maskLayer = {};\n    var frameMaskLayer = {};"
  );
  replace(
    "    var ffxFolder = Folder.userData.toString() + '/' + devName + '/' + scriptName + '/ffx/';",
    "    var ffxFolder = Folder.temp.fsName + '/AEUXModern-ffx/';"
  );
  fn(
    "buildLayers",
    "filterTypes",
    `    function buildLayers(compObj) {
        var undoOpen=false;
        try {
            if(!app.project) app.newProject();
            returnMessage=[]; maskLayer={}; frameMaskLayer={}; compMult=1; clippingMask=null;
            prefs=compObj.prefs; prefs.precompGroups=true;
            folderPath=compObj.layerData[0].folderPath;
            hostApp='Sketch'; labelColor=0;
            if(!prefs.newComp && !setComp()) throw new Error('Open a composition before using Current comp.');
            app.beginUndoGroup('AEUX Modern import'); undoOpen=true;
            progressInc=1/Math.max(1,compObj.layerData[0].layerCount);
            filterTypes(compObj.layerData);
            if(thisComp) thisComp.openInViewer();
            return JSON.stringify({ok:true,layerCount:compObj.layerData[0].layerCount,compId:thisComp.id,warnings:returnMessage});
        } finally { if(undoOpen) app.endUndoGroup(); }
    }`
  );
  fn(
    "aeText",
    "aeGroup",
    `    function aeText(layer,opt_parent) {
        var w=layer.frame.width,h=layer.frame.height;
        var r=layer.kind === 'Area' ? thisComp.layers.addBoxText([Math.max(w,1),Math.max(h,1)],layer.stringValue) : thisComp.layers.addText(layer.stringValue);
        r.name=layer.name; r.selected=false; r.label=labelColor;
        var prop=r.property('ADBE Text Properties').property('ADBE Text Document'), d=prop.value;
        d.resetCharStyle(); d.resetParagraphStyle();
        d.text=layer.stringValue; d.font=layer.fontName; d.fontSize=layer.fontSize;
        d.applyFill=true; d.fillColor=layer.textColor.slice(0,3);
        d.tracking=layer.trackingAdjusted;
        d.justification=[ParagraphJustification.LEFT_JUSTIFY,ParagraphJustification.RIGHT_JUSTIFY,ParagraphJustification.CENTER_JUSTIFY,ParagraphJustification.FULL_JUSTIFY_LASTLINE_LEFT][layer.justification] || ParagraphJustification.LEFT_JUSTIFY;
        if(layer.lineHeight){d.autoLeading=false;d.leading=layer.lineHeight;}
        d.spaceAfter=layer.paragraphSpacing || 0;
        if(layer.kind === 'Area') {
            d.boxTextSize=[Math.max(w,1),Math.max(h,1)];
            if(layer.baseline !== undefined) {
                d.boxFirstBaselineAlignment=BoxFirstBaselineAlignment.MINIMUM_VALUE_ROMAN;
                d.boxFirstBaselineAlignmentMinimum=layer.baseline;
            }
            if(typeof BoxVerticalAlignment !== 'undefined') d.boxVerticalAlignment=layer.verticalAlignment === 'center' ? BoxVerticalAlignment.CENTER : (layer.verticalAlignment === 'bottom' ? BoxVerticalAlignment.BOTTOM : BoxVerticalAlignment.TOP);
        }
        if(layer.stroke && layer.stroke.length){d.applyStroke=true;d.strokeColor=layer.stroke[0].color.slice(0,3);d.strokeWidth=layer.stroke[0].width;}
        prop.setValue(d);
        d=prop.value;
        if(layer.textRuns && layer.textRuns.length) {
            for(var k=0;k<layer.textRuns.length;k++) {
                var run=layer.textRuns[k], range=d.characterRange(run.start,run.end);
                range.font=run.font; range.fontSize=run.size; range.fillColor=run.color;
            }
            prop.setValue(d);
        }
        if(d.font !== layer.fontName) returnMessage.push('Font substituted for '+layer.name+': '+layer.fontName+' → '+d.font);
        var origin=layer.textOrigin, anchor;
        if(layer.kind === 'Area') {
            var bp=prop.value.boxTextPos;
            anchor=[bp[0]+w/2,bp[1]+h/2];
        } else {
            var offset=layer.justification === 1 ? w : (layer.justification === 2 ? w/2 : 0);
            var baseline=layer.baseline !== undefined ? layer.baseline : -r.sourceRectAtTime(0,false).top;
            anchor=[w/2-offset,h/2-baseline];
        }
        r.property('ADBE Transform Group').property('ADBE Anchor Point').setValue(anchor);
        r.property('ADBE Transform Group').property('ADBE Position').setValue([(origin[0]+w/2)*compMult,(origin[1]+h/2)*compMult]);
        r.property('ADBE Transform Group').property('ADBE Rotate Z').setValue(layer.rotation);
        r.property('ADBE Transform Group').property('ADBE Scale').setValue([layer.flip[0]*compMult,layer.flip[1]*compMult]);
        r.property('ADBE Transform Group').property('ADBE Opacity').setValue(layer.opacity*layer.textColor[3]);
        if(opt_parent){r.setParentWithJump(opt_parent);r.moveAfter(opt_parent);}
        r.enabled=layer.isVisible;
        addDropShadow(r,layer);addInnerShadow(r,layer);setLayerBlendMode(r,layer);setMask(r,layer);
    }`
  );
  replace(
    "            r.collapseTransformation = true;",
    "            r.collapseTransformation = !layer.clipsContents;"
  );
  replace(
    "            addInnerShadow(r, layer);\n        }\n        else {",
    "            addInnerShadow(r, layer);\n            setLayerBlendMode(r, layer);\n        }\n        else {"
  );
  replace(
    'var nameId = "".concat(layer.name, "_").concat(layer.id);',
    'var nameId = layer.assetName || (layer.name + "_" + layer.id);'
  );
  // The original image blur helper accidentally overwrote the global scale.
  source = source.replace(
    /compMult = \(ignoreCompMult\) \? 1 : compMult;/g,
    "var effectMult = (ignoreCompMult) ? 1 : compMult;"
  );
  // Images have baked appearance in the Modern exporter, so no image effects.
  replace(
    "        addBlur(r, layer, true);",
    "        // Rasterized appearance is already baked into this image."
  );
  replace(
    "        r('ADBE Transform Group')('ADBE Scale').setValue([w * compMult, h * compMult]);",
    "        if(layer.preserveImageSize === false){w=100;h=100;}\n        r('ADBE Transform Group')('ADBE Scale').setValue([w * compMult, h * compMult]);"
  );
  // Reachable legacy effect handlers must propagate errors to the transfer job.
  source = source.replace(
    /alert\(e\.toString\(\) \+ "\\nError on line: " \+ e\.line\.toString\(\)\);/g,
    "throw e;"
  );
  fn(
    "setMask",
    "applyGradientFfx",
    `    function setMask(currentLayer,layerData) {
        var key=currentLayer.containingComp.id+'_'+(currentLayer.parent ? currentLayer.parent.id : 'root');
        if(layerData.shouldBreakMaskChain) maskLayer[key]=frameMaskLayer[key] || null;
        if(maskLayer[key]) currentLayer.setTrackMatte(maskLayer[key],TrackMatteType.ALPHA);
        if(layerData.hasClippingMask) {
            var original=currentLayer;
            if(!layerData.isFrameClip) {
                currentLayer=original.duplicate();
                currentLayer.name=original.name+' / Matte';
                currentLayer.shy=true;
            }
            if(layerData.maskMode === 'Outline') {
                currentLayer.effectsActive=false;
                function clean(group) {
                    for(var i=group.numProperties;i>=1;i--) {
                        var p=group.property(i);
                        if(p.matchName.indexOf('ADBE Vector Graphic - ') === 0) p.remove();
                        else if(p.matchName === 'ADBE Vector Group') clean(p.property('ADBE Vectors Group'));
                    }
                }
                if(currentLayer instanceof ShapeLayer) {
                    var contents=currentLayer.property('ADBE Root Vectors Group');clean(contents);
                    var fill=contents.addProperty('ADBE Vector Graphic - Fill');
                    fill.property('ADBE Vector Fill Color').setValue([1,1,1,1]);
                    fill.property('ADBE Vector Fill Opacity').setValue(100);
                    currentLayer.property('ADBE Transform Group').property('ADBE Opacity').setValue(100);
                } else returnMessage.push('Outline mask uses rendered alpha for '+layerData.name);
            }
            maskLayer[key]=currentLayer;currentLayer.enabled=false;
            if(layerData.isFrameClip)frameMaskLayer[key]=currentLayer;
        }
    }`
  );
  fn(
    "createNamedFolder",
    "aeArtboard",
    `    function createNamedFolder(name,parentFolder) {
        var parent=parentFolder || app.project.rootFolder;
        for(var i=1;i<=parent.numItems;i++) {
            var item=parent.item(i);
            if(item instanceof FolderItem && item.name === name)return item;
        }
        var folder=app.project.items.addFolder(name);folder.parentFolder=parent;return folder;
    }`
  );
  // Native clipping uses frame-sized precomps; no mutable duplicate-matte chain.
  replace(
    "    var progressDialog = new Window('palette', 'Hold on. One sec.');",
    "    var pbar={value:0};\n    var progressDialog={alignChildren:null,add:function(){return {minimumSize:{},alignChildren:null};}};"
  );
  return source;
};
