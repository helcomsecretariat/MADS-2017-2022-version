define([
  "dojo/_base/declare",
  "dijit/registry",
  "dojo/query",
  "dojo",
  "dojo/on",
  "dojo/_base/lang",
  "dojo/_base/array",
  "dojo/dom-style",
  "esri/tasks/query", "esri/tasks/QueryTask",
  "dijit/_WidgetBase",
  "dijit/_TemplatedMixin",
  "dojo/text!./templates/attributeQueryWidget.html"
], function(declare, registry, query, dojo, on, lang, array, domStyle,
  Query, QueryTask,
  _WidgetBase, _TemplatedMixin, template) {
  return declare([_WidgetBase, _TemplatedMixin], {
    templateString: template,
    baseClass: "attributeQueryWidget",
    table: null,
    query: new Query(),
    queryTask: null,
    constructor: function(params) {
      this.table = params.table;
    },
    postCreate: function() {
      array.forEach(this.table.columns, lang.hitch(this, function(c) {
        var opt = document.createElement('option');
        opt.value = c.field;
        opt.innerHTML = c.field;
        opt.attrType = c.type;
        this.attributeSelect.appendChild(opt);
      }));

      this.queryTask = new QueryTask(this.table.featureLayer.url);
      this.query.where = "1=1";
      this.query.returnDistinctValues = true;

      on(this.attributeSelect, "change", lang.hitch(this, function(value) {
        //console.log(this.attributeSelect.options[this.attributeSelect.selectedIndex].attrType);
        this.attributeQueryTextArea.value = this.attributeQueryTextArea.value + this.attributeSelect.value + " ";
        this.getUniqueValues(this.attributeSelect.value);
      }));
      on(this.operator, "change", lang.hitch(this, function(value) {
        this.attributeQueryTextArea.value = this.attributeQueryTextArea.value + this.operator.value + " " ;
        this.operator.selectedIndex = 0;
      }));
      on(this.uniqueValues, "change", lang.hitch(this, function(value) {
        this.attributeQueryTextArea.value = this.attributeQueryTextArea.value + this.uniqueValues.value + " " ;
        //this.operator.selectedIndex = 0;
      }));
      on(this.filterPanelClose, "click", lang.hitch(this, function() {
        this.setVisible(false);
      }));
    },
    setVisible: function(mode) {
      if (mode) {
        domStyle.set(this.domNode, {"display": "block"});
      }
      else {
        domStyle.set(this.domNode, {"display": "none"});
      }
    },
    reset: function() {
      this.attributeQueryTextArea.value = "";
      this.attributeSelect.selectedIndex = 0;
      this.operator.selectedIndex = 0;
      this.removeSelectOptions(this.uniqueValues);
    },
    getUniqueValues: function(attribute) {
      var that = this;
      var type = that.attributeSelect.options[that.attributeSelect.selectedIndex].attrType;
      this.removeSelectOptions(this.uniqueValues);
      var opt = document.createElement('option');
      opt.value = "";
      opt.innerHTML = "";
      that.uniqueValues.appendChild(opt);

      if (that.attributeSelect.value !== "") {
        this.query.outFields = [attribute];
        this.query.orderByFields = [attribute];

        this.queryTask.execute(this.query, function(set) {
          array.forEach(set.features, function(f) {
            var opt = document.createElement('option');
            if (type === "esriFieldTypeString") {
              opt.value = "'" + f.attributes[attribute] + "'";
              opt.innerHTML = "'" + f.attributes[attribute] + "'";
            }
            else {
              opt.value = f.attributes[attribute];
              opt.innerHTML = f.attributes[attribute];
            }
            that.uniqueValues.appendChild(opt);
          });
        }, function(error){
          console.log(error);
        });
      }
    },
    removeSelectOptions: function(selectbox) {
      var i;
      for(i = selectbox.options.length - 1 ; i >= 0 ; i--) {
        selectbox.remove(i);
      }
    }
  });
});
