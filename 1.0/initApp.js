define([
  "dojo/_base/declare",
  "dojo/dom",
  "dojo/on",
  "dojo/query",
  "dojo/_base/lang",
  "dojo/_base/array",
  "dijit/registry",
  "dijit/Tooltip",
  "esri/request",
  "esri/config",
  "mads/js/startupWindow",
  "mads/js/mapManager",
  "mads/js/widgetPanel",
  "mads/js/widgetIcon",
  "widgets/coordsWidget",
  "widgets/scaleWidget",
  "widgets/clearSelectionWidget",
  "require"
], function(
  declare, dom, on, query, lang, array, registry, Tooltip,
  esriRequest, esriConfig,
  startupWindow, mapManager, widgetPanel, widgetIcon,
  coordsWidget, scaleWidget, clearSelectionWidget,
  require
) {
  return declare(null, {
    mM: null,
    widgetPanel: null,
    constructor: function(){
      var cookies = document.cookie;
      console.log("cookies", cookies);
      //document.cookie = "name=value";
      if (document.cookie.indexOf("_agreedMADSterms_") === -1) {
        var startupBoxDiv = dom.byId("startupBox");
        document.getElementById("startupBox").style.display = "block";
        var startBox = new startupWindow().placeAt(startupBoxDiv);
      }
      else {
        document.getElementById("startupBox").style.display = "none";
        document.getElementById("screenCover").style.display = "none";
        query('*').style('cursor', 'wait');
      }

      // read mads config file
      var windowUrl = window.location.pathname;
      windowUrl = windowUrl.replace("index.html", "");
      var requestHandle = esriRequest({
        url: windowUrl + madsVersion + "/config/config.json",
        handleAs: "json"
      });
      requestHandle.then(this.requestSucceeded, this.requestFailed);
    },

    requestSucceeded: function(response, io) {
      console.log(response);
      // set up proxy page
      esriConfig.defaults.io.proxyUrl = madsVersion + "/" + response.proxyUrl;
      // create map manager
      this.mM = new mapManager({mapNode: "map", mapConfig: response.map});
      this.mM.mapa.on("load", lang.hitch(this, function(e) {
        // add layers to the map (read from config)
        this.mM.addOperationalLayers(response.map.layers);
      }));
      //on(this.mM.mapa, "layers-add-result", lang.hitch(this, function(e) {
      this.mM.mapa.on("layers-add-result", lang.hitch(this, function(e) {

        // create map widgets
        var centerContainer = dom.byId("centerContainer");
        var mapWidgetsContainer = dom.byId("mapWidgetsContainer");
        new coordsWidget({map: this.mM.mapa}).placeAt(centerContainer);
        new scaleWidget({map: this.mM.mapa}).placeAt(centerContainer);
        var clearSelectionButton = new clearSelectionWidget({map: this.mM.mapa}).placeAt(mapWidgetsContainer);
        new Tooltip({
          //class: "tooltipPopup",
          connectId: [clearSelectionButton.domNode],
          showDelay: 10,
          label: "Clear map selections"
        });

        // create widget panel
        var widgetPanelNode = dojo.byId("widgetPanel");
        this.widgetPanel = new widgetPanel({
            title: "Widget",
            resizable: true,
            dockable: false,
            style: "position:absolute;top:20px;right:270px;width:304px;height:60%;"
        }, widgetPanelNode);
        this.widgetPanel.startup();
        // hide widget panel on
        this.widgetPanel.domNode.style.display = "none";
        this.widgetPanel.domNode.style.visibility = "hidden";

        // init widgets from config file
        initWidgets(response.widgets);

        function initWidgets(widgets) {
          var widgetModules = [],
              widgetConfigs = [];
          // each widget has js module. Module urls are store in the main config
          array.forEach(widgets, function(widget) {
            widgetModules.push(widget.url);
            widgetConfigs.push(widget);
          });
          // include widgets modules
          require(widgetModules, function() {
            array.forEach(arguments, function(argument, i) {
              // create widget using it's module (for attribute table widget, create just an icon)
              if (widgetConfigs[i].id === "attrtable") {
                var icon = new widgetIcon({config: widgetConfigs[i], widgetPanel: null, widget: null});
              }
              else {
                var widget = new argument({map: this.mM.mapa, widgetPanel: this.widgetPanel, config: widgetConfigs[i]});
              }
            });
            var footerClose = dom.byId("footerCloseIcon");
            on(footerClose, "click", lang.hitch(this, function() {
              registry.byId("footer").domNode.style.display = "none";
              registry.byId("mainWindow").layout();
            }));
          });
        }
      }));


    },
    requestFailed: function(error, io) {
      console.log("Error. Unable to read application configuration file. Error message: ", error.message);
    }
  });
});
