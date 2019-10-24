define([
  "dojo/_base/declare", "dojo/_base/lang", "dojo/on", "dojo/_base/array", "dojo/dom-style", "dojo/query!css3",
  "esri/tasks/QueryTask", "esri/tasks/query", "esri/request",
  "esri/dijit/PopupTemplate", "esri/geometry/Point", "esri/graphicsUtils",
  "esri/symbols/SimpleMarkerSymbol", "esri/symbols/SimpleLineSymbol", "esri/symbols/SimpleFillSymbol", "esri/Color"
], function(
  declare, lang, on, array, domStyle, query,
  QueryTask, Query, esriRequest,
  PopupTemplate, Point, graphicsUtils,
  SimpleMarkerSymbol, SimpleLineSymbol, SimpleFillSymbol, Color
){
  return declare(null, {
    map: null,
    layerName: null,
    queryAttribute: null,
    attributeValues: null,
    queryTask: null,
    query: new Query(),
    constructor: function(params) {
      this.map = params.map;
      this.queryTask = new QueryTask(params.queryUrl);
      this.layerName = params.layerName;
      var urlParam = params.queryFeatures.split(":");
      // if strings contains one ":"
      if (urlParam.length === 2) {
        this.queryAttribute = urlParam[0];
        this.attributeValues = urlParam[1];
        var requestHandle = esriRequest({
          "url": params.queryUrl,
          "content": {
            "f": "json"
          },
          "callbackParamName": "callback"
        });
        requestHandle.then(lang.hitch(this, function(response) {
          array.some(response.fields, lang.hitch(this, function(field){
            if (field.name === this.queryAttribute) {
              this.query.where = this.parseQueryFeatures(field.type);
              if (this.query.where.length > 0) {
                this.doQueryTask();
              }
              else {
                console.log("Can't execute features query.");
              }
              return false;
            }
          }));
        }), lang.hitch(this, function(error) {
          console.log("Can't get layer details from ags server ", error.message);
          this.query.where = this.parseQueryFeatures(null);
          if (this.query.where.length > 0) {
            this.doQueryTask();
          }
          else {
            console.log("Can't execute features query.");
          }
        }));
      }
      else {
        console.log("Bad 'features' parameter.");
      }
    },
    isNumber: function(n) {
      return /^-?[\d.]+(?:e-?\d+)?$/.test(n);
    },
    parseQueryFeatures: function(type) {
      var where = "";
      //var arr = queryFeatures.split(":");
      where = this.queryAttribute + " in (";
      var values = this.attributeValues.split(",");
      for (var i = 0; i < values.length; i++) {
        if (type === null) {
          if (this.isNumber(values[i])) {
            where += values[i] + ", ";
          }
          else {
            where += "'"+values[i] + "', ";
          }
        }
        else {
          if ((type === "esriFieldTypeString") || (type === "esriFieldTypeDate")) {
            where += "'"+values[i] + "', ";
          }
          else {
            where += values[i] + ", ";
          }
        }
      }

      if (where !=="") {
        where = where.slice(0, -2) + ")";
      }
      return where;
    },
    doQueryTask: function() {
      domStyle.set(dojo.byId("loadingCover"), {"display": "block"});
      query('*').style('cursor', 'wait');
      this.query.outFields = ["*"];
      this.query.returnGeometry = true;
      var mapa = this.map;
      var layerName = this.layerName;

      this.queryTask.execute(this.query,
        function(fset) {
          var resultFeatures = fset.features;
          mapa.graphics.clear();
          if (resultFeatures.length === 1) {
            var fieldInfos = [];
            var excludeInPopup = ["OBJECTID", "OBJECTID_1", "Shape", "Shape_Length", "Shape_Area"];
            for (var attribute in resultFeatures[0].attributes) {
              if (resultFeatures[0].attributes.hasOwnProperty(attribute)) {
                if (excludeInPopup.indexOf(attribute) === -1) {
                  var fieldInfo = {
                    fieldName: attribute,
                    visible: true,
                    label: attribute+":"
                  };
                  fieldInfos.push(fieldInfo);
                }
              }
            }
            var template = new PopupTemplate({
              title: layerName,
              fieldInfos: fieldInfos
            }); //Select template based on layer name
            resultFeatures[0].setInfoTemplate(template);
            var res = [resultFeatures[0]];

            var popupLocation;
            if (fset.geometryType == "esriGeometryPolyline") {
              var mid = parseInt(resultFeatures[0].geometry.paths[0].length / 2);
              var coords = resultFeatures[0].geometry.paths[0][mid];

              popupLocation = new Point(coords, mapa.spatialReference);
              var extent = graphicsUtils.graphicsExtent(resultFeatures);
              mapa.setExtent(extent, true);
            }
            else if (fset.geometryType == "esriGeometryPolygon") {
              popupLocation = resultFeatures[0].geometry.getExtent().getCenter();
              var extent = graphicsUtils.graphicsExtent(resultFeatures);
              mapa.setExtent(extent, true);
            }
            else if (fset.geometryType == "esriGeometryPoint") {
              var symbol = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_SQUARE, 20,
                            new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
                            new Color([0,0,0,0.0]), 0),
                            new Color([0,0,0,0.0]));
              resultFeatures[0].symbol = symbol;

              mapa.graphics.add(resultFeatures[0]);
              var extent = graphicsUtils.graphicsExtent(resultFeatures);
              mapa.setExtent(extent, false);
              popupLocation = resultFeatures[0].geometry;
            }
            mapa.infoWindow.setFeatures(res);
            setTimeout(lang.hitch(this, function() {
              mapa.infoWindow.show(popupLocation);
            }), 1000);
            //mapa.infoWindow.show(popupLocation);
          }
          else {
            if (fset.geometryType == "esriGeometryPoint") {
              var pOutline = new SimpleLineSymbol();
              pOutline.setStyle(SimpleLineSymbol.STYLE_SOLID);
              pOutline.setWidth(2);
              pOutline.setColor(new Color([0, 255, 255, 1.0]));
              var pSymbol = new SimpleMarkerSymbol();
              pSymbol.setStyle(SimpleMarkerSymbol.STYLE_SQUARE);
              pSymbol.setOutline(pOutline);
              pSymbol.setSize(20);
              pSymbol.setColor(new Color([0, 0, 0, 0.0]));
              array.forEach(resultFeatures, function(feature) {
                feature.setSymbol(pSymbol);
                mapa.graphics.add(feature);
              });
              var extent = graphicsUtils.graphicsExtent(resultFeatures);
              mapa.setExtent(extent, true);
            }
            else if (fset.geometryType == "esriGeometryPolyline") {
              var lSymbol = new SimpleLineSymbol();
              lSymbol.setStyle(SimpleLineSymbol.STYLE_SOLID);
              lSymbol.setWidth(2);
              lSymbol.setColor(new Color([255, 0, 0]));
              array.forEach(resultFeatures, function(feature){
                feature.setSymbol(lSymbol);
                mapa.graphics.add(feature);
              });
              var extent = graphicsUtils.graphicsExtent(resultFeatures);
              mapa.setExtent(extent, true);
            }
            else if (fset.geometryType == "esriGeometryPolygon") {
              var pgOutline = new SimpleLineSymbol();
              pgOutline.setStyle(SimpleLineSymbol.STYLE_SOLID);
              pgOutline.setWidth(2);
              pgOutline.setColor(new Color([255, 0, 0]));
              var pgSymbol = new SimpleFillSymbol();
              pgSymbol.setStyle(SimpleFillSymbol.STYLE_SOLID);
              pgSymbol.setOutline(pgOutline);
              pgSymbol.setColor(new Color([255, 255, 0, 0.25]));
              array.forEach(resultFeatures, function(feature){
                feature.setSymbol(pgSymbol);
                mapa.graphics.add(feature);
              });
              var extent = graphicsUtils.graphicsExtent(resultFeatures);
              mapa.setExtent(extent, true);
            }
          }

          domStyle.set(dojo.byId("loadingCover"), {"display": "none"});
          query('*').style('cursor', '');
        },
        function(error) {
          console.log(error.message);
          domStyle.set(dojo.byId("loadingCover"), {"display": "none"});
          query('*').style('cursor', '');
        });
    }
  });
});
