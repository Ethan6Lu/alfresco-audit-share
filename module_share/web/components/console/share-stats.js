/**
 * Copyright (C) 2005-2010 Alfresco Software Limited.
 *
 * This file is part of Alfresco
 *
 * Alfresco is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Alfresco is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Alfresco. If not, see <http://www.gnu.org/licenses/>.
 */
/**
 * ConsoleAudit tool component.
 *
 * @namespace Alfresco
 * @class Alfresco.ConsoleAudit
 */
(function () {
  /**
   * YUI Library aliases
   */
  var Dom = YAHOO.util.Dom,
    Event = YAHOO.util.Event,
    Element = YAHOO.util.Element;

  /**
   * Alfresco Slingshot aliases
   */
  var $html = Alfresco.util.encodeHTML;

  /**
   * ConsoleAudit constructor.
   *
   * @param {String} htmlId The HTML id �of the parent element
   * @return {Alfresco.ConsoleAudit} The new ConsoleAudit instance
   * @constructor
   */
  Alfresco.ConsoleAudit = function (htmlId) {
    this.name = "Alfresco.ConsoleAudit";
    Alfresco.ConsoleAudit.superclass.constructor.call(this, htmlId);

    /* Register this component */
    Alfresco.util.ComponentManager.register(this);

    /* Load YUI Components */
    Alfresco.util.YUILoaderHelper.require(["button", "container", "datasource", "paginator", "json", "history"], this.onComponentsLoaded, this);

    /* Define panel handlers */
    var parent = this;

    // NOTE: the panel registered first is considered the "default" view and is displayed first
    /* Audit Panel Handler */
    AuditPanelHandler = function AuditPanelHandler_constructor() {
      AuditPanelHandler.superclass.constructor.call(this, "audit");
    };

    // Surcharge de la classe Date. R�cup�re la semaine courante
    Date.prototype.getWeek = function() {
     var onejan = new Date(this.getFullYear(),0,1);
     return Math.ceil((((this - onejan) / 86400000) + onejan.getDay()+1)/7);
    };

    YAHOO.extend(AuditPanelHandler, Alfresco.ConsolePanelHandler, {
      /**
       * Called by the ConsolePanelHandler when this panel shall be loaded
       *
       * @method onLoad
       */
      onLoad: function onLoad() {
        // Buttons - Check ?
        // parent.widgets.searchButton = Alfresco.util.createYUIButton(parent, "search-button", parent.onSearch);
        parent.widgets.exportButton = Alfresco.util.createYUIButton(parent, "export-button", parent.onExport);

        parent.widgets.exportButton.set("disabled", true);

        parent.widgets.moduleCriteriaButton = new YAHOO.widget.Button("module-criteria", {
          type: "split",
          menu: "module-criteria-select",
          lazyloadmenu: false
        });
        parent.widgets.moduleCriteriaButton.value = "document";

        parent.widgets.actionCriteriaButton = new YAHOO.widget.Button("action-criteria", {
          type: "split",
          menu: "action-criteria-select",
          lazyloadmenu: false
        });
        parent.widgets.actionCriteriaButton.value = "read";


        //el, sType, fn, obj, overrideContext
        Event.addListener("by-days", "click", parent.onChangeDateFilter, {
          filter: "days"
        }, parent);
        Event.addListener("by-weeks", "click", parent.onChangeDateFilter, {
          filter: "weeks"
        }, parent);
        Event.addListener("by-months", "click", parent.onChangeDateFilter, {
          filter: "months"
        }, parent);
        Event.addListener("by-years", "click", parent.onChangeDateFilter, {
          filter: "years"
        }, parent);

        Event.addListener("chart-prev", "click", parent.onChangeDateInterval, {
          coef: -1
        }, parent);
        Event.addListener("chart-next", "click", parent.onChangeDateInterval, {
          coef: 1
        }, parent);
        this.loadSites();
      },

      /**
       * Cr�ation de la bo�te de dialogue de s�lection des sites
       * � partir du r�sultat du WebScript.
       * @method createSiteDialog
       *
       */
      loadSites: function loadSites() {
        //Changement de style pour l'ic�ne de chargement
        // parent.widgets.siteButton.set("label", parent._msg("label.loading") + ' <span class="loading"></span>');

        Alfresco.util.Ajax.jsonGet({
          url: Alfresco.constants.PROXY_URI + "share-stats/site/list-sites",
          successCallback: {
            fn: function (res) {
              this.createSiteMenu(res);
            },
            scope: parent
          },
          failureMessage: parent._msg("label.popup.error.list-site"),
          execScripts: true
        });
      }
    });

    new AuditPanelHandler();

    return this;
  };

  YAHOO.extend(Alfresco.ConsoleAudit, Alfresco.ConsoleTool, {

    /**
     * Cache-R�sultat de la derni�re requ�te ex�cut�e
     * Utilis� pour l'export CSV
     */
    lastRequest: {
      params: null,
      data: null,
      from: null,
      to: null
    },

    /**
     * @attribute selectedSites
     * Tableau contenant tous les sites selectionn�s dans la bo�te de dialogue
     *
     */
    selectedSites: [],

    /**
     * @attribute siteDialog
     * Yahoo Simple Dialog - Bo�te de dialogue permettant de
     * s�lectionner un ou plusieurs sites
     *
     */
    siteDialog: null,

    /**
     * @attribute pathToSwf
     * Chemin vers le fichier swf d'Open Flash Chart
     *
     */
    pathToSwf: "/share/components/console/open_flash_chart/open-flash-chart.swf",

    /**
     * @attribute endDatesArray
     * Dates de r�f�rence utilis�e pour les graphiques
     * Date pr�sente par d�faut
     */
    endDatesArray: [],
    /**
     * @attribute currentDateFilter
     * Filtre de date : days,weeks,months,years
     * "days" par d�faut
     */
    currentDateFilter: "weeks",

    /**
     * @attribute sites
     * Informations sur les sites (id/titre).
     */
    sites: [],

    /**
     * @attribute limit
     * Limite de documents remont�s par requ�te de popularit�
     */
    limit: 5,

    /**
     * Fired by YUILoaderHelper when required component script files have
     * been loaded into the browser.
     *
     * @method onComponentsLoaded
     */
    onComponentsLoaded: function ConsoleAudit_onComponentsLoaded() {
      Event.onContentReady(this.id, this.onReady, this, true);
    },

    /**
     * Fired by YUI when parent element is available for scripting.
     * Component initialisation, including instantiation of YUI widgets and event listener binding.
     *
     * @method onReady
     */
    onReady: function ConsoleAudit_onReady() {
      // Call super-class onReady() method
      Alfresco.ConsoleAudit.superclass.onReady.call(this);

      //Composants cr��, on ajoute des listeners sur les menus.
      var me = this;
      // Comportement du menu de filtre par Modules
      var onModulesMenuItemClick = function (p_sType, p_aArgs, p_oItem) {
          var sText = p_aArgs[1].cfg.getProperty("text"),
            value = p_aArgs[1].value;

          me.widgets.moduleCriteriaButton.value = value;
          me.widgets.moduleCriteriaButton.set("label", sText);
          me.onSearch();
        };
      this.widgets.moduleCriteriaButton.getMenu().subscribe("click", onModulesMenuItemClick);

      // Comportement du menu de filtre par Actions
      var onActionsMenuItemClick = function (p_sType, p_aArgs, p_oItem) {
          var sText = p_aArgs[1].cfg.getProperty("text"),
            value = p_aArgs[1].value;

          me.widgets.actionCriteriaButton.value = value;
          me.widgets.actionCriteriaButton.set("label", sText);
          me.onSearch();
        };
      this.widgets.actionCriteriaButton.getMenu().subscribe("click", onActionsMenuItemClick);

      var currentDate = new Date();
      currentDate.setMinutes(0);
      currentDate.setHours(0);
      currentDate.setMinutes(0);
      currentDate.setSeconds(0);

      this.endDatesArray["days"] = currentDate;
      this.endDatesArray["weeks"] = currentDate;
      this.endDatesArray["months"] = currentDate;
      this.endDatesArray["years"] = currentDate;
    },

    /**
     * @method createSiteDialog
     * @param res
     *
     */
    createSiteMenu: function ConsoleAudit_createSiteDialog(res) {
      var menuButtons = [],
        current_site = null,
        sites = res.json,
        i = 0,
        ii = sites.length,
        me = this;

      var onSiteMenuClick = function (p_sType, p_aArgs, p_oItem) {
          var sText = p_oItem.cfg.getProperty("text"),
            value = p_oItem.value;

          me.widgets.siteButton.value = value;
          me.widgets.siteButton.set("label", sText);
          me.execute();
        };

      menuButtons.push({
        text: this._msg("label.menu.site.all"),
        value: "",
        onclick: {
          fn: onSiteMenuClick
        }
      });

      for (; i < ii; i++) {
        current_site = sites[i];
        menuButtons.push({
          text: current_site.title,
          value: current_site.name,
          onclick: {
            fn: onSiteMenuClick
          }
        });

        //Stockage des sites
        me.sites.push({
          name: current_site.name,
          title: current_site.title
        });
      }
      this.widgets.siteButton = new YAHOO.widget.Button({
        type: "split",
        name: "site-criteria",
        id: "site-criteria",
        menu: menuButtons,
        container: "criterias"
      });

      //Maj des infos du bouttons
      this.widgets.siteButton.set("label", this._msg("label.menu.site.all"));
      this.widgets.siteButton.value = "";

      this.execute();
    },

    onExport: function ConsoleAudit_onExport() {
      if (this.lastRequest.params) {
        var url = Alfresco.constants.PROXY_URI + "share-stats/export-audits" + this.lastRequest.params; //?json=" + escape(YAHOO.lang.JSON.stringify(this.lastRequest.data));//JSON.stringify
        window.open(url);
      }
    },

    /**
     * @method
     * @param
     * @return
     */
    onSearch: function ConsoleAudit_onSearch() {
      //R�cup�ration des variables de l'UI
      var action = this.convertMenuValue(this.widgets.actionCriteriaButton.value),
        module = this.convertMenuValue(this.widgets.moduleCriteriaButton.value),
        dateFilter = this.currentDateFilter,
        site = this.convertMenuValue(this.widgets.siteButton.value),
        type = action,
        tsString = "";

      // Cr�tion du tableau d'intervalle de dates
      if (dateFilter) {
        tsString = this.buildTimeStampArray().toString();
      }

      // Cr�ation des param�tres et ex�cution de la requ�te
      this.lastRequest.params = this.buildParams(module, site, tsString, type);

      var url = Alfresco.constants.PROXY_URI + "share-stats/select-audits" + this.lastRequest.params;
      Alfresco.util.Ajax.jsonGet({
        url: url,
        successCallback: {
          fn: this.displayGraph,
          scope: this
        },
        failureMessage: this._msg("label.popup.query.error"),
        execScripts: true,
        additionalsParams: {
          chartType: "vbar",
          type: type,
          tsString: tsString,
          target: "chart",
          height: "450",
          width: "90%"
        }
      });

      // Probl�me de focus avec le bouton et flash
      // this.widgets.searchButton.blur();
    },

    getByPopularity: function ConsoleAudit_getByPopularity(type) {
      var site = this.convertMenuValue(this.widgets.siteButton.value),
        dateFilter = this.currentDateFilter,
        tsArray = this.buildTimeStampArray(),
        from = tsArray[0],
        to = tsArray[tsArray.length - 1],
        params = null;

      // Cr�ation des param�tres et ex�cution de la requ�te
      params = this.buildParams(null, site, null, type, from, to, this.limit);

      var url = Alfresco.constants.PROXY_URI + "share-stats/select-audits" + params;
      Alfresco.util.Ajax.jsonGet({
        url: url,
        successCallback: {
          fn: this.displayGraph,
          scope: this
        },
        failureMessage: this._msg("label.popup.query.error"),
        execScripts: true,
        additionalsParams: {
          chartType: "hbar",
          type: type,
          target: type,
          height: "200",
          width: "100%",
          from: from,
          to: to
        }
      });

    },
    /**
     * @method displayGraph Affiche le requ�te suite � une requ�te Ajax
     * @param response R�ponse de la requ�te
     */
    displayGraph: function ConsoleAudit_displayGraph(response) {
      var additionalsParams, id, swf, chartTag;

      additionalsParams = response.config.additionalsParams;
      id = this.id + "-" + additionalsParams.target;
      swf = Dom.get(id);
      chartTag = swf.tagName.toLowerCase();

      if (response.json) {
        this.widgets.exportButton.set("disabled", false);
        response.json.currentFilter = this.currentDateFilter;
        response.json.additionalsParams = additionalsParams;
        // response.json.currentSites = this.sites;
        // console.log(getFlashData(escape(YAHOO.lang.JSON.stringify(response.json))));

        if (chartTag == "embed" || chartTag == "object") {
          swf.load(getFlashData(escape(YAHOO.lang.JSON.stringify(response.json))));
        } else {
          //Cr�ation variables et attribut - GetFlashData d�fini dans get_data.js - id : Variables json pour ofc.
          var flashvars = {
            "get-data": "getFlashData",
            "id": escape(YAHOO.lang.JSON.stringify(response.json))
          },
            params = {
              wmode: "opaque"
            },
            // /!\ pour IE
            attributes = {
              salign: "l",
              AllowScriptAccess: "always"
            };

          //Cr�ation du graphique Flash.
          swfobject.embedSWF(this.pathToSwf, id, additionalsParams.width, additionalsParams.height, "9.0.0", "expressInstall.swf", flashvars, params, attributes);
        }

      } else {
        //On remove le SWF courant.
        this.removeGraph(id);
        Dom.get(id).innerHTML = this._msg("message.no_results");
        this.widgets.exportButton.set("disabled", true);
      }
      // this.widgets.searchButton.blur();
    },

    /**
     * @method removeGraph
     * @return boolean
     */
    removeGraph: function ConsoleAudit_removeGraph(id) {
      var swf = Dom.get(id),
        chartTag = swf.tagName.toLowerCase(),
        res = false;

      if (chartTag == "embed" || chartTag == "object") {
        swfobject.removeSWF(id);
        //Le conteneur �tant d�truit, il faut le recr�er ...
        var newChartDiv = new YAHOO.util.Element(document.createElement("div"));
        newChartDiv.set("id", id);
        newChartDiv.appendTo(id + "-container");
        res = true;
      }

      return res;
    },

    /**
     *
     * @method countGraphItems
     * @return integer
     */
    countGraphItems: function ConsoleAudit_countGraphItems(json) {
      var count = 0;
      if (json.slicedDates) {
        var maxItems = 0,
          item, i;
        for (i in json.items) {
          item = json.items[i];
          maxItems = (item.totalResults > maxItems) ? item.totalResults : maxItems;
        }
        count = maxItems * json.totalResults;
      } else {
        count = json.totalResults;
      }

      return count;
    },
    /**
     * @method convertDate
     * @param d Date au format jj/mm/aaaa
     * @return integer Timestamp unix de la date
     */
    convertDate: function ConsoleAudit_convertDate(d) {
      var res = 0;
      if (d.length > 0) {
        var dateArray = d.split('/');
        var dateToReturn = new Date(dateArray[2], dateArray[1] - 1, dateArray[0], 0, 0, 0);
        res = dateToReturn.getTime();
      }
      return res;
    },

    /**
     * @method convertTimeStamp
     * @param ts Timestamp unix
     * @param exclude boolean indiquant si le jour doit �tre exclu
     * @return string Date au format jj/mm/aaaa
     */
    convertTimeStamp: function ConsoleAudit_convertTimeStamp(ts, exclude) {
      var d = new Date(ts);
      // retour un jour en arri�re en cas d'exclude
      if (exclude) {
        d.setDate(d.getDate() - 1);
      }

      var month = (d.getMonth() + 1).toString(),
        day = d.getDate().toString(),
        year = d.getFullYear().toString();

      return day + "/" + month + "/" + year;
    },

    /**
     * Transforme les valeurs en cas de "" ou de undefined
     * @method convertMenuValue
     * @param val String Valeur du bouton
     * @return string Valeur "convertie"
     */
    convertMenuValue: function ConsoleAudit_convertMenuValue(val) {
      var res = null;
      if (val !== undefined && val !== "") {
        res = val;
      }
      return res;
    },


    /**
       * @method buildParams Construit une cha�ne de caract�re pour passer les arguments en GET
       * @param from Timestamp unix (string) de la date minimum
       * @param to Timestamp unix (string) de la date maximum
       * @param action Action selectionn�e dans l'UI  --> Useless ?
       * @param module Module selectionn� dans l'UI
       * @param dates Ensemble des tranches de dates dans le cas d'une recherche par date
       * @param type Type de requ�te � effectuer

       * @return string params argument � passer � la requ�te
       */
    buildParams: function ConsoleAudit_buildParams(module, site, dates, type, from, to, limit) {
      var params = "?type=" + type;

      if (dates !== null && dates != "") {
        params += "&dates=" + dates;
      }
      if (module !== null) {
        params += "&module=" + module;
      }
      if (site !== null) {
        params += "&site=" + site;
      }
      if (from) {
        params += "&from=" + from;
      }
      if (to) {
        params += "&to=" + to;
      }
      if (limit) {
        params += "&limit=" + limit;
      }
      return params;
    },

    /**
     * @method buildTimeStampArray Construit des intervalles de dates
     * @param nbInterval Nombre d'intervalle de d�coupage
     * @param pTo Date de fin du d�coupage
     * @param type Type de d�coupage (Mois/Jour/Semaine)
     *
     * @return array Tableau contenant les diff�rents intervalles de dates
     */
    buildTimeStampArray: function ConsoleAudit_buildTimeStampArray(nbInterval) {
      var tsArray = [],
        from = null,
        to = null,
        currentDay = null,
        next = null,
        hasNext = null,
        res = "";

      // Cr�ation de nouvelles dates � manipuler
      to = new Date(this.endDatesArray[this.currentDateFilter].getTime());
      from = new Date(this.endDatesArray[this.currentDateFilter].getTime());

      // Cr�� les intervalles allant du mois de d�part au mois d'arriv�e INCLUS
      if (this.currentDateFilter == "months") {
        tsArray.push(from.setDate(1));
        next = new Date(from);
        next.setDate(1);
        next.setDate(next.getDate() + 3);

        // Date d'arr�t
        to.setDate(1);
        to.setMonth(to.getMonth() + 1);

        hasNext = (to.getTime() > next.getTime());
        while (hasNext) {
          tsArray.push(next.getTime());
          next.setDate(next.getDate() + 3);
          hasNext = (to.getTime() > next.getTime());
        }
        tsArray.push(next.getTime());
      }
      // Selectionne par semaine suivant from et to.
      // Les semaines de "from" et "to" sont INCLUSES
      else if (this.currentDateFilter == "weeks") {
        //On utilise la date de d�part pour r�cup�rer tous les jours de la semaine
        next = null, currentDay = to.getDay(), hasNext = false;
        //D�but de semaine
        from.setDate(to.getDate() - (currentDay - 1));
        next = new Date(from);
        tsArray.push(from.getTime());

        //Date d'arr�t
        to.setDate(from.getDate() + 7);

        next.setDate(from.getDate() + 1);
        hasNext = (to.getTime() > next.getTime());
        while (hasNext) {
          tsArray.push(next.getTime());
          next.setDate(next.getDate() + 1);
          hasNext = (to.getTime() > next.getTime());
        }
        //Semaine suivante, on test au cas o� on d�passe.
        tsArray.push(next.getTime());
      }
      // Cr�� les intervalles allant du jour de d�part au jour d'arriv�e INCLUS
      else if (this.currentDateFilter == "days") {
        //On ajoute la date de d�part
        tsArray.push(from.getTime());

        //On ajoute 1 jour � la date de fin, pour inclure le dernier jour selectionn�.
        to.setDate(to.getDate() + 1);

        //On r�cup�re le jour suivant
        next = new Date(from);
        next.setHours(next.getHours() + 2);

        //On v�rifie qu'il ne d�passe pas la date de fin, on boucle
        hasNext = (to > next);
        while (hasNext) {
          tsArray.push(next.getTime());
          next.setHours(next.getHours() + 2);
          hasNext = (to > next);
        }
        tsArray.push(to.getTime());
      } else if (this.currentDateFilter == "years") {
        // On se place au d�but de l'ann�e
        from.setDate(1);
        from.setMonth(0);
        tsArray.push(from.getTime());

        to.setDate(1);
        to.setMonth(0);
        to.setFullYear(to.getFullYear() + 1);

        next = new Date(from);
        next.setMonth(next.getMonth() + 1);
        hasNext = (to.getTime() > next.getTime());
        while (hasNext) {
          tsArray.push(next.getTime());
          next.setMonth(next.getMonth() + 1);
          hasNext = (to.getTime() > next.getTime());
        }
        tsArray.push(next.getTime());
      }

      return tsArray;
    },

    /**
     * @method onChangeDateFilter
     * @param e Event d�clencheur
     * @param args Composant d�clencheur
     * Gestionnaire click Jour / Semaine / Mois / Ann�e
     */
    onChangeDateFilter: function ConsoleAudit_OnChangeDateFilter(e, args) {
      Event.stopEvent(e);
      Dom.removeClass("by-" + this.currentDateFilter, "selected");
      Dom.addClass("by-" + args.filter, "selected");
      this.currentDateFilter = args.filter;
      this.execute();
    },


    /**
     * @method onChangeDateInterval
     * @param e Event d�clencheur
     * @param args Composant d�clencheur
     * Gestionnaire click suivant / pr�c�dent
     */
    onChangeDateInterval: function ConsoleAudit_OnChangeDateInterval(e, args) {
      var coef = args.coef,
        currentDate = new Date(),
        dateFilter = this.currentDateFilter,
        newDate = new Date(this.endDatesArray[dateFilter]);

      Event.stopEvent(e);
      switch (dateFilter) {
      case "days":
        newDate.setDate(this.endDatesArray[dateFilter].getDate() + (1 * coef));
        break;
      case "weeks":
        newDate.setDate(this.endDatesArray[dateFilter].getDate() + (7 * coef));
        break;
      case "months":
        newDate.setMonth(this.endDatesArray[dateFilter].getMonth() + (1 * coef));
        break;
      case "years":
        newDate.setFullYear(this.endDatesArray[dateFilter].getFullYear() + (1 * coef));
        break;
      }

      this.endDatesArray[dateFilter] = newDate;

      this.execute();
    },

    execute: function ConsoleAudit_execute() {
      this.getByPopularity("mostupdated");
      this.getByPopularity("mostread");
      this.onSearch();
    },

    onSearchClick: function ConsoleAudit_onSearchClick() {
      this.refreshUIState({
        "Time": new Date().getTime()
      });
    },

    //Traduction des messages
    _msg: function ConsoleAudit__msg(messageId) {
      return Alfresco.util.message.call(this, messageId, "Alfresco.ConsoleAudit", Array.prototype.slice.call(arguments).slice(1));
    }
  });
})();