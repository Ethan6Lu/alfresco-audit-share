// AtolStatistics namespace
if (typeof AtolStatistics == undefined || !AtolStatistics) { var AtolStatistics = {}; AtolStatistics.dateFormatMasks = AtolStatistics.dateFormatMasks || {}; }

AtolStatistics.dateFormatMasks = {
  fullDate: Alfresco.util.message("statistics.date-format.fullDate"),
  mediumDate: Alfresco.util.message("statistics.date-format.mediumDate"),
  shortDate: Alfresco.util.message("statistics.date-format.shortDate"),
  monthYear: Alfresco.util.message("statistics.date-format.monthYear"),
  fullDay: Alfresco.util.message("statistics.date-format.fullDay"),
  mediumDay: Alfresco.util.message("statistics.date-format.mediumDay"),
  shortDay: Alfresco.util.message("statistics.date-format.shortDay"),
  fullMonth: Alfresco.util.message("statistics.date-format.fullMonth"),
  fullHour: Alfresco.util.message("statistics.date-format.fullHour"),
  shortHour: Alfresco.util.message("statistics.date-format.shortHour")
};

/**
 * Tool tool component.
 *
 * @namespace AtolStatistics
 * @class AtolStatistics.Tool
 */
(function () {
  /**
   * YUI Library aliases
   */
  var Dom = YAHOO.util.Dom,
      Event = YAHOO.util.Event;

  /**
   * Tool constructor.
   *
   * @param {String} htmlId The HTML id of the parent element
   * @return {AtolStatistics.Tool} The new Tool instance
   * @constructor
   */
  AtolStatistics.Tool = function Tool_constructor(htmlId) {
    AtolStatistics.Tool.superclass.constructor.apply(this, arguments);

    // Surcharge de la classe Date. R�cup�re la semaine courante
    Date.prototype.getWeek = function() {
     var onejan = new Date(this.getFullYear(), 0, 1);
     return Math.ceil((((this - onejan) / 86400000) + onejan.getDay() + 1) / 7);
    };

    return this;
  };

  YAHOO.extend(AtolStatistics.Tool, Alfresco.component.Base, {
    options: {
      /**
       * @attribute pathToSwf
       * Chemin vers le fichier swf d'Open Flash Chart
       */
      pathToSwf: "open-flash-chart.swf",

      /**
       * @attribute currentDateFilter
       * Filtre de date : days, weeks, months, years
       * "weeks" par d�faut
       */
      currentDateFilter: "weeks"
    },

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
     * @attribute endDatesArray
     * Dates de r�f�rence utilis�e pour les graphiques
     * Date pr�sente par d�faut
     */
    endDatesArray: [],

    /**
     * @attribute sites
     * Informations sur les sites (id/titre).
     */
    sites: {},

    /**
     * Fired by YUI when parent element is available for scripting.
     * Component initialisation, including instantiation of YUI widgets and event listener binding.
     *
     * @method onReady
     */
    onReady: function Tool_onReady() {
      Dom.addClass(this.id + "-by-" + this.options.currentDateFilter, "selected");
    },

    onSearch: function Tool_onSearch() {
      // To be overridden
    },

    loadSites: function loadSites() {
      // Changement de style pour l'ic�ne de chargement
      // this.widgets.siteButton.set("label", this.msg("label.sites.loading") + ' <span class="loading"></span>');

      if (this.options.siteId && this.options.siteId != "") {
        Alfresco.util.Ajax.jsonGet({
          url: Alfresco.constants.PROXY_URI + "api/sites/" + encodeURIComponent(this.options.siteId),
          successCallback: {
            fn: function (res) {
              var param = {
                json: [{
                    name: this.options.siteId,
                    title: res.json.title || ""
                  }
                ]
              };
              this.createSiteMenu(param, true);
            },
            scope: this
          },
          failureMessage: this.msg("label.popup.error.list-site")
        });
      } else {
        Alfresco.util.Ajax.jsonGet({
          url: Alfresco.constants.PROXY_URI + "share-stats/site/list-sites?role=SiteManager",
          successCallback: {
            fn: function (res) {
              this.createSiteMenu(res);
            },
            scope: this
          },
          failureMessage: this.msg("label.popup.error.list-site"),
          execScripts: true
        });
      }
    },

    onSiteMenuClick: function Tool_onSiteMenuClick(p_sType, p_aArgs, p_oItem) {
      var sText = p_oItem.cfg.getProperty("text");

      this.widgets.siteButton.value = p_oItem.value;
      this.widgets.siteButton.set("label", sText);
      this.execute();
    },

    createSiteMenu: function Tool_createSiteMenu(res, hideAllSiteEntry) {
      var siteMenuButtons = [],
          allSitesMenuButton = [],
          menuButtons = [],
          siteIds = [];

      for (var i=0, ii=res.json.length ; i < ii ; i++) {
        var current_site = res.json[i];
        siteMenuButtons.push({
          text: current_site.title,
          value: current_site.name,
          onclick: {
            fn: this.onSiteMenuClick,
            scope: this
          }
        });

        // Stockage des sites
        siteIds.push(current_site.name);
        this.sites[current_site.name] = current_site.title;
      }

      if (!hideAllSiteEntry) {
        allSitesMenuButton.push({
          text: this.msg("label.menu.site.all"),
          value: siteIds.join(','),

          onclick: {
            fn: this.onSiteMenuClick,
            scope: this
          }
        });
      }

      menuButtons = allSitesMenuButton.concat(siteMenuButtons);
      var btOpts = {
        type: "split",
        menu: menuButtons,
        lazyloadmenu: false
      };

      if (menuButtons.length <= 1) {
        btOpts.disabled = true;
      }

      this.widgets.siteButton = new YAHOO.widget.Button("site-criteria", btOpts);

      // Maj des infos du bouton
      // S�lection de la 1�re entr�e
      this.widgets.siteButton.set("label", menuButtons[0].text);
      this.widgets.siteButton.value = menuButtons[0].value;
      this.widgets.siteButton.set("selectedMenuItem", this.widgets.siteButton.getMenu().getItem(0));

      this.execute();
    },

    /**
     * @method buildTimeStampArray Construit des intervalles de dates
     * @return array Tableau contenant les diff�rents intervalles de dates
     */
    buildTimeStampArray: function Tool_buildTimeStampArray() {
      var tsArray = [],
        from = null,
        to = null,
        currentDay = null,
        next = null,
        hasNext = null,
        res = "";

      // Cr�ation de nouvelles dates � manipuler
      to = new Date(this.endDatesArray[this.options.currentDateFilter].getTime());
      from = new Date(this.endDatesArray[this.options.currentDateFilter].getTime());

      // Cr�� les intervalles allant du mois de d�part au mois d'arriv�e INCLUS
      if (this.options.currentDateFilter == "months") {
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
      else if (this.options.currentDateFilter == "weeks") {
        // On utilise la date de d�part pour r�cup�rer tous les jours de la semaine
        next = null, currentDay = to.getDay(), hasNext = false;
        // D�but de semaine
        from.setDate(to.getDate() - (currentDay - 1));
        next = new Date(from);
        tsArray.push(from.getTime());

        // Date d'arr�t
        to.setMonth(from.getMonth());
        to.setDate(from.getDate() + 7);

        next.setDate(from.getDate() + 1);
        hasNext = (to.getTime() > next.getTime());
        while (hasNext) {
          tsArray.push(next.getTime());
          next.setDate(next.getDate() + 1);
          hasNext = (to.getTime() > next.getTime());
        }
        // Semaine suivante, on test au cas o� on d�passe.
        tsArray.push(next.getTime());
      }
      // Cr�� les intervalles allant du jour de d�part au jour d'arriv�e INCLUS
      else if (this.options.currentDateFilter == "days") {
        // On ajoute la date de d�part
        tsArray.push(from.getTime());

        // On ajoute 1 jour � la date de fin, pour inclure le dernier jour selectionn�.
        to.setDate(to.getDate() + 1);

        // On r�cup�re le jour suivant
        next = new Date(from);
        next.setHours(next.getHours() + 2);

        // On v�rifie qu'il ne d�passe pas la date de fin, on boucle
        hasNext = (to > next);
        while (hasNext) {
          tsArray.push(next.getTime());
          next.setHours(next.getHours() + 2);
          hasNext = (to > next);
        }
        tsArray.push(to.getTime());
      } else if (this.options.currentDateFilter == "years") {
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
     * @method removeGraph
     * @return boolean
     */
    removeGraph: function Tool_removeGraph(id) {
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
    convertDate: function Tool_convertDate(d) {
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
    convertTimeStamp: function Tool_convertTimeStamp(ts, exclude) {
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
    convertMenuValue: function Tool_convertMenuValue(val) {
      var res = null;
      if (val !== undefined && val !== "") {
        res = val;
      }
      return res;
    },

    /**
     * @method onChangeDateFilter
     * @param e Event d�clencheur
     * @param args Composant d�clencheur
     * Gestionnaire click Jour / Semaine / Mois / Ann�e
     */
    onChangeDateFilter: function Tool_OnChangeDateFilter(e, args) {
      if (e) Event.stopEvent(e);
      Dom.removeClass(this.id + "-by-" + this.options.currentDateFilter, "selected");
      Dom.addClass(this.id + "-by-" + args.filter, "selected");
      this.options.currentDateFilter = args.filter;
      this.execute();
    },

    /**
     * @method onChangeDateInterval
     * @param e Event d�clencheur
     * @param args Composant d�clencheur
     * Gestionnaire click suivant / pr�c�dent
     */
    onChangeDateInterval: function Tool_OnChangeDateInterval(e, args) {
      var coef = args.coef,
        currentDate = new Date(),
        dateFilter = this.options.currentDateFilter,
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

    setupCurrentDates : function Tool_setupCurrentDates(){
      var currentDate = new Date();
      currentDate.setMinutes(0);
      currentDate.setHours(0);
      currentDate.setMinutes(0);
      currentDate.setSeconds(0);
      currentDate.setMilliseconds(0);

      this.endDatesArray["days"] = currentDate;
      this.endDatesArray["weeks"] = currentDate;
      this.endDatesArray["months"] = currentDate;
      this.endDatesArray["years"] = currentDate;
    },

    onResetDates: function Tool_OnResetDates(){
      this.setupCurrentDates();
      this.execute();
    },

    execute: function Tool_execute() {
      this.onSearch();
    }
  });
})();