define([
  "dojo/_base/declare", "dojo/_base/fx", "dojo/_base/lang", "dojo/dom-style", "dojo/mouse", "dojo/dom-class", "dojo/_base/window",
  "dojo/on", "dojo/dom", "dojo/dom-construct", "dojo/_base/array", "dojo/query!css3", "dijit/registry",
  "dojo/store/Memory","dijit/tree/ObjectStoreModel", "dijit/Tree", "dijit/form/FilteringSelect",
  "dijit/form/HorizontalSlider", "dijit/form/HorizontalRule", "dijit/form/HorizontalRuleLabels", "dijit/form/CheckBox", "dijit/Tooltip"
], function(declare, baseFx, lang, domStyle, mouse, domClass, win,
  on, dom, domConstruct, array, query, registry,
  Memory, ObjectStoreModel, Tree, FilteringSelect,
  HorizontalSlider, HorizontalRule, HorizontalRuleLabels, checkBox, Tooltip){
  return declare(null, {
    map: null,
    service: null,
    layerlistContainer: null,
    data: null,
    store: null,
    treeModel: null,
    tree: null,
    visibleLayers: [],
    addingLayer: false,
    constructor: function(params) {

      this.layerlistContainer = params.container;
      this.map = params.map;




      // remove cover after layer added to the map
      this.map.on("update-end", lang.hitch(this, function() {
        if (this.addingLayer) {
          domStyle.set(dojo.byId("loadingCover"), {"display": "none"});
          this.addingLayer = false;
        }
      }));
    },

    createDataArray: function(service) {
      this.service = service;
      this.data = [{ id: "layerlist", leaf: false}];
      array.forEach(this.service.layerInfos, lang.hitch(this, function(layerInfo) {
        this.createDataRecord(layerInfo, "layerlist");
      }));

      this.createTree();

    },

    destroyTree: function() {
      this.visibleLayers = [];
      this.service.setVisibleLayers(this.visibleLayers);
      delete this.store;
			this.treeModel.destroy();
			this.tree.destroy();
			domConstruct.empty(this.layerlistContainer);
    },

    createDataRecord: function(layerInfo, parent) {
      var id = null;
      if (layerInfo.name != "") {
        id = layerInfo.name;
      }
      else if (layerInfo.title != "") {
        id = layerInfo.title;
      }

      var leaf = false;
      if (layerInfo.subLayers.length == 0) {
					leaf = true;
			}

      if (id != null) {
        this.data.push({id: id, parent: parent, name: layerInfo.title, wmsName: layerInfo.name, legend: layerInfo.legendURL, leaf: leaf});
      }

      if (layerInfo.subLayers.length > 0) {
        if (id == null) {
          id = parent;
        }
        array.forEach(layerInfo.subLayers, lang.hitch(this, function(layerInfo) {
          this.createDataRecord(layerInfo, id);
        }));
      }
    },

    createTree: function() {
      var that = this;

      this.store = new Memory({
        data: this.data,
        getChildren: function(object){
            return this.query({parent: object.id});
        }
      });

      this.treeModel = new ObjectStoreModel({
        store: this.store,
        query: {id: 'layerlist'}
      });

      /*var filteringSelect = new FilteringSelect({
        id: "layerSearchInput",
        name: "layerSearch",
        class: "layerSearchInput",
        queryExpr: "*${0}*",
        autoComplete: false,
        required: false,
        forceWidth: true,
        hasDownArrow: false,
        placeHolder: "Search...",
        store: myStore,
        searchAttr: "name",
        onChange: lang.hitch(this, function(state){
          var id = dijit.byId("layerSearchInput").get('value');
          //console.log(id);
          this.showLayer([id]);
          // clear search field
          dijit.byId("layerSearchInput").set("value", "");
        })
      }, this.layerSearchInput).startup();*/

      this.tree = new Tree({
        model: this.treeModel,
        showRoot: false,
        getIconClass:function(item, opened){

        },
        getNodeFromItem: function (id) {
          //return this._itemNodesMap[item.name[0]];
          return this._itemNodesMap[ id ][0];
        },

        _createTreeNode: function(args) {
          var tnode = new dijit._TreeNode(args);
          tnode.labelNode.innerHTML = args.label;

          var layerInfoButton = domConstruct.create("div", { "class": "metadataButton" }, tnode.contentNode, "first");
          new Tooltip({
            //class: "tooltipPopup",
            connectId: [layerInfoButton],
            showDelay: 10,
            label: "Layer info"
          });

          // if tree node is a data layer
          if (tnode.item.leaf) {
            dojo.destroy(tnode.expandoNode);
            var cb = new dijit.form.CheckBox();
            cb.placeAt(tnode.contentNode, "first");



            // set sublayers label width depending on sublayer level in the tree
            /*var rowNodeWidth = domStyle.get(tnode.rowNode, "width");
            var rowNodePadding = domStyle.get(tnode.rowNode, "padding-left");
            var labelNodeWidth = rowNodeWidth - rowNodePadding - 50;
            //domStyle.set(tnode.contentNode, {"width": labelNodeWidth+"px"});
            domStyle.set(tnode.labelNode, {"width": labelNodeWidth+"px"});*/
            //domStyle.set(tnode.labelNode, {"width": "100%"});

            // create legend node
            var legendContainerDiv = domConstruct.create("div", { "class": "legendContainerDiv" }, tnode.rowNode, "last");
            domConstruct.create('img', {
              "src": tnode.item.legend
            }, legendContainerDiv);

            // on sublayer check box click
            on(cb, "change", function(checked) {
              if (checked) {
                that.addingLayer = true;
                domStyle.set(dojo.byId("loadingCover"), {"display": "block"});
                that.visibleLayers.push(tnode.item.wmsName);
                that.service.setVisibleLayers(that.visibleLayers);

                domStyle.set(legendContainerDiv, "display", "block");

                /*that.addingLayer = true;
                domStyle.set(dojo.byId("loadingCover"), {"display": "block"});
                // make sublayer visible
                visible.push(tnode.item.visibilityId);
                serviceLayer.setVisibleLayers(visible);

                // show legend


                // add sublayer for identify task
                identify[tnode.item.layer].params.layerIds.push(tnode.item.visibilityId);

                // set tree path nodes style on select
                array.forEach(tnode.tree.paths, lang.hitch(this, function(path){
                  array.forEach(path, lang.hitch(this, function(object, i){
                    //console.log(tnode.tree.path, object);
                    if (i>0) {
                      var n = tnode.tree.getNodeFromItem(object.id);
                      domStyle.set(n.rowNode, {
                        "background-color": "#A5C0DE"
                      });
                      if (visitedNodesIds.hasOwnProperty(object.id)) {
                        visitedNodesIds[object.id] = visitedNodesIds[object.id] + 1;
                      }
                      else {
                        visitedNodesIds[object.id] = 1;
                      }
                    }
                  }));
                }));
                // create attribute table for this layer
                attributeTable = new attributeTableWidget({
                  url: serviceLayer.url+'/'+tnode.item.visibilityId,
                  name: tnode.item.name,
                  map: mapa
                });*/
              }
              else {
                var index = that.visibleLayers.indexOf(tnode.item.wmsName);
                if (index > -1) {
                  that.visibleLayers.splice(index, 1);
                  that.service.setVisibleLayers(that.visibleLayers);
                }
                // hide legend
                domStyle.set(legendContainerDiv, "display", "none");
              }
            });
            tnode.checkBox = cb;


          }
          return tnode;
        }
      });
      this.tree.placeAt(this.layerlistContainer);
      this.tree.startup();
    }
  });
});
