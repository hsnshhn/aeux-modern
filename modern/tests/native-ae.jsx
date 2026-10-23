/* Runs synchronously in AE. It never closes or saves the user's project. */
(function(){
    var config=__AEUX_NATIVE_CONFIG__, before={}, active=app.project.activeItem;
    var result={}, created=[];
    for(var i=1;i<=app.project.numItems;i++) before[app.project.item(i).id]=true;
    try {
        $.evalFile(File(config.host));
        result=JSON.parse(AEUXModern.importFile(config.file,JSON.stringify(config.prefs)));
        if(result.ok) {
            var comp=app.project.itemByID(result.compIds[0]);
            result.actual=[];
            function inspect(c) {
                for(var n=1;n<=c.numLayers;n++) {
                    var layer=c.layer(n), entry={name:layer.name,shape:layer instanceof ShapeLayer,text:layer instanceof TextLayer,matte:layer.hasTrackMatte,enabled:layer.enabled,scale:layer.transform.scale.value,position:layer.transform.position.value,image:!!(layer.source && layer.source instanceof FootageItem)};
                    if(layer instanceof TextLayer) {
                        var d=layer.text.sourceText.value;
                        entry.font=d.font;entry.content=d.text;entry.position=layer.transform.position.value;
                    }
                    result.actual.push(entry);
                    if(layer.source && layer.source instanceof CompItem) inspect(layer.source);
                }
            }
            inspect(comp);
            comp.saveFrameToPng(0,File(config.png));
        }
    } catch(e) { result={ok:false,error:String(e),line:e.line}; }
    finally {
        // AE blocks user editing while this script runs. Only IDs created after
        // the snapshot above are removed; all existing project items are kept.
        for(var j=1;j<=app.project.numItems;j++){var item=app.project.item(j);if(!before[item.id])created.push(item);}
        for(var k=created.length-1;k>=0;k--){try{created[k].remove();}catch(e){}}
        try{if(active && active instanceof CompItem)active.openInViewer();}catch(e){}
        var file=File(config.report);file.encoding='UTF-8';file.open('w');
        file.write(typeof JSON !== 'undefined' ? JSON.stringify(result) : result.toSource());file.close();
    }
})();
