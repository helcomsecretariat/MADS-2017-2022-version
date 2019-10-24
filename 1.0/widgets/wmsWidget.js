define([
  "dojo/_base/declare",
  "dojo/on",
  "dojo/_base/lang",
  "dojo/dom-construct",
  "dojo/dom-style",
  "dojo/_base/array",
  "dojo/request",
  "dijit/form/CheckBox",
  "esri/request",
  "esri/layers/WMSLayer",
  "esri/dijit/util/busyIndicator",
  "mads/js/widgetIcon",
  "mads/js/wmsLayerlistManager",
  "dijit/_WidgetBase",
  "dijit/_TemplatedMixin",
  "dojo/text!./templates/wmsWidget.html"
], function(declare, on, lang, domConstruct, domStyle, array,
  dojoRequest, checkBox,
  esriRequest, WMSLayer, busyIndicator,
  widgetIcon, wmsLayerlistManager,
  _WidgetBase, _TemplatedMixin, template){
  return declare([_WidgetBase, _TemplatedMixin], {
    templateString: template,
    baseClass: "wmsWidget",
    widgetIcon: null,
    widgetPanel: null,
    map: null,
    bI: null,
    wmsList: null,
    wmsLayer: null,
    //wmsListStore: null,
    constructor: function(params) {
      this.widgetIcon = new widgetIcon({config: params.config, widgetPanel: params.widgetPanel, widget: this});
      this.widgetPanel = params.widgetPanel;
      this.map = params.map;
      // show busy circle when loading wms
      this.bI = busyIndicator.create({target: this.widgetPanel.id, imageUrl: madsVersion + "/img/loading.gif", backgroundOpacity: 0});


    },

    postCreate: function() {
      this.getWmsServicesList();
      this.wmsList = new wmsLayerlistManager({container: this.wmsLayerListSection, map: this.map});
    },

    getWmsServicesList: function() {
      var windowUrl = window.location.pathname;
      windowUrl = windowUrl.replace("index.html", "");
      var requestHandle = esriRequest({
        url: windowUrl + madsVersion + "/config/wms.json",
        handleAs: "json"
      });
      requestHandle.then(lang.hitch(this, function(response) {
        array.forEach(response.wmslist, lang.hitch(this, function(wmsGroup) {

          var optgroup = document.createElement('optgroup');
          optgroup.label = wmsGroup.label;
          array.forEach(wmsGroup.services, lang.hitch(this, function(service) {
            var opt = document.createElement('option');
            opt.value = service.url;
            opt.innerHTML = service.name;
            optgroup.appendChild(opt);
          }));
          this.wmsSelect.appendChild(optgroup);
        }));

        on(this.wmsSelect, "change", lang.hitch(this, function(e){
          this.wmsSearchInput.value = e.target.selectedOptions[0].value;
        }));
      }), lang.hitch(this, function(error) {
        console.log("Error. Can't get wms services list. Error message: ", error.message);
        //this.setupLayerListAndDisplayLayer();
      }));
    },

    checkWmsInput: function() {
      // check if there is form input value
  		if (this.wmsSearchInput.value.length > 0) {
  			this.connectToWmsService();
  		}
  		else {
  			this.wmsRequestMessage.innerHTML = "Input service URL.";
  		}
  	},

    clearWmsLayerList: function()
  	{
  		// hide list section and display search section
  	   this.wmsSearchInput.value = '';
       this.wmsList.destroyTree();

       //domConstruct.empty(this.wmsLayerListSection);
  	   this.wmsRequestMessage.innerHTML = '';
  		 domStyle.set(this.wmsInputSection, "display", "block");
  		 domStyle.set(this.wmsLayerListSection, "display", "none");
       domStyle.set(this.wmsClearLayerList, "display", "none");

       //delete this.wmsList;
       // remove layers from the map
       /*var layerIds = lang.clone(this.map.layerIds);
       array.forEach(layerIds, lang.hitch(this, function(layerId) {
         // look for layer ids that starts with
         if (layerId.startsWith("wmsLayer")) {
           var lyr = this.map.getLayer(layerId);
           this.map.removeLayer(lyr);
         }
       }));*/
  	},

    connectToWmsService: function() {
      var map = this.map;
      var bI = this.bI;
      var that = this;
      // show busy circle
      bI.show();
      var serviceUrl = this.wmsSearchInput.value;
      var wmsRequestMessage = this.wmsRequestMessage;
      var wmsInputSection = this.wmsInputSection;
      var wmsLayerListSection = this.wmsLayerListSection;
      // add get capabilities parameter to input url
      var serviceGetCapabilitiesUrl = serviceUrl+"?request=GetCapabilities&service=WMS&language=eng";
      // create a wms request
      var serviceRequest = esriRequest({
  		  url: serviceGetCapabilitiesUrl,
  		  handleAs: "xml"
  		});
  		serviceRequest.then(wmsRequestSucceeded, wmsRequestFailed);

      function wmsRequestSucceeded(xml) {

        //var wmsLayer = new WMSLayer(serviceUrl+"?language=eng");
        var wmsLayer = new WMSLayer(serviceUrl, {
          customParameters: {
            "language": "eng"
          },
          showAttribution: false
        });
        // when wms created - call BASEMAPS verify method
        wmsLayer.on("load", createWmsLayerList);
  			//wmsLayer.on("load", verifyWms);
        // hide search section and display list section
  			domStyle.set(wmsInputSection, "display", "none");
  			domStyle.set(wmsLayerListSection, "display", "block");
        domStyle.set(this.wmsClearLayerList, "display", "block");
  		}

      function wmsRequestFailed(error) {
  			console.log("wmsRequestFailed", error);
  			wmsRequestMessage.innerHTML = "Unable to load service. Server response status: " + error.status + ".";
        // hide busy circle
        bI.hide();
  		}

      function verifyWms(evt) {
        var layer = evt.layer;
        /*var verufyRequest = esriRequest({
          url: "http://localhost:8080/sc/wms/verify",
          content: {"url": layer.url},
          handleAs: "json"
        },
        {
          "useProxy": false,
          "usePost": true
        }).then(
          function(response) {
            console.log("Success: ", response);
          }, function(error) {
            console.log("Error: ", error);
          }
        );*/
        var data = {
					"url": layer.url
				};
        dojoRequest.post("1.0/proxy/proxy.ashx?http://localhost:8080/sc/wms/verify", createPostRequestParams(data)).then(
					lang.hitch(this, function(response){
						if (response.type == "error") {
							console.log("Success: ", response);
						}
						else if (response.type == "success") {
							console.log("Success: ", response);
						}
					}),
					lang.hitch(this, function(error){
						console.log("Error: ", error);
					})
				);
      }

      function createPostRequestParams(data) {
  			return {
  				data: JSON.stringify(data),
  				handleAs: "json",
  				headers: {
  					"Content-Type": 'application/json; charset=utf-8',
  					"Accept": "application/json"
  				}
  			}
  		}

      function createWmsLayerList(evt) {
        var lyr = evt.layer;
        /*console.log("wmsRequestsucceed", evt);
        console.log("copyright", evt.layer.copyright);
        console.log("max", evt.layer.maxScale);
        console.log("min", evt.layer.minScale);
        console.log("extent", evt.layer.extent);
        console.log("fullExtent", evt.layer.fullExtent);
        console.log("layerInfos", evt.layer.layerInfos);
        console.log("visibleLayers", evt.layer.visibleLayers);
        console.log("visibleAtMapScale", evt.layer.visibleAtMapScale);
        console.log("version", evt.layer.version);
        console.log("title", evt.layer.title);
        console.log("initialExtent", evt.layer.initialExtent);
        console.log("id", evt.layer.id);
        console.log("getFeatureInfoURL", evt.layer.getFeatureInfoURL);
        console.log("customParameters", evt.layer.customParameters);*/

        createInfoSection(lyr);
        createLayersSection(lyr);
        map.addLayer(lyr);
        // hide busy circle
        bI.hide();
      }

      function createInfoSection(layer) {
        // create url node
        if (layer.url) {
          createInfoNode("Url", layer.url);
  			}
        // create title node
  			if (layer.title) {
          createInfoNode("Title", layer.title);
  			}
        // create description node
  			if (layer.description) {
          createInfoNode("Description", layer.description);
  			}
        // create copyright node
  			if (layer.copyright) {
          createInfoNode("Copyright", layer.copyright);
  			}
      }

      function createInfoNode(label, value) {
        domConstruct.create('div', {
          "innerHTML": "<span style='font-weight: bold'>" + label + ": </span>" + value,
          "class": "wmsItem"
        }, wmsLayerListSection);
      }

      function createLayersSection(layer) {
        that.wmsList.createDataArray(layer);
        //that.wmsList = new layerlistTreeManager({service: layer, container: wmsLayerListSection, map: map});


        // create layer list nodes for each wms layer
  			/*if (layer.layerInfos.length > 0) {
  				domConstruct.create('div', {
  					"innerHTML": "<span style='font-weight: bold;'> WMS layers: </span>",
  					"class": "wmsItem"
  				}, wmsLayerListSection);
  				array.forEach(layer.layerInfos, function(layerInfo) {
  					addLayerNode(layer.title, layerInfo);
  				});
  			}*/
      }

      function addLayerNode(title, layerInfo) {
        // if layer is a leaf construct layer list nodes
        if (layerInfo.subLayers.length === 0) {
          var layerNode = domConstruct.create("div", {
  					"class": "wmsLayerContainer"
  				}, wmsLayerListSection);
          var layerTextNode = domConstruct.create("div", null, layerNode);
          var layerLegendNode = domConstruct.create("div", null, layerNode);
  				var layerTitleNode = domConstruct.create("div", {
  					"innerHTML": layerInfo.title,
  					"class": "wmsLayerTitle"
  				});
  				domConstruct.place(layerTitleNode, layerTextNode, "first");
          // check box to show/hide layer
          var cb = new dijit.form.CheckBox({
              "class": "wmsLayerCheckbox"
            }
          );
          cb.placeAt(layerTextNode, "last");

          // show/hide layer and show legend on check box state change
          on(cb, "change", function(checked){
            if (checked) {
              bI.show();
              addLayerToMap(layerInfo.name);
              if (layerInfo.legendURL) {
                var image = domConstruct.create('img', {
                  "src": layerInfo.legendURL
                }, layerLegendNode);
              }
            }
            else {
              var lyr = map.getLayer("wmsLayer_"+layerInfo.name);
              map.removeLayer(lyr);
              domConstruct.empty(layerLegendNode);
            }
          });
        }
        // if group layer - do not include in the list. Add node for each sublayer
        else {
          array.forEach(layerInfo.subLayers, function(layerInfo) {
  					addLayerNode(layerInfo.title, layerInfo);
  				});
        }

  		}

      // Create separate wms layer for each layer added to the map
      function addLayerToMap(layername) {
  			var wmsLayer0 = new WMSLayer(serviceUrl, {"id": "wmsLayer_"+layername});
  			wmsLayer0.on("load", function(evt) {
      		wmsLayer0.setVisibleLayers([layername]);
  				map.addLayer(wmsLayer0);
    		});
        wmsLayer0.on("update-end", function(e) {
    			bI.hide();
    		});
  		}
    }

  });
});
