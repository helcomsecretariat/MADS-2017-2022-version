define([
  "dojo/_base/declare", "dojo/_base/lang", "dojo/dom", "dojo/_base/array", "dojo/query", "dojo/on",
  "dojo/dom-construct", "dojo/dom-class", "dojo/dom-style", "dojo/dnd/Moveable", "dijit/registry",
  "esri/request", "esri/map", "esri/dijit/BasemapGallery", "esri/dijit/BasemapLayer", "esri/dijit/Basemap", "esri/layers/ArcGISTiledMapServiceLayer",
  "esri/layers/ArcGISDynamicMapServiceLayer", "esri/layers/GraphicsLayer", "esri/geometry/Point", "esri/SpatialReference", "esri/geometry/Extent",
  "esri/dijit/Popup", "esri/dijit/PopupTemplate", "esri/symbols/SimpleFillSymbol", "esri/symbols/SimpleLineSymbol", "esri/symbols/SimpleMarkerSymbol", "esri/Color",
  "widgets/attributeTableWidget",
  "widgets/layerlistWidget"
], function(
  declare, lang, dom, array, query, on,
  domConstruct, domClass, domStyle, Moveable, registry,
  esriRequest, Map, BasemapGallery, BasemapLayer, Basemap, ArcGISTiledMapServiceLayer,
  ArcGISDynamicMapServiceLayer, GraphicsLayer, Point, SpatialReference, Extent,
  Popup, PopupTemplate, SimpleFillSymbol, SimpleLineSymbol, SimpleMarkerSymbol, Color,
  attributeTableWidget,
  layerlistWidget
) {
  return declare(null, {
    mapa: null,
    // Layer list object (required for Identify)
    layerListObj: null,
    metadataIdsUrl: null,
    // store clicked location for displaying popup
    clickPoint: null,
    // graphic layer for identified point features
    selectedGraphics: null,
    currentExtent: null,
    relatedAttributeTable: null,
    constructor: function(params) {
      this.metadataIdsUrl = params.metadataIdsUrl;
      // create popup
      var popup = new Popup({
        // fill symbol for polygon features
        fillSymbol: new SimpleFillSymbol(
                      SimpleFillSymbol.STYLE_SOLID,
                      new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255, 0, 0]), 2),
                      new Color([255, 255, 0, 0.25])
                    ),
        // line symbol for line features
        lineSymbol: new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255, 0, 0]), 2)
      }, domConstruct.create("div"));
      // custom class for popup
      domClass.add(popup.domNode, "popupStyle");
      // create map using json config
      var mapConfig = params.mapConfig;
      this.mapa = new Map(params.mapNode, {
        spatialReference: mapConfig.spatialReference,
        lods: mapConfig.lods,
        sliderPosition: "top-right",
        infoWindow: popup
      });

      // create basemaps gallery and basemap layers from config
      var basemapGallery = new BasemapGallery({
        showArcGISBasemaps: false,
        map: this.mapa
      }, "basemapGallery");

      array.forEach(mapConfig.basemaps, lang.hitch(this, function(configBasemap) {
        var bl = new BasemapLayer({
          //id: configBasemap.configId,
          url: configBasemap.url
        });
        var basemap = new Basemap({
          layers: [bl],
          thumbnailUrl: madsVersion + "/img/" + configBasemap.thumbnail
        });
        basemapGallery.add(basemap);
      }));
      basemapGallery.startup();
      var basemapLayer = new ArcGISTiledMapServiceLayer(mapConfig.basemaps[0].url, {
        "id": "Basemap"
      });
      this.mapa.addLayer(basemapLayer);

      // create selection layer
      this.selectedGraphics = new GraphicsLayer();
      this.mapa.addLayer(this.selectedGraphics);

      this.mapa.on("load", lang.hitch(this, function(e) {
        this.mapa.centerAndZoom(new Point(mapConfig.center.x, mapConfig.center.y, new SpatialReference({ wkid: 3035 })), mapConfig.zoom);
        this.currentExtent = this.mapa.extent;
        // draggable popup
        var handle = this.mapa.infoWindow.domNode.querySelector(".title");
        var dnd = new Moveable(this.mapa.infoWindow.domNode, {
            handle: handle
        });
        // hide pointer and outerpointer (used depending on where the pointer is shown)
        dnd.on('FirstMove', lang.hitch(this, function(e) {
          var arrowNode =  this.mapa.infoWindow.domNode.querySelector(".outerPointer");
          arrowNode.classList.add("hidden");
          arrowNode =  this.mapa.infoWindow.domNode.querySelector(".pointer");
          arrowNode.classList.add("hidden");
        }.bind(this)));

        // on map click
        on(this.mapa, "click", lang.hitch(this, function(evt) {
          domStyle.set(dojo.byId("loadingCover"), {"display": "block"});
          query('*').style('cursor', 'wait');
          // hide related table link before showing popup
          query(".relatedTablelink").forEach(dojo.destroy);

          // run identifies
          this.runIdentifies(evt);
        }));
      }));

      this.mapa.on("extent-change", lang.hitch(this, function (e) {
        if (((e.extent.xmax > 8200000) || (e.extent.xmin < 800000) || (e.extent.ymax > 7300000) || (e.extent.ymin < 1200000)) && (this.currentExtent)) {
          this.mapa.setExtent(this.currentExtent);
        }
        this.currentExtent = e.extent;
      }));

      /*this.mapa.infoWindow.on("hide", lang.hitch(this, function () {

      }));*/
    },

    addOperationalLayers: function(layers) {
      on(this.mapa, "layers-add-result", lang.hitch(this, function(e) {
        // create layer list
        setTimeout(lang.hitch(this, function() {
          var layerlistContainer = dom.byId("layerlistContainer");
          var llwidget = new layerlistWidget({map: this.mapa, metadataIdsUrl: this.metadataIdsUrl}).placeAt(layerlistContainer);
          // Store widget object to get Identify Tasks
          this.layerListObj = llwidget;
        }), 1000);


        //domStyle.set(dojo.byId("loadingContainer"), {"display": "none"});

        on(layerlistContainer, "click", lang.hitch(this, function(evt) {
          // hide layer top group menu
          query(".layerTopGroupMenu").forEach(function(node){
            domStyle.set(node, {"display": "none"});
          });
        }));
      }));

      var services = [];
      array.forEach(layers, function(layer) {
        var service = new ArcGISDynamicMapServiceLayer(layer.url, {
          "id": layer.label,
          "showAttribution": false
        });
        service.wms = layer.wms;
        service.setVisibleLayers([]);
        services.push(service);
      });
      this.mapa.addLayers(services);
    },

    // Setup and run Identify Tasks for each service
    runIdentifies: function(evt) {
      this.clickPoint = evt.mapPoint;
      // Identify Tasks and Parameters for each service
      var tasks = [], idParams = [];
      // Identify object from Layer List
      var identify = this.layerListObj.identify;
      // For each service
      for (var service in identify) {
        if (identify.hasOwnProperty(service)) {
          // Add Identify Task
          var task = identify[service].task;
          tasks.push(task);

          // Setup and add Identify Parameters
          var idp = identify[service].params;
          idp.width = this.mapa.width;
          idp.height = this.mapa.height;
          idp.geometry = evt.mapPoint;
          idp.mapExtent = this.mapa.extent;
          idParams.push(idp);
        }
      }

      // Identify tasks synchronization
      var defTasks = dojo.map(tasks, function (task) {
        return new dojo.Deferred();
      });
      var dlTasks = new dojo.DeferredList(defTasks);

      // Call a chain of methods for every Identify task
      dlTasks.then(this.showIdentifyResults);

      // Executing each service Identify Task
      for (i = 0; i < tasks.length; i++) {
        try {
          tasks[i].execute(idParams[i], defTasks[i].callback, defTasks[i].errback);
        } catch (e) {
          console.log("Error caught");
          console.log(e);
          defTasks[i].errback(e); //If you get an error for any task, execute the errback
        }
      }
    },

    showIdentifyResults: function(r) {
      var results = [];
      let identifyFailed = false;
      r = dojo.filter(r, function (result) {
        return r[0];
      }); //filter out any failed tasks
      //var result = r[r.length-1][1];
      for (i=0;i<r.length;i++) {
        if (!r[i][0]) {
          identifyFailed = true;
        }
        else {
          results = results.concat(r[i][1]);
        }
      }
      if (!identifyFailed) {
        // Identified object top most layer in top most service
        var result = results[results.length-1];
        // Identify object from Layer List
        var identify = this.mM.layerListObj.identify;

        if (result) {
          var mapLayers = this.mM.mapa.getLayersVisibleAtScale();
          array.some(mapLayers, lang.hitch(this, function(mapLayer) {
            if ((mapLayer.visibleLayers) && (!mapLayer.tileInfo)) {
              if (mapLayer.visibleLayers.includes(result.layerId)) {
                array.forEach(mapLayer.layerInfos, lang.hitch(this, function(info) {
                  if ((info.name == result.layerName) && (info.id == result.layerId)) {
                    var requestHandle = esriRequest({
                      url: mapLayer.url+"/"+result.layerId+"?f=json",
                      handleAs: "json"
                    });
              			requestHandle.then(lang.hitch(this, function (response) {
                        if (response.relationships.length > 0) {
                          array.forEach(response.relationships, lang.hitch(this, function(rel) {
                            // create related table link in popup
                            var link = domConstruct.create("a", {
                              "class": " action relatedTablelink",
                              "style": "display: block",
                              "innerHTML": rel.name,
                              "href": "javascript: void(0);"
                            }, query(".actionList", this.mM.mapa.infoWindow.domNode)[0]);

                            on(link, "click", lang.hitch(this, function () {
                              var rel_field_name = null;
                              var rel_field_alias = null;
                              var rel_field_type = null;
                              //var rel = response.relationships[0];
                              array.some(response.fields, lang.hitch(this, function(field) {
                                if (field.name == rel.keyField) {
                                  rel_field_name = field.name;
                                  rel_field_alias = field.alias;
                                  rel_field_type = field.type;
                                  return false;
                                }
                              }));
                              if (result.feature.attributes[rel_field_name]) {
                                this.mM.getRelatedRecords(mapLayer.url, rel.relatedTableId, rel.name, rel_field_name, rel_field_alias, rel_field_type, result.feature.attributes[rel_field_name]);
                              }
                              else if (result.feature.attributes[rel_field_alias]) {
                                this.mM.getRelatedRecords(mapLayer.url, rel.relatedTableId, rel.name, rel_field_name, rel_field_alias, rel_field_type, result.feature.attributes[rel_field_alias]);
                              }
                              else {
                                alert("Can't get related records.");
                              }
                    				}));
                          }));
                        }
                    	}),
                    	lang.hitch(this, function (error) {
              					console.log(error);
              				})
                    );
                  }
                }));
                return false;
              }
            }
          }));
          var res = dojo.map([result], function(result) {
            var feature = result.feature;
            var fieldInfos = [];

            // if identified layer is raster layer - display just Pixel Value in the popup
            if (result.geometryType == "esriGeometryPoint" && feature.attributes["Pixel Value"]) {
              var fieldInfo = {
                fieldName: "Pixel Value",
                visible: true,
                label: "Value:"
              };
              fieldInfos.push(fieldInfo);
            }
            // display attributtes in popup
            else {
              /*if (feature.attributes.hasOwnProperty("OBJECTID_12")) {
                objID = {
                  "name": "OBJECTID_12",
                  "value": feature.attributes["OBJECTID_12"]
                }
              }
              else if (feature.attributes.hasOwnProperty("OBJECTID_1")) {
                objID = {
                  "name": "OBJECTID_1",
                  "value": feature.attributes["OBJECTID_1"]
                }
              }
              else if (feature.attributes.hasOwnProperty("OBJECTID")) {
                objID = {
                  "name": "OBJECTID",
                  "value": feature.attributes["OBJECTID"]
                }
              }*/

              var excludeInPopup = ["OBJECTID", "OBJECTID_1", "OBJECTID_12","Shape", "SHAPE", "Shape_Length", "SHAPE_Length", "Shape_Area", "SHAPE_Area"];
              for (var attribute in feature.attributes) {
                if (feature.attributes.hasOwnProperty(attribute)) {
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
              // create symbol for marker objects
              if (result.geometryType == "esriGeometryPoint") {
                this.mM.selectedGraphics.clear();
                var symbol = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_SQUARE, 20,
                              new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
                              new Color([0,0,0,0.0]), 0),
                              new Color([0,0,0,0.0]));
                feature.symbol = symbol;
                this.mM.selectedGraphics.add(feature);
              }
            }
            var template = new PopupTemplate({
              title: result.layerName,
              fieldInfos: fieldInfos
            }); //Select template based on layer name

            feature.setInfoTemplate(template);
            return feature;
          });

          this.mM.mapa.infoWindow.setFeatures(res);
          /*var link = domConstruct.create("div",{
                  //"class": "action",
                  "id": "statsLink",
                  "innerHTML": "Link: http://localhost:8080/MADS/?datasetID=fbfb04b6-5cd0-4bad-8347-674a63e28855&features=ID:149370", //text that appears in the popup for the link
                  //"href": "javascript: void(0);"
                }, query(".mainSection", this.mM.mapa.infoWindow.domNode)[0]);*/
          this.mM.mapa.infoWindow.show(this.mM.clickPoint);
          domStyle.set(dojo.byId("loadingCover"), {"display": "none"});
          query('*').style('cursor', '');
        }
        else {
          domStyle.set(dojo.byId("loadingCover"), {"display": "none"});
          query('*').style('cursor', '');
        }
      }
      else {
        domStyle.set(dojo.byId("loadingCover"), {"display": "none"});
        query('*').style('cursor', '');
      }
    },

    getRelatedRecords: function(url, tableId, tableName, attrName, attrAlias, attrType, attrValue) {
      registry.byId("footer").domNode.style.display = "block";
      registry.byId("mainWindow").layout();

      var tableTitle = tableName + " (" + attrName + " = " + attrValue + ")";
      if (attrAlias) {
        tableTitle = tableName + " (" + attrAlias + " = " + attrValue + ")";
      }
      var where = null;
      if ((attrType == "esriFieldTypeInteger") || (attrType == "esriFieldTypeDouble")) {
        where = attrName + " = " + attrValue;
      }
      else if (attrType == "esriFieldTypeString") {
        where = attrName + " = '" + attrValue + "'";
      }

      if (where != null) {
        this.relatedAttributeTable = new attributeTableWidget({
          url: url+'/'+tableId,
          name: tableTitle,
          where: where,
          map: this.mapa
        });
      }
    }
  });
});
