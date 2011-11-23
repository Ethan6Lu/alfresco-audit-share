package com.atolcd.alfresco.web.scripts.shareStats;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.Charset;
import java.sql.SQLException;
import java.util.Calendar;
import java.util.GregorianCalendar;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.alfresco.service.cmr.site.SiteInfo;
import org.alfresco.service.cmr.site.SiteService;
import org.json.JSONException;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.extensions.surf.util.I18NUtil;
import org.springframework.extensions.webscripts.AbstractWebScript;
import org.springframework.extensions.webscripts.WebScriptRequest;
import org.springframework.extensions.webscripts.WebScriptResponse;
import org.springframework.util.Assert;

import com.atolcd.alfresco.AuditCount;
import com.atolcd.alfresco.AuditQueryParameters;
import com.atolcd.alfresco.CsvExportEntry;
import com.csvreader.CsvWriter;

public class AuditExportGet extends AbstractWebScript implements InitializingBean {

    private SelectAuditsGet wsSelectAudits;
    private SiteService siteService;

    public void setWsSelectAudits(SelectAuditsGet wsSelectAudits) {
        this.wsSelectAudits = wsSelectAudits;
    }

    public void setSiteService(SiteService siteService) {
        this.siteService = siteService;
    }
    
    @Override
    public void afterPropertiesSet() throws Exception {
        Assert.notNull(wsSelectAudits);
        Assert.notNull(siteService);
    }

