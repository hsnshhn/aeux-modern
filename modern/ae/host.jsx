/* AEUX Modern CEP entry point. Keep ExtendScript ES3 compatible. */
var AEUXModern = (function(){
    function importFile(filePath,prefsJSON) {
        try {
            var file=File(filePath);
            if(!file.exists)throw new Error('The transfer file no longer exists.');
            file.encoding='UTF-8';
            if(!file.open('r'))throw new Error('Cannot open the transfer file.');
            var text=file.read();file.close();
            var data=JSON.parse(text), prefs=JSON.parse(prefsJSON);
            if(data.format !== 'aeux-modern' || data.schemaVersion !== 1)throw new Error('Unsupported transfer file.');
            var count=0, comps=[], warnings=data.warnings || [];
            for(var i=0;i<data.batches.length;i++) {
                var result=JSON.parse(AEUXModernRenderer.buildLayers({layerData:data.batches[i],prefs:prefs}));
                if(!result.ok)throw new Error(result.error || 'Layer import failed.');
                count+=Number(result.layerCount);comps.push(result.compId);
                for(var j=0;j<result.warnings.length;j++)warnings.push({layer:'After Effects',message:String(result.warnings[j])});
            }
            return JSON.stringify({ok:true,layerCount:count,compIds:comps,warnings:warnings});
        } catch(e) {return JSON.stringify({ok:false,error:String(e.message || e)+' (line '+e.line+') · Use Undo to remove any partial import.'});}
    }
    return {importFile:importFile};
})();
