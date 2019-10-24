define([
  "dojo/_base/declare",
  "dojo/_base/lang",
  "dojo/on",
  "dojo/dom-style",
  "dijit/_WidgetBase",
  "dijit/_TemplatedMixin",
  "dojo/text!./templates/clearSelectionWidget.html"
], function(declare, lang, on, domStyle,
  _WidgetBase, _TemplatedMixin, template) {
  return declare([_WidgetBase, _TemplatedMixin], {
    templateString: template,
    baseClass: "mapWidget",
    id: "clearSelectionWidgetId",
    style: "background-image: url('" + madsVersion + "/img/clearSelection30.png')",
    map: null,
    constructor: function(params) {
      this.map = params.map;
    },
    postCreate: function() {
      this.on("click", lang.hitch(this, function() {
        this.map.graphics.clear();
        this.map.infoWindow.hide();
      }));
    },
    setVisible: function(mode) {
      if (mode) {
        domStyle.set(this.domNode, {"display": "block"});
      }
      else {
        domStyle.set(this.domNode, {"display": "none"});
      }
    }
  });
});
