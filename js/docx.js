





/** Génère un vrai fichier Word (.docx) modifiable, sans bibliothèque externe. */
import { Zip, SB, esc, XML_HEAD } from "./util.js";
import { Block, lines as docLines } from "./doc.js";

/** Génère un vrai fichier Word (.docx) modifiable. Renvoie un Uint8Array. */
export function writeDocx(doc) {

    let W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    let R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

        /** Couleur principale du thème. */
    let accent ;
    let light ;
    let accent2 ;
    let headFont ;
    let bodyFont ;
    let textWidth ; // largeur utile en twips
    let images = [];
    let imageExt = [];
    let numberedLists = [];
    let drawingId = 1;
    let labels = [];
    let current = -1;

                accent = doc.theme.primaryHex();
        light = doc.theme.lightHex();
        accent2 = doc.theme.accentHex();
        headFont = doc.theme.headFont;
        bodyFont = doc.theme.bodyFont;
        textWidth = doc.landscape ? 16838 - 2 * 1134 : 11906 - 2 * 1418;


    function writeTo() {
        collectFonts();
        let body = buildBody();
        let zip = Zip.open();
        Zip.put(zip, "[Content_Types].xml", contentTypes());
        Zip.put(zip, "_rels/.rels", XML_HEAD
                + "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">"
                + "<Relationship Id=\"rId1\" Type=\"" + R + "/officeDocument\" Target=\"word/document.xml\"/>"
                + "<Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties\" Target=\"docProps/core.xml\"/>"
                + "</Relationships>");
        Zip.put(zip, "docProps/core.xml", Zip.coreProps(doc.title, doc.author.isEmpty() ? "FAFIO" : doc.author));
        Zip.put(zip, "word/document.xml", body);
        Zip.put(zip, "word/styles.xml", styles());
        Zip.put(zip, "word/numbering.xml", numbering());
        Zip.put(zip, "word/settings.xml", XML_HEAD + "<w:settings xmlns:w=\"" + W + "\">"
                + (embedded.isEmpty() ? "" : "<w:embedTrueTypeFonts/>")
                + (doc.toc ? "<w:updateFields w:val=\"true\"/>" : "")
                + "<w:defaultTabStop w:val=\"708\"/>"
                + "<w:characterSpacingControl w:val=\"doNotCompress\"/><w:compat><w:compatSetting w:name=\"compatibilityMode\" "
                + "w:uri=\"http://schemas.microsoft.com/office/word\" w:val=\"15\"/></w:compat></w:settings>");
        Zip.put(zip, "word/footer1.xml", footer());
        if (doc.theme.runningHeader) Zip.put(zip, "word/header1.xml", header());
        Zip.put(zip, "word/fontTable.xml", fontTable());
        Zip.put(zip, "word/_rels/fontTable.xml.rels", fontTableRels());
        for (let i = 0; i < embedded.length; i++) {
            Zip.put(zip, "word/fonts/font" + (i + 1) + ".odttf", obfuscate(embedded.get(i), embeddedKeys.get(i)));
        }
        Zip.put(zip, "word/_rels/document.xml.rels", documentRels());
        for (let i = 0; i < images.length; i++) {
            Zip.put(zip, "word/media/image" + (i + 1) + "." + imageExt.get(i), images.get(i));
        }
        return zip.finish();
    }

    // ------------------------------------------------------------ Corps

    function buildBody() {
        let b = new SB();
        b.append(XML_HEAD)
                .append("<w:document xmlns:w=\"").append(W).append("\" xmlns:r=\"").append(R).append("\" ")
                .append("xmlns:wp=\"http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing\" ")
                .append("xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\" ")
                .append("xmlns:pic=\"http://schemas.openxmlformats.org/drawingml/2006/picture\"><w:body>");
        if (doc.cover) {
            switch (doc.coverModel) {
                case "EXPOSE": coverExpose(b); break;
                case "TP": coverTp(b); break;
                default: if (hasBg()) coverSimpleBg(b); else cover(b);
            }
        }
        labels = doc.headingLabels();
        if (doc.toc) toc(b);
        for (let i = 0; i < doc.blocks.length; i++) {
            current = i;
            block(b, doc.blocks.get(i));
        }
        if (doc.isPresentation()) slidesOutline(b);
        // section
        let w = doc.landscape ? 16838 : 11906, h = doc.landscape ? 11906 : 16838;
        let m = doc.landscape ? 1134 : 1418;
        b.append("<w:sectPr>").append(doc.theme.runningHeader ? "<w:headerReference w:type=\"default\" r:id=\"rIdHeader\"/>" : "")
                .append("<w:footerReference w:type=\"default\" r:id=\"rIdFooter\"/>")
                .append("<w:pgSz w:w=\"").append(w).append("\" w:h=\"").append(h).append("\"")
                .append(doc.landscape ? " w:orient=\"landscape\"" : "").append("/>")
                .append("<w:pgMar w:top=\"").append(m).append("\" w:right=\"").append(m).append("\" w:bottom=\"").append(m)
                .append("\" w:left=\"").append(m).append("\" w:header=\"708\" w:footer=\"708\" w:gutter=\"0\"/>")
                .append(doc.cover ? "<w:titlePg/>" : "")
                .append("</w:sectPr></w:body></w:document>");
        return b.toString();
    }

    function cover(b) {
        if (!doc.institution.isEmpty()) {
            p(b, pPr("center", 0, 240, null), run(doc.institution.toUpperCase(), true, false, 24, null, bodyFont));
        }
        b.append("<w:p><w:pPr><w:spacing w:before=\"2400\" w:after=\"0\"/>").append(bidi()).append("</w:pPr></w:p>");
        b.append("<w:p><w:pPr><w:pBdr><w:bottom w:val=\"single\" w:sz=\"18\" w:space=\"8\" w:color=\"").append(accent)
                .append("\"/></w:pBdr><w:spacing w:after=\"240\"/><w:jc w:val=\"center\"/>").append(bidi()).append("</w:pPr>")
                .append(run(doc.title, true, false, 56, accent, headFont)).append("</w:p>");
        if (!doc.subtitle.isEmpty()) {
            p(b, pPr("center", 120, 120, null), run(doc.subtitle, false, true, 30, "4B5563", headFont));
        }
        b.append("<w:p><w:pPr><w:spacing w:before=\"2400\" w:after=\"0\"/>").append(bidi()).append("</w:pPr></w:p>");
        for (const line of docLines(doc.author)) {
            p(b, pPr("center", 0, 80, null), run(line, false, false, 26, null, bodyFont));
        }
        for (const line of docLines(doc.extra)) {
            p(b, pPr("center", 0, 80, null), run(line, false, true, 22, "4B5563", bodyFont));
        }
        if (!doc.date.isEmpty()) {
            p(b, pPr("center", 600, 0, null), run(doc.date, false, false, 22, "6B7280", bodyFont));
        }
        b.append("<w:p><w:r><w:br w:type=\"page\"/></w:r></w:p>");
    }

    // ------------------------------------------------------------ Couvertures officielles

    let TNR = "Times New Roman";

    /** Cellule de tableau sans bordure. */
    function hasBg() {
        return doc.theme.coverBg != null;
    }

    function cell(w, content, vAlign) {
        return "<w:tc><w:tcPr><w:tcW w:w=\"" + w + "\" w:type=\"dxa\"/>" + (hasBg() ? "<w:shd w:val=\"clear\" w:color=\"auto\" w:fill=\"FFFFFF\"/>" : "")
                + (vAlign != null ? "<w:vAlign w:val=\"" + vAlign + "\"/>" : "") + "</w:tcPr>"
                + (content.isEmpty() ? "<w:p/>" : content) + "</w:tc>";
    }

    function noBorderTable(widths) {
        let t = new SB("<w:tbl><w:tblPr><w:tblW w:w=\"" + textWidth + "\" w:type=\"dxa\"/><w:jc w:val=\"center\"/>"
                + "<w:tblBorders><w:top w:val=\"nil\"/><w:left w:val=\"nil\"/><w:bottom w:val=\"nil\"/><w:right w:val=\"nil\"/>"
                + "<w:insideH w:val=\"nil\"/><w:insideV w:val=\"nil\"/></w:tblBorders><w:tblLayout w:type=\"fixed\"/></w:tblPr><w:tblGrid>");
        for (const w of widths) t.append("<w:gridCol w:w=\"").append(w).append("\"/>");
        return t.append("</w:tblGrid>").toString();
    }

    /** Colonne d'en-tête bilingue (une ligne par niveau, lignes « *** » conservées). */
    function headerColumn(text, halfPts) {
        let c = new SB();
        for (const line of text.split(/\r?\n/)) {
            let l = line.trim();
            if (l.isEmpty()) continue;
            let stars = l.replaceAll("*", "").trim().isEmpty();
            c.append("<w:p><w:pPr><w:spacing w:before=\"0\" w:after=\"0\" w:line=\"240\" w:lineRule=\"auto\"/><w:jc w:val=\"center\"/></w:pPr>")
                    .append(run(l, false, false, stars ? 14 : halfPts, null, "Calibri")).append("</w:p>");
        }
        return c.toString();
    }

    function logoParagraph(img, maxCx, maxCy) {
        if (img == null) return "";
        let cx = maxCx, cy = Math.floor(maxCx * img.h / Math.max(1, img.w));
        if (cy > maxCy) { cy = maxCy; cx = Math.floor(maxCy * img.w / Math.max(1, img.h)); }
        let idx = addImage(img.data, img.type);
        return "<w:p><w:pPr><w:spacing w:before=\"120\" w:after=\"0\"/><w:jc w:val=\"center\"/></w:pPr>" + drawingRun(idx, cx, cy) + "</w:p>";
    }

    function emptyLines(b, n) {
        for (let i = 0; i < n; i++) b.append("<w:p><w:pPr><w:spacing w:after=\"0\"/></w:pPr></w:p>");
    }

    /** Ruban de l'année académique (cellule colorée centrée). */
    function yearRibbon(b, year) {
        if (year.isEmpty()) return;
        let w = 3400;
        b.append("<w:tbl><w:tblPr><w:tblW w:w=\"").append(w).append("\" w:type=\"dxa\"/><w:jc w:val=\"center\"/><w:tblBorders>")
                .append("<w:top w:val=\"single\" w:sz=\"8\" w:color=\"2F5496\"/><w:left w:val=\"single\" w:sz=\"8\" w:color=\"2F5496\"/>")
                .append("<w:bottom w:val=\"single\" w:sz=\"8\" w:color=\"2F5496\"/><w:right w:val=\"single\" w:sz=\"8\" w:color=\"2F5496\"/>")
                .append("</w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w=\"").append(w).append("\"/></w:tblGrid><w:tr><w:trPr><w:trHeight w:val=\"560\"/></w:trPr>")
                .append("<w:tc><w:tcPr><w:tcW w:w=\"").append(w).append("\" w:type=\"dxa\"/><w:shd w:val=\"clear\" w:color=\"auto\" w:fill=\"").append(doc.theme.id.equals("modern") ? "5B9BD5" : accent).append("\"/><w:vAlign w:val=\"center\"/></w:tcPr>")
                .append("<w:p><w:pPr><w:spacing w:after=\"0\"/><w:jc w:val=\"center\"/></w:pPr>").append(run(year, true, false, 28, "FFFFFF", "Calibri")).append("</w:p>")
                .append("</w:tc></w:tr></w:tbl>");
    }

    /** Image de fond pleine page, placée derrière le texte de la couverture. */
    function backgroundParagraph() {
        let img = doc.theme.coverBg;
        if (img == null) return "";
        let idx = addImage(img.data, img.type);
        let cx = (doc.landscape ? 16838 : 11906) * 635;
        let cy = (doc.landscape ? 11906 : 16838) * 635;
        let id = drawingId++;
        return "<w:p><w:pPr><w:spacing w:before=\"0\" w:after=\"0\" w:line=\"20\" w:lineRule=\"exact\"/></w:pPr><w:r><w:drawing>"
                + "<wp:anchor distT=\"0\" distB=\"0\" distL=\"0\" distR=\"0\" simplePos=\"0\" relativeHeight=\"0\" behindDoc=\"1\" locked=\"1\" layoutInCell=\"1\" allowOverlap=\"1\">"
                + "<wp:simplePos x=\"0\" y=\"0\"/><wp:positionH relativeFrom=\"page\"><wp:posOffset>0</wp:posOffset></wp:positionH>"
                + "<wp:positionV relativeFrom=\"page\"><wp:posOffset>0</wp:posOffset></wp:positionV>"
                + "<wp:extent cx=\"" + cx + "\" cy=\"" + cy + "\"/><wp:effectExtent l=\"0\" t=\"0\" r=\"0\" b=\"0\"/><wp:wrapNone/>"
                + "<wp:docPr id=\"" + id + "\" name=\"Fond " + id + "\"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect=\"1\"/></wp:cNvGraphicFramePr>"
                + "<a:graphic><a:graphicData uri=\"http://schemas.openxmlformats.org/drawingml/2006/picture\"><pic:pic><pic:nvPicPr><pic:cNvPr id=\"" + id
                + "\" name=\"fond.jpeg\"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed=\"rIdImg" + idx + "\"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>"
                + "<pic:spPr><a:xfrm><a:off x=\"0\" y=\"0\"/><a:ext cx=\"" + cx + "\" cy=\"" + cy + "\"/></a:xfrm><a:prstGeom prst=\"rect\"><a:avLst/></a:prstGeom></pic:spPr>"
                + "</pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r></w:p>";
    }

    /** Cartouche du titre : cadre double aux couleurs du thème, fond blanc. */
    function cartouche(inner, widthRatio) {
        let w = ~~(textWidth * widthRatio);
        let bd = "w:val=\"double\" w:sz=\"12\" w:space=\"0\" w:color=\"" + accent + "\"";
        return "<w:tbl><w:tblPr><w:tblW w:w=\"" + w + "\" w:type=\"dxa\"/><w:jc w:val=\"center\"/><w:tblBorders><w:top " + bd + "/><w:left " + bd
                + "/><w:bottom " + bd + "/><w:right " + bd + "/></w:tblBorders><w:tblCellMar><w:top w:w=\"200\" w:type=\"dxa\"/><w:left w:w=\"200\" w:type=\"dxa\"/>"
                + "<w:bottom w:w=\"200\" w:type=\"dxa\"/><w:right w:w=\"200\" w:type=\"dxa\"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w=\"" + w + "\"/></w:tblGrid>"
                + "<w:tr><w:tc><w:tcPr><w:tcW w:w=\"" + w + "\" w:type=\"dxa\"/><w:shd w:val=\"clear\" w:color=\"auto\" w:fill=\"FFFFFF\"/></w:tcPr>" + inner + "</w:tc></w:tr></w:tbl>";
    }

    /** Bloc blanc discret (participants, informations) pour rester lisible sur l'illustration. */
    function whiteCard(inner, widthRatio) {
        let w = ~~(textWidth * widthRatio);
        let bd = "w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"" + light + "\"";
        return "<w:tbl><w:tblPr><w:tblW w:w=\"" + w + "\" w:type=\"dxa\"/><w:jc w:val=\"center\"/><w:tblBorders><w:top " + bd + "/><w:left " + bd
                + "/><w:bottom " + bd + "/><w:right " + bd + "/></w:tblBorders><w:tblCellMar><w:top w:w=\"120\" w:type=\"dxa\"/><w:left w:w=\"200\" w:type=\"dxa\"/>"
                + "<w:bottom w:w=\"120\" w:type=\"dxa\"/><w:right w:w=\"200\" w:type=\"dxa\"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w=\"" + w + "\"/></w:tblGrid>"
                + "<w:tr><w:tc><w:tcPr><w:tcW w:w=\"" + w + "\" w:type=\"dxa\"/><w:shd w:val=\"clear\" w:color=\"auto\" w:fill=\"FFFFFF\"/></w:tcPr>" + inner + "</w:tc></w:tr></w:tbl>";
    }

    /** Couverture simple sur fond illustré : établissement, cartouche du titre, auteurs, date. */
    function coverSimpleBg(b) {
        b.append(backgroundParagraph());
        if (!doc.institution.isEmpty()) {
            b.append(whiteCard("<w:p><w:pPr><w:spacing w:after=\"0\"/><w:jc w:val=\"center\"/></w:pPr>"
                    + run(doc.institution.toUpperCase(), true, false, 22, accent, bodyFont) + "</w:p>", 0.7));
        }
        let t = new SB();
        t.append("<w:p><w:pPr><w:spacing w:after=\"120\"/><w:jc w:val=\"center\"/></w:pPr>").append(run(doc.title, true, false, 48, accent, headFont)).append("</w:p>");
        if (!doc.subtitle.isEmpty()) {
            t.append("<w:p><w:pPr><w:spacing w:after=\"0\"/><w:jc w:val=\"center\"/></w:pPr>").append(run(doc.subtitle, false, true, 28, "4B5563", headFont)).append("</w:p>");
        }
        b.append("<w:p><w:pPr><w:spacing w:before=\"2600\" w:after=\"0\"/></w:pPr></w:p>");
        b.append(cartouche(t.toString(), 0.82));
        let a = new SB();
        for (const line of docLines(doc.author)) {
            a.append("<w:p><w:pPr><w:spacing w:after=\"40\"/><w:jc w:val=\"center\"/></w:pPr>").append(run(line, true, false, 24, null, bodyFont)).append("</w:p>");
        }
        for (const line of docLines(doc.extra)) {
            a.append("<w:p><w:pPr><w:spacing w:after=\"40\"/><w:jc w:val=\"center\"/></w:pPr>").append(run(line, false, true, 21, "4B5563", bodyFont)).append("</w:p>");
        }
        if (!doc.date.isEmpty()) {
            a.append("<w:p><w:pPr><w:spacing w:before=\"80\" w:after=\"0\"/><w:jc w:val=\"center\"/></w:pPr>").append(run(doc.date, false, false, 21, accent, bodyFont)).append("</w:p>");
        }
        if (a.length > 0) {
            b.append("<w:p><w:pPr><w:spacing w:before=\"2400\" w:after=\"0\"/></w:pPr></w:p>");
            b.append(whiteCard(a.toString(), 0.6));
        }
        b.append("<w:p><w:r><w:br w:type=\"page\"/></w:r></w:p>");
    }

    /** Modèle « Exposé » : en-tête bilingue, deux logos, titre souligné, thème, participants, supervision, ruban. */
    function coverExpose(b) {
        b.append(backgroundParagraph());
        let half = Math.floor(textWidth / 2);
        b.append(noBorderTable([half, half]));
        b.append("<w:tr>").append(cell(half, headerColumn(doc.headerLeft, 18), "top")).append(cell(half, headerColumn(doc.headerRight, 18), "top")).append("</w:tr>");
        if (doc.logoLeft != null || doc.logoRight != null) {
            b.append("<w:tr>").append(cell(half, logoParagraph(doc.logoLeft, 1100000, 1000000), "center"))
                    .append(cell(half, logoParagraph(doc.logoRight, 1100000, 1000000), "center")).append("</w:tr>");
        }
        b.append("</w:tbl>");
        let tf = hasBg() ? headFont : TNR;
        let ti = new SB();
        ti.append("<w:p><w:pPr><w:spacing w:before=\"0\" w:after=\"").append(hasBg() ? 120 : 240).append("\"/><w:jc w:val=\"center\"/></w:pPr>")
                .append(hasBg() ? run(doc.title.toUpperCase(), true, false, 34, accent, tf) : runU(doc.title.toUpperCase(), true, 32, tf)).append("</w:p>");
        if (!doc.subtitle.isEmpty()) {
            ti.append("<w:p><w:pPr><w:spacing w:after=\"").append(hasBg() ? 0 : 240).append("\"/><w:jc w:val=\"center\"/></w:pPr>")
                    .append(runU(doc.themeLabel, false, 26, tf))
                    .append(run(" : " + doc.subtitle.toUpperCase(), true, false, 26, null, tf)).append("</w:p>");
        }
        b.append("<w:p><w:pPr><w:spacing w:before=\"").append(hasBg() ? 900 : 1300).append("\" w:after=\"0\"/></w:pPr></w:p>");
        b.append(hasBg() ? cartouche(ti.toString(), 0.86) : ti.toString());
        let people = docLines(doc.author);
        let pc = new SB();
        if (!people.isEmpty()) {
            pc.append("<w:p><w:pPr><w:spacing w:before=\"0\" w:after=\"160\"/></w:pPr>")
                    .append(runU(doc.participantsLabel, true, 22, TNR)).append("</w:p>");
            for (const person of people) {
                pc.append("<w:p><w:pPr><w:spacing w:after=\"60\"/><w:ind w:left=\"284\"/></w:pPr>")
                        .append(run("\u27A2  " + person.toUpperCase(), true, false, 22, null, TNR)).append("</w:p>");
            }
        }
        if (!doc.supervision.isEmpty()) {
            let first = true;
            for (const sup of docLines(doc.supervision)) {
                pc.append("<w:p><w:pPr><w:spacing w:before=\"").append(first ? 240 : 0).append("\" w:after=\"40\"/><w:ind w:left=\"2268\"/></w:pPr>");
                if (first) {
                    pc.append(runU(doc.supervisionLabel, true, 22, TNR)).append(run(" : ", false, false, 22, null, TNR));
                } else {
                    pc.append("<w:r><w:tab/><w:tab/><w:tab/></w:r>");
                }
                pc.append(run(sup, true, false, 22, null, TNR)).append("</w:p>");
                first = false;
            }
        }
        if (pc.length > 0) {
            b.append("<w:p><w:pPr><w:spacing w:before=\"500\" w:after=\"0\"/></w:pPr></w:p>");
            b.append(hasBg() ? whiteCard(pc.toString(), 1.0) : pc.toString());
        }
        b.append("<w:p><w:pPr><w:spacing w:before=\"900\" w:after=\"0\"/></w:pPr></w:p>");
        yearRibbon(b, doc.date);
        b.append("<w:p><w:r><w:br w:type=\"page\"/></w:r></w:p>");
    }

    /** Modèle « TP » : en-tête bilingue avec logo central, laboratoire, cadre coloré, groupe, informations, année. */
    function coverTp(b) {
        b.append(backgroundParagraph());
        let side = ~~(textWidth * 0.38), mid = textWidth - 2 * side;
        b.append(noBorderTable([side, mid, side]));
        let logo = doc.logoLeft != null ? doc.logoLeft : doc.logoRight;
        b.append("<w:tr>").append(cell(side, headerColumn(doc.headerLeft, 17), "top"))
                .append(cell(mid, logoParagraph(logo, 1250000, 1400000), "center"))
                .append(cell(side, headerColumn(doc.headerRight, 17), "top")).append("</w:tr></w:tbl>");
        b.append("<w:p><w:pPr><w:pBdr><w:bottom w:val=\"single\" w:sz=\"12\" w:space=\"1\" w:color=\"000000\"/></w:pBdr><w:spacing w:after=\"240\"/></w:pPr></w:p>");
        let lab = new SB();
        for (const l of docLines(doc.institution)) {
            lab.append("<w:p><w:pPr><w:spacing w:after=\"40\"/><w:jc w:val=\"center\"/></w:pPr>").append(run(l.toUpperCase(), true, false, 22, null, TNR)).append("</w:p>");
        }
        if (lab.length > 0) b.append(hasBg() ? whiteCard(lab.toString(), 0.9) : lab.toString());
        b.append("<w:p><w:pPr><w:spacing w:before=\"500\" w:after=\"0\"/></w:pPr></w:p>");
        // Cadre coloré du titre
        let w = ~~(textWidth * 0.9);
        b.append("<w:tbl><w:tblPr><w:tblW w:w=\"").append(w).append("\" w:type=\"dxa\"/><w:jc w:val=\"center\"/><w:tblBorders>")
                .append("<w:top w:val=\"single\" w:sz=\"12\" w:color=\"").append(accent).append("\"/><w:left w:val=\"single\" w:sz=\"12\" w:color=\"").append(accent).append("\"/>")
                .append("<w:bottom w:val=\"single\" w:sz=\"12\" w:color=\"").append(accent).append("\"/><w:right w:val=\"single\" w:sz=\"12\" w:color=\"").append(accent).append("\"/>")
                .append("</w:tblBorders><w:tblCellMar><w:top w:w=\"160\" w:type=\"dxa\"/><w:bottom w:w=\"160\" w:type=\"dxa\"/></w:tblCellMar></w:tblPr>")
                .append("<w:tblGrid><w:gridCol w:w=\"").append(w).append("\"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w=\"").append(w)
                .append("\" w:type=\"dxa\"/><w:shd w:val=\"clear\" w:color=\"auto\" w:fill=\"").append(doc.theme.id.equals("modern") ? "4472C4" : light).append("\"/></w:tcPr>");
        if (!doc.subtitle.isEmpty()) {
            b.append("<w:p><w:pPr><w:spacing w:after=\"60\"/><w:jc w:val=\"center\"/></w:pPr>").append(run(doc.subtitle.toUpperCase(), true, false, 28, doc.theme.id.equals("modern") ? "0B1F4D" : accent, TNR)).append("</w:p>");
        }
        b.append("<w:p><w:pPr><w:spacing w:after=\"0\"/><w:jc w:val=\"center\"/></w:pPr>").append(run(doc.title.toUpperCase(), true, false, 28, doc.theme.id.equals("modern") ? "0B1F4D" : accent, TNR)).append("</w:p>");
        b.append("</w:tc></w:tr></w:tbl>");
        emptyLines(b, 1);
        if (!doc.group.isEmpty()) {
            let g = "<w:p><w:pPr><w:spacing w:before=\"0\" w:after=\"0\"/><w:jc w:val=\"center\"/></w:pPr>" + run(doc.group.toUpperCase(), true, false, 28, null, TNR) + "</w:p>";
            b.append("<w:p><w:pPr><w:spacing w:before=\"400\" w:after=\"0\"/></w:pPr></w:p>");
            b.append(hasBg() ? whiteCard(g, 0.6) : g);
            b.append("<w:p><w:pPr><w:spacing w:before=\"0\" w:after=\"300\"/></w:pPr></w:p>");
        }
        let info = new SB();
        for (const l of docLines(doc.infoLines)) {
            info.append("<w:p><w:pPr><w:spacing w:after=\"200\"/><w:ind w:left=\"").append(hasBg() ? 200 : 851).append("\"/></w:pPr>").append(run(l.toUpperCase(), true, false, 22, null, TNR)).append("</w:p>");
        }
        if (info.length > 0) b.append(hasBg() ? whiteCard(info.toString(), 0.8) : info.toString());
        for (const l of docLines(doc.extra)) {
            b.append("<w:p><w:pPr><w:spacing w:before=\"240\" w:after=\"60\"/><w:jc w:val=\"center\"/></w:pPr>").append(run(l, true, false, 22, null, TNR)).append("</w:p>");
        }
        emptyLines(b, 1);
        if (!doc.date.isEmpty()) {
            if (hasBg()) {
                b.append("<w:p><w:pPr><w:spacing w:before=\"700\" w:after=\"0\"/></w:pPr></w:p>");
                yearRibbon(b, doc.date);
            } else {
                b.append("<w:p><w:pPr><w:spacing w:before=\"900\"/><w:jc w:val=\"center\"/></w:pPr>")
                        .append(runU(doc.date, true, 24, TNR)).append("</w:p>");
            }
        }
        b.append("<w:p><w:r><w:br w:type=\"page\"/></w:r></w:p>");
    }

    /** Page « Plan de travail ». */
    function toc(b) {
        b.append("<w:p><w:pPr><w:spacing w:after=\"360\"/>").append(bidi()).append("</w:pPr>").append(run(doc.tocTitle, true, false, 24, null, headFont)).append("</w:p>");
        for (let i = 0; i < doc.blocks.length; i++) {
            let blk = doc.blocks.get(i);
            if (blk.type != "HEADING" || blk.level < 1 || blk.level > 2) continue;
            let label = labels.get(i) == null ? blk.text : labels.get(i);
            let ind = blk.level == 1 ? 284 : 1134;
            b.append("<w:p><w:pPr><w:spacing w:after=\"80\"/><w:ind w:left=\"").append(ind).append("\"/>").append(bidi()).append("</w:pPr>")
                    .append(run(label, false, false, 22, null, null)).append("</w:p>");
        }
        b.append("<w:p><w:r><w:br w:type=\"page\"/></w:r></w:p>");
    }

    function block(b, blk) {
        switch (blk.type) {
            case "HEADING": {
                if (blk.level <= 0) {
                    let color = blk.accent || doc.style != "CLASSIC" ? accent : null;
                    let size = blk.sizePt > 0 ? Math.round(blk.sizePt * 2) : 40;
                    p(b, "<w:pPr><w:pStyle w:val=\"Title\"/>" + jc(blk.align) + bidi() + "</w:pPr>",
                            run(blk.text, true, blk.italic, size, color, headFont));
                } else {
                    let lvl = Math.min(3, blk.level);
                    let label = current >= 0 && current < labels.length && labels.get(current) != null ? labels.get(current) : blk.text;
                    let runs = run(label, false, false, 0, null, null);
                    let dot = label.indexOf(". ");
                    if (lvl == 1 && doc.theme.heading == "BADGE" && dot > 0 && dot <= 5) {
                        let rp = "<w:rPr><w:color w:val=\"FFFFFF\"/><w:shd w:val=\"clear\" w:color=\"auto\" w:fill=\"" + accent + "\"/></w:rPr>";
                        runs = "<w:r>" + rp + "<w:t xml:space=\"preserve\"> " + esc(label.substring(0, dot)) + " </w:t></w:r>"
                                + run("  " + label.substring(dot + 2), false, false, 0, null, null);
                    }
                    p(b, "<w:pPr><w:pStyle w:val=\"Heading" + lvl + "\"/>" + (blk.align != "LEFT" ? jc(blk.align) : "") + bidi() + "</w:pPr>", runs);
                }
                break;
            }
            case "PARAGRAPH": {
                let paras = splitParas(blk.text);
                for (const t of paras) {
                    let color = blk.accent ? accent : blk.muted ? "6B7280" : null;
                    let size = blk.sizePt > 0 ? Math.round(blk.sizePt * 2) : 0;
                    p(b, "<w:pPr>" + jc(blk.align) + bidi() + "</w:pPr>", run(t, blk.bold, blk.italic, size, color, null));
                }
                break;
            }
            case "BULLETS":
            case "NUMBERED": {
                let numId ;
                if (blk.type == "BULLETS") {
                    numId = 1;
                } else {
                    numberedLists.add(numberedLists.length);
                    numId = 1 + numberedLists.length;
                }
                for (const it of blk.items) {
                    p(b, "<w:pPr><w:pStyle w:val=\"ListParagraph\"/><w:numPr><w:ilvl w:val=\"0\"/><w:numId w:val=\"" + numId
                            + "\"/></w:numPr><w:spacing w:after=\"60\"/>" + bidi() + "</w:pPr>", run(it, false, false, 0, null, null));
                }
                break;
            }
            case "TABLE":
                table(b, blk);
                break;
            case "IMAGE":
                image(b, blk);
                break;
            case "FIELD": {
                let tab = "<w:tabs><w:tab w:val=\"right\" w:leader=\"dot\" w:pos=\"" + textWidth + "\"/></w:tabs>";
                b.append("<w:p><w:pPr>").append(tab).append("<w:spacing w:before=\"120\" w:after=\"120\"/>").append(bidi()).append("</w:pPr>")
                        .append(run(blk.text + " : ", true, false, 0, null, null))
                        .append("<w:r><w:tab/></w:r></w:p>");
                for (let i = 1; i < blk.lines; i++) {
                    b.append("<w:p><w:pPr>").append(tab).append("<w:spacing w:before=\"120\" w:after=\"120\"/></w:pPr><w:r><w:tab/></w:r></w:p>");
                }
                break;
            }
            case "CHOICES": {
                p(b, "<w:pPr><w:spacing w:before=\"160\" w:after=\"60\"/>" + bidi() + "</w:pPr>", run(blk.text, true, false, 0, null, null));
                if (blk.items.isEmpty()) {
                    let tab = "<w:tabs><w:tab w:val=\"right\" w:leader=\"dot\" w:pos=\"" + textWidth + "\"/></w:tabs>";
                    for (let i = 0; i < 2; i++) {
                        b.append("<w:p><w:pPr>").append(tab).append("<w:spacing w:before=\"120\" w:after=\"120\"/></w:pPr><w:r><w:tab/></w:r></w:p>");
                    }
                } else {
                    for (const it of blk.items) {
                        p(b, "<w:pPr><w:ind w:left=\"567\"/><w:spacing w:after=\"40\"/>" + bidi() + "</w:pPr>",
                                run("☐  " + it, false, false, 0, null, null));
                    }
                }
                break;
            }
            case "SPACER":
                b.append("<w:p/>");
                break;
            case "PAGE_BREAK":
                b.append("<w:p><w:r><w:br w:type=\"page\"/></w:r></w:p>");
                break;
            case "SLOT":
                break;
            case "DIVIDER":
                b.append("<w:p><w:pPr><w:pBdr><w:bottom w:val=\"single\" w:sz=\"6\" w:space=\"1\" w:color=\"").append(accent)
                        .append("\"/></w:pBdr><w:spacing w:after=\"120\"/></w:pPr></w:p>");
                break;
        }
    }

    function slidesOutline(b) {
        let n = 1;
        for (const s of doc.slides) {
            if (s.statement) {
                p(b, "<w:pPr><w:pStyle w:val=\"Heading1\"/><w:jc w:val=\"center\"/>" + bidi() + "</w:pPr>", run(s.title, false, false, 0, null, null));
                continue;
            }
            p(b, "<w:pPr><w:pStyle w:val=\"Heading1\"/>" + bidi() + "</w:pPr>", run(n++ + ". " + s.title, false, false, 0, null, null));
            for (const it of s.bullets) {
                p(b, "<w:pPr><w:pStyle w:val=\"ListParagraph\"/><w:numPr><w:ilvl w:val=\"0\"/><w:numId w:val=\"1\"/></w:numPr>" + bidi() + "</w:pPr>",
                        run(it, false, false, 0, null, null));
            }
            if (s.png != null) {
                let img = Block.image(s.png, s.pxW, s.pxH, s.imgType);
                if (img != null) image(b, img);
                if (!s.caption.isEmpty()) {
                    p(b, "<w:pPr><w:jc w:val=\"center\"/>" + bidi() + "</w:pPr>", run(s.caption, false, true, 20, "4B5563", null));
                }
            }
        }
    }

    function table(b, blk) {
        let cols = blk.header.length;
        for (const r of blk.rows) cols = Math.max(cols, r.length);
        if (cols == 0) return;
        let colW = Math.floor(textWidth / cols);
        b.append("<w:tbl><w:tblPr><w:tblStyle w:val=\"TableGrid\"/><w:tblW w:w=\"5000\" w:type=\"pct\"/>")
                .append(doc.rtl ? "<w:bidiVisual/>" : "")
                .append("<w:tblBorders>")
                .append(border("top")).append(border("left")).append(border("bottom")).append(border("right"))
                .append(border("insideH")).append(border("insideV"))
                .append("</w:tblBorders><w:tblCellMar><w:top w:w=\"60\" w:type=\"dxa\"/><w:left w:w=\"100\" w:type=\"dxa\"/>")
                .append("<w:bottom w:w=\"60\" w:type=\"dxa\"/><w:right w:w=\"100\" w:type=\"dxa\"/></w:tblCellMar></w:tblPr><w:tblGrid>");
        for (let i = 0; i < cols; i++) b.append("<w:gridCol w:w=\"").append(colW).append("\"/>");
        b.append("</w:tblGrid>");
        if (!blk.header.isEmpty()) {
            b.append("<w:tr><w:trPr><w:tblHeader/></w:trPr>");
            for (let i = 0; i < cols; i++) {
                let t = i < blk.header.length ? blk.header.get(i) : "";
                b.append("<w:tc><w:tcPr><w:tcW w:w=\"").append(colW).append("\" w:type=\"dxa\"/><w:shd w:val=\"clear\" w:color=\"auto\" w:fill=\"")
                        .append(accent).append("\"/></w:tcPr>");
                p(b, "<w:pPr><w:spacing w:after=\"0\"/>" + bidi() + "</w:pPr>", run(t, true, false, 0, "FFFFFF", null));
                b.append("</w:tc>");
            }
            b.append("</w:tr>");
        }
        let ri = 0;
        for (const r of blk.rows) {
            b.append("<w:tr>");
            for (let i = 0; i < cols; i++) {
                let t = i < r.length ? r.get(i) : "";
                b.append("<w:tc><w:tcPr><w:tcW w:w=\"").append(colW).append("\" w:type=\"dxa\"/>");
                if (ri % 2 == 1) b.append("<w:shd w:val=\"clear\" w:color=\"auto\" w:fill=\"").append(light).append("\"/>");
                b.append("</w:tcPr>");
                p(b, "<w:pPr><w:spacing w:after=\"0\"/>" + bidi() + "</w:pPr>", run(t, false, false, 0, null, null));
                b.append("</w:tc>");
            }
            b.append("</w:tr>");
            ri++;
        }
        b.append("</w:tbl><w:p/>");
    }

    function border(side) {
        return "<w:" + side + " w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"D1D5DB\"/>";
    }

    function image(b, blk) {
        let idx = addImage(blk.png, blk.imgType);
        let maxW = textWidth * 635; // twips -> EMU
        let cx = blk.pxW * 9525;
        let cy = blk.pxH * 9525;
        if (cx > maxW) {
            cy = Math.floor(cy * maxW / cx);
            cx = maxW;
        }
        let maxH = doc.landscape ? 3600000 : 4680000; // ~10 cm / 13 cm : l'image et sa légende restent ensemble
        if (cy > maxH) {
            cx = Math.floor(cx * maxH / cy);
            cy = maxH;
        }
        b.append("<w:p><w:pPr><w:keepNext/><w:jc w:val=\"center\"/></w:pPr>").append(drawingRun(idx, cx, cy)).append("</w:p>");
    }

    /** Ajoute une image au paquet et renvoie son numéro. */
    function addImage(data, type) {
        images.add(data);
        imageExt.add("jpeg".equals(type) ? "jpeg" : "png");
        return images.length;
    }

    function drawingRun(idx, cx, cy) {
        let b = new SB();
        let id = drawingId++;
        b.append("<w:r><w:drawing><wp:inline distT=\"0\" distB=\"0\" distL=\"0\" distR=\"0\">")
                .append("<wp:extent cx=\"").append(cx).append("\" cy=\"").append(cy).append("\"/>")
                .append("<wp:docPr id=\"").append(id).append("\" name=\"Image ").append(id).append("\"/>")
                .append("<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect=\"1\"/></wp:cNvGraphicFramePr>")
                .append("<a:graphic><a:graphicData uri=\"http://schemas.openxmlformats.org/drawingml/2006/picture\">")
                .append("<pic:pic><pic:nvPicPr><pic:cNvPr id=\"").append(id).append("\" name=\"image").append(idx).append(".").append(imageExt.get(idx - 1)).append("\"/><pic:cNvPicPr/></pic:nvPicPr>")
                .append("<pic:blipFill><a:blip r:embed=\"rIdImg").append(idx).append("\"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>")
                .append("<pic:spPr><a:xfrm><a:off x=\"0\" y=\"0\"/><a:ext cx=\"").append(cx).append("\" cy=\"").append(cy).append("\"/></a:xfrm>")
                .append("<a:prstGeom prst=\"rect\"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic>")
                .append("</wp:inline></w:drawing></w:r>");
        return b.toString();
    }

    // ------------------------------------------------------------ Aides XML

    function splitParas(text) {
        let out = [];
        for (const l of text.split(/\r?\n/)) {
            if (!l.trim().isEmpty()) out.add(l.trim());
        }
        if (out.isEmpty()) out.add("");
        return out;
    }

    function p(b, pPr, runs) {
        b.append("<w:p>").append(pPr == null ? "" : pPr).append(runs).append("</w:p>");
    }

    function pPr(jc, before, after, extra) {
        return "<w:pPr><w:spacing w:before=\"" + before + "\" w:after=\"" + after + "\"/><w:jc w:val=\"" + jc + "\"/>"
                + (extra == null ? "" : extra) + bidi() + "</w:pPr>";
    }

    function jc(a) {
        switch (a) {
            case "CENTER": return "<w:jc w:val=\"center\"/>";
            case "RIGHT": return "<w:jc w:val=\"" + (doc.rtl ? "left" : "right") + "\"/>";
            case "JUSTIFY": return "<w:jc w:val=\"both\"/>";
            default: return doc.rtl ? "<w:jc w:val=\"right\"/>" : "";
        }
    }

    function bidi() {
        return doc.rtl ? "<w:bidi/>" : "";
    }

    /** Un « run » de texte : gras, italique, taille (demi-points), couleur, police. */

    /** Variante soulignée. */
    function runU(text, bold, halfPts, font) {
        return run(text, bold, false, halfPts, null, font, true);
    }

    function run(text, bold, italic, halfPts, color, font, underline = false) {
        let r = new SB("<w:r><w:rPr>");
        if (font != null) {
            r.append("<w:rFonts w:ascii=\"").append(font).append("\" w:hAnsi=\"").append(font).append("\" w:cs=\"").append(font).append("\"/>");
        }
        if (bold) r.append("<w:b/><w:bCs/>");
        if (italic) r.append("<w:i/><w:iCs/>");
        if (color != null) r.append("<w:color w:val=\"").append(color).append("\"/>");
        if (halfPts > 0) r.append("<w:sz w:val=\"").append(halfPts).append("\"/><w:szCs w:val=\"").append(halfPts).append("\"/>");
        if (underline) r.append("<w:u w:val=\"single\"/>");
        if (doc.rtl) r.append("<w:rtl/>");
        r.append("</w:rPr><w:t xml:space=\"preserve\">").append(esc(text)).append("</w:t></w:r>");
        return r.toString();
    }

    // ------------------------------------------------------------ Parties fixes

    function contentTypes() {
        return XML_HEAD + "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">"
                + "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>"
                + "<Default Extension=\"xml\" ContentType=\"application/xml\"/>"
                + "<Default Extension=\"png\" ContentType=\"image/png\"/>"
                + "<Default Extension=\"jpeg\" ContentType=\"image/jpeg\"/>"
                + "<Default Extension=\"odttf\" ContentType=\"application/vnd.openxmlformats-officedocument.obfuscatedFont\"/>"
                + "<Override PartName=\"/word/fontTable.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml\"/>"
                + (doc.theme.runningHeader ? "<Override PartName=\"/word/header1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml\"/>" : "")
                + "<Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/>"
                + "<Override PartName=\"/word/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml\"/>"
                + "<Override PartName=\"/word/numbering.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml\"/>"
                + "<Override PartName=\"/word/settings.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml\"/>"
                + "<Override PartName=\"/word/footer1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml\"/>"
                + "<Override PartName=\"/docProps/core.xml\" ContentType=\"application/vnd.openxmlformats-package.core-properties+xml\"/>"
                + "</Types>";
    }

    function documentRels() {
        let b = new SB(XML_HEAD);
        b.append("<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">")
                .append("<Relationship Id=\"rIdStyles\" Type=\"").append(R).append("/styles\" Target=\"styles.xml\"/>")
                .append("<Relationship Id=\"rIdNum\" Type=\"").append(R).append("/numbering\" Target=\"numbering.xml\"/>")
                .append("<Relationship Id=\"rIdSettings\" Type=\"").append(R).append("/settings\" Target=\"settings.xml\"/>")
                .append("<Relationship Id=\"rIdFooter\" Type=\"").append(R).append("/footer\" Target=\"footer1.xml\"/>")
                .append("<Relationship Id=\"rIdFonts\" Type=\"").append(R).append("/fontTable\" Target=\"fontTable.xml\"/>");
        if (doc.theme.runningHeader) b.append("<Relationship Id=\"rIdHeader\" Type=\"").append(R).append("/header\" Target=\"header1.xml\"/>");
        for (let i = 1; i <= images.length; i++) {
            b.append("<Relationship Id=\"rIdImg").append(i).append("\" Type=\"").append(R).append("/image\" Target=\"media/image").append(i).append(".").append(imageExt.get(i - 1)).append("\"/>");
        }
        return b.append("</Relationships>").toString();
    }

    function pageField(rPr) {
        return "<w:r>" + rPr + "<w:fldChar w:fldCharType=\"begin\"/></w:r><w:r>" + rPr + "<w:instrText xml:space=\"preserve\"> PAGE </w:instrText></w:r>"
                + "<w:r>" + rPr + "<w:fldChar w:fldCharType=\"separate\"/></w:r><w:r>" + rPr + "<w:t>1</w:t></w:r><w:r>" + rPr + "<w:fldChar w:fldCharType=\"end\"/></w:r>";
    }

    function numPagesField(rPr) {
        return "<w:r>" + rPr + "<w:fldChar w:fldCharType=\"begin\"/></w:r><w:r>" + rPr + "<w:instrText xml:space=\"preserve\"> NUMPAGES </w:instrText></w:r>"
                + "<w:r>" + rPr + "<w:fldChar w:fldCharType=\"separate\"/></w:r><w:r>" + rPr + "<w:t>1</w:t></w:r><w:r>" + rPr + "<w:fldChar w:fldCharType=\"end\"/></w:r>";
    }

    function footer() {
        let head = XML_HEAD + "<w:ftr xmlns:w=\"" + W + "\" xmlns:r=\"" + R + "\">";
        let gray = "<w:rPr><w:color w:val=\"7F7F7F\"/><w:sz w:val=\"18\"/></w:rPr>";
        switch (doc.theme.pageNum) {
            case "OF": {
                return head + "<w:p><w:pPr><w:jc w:val=\"right\"/></w:pPr><w:r>" + gray + "<w:t xml:space=\"preserve\">" + esc(doc.theme.pageWord) + " </w:t></w:r>"
                        + pageField("<w:rPr><w:b/><w:color w:val=\"" + accent + "\"/><w:sz w:val=\"18\"/></w:rPr>")
                        + "<w:r>" + gray + "<w:t xml:space=\"preserve\"> " + esc(doc.theme.ofWord) + " </w:t></w:r>" + numPagesField(gray) + "</w:p></w:ftr>";
            }
            case "CIRCLE": {
                let rp = "<w:rPr><w:b/><w:color w:val=\"FFFFFF\"/><w:sz w:val=\"20\"/><w:shd w:val=\"clear\" w:color=\"auto\" w:fill=\"" + accent + "\"/></w:rPr>";
                return head + "<w:p><w:pPr><w:jc w:val=\"right\"/></w:pPr><w:r>" + rp + "<w:t xml:space=\"preserve\">  </w:t></w:r>" + pageField(rp)
                        + "<w:r>" + rp + "<w:t xml:space=\"preserve\">  </w:t></w:r></w:p></w:ftr>";
            }
            case "BAND": {
                let rp = "<w:rPr><w:b/><w:color w:val=\"FFFFFF\"/><w:sz w:val=\"20\"/></w:rPr>";
                return head + "<w:p><w:pPr><w:shd w:val=\"clear\" w:color=\"auto\" w:fill=\"" + accent + "\"/><w:spacing w:before=\"60\" w:after=\"60\"/><w:jc w:val=\"center\"/></w:pPr>"
                        + pageField(rp) + "</w:p></w:ftr>";
            }
            case "DASH": {
                let rp = "<w:rPr><w:color w:val=\"" + accent + "\"/><w:sz w:val=\"20\"/></w:rPr>";
                return head + "<w:p><w:pPr><w:jc w:val=\"center\"/></w:pPr><w:r>" + rp + "<w:t xml:space=\"preserve\">\u2014  </w:t></w:r>" + pageField(rp)
                        + "<w:r>" + rp + "<w:t xml:space=\"preserve\">  \u2014</w:t></w:r></w:p></w:ftr>";
            }
            case "PIPE":
                doc.pageWordFooter = true;
                break;
            default:
                break;
        }
        if (doc.pageWordFooter) {
            let rp = "<w:rPr><w:sz w:val=\"18\"/></w:rPr>";
            return XML_HEAD + "<w:ftr xmlns:w=\"" + W + "\" xmlns:r=\"" + R + "\"><w:p><w:pPr><w:pBdr><w:top w:val=\"single\" w:sz=\"4\" w:space=\"4\" w:color=\"D9D9D9\"/></w:pBdr></w:pPr>"
                    + "<w:r>" + rp + "<w:fldChar w:fldCharType=\"begin\"/></w:r><w:r>" + rp + "<w:instrText xml:space=\"preserve\"> PAGE </w:instrText></w:r>"
                    + "<w:r>" + rp + "<w:fldChar w:fldCharType=\"separate\"/></w:r><w:r><w:rPr><w:b/><w:sz w:val=\"18\"/></w:rPr><w:t>1</w:t></w:r><w:r>" + rp + "<w:fldChar w:fldCharType=\"end\"/></w:r>"
                    + "<w:r><w:rPr><w:color w:val=\"7F7F7F\"/><w:sz w:val=\"18\"/></w:rPr><w:t xml:space=\"preserve\"> | </w:t></w:r>"
                    + "<w:r><w:rPr><w:color w:val=\"7F7F7F\"/><w:spacing w:val=\"60\"/><w:sz w:val=\"18\"/></w:rPr><w:t>Page</w:t></w:r></w:p></w:ftr>";
        }
        return XML_HEAD + "<w:ftr xmlns:w=\"" + W + "\" xmlns:r=\"" + R + "\"><w:p><w:pPr><w:jc w:val=\"center\"/></w:pPr>"
                + "<w:r><w:rPr><w:color w:val=\"9CA3AF\"/><w:sz w:val=\"18\"/></w:rPr><w:fldChar w:fldCharType=\"begin\"/></w:r>"
                + "<w:r><w:rPr><w:color w:val=\"9CA3AF\"/><w:sz w:val=\"18\"/></w:rPr><w:instrText xml:space=\"preserve\"> PAGE </w:instrText></w:r>"
                + "<w:r><w:rPr><w:color w:val=\"9CA3AF\"/><w:sz w:val=\"18\"/></w:rPr><w:fldChar w:fldCharType=\"separate\"/></w:r>"
                + "<w:r><w:rPr><w:color w:val=\"9CA3AF\"/><w:sz w:val=\"18\"/></w:rPr><w:t>1</w:t></w:r>"
                + "<w:r><w:rPr><w:color w:val=\"9CA3AF\"/><w:sz w:val=\"18\"/></w:rPr><w:fldChar w:fldCharType=\"end\"/></w:r>"
                + "</w:p></w:ftr>";
    }

    function header() {
        return XML_HEAD + "<w:hdr xmlns:w=\"" + W + "\" xmlns:r=\"" + R + "\"><w:p><w:pPr><w:pBdr><w:bottom w:val=\"single\" w:sz=\"4\" w:space=\"4\" w:color=\"" + accent + "\"/></w:pBdr>"
                + "<w:jc w:val=\"" + (doc.rtl ? "left" : "right") + "\"/></w:pPr>" + run(doc.title, false, true, 16, "7F7F7F", null) + "</w:p></w:hdr>";
    }

    function styles() {
        let hc = accent;
        let h1Color = hc;
        let h1Ppr ;
        switch (doc.theme.heading) {
            case "BAND":
                h1Ppr = "<w:shd w:val=\"clear\" w:color=\"auto\" w:fill=\"" + accent + "\"/>";
                h1Color = "FFFFFF";
                break;
            case "LEFTBAR":
                h1Ppr = "<w:pBdr><w:left w:val=\"single\" w:sz=\"36\" w:space=\"8\" w:color=\"" + accent + "\"/></w:pBdr>";
                break;
            case "BOXED":
                h1Ppr = "<w:pBdr><w:top w:val=\"single\" w:sz=\"8\" w:space=\"3\" w:color=\"" + accent + "\"/><w:left w:val=\"single\" w:sz=\"8\" w:space=\"6\" w:color=\"" + accent
                        + "\"/><w:bottom w:val=\"single\" w:sz=\"8\" w:space=\"3\" w:color=\"" + accent + "\"/><w:right w:val=\"single\" w:sz=\"8\" w:space=\"6\" w:color=\"" + accent + "\"/></w:pBdr>"
                        + "<w:shd w:val=\"clear\" w:color=\"auto\" w:fill=\"" + light + "\"/>";
                break;
            case "CLASSIC":
                h1Ppr = "<w:pBdr><w:top w:val=\"single\" w:sz=\"4\" w:space=\"4\" w:color=\"" + accent2 + "\"/><w:bottom w:val=\"single\" w:sz=\"4\" w:space=\"4\" w:color=\"" + accent2 + "\"/></w:pBdr>";
                break;
            case "BADGE":
                h1Ppr = "";
                break;
            default:
                h1Ppr = "<w:pBdr><w:bottom w:val=\"single\" w:sz=\"12\" w:space=\"4\" w:color=\"" + accent2 + "\"/></w:pBdr>";
        }
        let h1Border = h1Ppr;
        return XML_HEAD + "<w:styles xmlns:w=\"" + W + "\">"
                + "<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii=\"" + bodyFont + "\" w:hAnsi=\"" + bodyFont + "\" w:eastAsia=\"" + bodyFont
                + "\" w:cs=\"" + bodyFont + "\"/><w:color w:val=\"1F2937\"/><w:sz w:val=\"22\"/><w:szCs w:val=\"22\"/><w:lang w:val=\"fr-FR\" w:bidi=\"ar-SA\"/></w:rPr></w:rPrDefault>"
                + "<w:pPrDefault><w:pPr><w:spacing w:after=\"120\" w:line=\"288\" w:lineRule=\"auto\"/></w:pPr></w:pPrDefault></w:docDefaults>"
                + "<w:style w:type=\"paragraph\" w:default=\"1\" w:styleId=\"Normal\"><w:name w:val=\"Normal\"/><w:qFormat/></w:style>"
                + "<w:style w:type=\"paragraph\" w:styleId=\"Title\"><w:name w:val=\"Title\"/><w:basedOn w:val=\"Normal\"/><w:next w:val=\"Normal\"/><w:qFormat/>"
                + "<w:pPr><w:spacing w:before=\"0\" w:after=\"240\"/></w:pPr><w:rPr><w:rFonts w:ascii=\"" + headFont + "\" w:hAnsi=\"" + headFont + "\" w:cs=\"" + headFont + "\"/>"
                + "<w:b/><w:color w:val=\"" + hc + "\"/><w:sz w:val=\"40\"/></w:rPr></w:style>"
                + heading(1, 30, h1Color, h1Border, 360)
                + heading(2, 26, hc, "", 240)
                + heading(3, 23, "374151", "", 200)
                + "<w:style w:type=\"paragraph\" w:styleId=\"ListParagraph\"><w:name w:val=\"List Paragraph\"/><w:basedOn w:val=\"Normal\"/><w:qFormat/>"
                + "<w:pPr><w:ind w:left=\"720\"/></w:pPr></w:style>"
                + "<w:style w:type=\"table\" w:default=\"1\" w:styleId=\"TableNormal\"><w:name w:val=\"Normal Table\"/><w:tblPr><w:tblInd w:w=\"0\" w:type=\"dxa\"/>"
                + "<w:tblCellMar><w:top w:w=\"0\" w:type=\"dxa\"/><w:left w:w=\"108\" w:type=\"dxa\"/><w:bottom w:w=\"0\" w:type=\"dxa\"/><w:right w:w=\"108\" w:type=\"dxa\"/></w:tblCellMar></w:tblPr></w:style>"
                + "<w:style w:type=\"table\" w:styleId=\"TableGrid\"><w:name w:val=\"Table Grid\"/><w:basedOn w:val=\"TableNormal\"/><w:pPr><w:spacing w:after=\"0\" w:line=\"240\" w:lineRule=\"auto\"/></w:pPr></w:style>"
                + "</w:styles>";
    }

    function heading(lvl, halfPts, color, border, before) {
        let caps = lvl == 1 && doc.theme.heading == "CLASSIC";
        return "<w:style w:type=\"paragraph\" w:styleId=\"Heading" + lvl + "\"><w:name w:val=\"heading " + lvl + "\"/><w:basedOn w:val=\"Normal\"/>"
                + "<w:next w:val=\"Normal\"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/>" + border
                + "<w:spacing w:before=\"" + before + "\" w:after=\"120\"/>" + (caps ? "<w:jc w:val=\"center\"/>" : "") + "<w:outlineLvl w:val=\"" + (lvl - 1) + "\"/></w:pPr>"
                + "<w:rPr><w:rFonts w:ascii=\"" + headFont + "\" w:hAnsi=\"" + headFont + "\" w:cs=\"" + headFont + "\"/><w:b/><w:bCs/>" + (caps ? "<w:caps/>" : "") + "<w:color w:val=\"" + color
                + "\"/><w:sz w:val=\"" + halfPts + "\"/><w:szCs w:val=\"" + halfPts + "\"/></w:rPr></w:style>";
    }

    function numbering() {
        let b = new SB(XML_HEAD);
        b.append("<w:numbering xmlns:w=\"").append(W).append("\">")
                .append("<w:abstractNum w:abstractNumId=\"0\"><w:multiLevelType w:val=\"hybridMultilevel\"/>")
                .append("<w:lvl w:ilvl=\"0\"><w:start w:val=\"1\"/><w:numFmt w:val=\"bullet\"/><w:lvlText w:val=\"").append(esc(doc.theme.bullet)).append("\"/><w:lvlJc w:val=\"left\"/>")
                .append("<w:pPr><w:ind w:left=\"720\" w:hanging=\"360\"/></w:pPr><w:rPr>")
                .append("\u2022".equals(doc.theme.bullet) ? "" : "<w:rFonts w:ascii=\"Segoe UI Symbol\" w:hAnsi=\"Segoe UI Symbol\"/>")
                .append("<w:color w:val=\"").append(accent).append("\"/></w:rPr></w:lvl></w:abstractNum>")
                .append("<w:abstractNum w:abstractNumId=\"1\"><w:multiLevelType w:val=\"hybridMultilevel\"/>")
                .append("<w:lvl w:ilvl=\"0\"><w:start w:val=\"1\"/><w:numFmt w:val=\"decimal\"/><w:lvlText w:val=\"%1.\"/><w:lvlJc w:val=\"left\"/>")
                .append("<w:pPr><w:ind w:left=\"720\" w:hanging=\"360\"/></w:pPr><w:rPr><w:b/><w:color w:val=\"").append(accent).append("\"/></w:rPr></w:lvl></w:abstractNum>")
                .append("<w:num w:numId=\"1\"><w:abstractNumId w:val=\"0\"/></w:num>");
        for (let i = 0; i < numberedLists.length; i++) {
            b.append("<w:num w:numId=\"").append(2 + i).append("\"><w:abstractNumId w:val=\"1\"/>")
                    .append("<w:lvlOverride w:ilvl=\"0\"><w:startOverride w:val=\"1\"/></w:lvlOverride></w:num>");
        }
        return b.append("</w:numbering>").toString();
    }

    // ------------------------------------------------------------ Polices intégrées

    let embedded = [];
    let embeddedKeys = [];
    /** nom de police -> [indice regular, indice bold] (base 1, 0 = absent) */
    let fontEmbeds = new Map();

    function collectFonts() {
        addFont(doc.theme.headFont, doc.theme.headFontR, doc.theme.headFontB);
        addFont(doc.theme.bodyFont, doc.theme.bodyFontR, doc.theme.bodyFontB);
    }

    function addFont(name, regular, bold) {
        if (name == null || fontEmbeds.has(name) || (regular == null && bold == null)) return;
        let idx = [0, 0];
        if (regular != null) { embedded.push(regular); embeddedKeys.push(newGuid()); idx[0] = embedded.length; }
        if (bold != null) { embedded.push(bold); embeddedKeys.push(newGuid()); idx[1] = embedded.length; }
        fontEmbeds.set(name, idx);
    }

    function newGuid() {
        const h = [...crypto.getRandomValues(new Uint8Array(16))].map(x => x.toString(16).padStart(2, "0")).join("").toUpperCase();
        return "{" + h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20) + "}";
    }

    /** Brouillage standard des polices intégrées (ECMA-376, partie 2, § 17.8.1). */
    function obfuscate(font, guid) {
        const out = new Uint8Array(font);
        const hx = guid.replace(/[{}-]/g, "");
        const key = [];
        for (let i = 0; i < 16; i++) key[i] = parseInt(hx.substring(30 - 2 * i, 32 - 2 * i), 16);
        for (let i = 0; i < 32 && i < out.length; i++) out[i] = out[i] ^ key[i % 16];
        return out;
    }

    function fontTable() {
        let b = new SB(XML_HEAD + "<w:fonts xmlns:w=\"" + W + "\" xmlns:r=\"" + R + "\">");
        let names = new Set();
        names.add(headFont); names.add(bodyFont); names.add(TNR); names.add("Calibri");
        for (const n of names) {
            b.append("<w:font w:name=\"").append(esc(n)).append("\"><w:charset w:val=\"00\"/><w:family w:val=\"auto\"/><w:pitch w:val=\"variable\"/>");
            let idx = fontEmbeds.get(n);
            if (idx != null) {
                if (idx[0] > 0) b.append("<w:embedRegular r:id=\"rIdF").append(idx[0]).append("\" w:fontKey=\"").append(embeddedKeys.get(idx[0] - 1)).append("\"/>");
                if (idx[1] > 0) b.append("<w:embedBold r:id=\"rIdF").append(idx[1]).append("\" w:fontKey=\"").append(embeddedKeys.get(idx[1] - 1)).append("\"/>");
            }
            b.append("</w:font>");
        }
        return b.append("</w:fonts>").toString();
    }

    function fontTableRels() {
        let b = new SB(XML_HEAD + "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">");
        for (let i = 1; i <= embedded.length; i++) {
            b.append("<Relationship Id=\"rIdF").append(i).append("\" Type=\"").append(R).append("/font\" Target=\"fonts/font").append(i).append(".odttf\"/>");
        }
        return b.append("</Relationships>").toString();
    }
    return writeTo();
}