    /**
	 * 
	 */
    @Override
    public void execute(WebScriptRequest req, WebScriptResponse res) throws IOException {
        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            Charset charset = Charset.forName("UTF-8");// ISO-8859-1
            CsvWriter csv = new CsvWriter(baos, ',', charset);

            Map<String, Object> model = new HashMap<String, Object>();
            AuditQueryParameters params = wsSelectAudits.buildParametersFromRequest(req);

            String type = "all";
            if (req.getParameter("type").startsWith("sites") || (req.getParameter("type").equals("action") && req.getParameter("module") != null)) {
                type = req.getParameter("type");
            }
            wsSelectAudits.checkForQuery(model, params, type);
            buildCsvFromRequest(model, csv, params, type);

            csv.close();
            res.setHeader("Content-Disposition", "attachment; filename=\"export.csv\"");
            res.setContentType("application/csv");// application/octet-stream
            baos.writeTo(res.getOutputStream());

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    /**
     * 
     * @param model
     *            Modèle dans lequel on écrit
     * @param csv
     *            CsvWriter utilisé pour écrire dans le modèle
     * @throws SQLException
     * @throws JSONException
     * @throws IOException
     */
    @SuppressWarnings("unchecked")
    public void buildCsvFromRequest(Map<String, Object> model, CsvWriter csv, AuditQueryParameters params, String type)
            throws SQLException, JSONException, IOException {
        // S�lection de TOUS les audits.
        String dateRecord = null;
        if (model.containsKey("results")) {
            if (!model.containsKey("slicedDates")) {
                if (params.getDateFrom() > 0 || params.getDateTo() > 0) {
                    csv.writeRecord(new String[] { I18NUtil.getMessage("csv.site"), I18NUtil.getMessage("csv.module"),
                            I18NUtil.getMessage("csv.action"), I18NUtil.getMessage("csv.count"),
                            I18NUtil.getMessage("csv.interval") });
                    dateRecord = getStringDate(params.getDateFrom()) + " - " + getStringDate(params.getDateTo());
                } else {
                    csv.writeRecord(new String[] { I18NUtil.getMessage("csv.site"), I18NUtil.getMessage("csv.module"),
                            I18NUtil.getMessage("csv.action"), I18NUtil.getMessage("csv.count") });
                }

                List<CsvExportEntry> csvExportEntries = (List<CsvExportEntry>) model.get("results");
                writeCsvEntry(csv, csvExportEntries, false, dateRecord);
            } else {
                csv.writeRecord(new String[] { I18NUtil.getMessage("csv.interval"), I18NUtil.getMessage("csv.module"),
                        I18NUtil.getMessage("csv.action"), I18NUtil.getMessage("csv.count"),
                        I18NUtil.getMessage("csv.site") });
                List<List<CsvExportEntry>> auditExportEntryList = (List<List<CsvExportEntry>>) model.get("results");
                String[] slicedDates = ((String) model.get("slicedDates")).split(",");
                for (int i = 0; i < auditExportEntryList.size(); i++) {
                    dateRecord = getStringDate(Long.parseLong(slicedDates[i]));
                    dateRecord += " - " + getStringDate(Long.parseLong(slicedDates[i + 1]));
                    writeCsvEntry(csv, auditExportEntryList.get(i), true, dateRecord);
                }
            }
        } else if (type.startsWith("sites")) {
            if (model.containsKey("slicedDates")) {
                csv.writeRecord(new String[] { I18NUtil.getMessage("csv.interval"), I18NUtil.getMessage("csv.site"),
                        I18NUtil.getMessage("csv.count") });
                List<List<AuditCount>> auditCountsLists = (List<List<AuditCount>>) model.get("dates");
                String[] slicedDates = ((String) model.get("slicedDates")).split(",");
                for (int i = 0; i < auditCountsLists.size(); i++) {
                    dateRecord = getStringDate(Long.parseLong(slicedDates[i]));
                    dateRecord += " - " + getStringDate(Long.parseLong(slicedDates[i + 1]));
                    writeAuditCount(csv, auditCountsLists.get(i), true, dateRecord,"site");
                }
            } else {

                if (params.getDateFrom() > 0 || params.getDateTo() > 0) {
                    dateRecord = getStringDate(params.getDateFrom()) + "-" + getStringDate(params.getDateTo());
                    csv.writeRecord(new String[] { I18NUtil.getMessage("csv.site"), I18NUtil.getMessage("csv.count"),
                            I18NUtil.getMessage("csv.interval") });
                } else {
                    csv.writeRecord(new String[] { I18NUtil.getMessage("csv.site"), I18NUtil.getMessage("csv.count") });
                }
                List<AuditCount> auditCounts = (List<AuditCount>) model.get("views");
                writeAuditCount(csv, auditCounts, false, dateRecord,"site");
            }
        } else {
            if (model.containsKey("slicedDates")) {
                csv.writeRecord(new String[] { I18NUtil.getMessage("csv.interval"), I18NUtil.getMessage("csv.action"),
                        I18NUtil.getMessage("csv.count") });
                List<List<AuditCount>> auditCountsLists = (List<List<AuditCount>>) model.get("dates");
                String[] slicedDates = ((String) model.get("slicedDates")).split(",");
                for (int i = 0; i < auditCountsLists.size(); i++) {
                    dateRecord = getStringDate(Long.parseLong(slicedDates[i]));
                    dateRecord += " - " + getStringDate(Long.parseLong(slicedDates[i + 1]));
                    writeAuditCount(csv, auditCountsLists.get(i), true, dateRecord,"action");
                }
            } else {
                if (params.getDateFrom() > 0 || params.getDateTo() > 0) {
                    dateRecord = getStringDate(params.getDateFrom()) + "-" + getStringDate(params.getDateTo());
                    csv.writeRecord(new String[] { I18NUtil.getMessage("csv.action"), I18NUtil.getMessage("csv.count"),
                            I18NUtil.getMessage("csv.interval") });
                } else {
                    csv.writeRecord(new String[] { I18NUtil.getMessage("csv.action"), I18NUtil.getMessage("csv.count") });
                }
                List<AuditCount> auditCounts = (List<AuditCount>) model.get("views");
                writeAuditCount(csv, auditCounts, false, dateRecord,"action");
            }
        }
    }

    /**
     * 
     * @param csv
     *            CsvWriter dans lequel on �crit
     * @param auditCounts
     * @throws IOException
     */
    public void writeAuditCount(CsvWriter csv, List<AuditCount> auditCounts, boolean dateFirst, String date,String type)
            throws IOException {
        for (AuditCount auditCount : auditCounts) {
            String[] record;
            int recordIndex = 0;
            if (date != null) {
                record = new String[3];
                if (dateFirst) {
                    record[recordIndex++] = date;
                }
            } else {
                record = new String[2];
            }
            if(type.equals("action")){
                record[recordIndex++] = I18NUtil.getMessage("csv." + auditCount.getTarget());
            } else if (type.equals("site")){
                SiteInfo siteInfo = siteService.getSite(auditCount.getTarget());
                String siteTitle = auditCount.getTarget();
                if(siteInfo != null){
                    siteTitle = siteInfo.getTitle().replace(",", "");
                }
                record[recordIndex++] = siteTitle;
            }
            record[recordIndex++] = String.valueOf(auditCount.getCount());

            if (!dateFirst && date != null) {
                record[recordIndex++] = date;
            }
            csv.writeRecord(record);
        }
    }

    public void writeCsvEntry(CsvWriter csv, List<CsvExportEntry> csvExportEntries, boolean dateFirst, String date)
            throws IOException {
        for (CsvExportEntry csvExportEntry : csvExportEntries) {
            String[] record;
            int recordIndex = 0;
            if (date != null) {
                record = new String[5];
                if (dateFirst) {
                    record[recordIndex++] = date;
                }
            } else {
                record = new String[4];
            }
            record[recordIndex++] = csvExportEntry.getAuditSite();
            record[recordIndex++] = I18NUtil.getMessage("csv." + csvExportEntry.getAuditAppName());
            record[recordIndex++] = I18NUtil.getMessage("csv." + csvExportEntry.getAuditAppName() + "."
                    + csvExportEntry.getAuditActionName());
            record[recordIndex++] = String.valueOf(csvExportEntry.getCount());

            if (!dateFirst && date != null) {
                record[recordIndex++] = date;
            }
            csv.writeRecord(record);
        }
    }

    /**
     * 
     * @param gc
     *            Gr�gorianCalendar dont on souhaite r�cup�rer la date
     * 
     * @return date String
     */
    public String getStringDate(long l) {
        GregorianCalendar gc = new GregorianCalendar();
        gc.setTimeInMillis(l);

        String date = "";
        date += String.valueOf(gc.get(Calendar.DAY_OF_MONTH)) + "/";
        date += String.valueOf(gc.get(Calendar.MONTH) + 1) + "/";
        date += String.valueOf(gc.get(Calendar.YEAR));

        return date;
    }
}
