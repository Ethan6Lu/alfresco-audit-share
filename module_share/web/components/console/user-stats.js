/**
 * ConsoleUserAudit tool component.
 *
 * @namespace Alfresco
 * @class Alfresco.ConsoleUserAudit
 */ (function () {
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
   * ConsoleUserAudit constructor.
   *
   * @param {String} htmlId The HTML id �of the parent element
   * @return {Alfresco.ConsoleUserAudit} The new ConsoleUserAudit instance
   * @constructor
   */
  Alfresco.ConsoleUserAudit = function (htmlId) {
    this.name = "Alfresco.ConsoleUserAudit";
    Alfresco.ConsoleUserAudit.superclass.constructor.call(this, htmlId);

    /* Register this component */
    Alfresco.util.ComponentManager.register(this);

    /* Load YUI Components */
    Alfresco.util.YUILoaderHelper.require(["button", "container", "datasource", "paginator", "json", "history"], this.onComponentsLoaded, this);

    /* Define panel handlers */
    var parent = this;

    // NOTE: the panel registered first is considered the "default" view and is displayed first
    /* Audit Panel Handler */
    UserAuditPanelHandler = function UserAuditPanelHandler_constructor() {
      UserAuditPanelHandler.superclass.constructor.call(this, "audit");
    };

    // Surcharge de la classe Date. R�cup�re la semaine courante
    Date.prototype.getWeek = function () {
      var onejan = new Date(this.getFullYear(), 0, 1);
      return Math.ceil((((this - onejan) / 86400000) + onejan.getDay() + 1) / 7);
    };

    YAHOO.extend(UserAuditPanelHandler, Alfresco.ConsolePanelHandler, {
      /**
       * Called by the ConsolePanelHandler when this panel shall be loaded
       *
       * @method onLoad
       */
      onLoad: function onLoad() {
        // Buttons - Check ?
        parent.widgets.exportButton = Alfresco.util.createYUIButton(parent, "export-button", parent.onExport);

        parent.widgets.exportButton.set("disabled", true);

        // el, sType, fn, obj, overrideContext
        Event.addListener("home", "click", parent.onResetDates, null, parent);
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

    new UserAuditPanelHandler();

    return this;
  };

  YAHOO.extend(Alfresco.ConsoleUserAudit, Alfresco.ConsoleTool, {

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
    onComponentsLoaded: function ConsoleUserAudit_onComponentsLoaded() {
      Event.onContentReady(this.id, this.onReady, this, true);
    },

    /**
     * Fired by YUI when parent element is available for scripting.
     * Component initialisation, including instantiation of YUI widgets and event listener binding.
     *
     * @method onReady
     */
    onReady: function ConsoleUserAudit_onReady() {
      // Call super-class onReady() method
      Alfresco.ConsoleUserAudit.superclass.onReady.call(this);

      this.setupCurrentDates();
    },

    /**
     * @method createSiteDialog
     * @param res
     *
     */
    createSiteMenu: function ConsoleUserAudit_createSiteDialog(res) {
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
        container: "site-criteria-container"
      });

      //Maj des infos du bouttons
      this.widgets.siteButton.set("label", this._msg("label.menu.site.all"));
      this.widgets.siteButton.value = "";

      this.execute();
    },

    onExport: function ConsoleUserAudit_onExport() {
      // TODO:
      if (this.lastRequest.params) {
        var params = this.lastRequest.params;
        params += "&type=users";
        params += "&values=" + this.lastRequest.values.toString();
        var url = Alfresco.constants.PROXY_URI + "share-stats/export-audits" + params; //?json=" + escape(YAHOO.lang.JSON.stringify(this.lastRequest.data));//JSON.stringify
        window.open(url);
      }
    },

    getUsers: function ConsoleUserAudit_getUsers(type) {
      var displayUsers = function (response) {
          var names = response.json.items,
            el = Dom.get(this.id + "-" + type);
          if (names) {
            var context = Alfresco.constants.URL_PAGECONTEXT,
              url = "",
              html = "",
              name = "",
              i = 0,
              l = names.length;

            for (; i < l; i++) {
              name = names[i];
              html += '<li class="nav-user">';
              html += '<a class="theme-color-1" tabindex="0" target="_blank" href="' + context + 'user/' + name + '/profile">' + name + '</a>';
              html += '</li>';
            }

            html = "<ul>" + html + "</ul>";
            el.innerHTML = html;
          } else {
            el.innerHTML = this.msg("label.no-results." + type);
          }
        };

      //R�cup�ration des variables de l'UI
      var dateFilter = this.currentDateFilter,
        site = this.convertMenuValue(this.widgets.siteButton.value),
        tsString = "",
        params = "";

      // Cr�tion du tableau d'intervalle de dates

      tsArray = this.buildTimeStampArray();
      tsString = tsArray[0].toString() + "," + tsArray[tsArray.length - 1];

      params = "?type=" + type;
      params += "&dates=" + tsString;
      if (site) {
        params += "&site=" + site;
      }

      var url = Alfresco.constants.PROXY_URI + "share-stats/select-users" + params;
      Alfresco.util.Ajax.jsonGet({
        url: url,
        successCallback: {
          fn: displayUsers,
          scope: this
        },
        failureMessage: this._msg("label.popup.query.error"),
        execScripts: true
      });
    },
    /**
     * @method
     * @param
     * @return
     */
    onSearch: function ConsoleUserAudit_onSearch() {
      //R�cup�ration des variables de l'UI
      var dateFilter = this.currentDateFilter,
        site = this.convertMenuValue(this.widgets.siteButton.value),
        tsString = "",
        params = "";

      // Cr�tion du tableau d'intervalle de dates
      if (dateFilter) {
        tsString = this.buildTimeStampArray().toString();
      }

      // Cr�ation des param�tres et ex�cution de la requ�te
      params = "?type=users-count";
      params += "&dates=" + tsString;
      if (site) {
        params += "&site=" + site;
      }
      this.lastRequest.params = params;

      var url = Alfresco.constants.PROXY_URI + "share-stats/select-users" + this.lastRequest.params;
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
          type: "count",
          site: site,
          tsString: tsString,
          target: "chart",
          height: "450",
          width: "90%"
        }
      });

    },

    /**
     * @method displayGraph Affiche le requ�te suite � une requ�te Ajax
     * @param response R�ponse de la requ�te
     */
    displayGraph: function ConsoleUserAudit_displayGraph(response) {
      var additionalsParams, id, swf, chartTag;

      additionalsParams = response.config.additionalsParams;
      id = this.id + "-" + additionalsParams.target;
      swf = Dom.get(id);
      chartTag = swf.tagName.toLowerCase();

      if (response.json) {
        this.widgets.exportButton.set("disabled", false);
        response.json.currentFilter = this.currentDateFilter;
        response.json.additionalsParams = additionalsParams;
        this.lastRequest.values = response.json.values;

        if (chartTag == "embed" || chartTag == "object") {
          swf.load(getUserFlashData(escape(YAHOO.lang.JSON.stringify(response.json))));
        } else {
          //Cr�ation variables et attribut - GetFlashData d�fini dans get_data.js - id : Variables json pour ofc.
          var flashvars = {
            "get-data": "getUserFlashData",
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
    },

    /**
     * @method removeGraph
     * @return boolean
     */
    removeGraph: function ConsoleUserAudit_removeGraph(id) {
      var swf = Dom.get(id),
        chartTag = swf.tagName.toLowerCase(),
        res = false;

      if (chartTag == "embed" || chartTag == "object") {
        swfobject.removeSWF(id);
        // Le conteneur �tant d�truit, il faut le recr�er ...
        var newChartDiv = new YAHOO.util.Element(document.createElement("div"));
        newChartDiv.set("id", id);
        newChartDiv.appendTo(id + "-container");
        res = true;
      }

      return res;
    },

    /**
     * @method convertDate
     * @param d Date au format jj/mm/aaaa
     * @return integer Timestamp unix de la date
     */
    convertDate: function ConsoleUserAudit_convertDate(d) {
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
    convertTimeStamp: function ConsoleUserAudit_convertTimeStamp(ts, exclude) {
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
    convertMenuValue: function ConsoleUserAudit_convertMenuValue(val) {
      var res = null;
      if (val !== undefined && val !== "") {
        res = val;
      }
      return res;
    },


    /**
     * @method buildParams Construit une cha�ne de caract�re pour passer les arguments en GET
     * @return string params argument � passer � la requ�te
     */
    buildParams: function ConsoleUserAudit_buildParams() {
      var params = "";

      // TODO:

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
    buildTimeStampArray: function ConsoleUserAudit_buildTimeStampArray(nbInterval) {
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
        next.setDate(next.getDate() + 1);

        // Date d'arr�t
        to.setDate(1);
        to.setMonth(to.getMonth() + 1);

        hasNext = (to.getTime() > next.getTime());
        while (hasNext) {
          tsArray.push(next.getTime());
          next.setDate(next.getDate() + 1);
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
        to.setMonth(from.getMonth());
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
    onChangeDateFilter: function ConsoleUserAudit_OnChangeDateFilter(e, args) {
      if (e) Event.stopEvent(e);
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
    onChangeDateInterval: function ConsoleUserAudit_OnChangeDateInterval(e, args) {
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

    onResetDates: function ConsoleUserAudit_OnResetDates() {
      this.setupCurrentDates();
      this.execute();
    },

    execute: function ConsoleUserAudit_execute() {
      this.getUsers("users-connected");
      this.getUsers("users-never-connected");
      this.onSearch();
    },

    setupCurrentDates: function ConsoleUserAudit_setupCurrentDates() {
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

    //Traduction des messages
    _msg: function ConsoleUserAudit__msg(messageId) {
      return Alfresco.util.message.call(this, messageId, "Alfresco.ConsoleUserAudit", Array.prototype.slice.call(arguments).slice(1));
    }
  });
})();