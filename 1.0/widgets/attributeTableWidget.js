define([
  "dojo/_base/declare",
  "dijit/registry",
  "dojo/query",
  "dojo",
  "dojo/on",
  "dojo/_base/lang",
  "dojo/_base/array",
  "dojo/dom-style",
  "dojo/dom-construct",
  "dijit/layout/ContentPane",
  "esri/layers/FeatureLayer",
  "esri/dijit/FeatureTable",
  "mads/js/widgetIcon",
  "mads/js/queryFeaturesManager",
  "widgets/attributeQueryWidget",
  "dijit/_WidgetBase",
  "dijit/_TemplatedMixin",
  "dojo/text!./templates/attributeTableWidget.html"
], function(declare, registry, query, dojo, on, lang, array, domStyle, domConstruct,
  ContentPane, FeatureLayer, FeatureTable,
  widgetIcon, queryFeaturesManager, attributeQueryWidget,
  _WidgetBase, _TemplatedMixin, template) {
  return declare([_WidgetBase, _TemplatedMixin], {
    templateString: template,
    baseClass: "attributeTableWidget",
    map: null,
    tabContainer: null,
    tabPane: null,
    queryPanel: null,
    featureTable: null,
    layerUrl: null,
    layerName: null,
    layerDefinition: null,
    featureIds: [],
    tableDestroyed: false,
    constructor: function(params) {
      this.layerUrl = params.url;
      this.layerName = params.name;
      if (params.where) {
        this.layerDefinition = params.where;
      }
      this.tabContainer = registry.byId("attrTableTabs");
      this.map = params.map;
    },
    postCreate: function() {
      // create feature layer for attribute table
      var fl = new FeatureLayer(this.layerUrl, {
        mode: FeatureLayer.MODE_ONDEMAND,
        supportsAdvancedQueries: true,
        outFields: ["*"]
      });
      fl.setDefinitionExpression(this.layerDefinition);

      fl.on("load", lang.hitch(this, function(e) {
        if ((e.layer.type === "Feature Layer") || (e.layer.type === "Table")) {

          var functions = [];
          if (e.layer.type === "Feature Layer") {
            functions = [
              {
                label: "Filter",
                callback: lang.hitch(this, function(evt) {
                  this.queryPanel.setVisible(true);
                })
              },{
                label: "Show All",
                callback: lang.hitch(this, function(evt) {
                  e.layer.setDefinitionExpression("1=1");
                  this.featureTable.refresh();
                  this.queryPanel.reset();
                })
              }
            ];
          }

          // remove thousand separators from number fields
          var fieldInfos = [];
          array.forEach(fl.fields, lang.hitch(this, function(field) {
            if ((field.type == "esriFieldTypeDouble") || (field.type == "esriFieldTypeInteger")) {
              var fieldInfo = {
                name: field.name,
                alias: field.alias,
                format: {
                  digitSeparator: false
                }
              };
              fieldInfos.push(fieldInfo);
            }
          }));

          // create feature table
          this.featureTable = new FeatureTable({
            featureLayer : e.layer,
            showRelatedRecords: true,
            outFields: ["*"],
            fieldInfos: fieldInfos,
            menuFunctions: functions,
            map: this.map
          });
          this.featureTable.startup();

          if (e.layer.type === "Feature Layer") {
            // on select row
            this.featureTable.on("row-select", lang.hitch(this, function(evt) {
              var rowData = evt.rows[0].data;
              this.featureIds.push(rowData[this.featureTable.idProperty]);
              this.map.infoWindow.hide();
              // hide related table link before showing popup
              query(".relatedTablelink").forEach(dojo.destroy);
              //registry.byId("clearSelectionWidgetId").setVisible(true);

              var qFM = new queryFeaturesManager({
                map: this.map,
                queryFeatures: this.featureTable.idProperty + ":" + this.featureIds.join(),
                queryUrl: this.layerUrl,
                layerName: this.layerName
              });
            }));

            // on deselect row
            this.featureTable.on("row-deselect", lang.hitch(this, function(evt) {
              this.featureIds = [];
              this.map.graphics.clear();
              this.map.infoWindow.hide();
            }));
          }

          // create pane for attribute table in tab container
          this.tabPane = new ContentPane({
            title: this.layerName,
            closable: true
          });
          this.tabContainer.addChild(this.tabPane);
          this.tabContainer.selectChild(this.tabPane);
          this.tabPane.addChild(this.featureTable);

          on(this.tabPane, "close", lang.hitch(this, function() {
            this.tableDestroyed = true;
            this.featureTable.destroy();
          }));

          // remove dijitContentPane class from attribute table. (Mouse interacting with table issue).
          var arr = query(".dijitContentPane", this.featureTable.domNode);
          array.forEach(arr, lang.hitch(this, function(object, i){
            dojo.removeClass(object, "dijitContentPane");
          }));

          //var queryPanel = domConstruct.create("div", { "style": "background-color: red; po", innerHTML: "Query" }, this.tabPane.domNode, "last");
          this.queryPanel = new attributeQueryWidget({table: this.featureTable}).placeAt(this.tabPane.domNode);

          on(this.queryPanel.filterButton, "click", lang.hitch(this, function() {
            e.layer.setDefinitionExpression(this.queryPanel.attributeQueryTextArea.value);
            this.featureTable.refresh();
          }));

          on(this.queryPanel.resetButton, "click", lang.hitch(this, function() {
            e.layer.setDefinitionExpression("1=1");
            this.featureTable.refresh();
            this.queryPanel.reset();
          }));
        }
      }));
    }
  });
});
