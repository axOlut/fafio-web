





/** Génère un vrai fichier Word (.docx) modifiable, sans bibliothèque externe. */
import { Zip, SB, esc, XML_HEAD, hex } from "./util.js";
import { Block, lines as docLines } from "./doc.js";
import * as MathTex from "./math.js";

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
        let st = styles();
        if (doc.fontScale != 1 && doc.cv == null) st = scaleAttr(scaleAttr(st, "<w:sz w:val=\"", doc.fontScale), "<w:szCs w:val=\"", doc.fontScale);
        Zip.put(zip, "word/styles.xml", st);
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
                .append("xmlns:pic=\"http://schemas.openxmlformats.org/drawingml/2006/picture\" xmlns:m=\"").append(MathTex.M_NS).append("\"><w:body>");
        if (doc.cv != null) {
            cvBody(b);
            return b.toString();
        }
        if (doc.cover) {
            switch (doc.coverModel) {
                case "EXPOSE": coverExpose(b); break;
                case "TP": coverTp(b); break;
                case "MEMOIRE": coverMemoire(b); break;
                default: if (hasBg()) coverSimpleBg(b); else cover(b);
            }
        }
        let bodyStart = b.length;
        labels = doc.headingLabels();
        let tocBlock = false;
        for (const x of doc.blocks) if (x.type == "TOC") tocBlock = true;
        if (doc.toc && !tocBlock) toc(b);
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
                .append(mainDone && doc.romanPrelim ? "<w:pgNumType w:start=\"1\"/>" : "")
                .append(doc.cover && !doc.pageBorder && !(mainDone && doc.romanPrelim) ? "<w:titlePg/>" : "")
                .append("</w:sectPr></w:body></w:document>");
        let out = b.toString();
        // Taille du texte choisie : tout le contenu après la page de garde
        if (doc.fontScale != 1) {
            out = out.substring(0, bodyStart) + scaleAttr(scaleAttr(out.substring(bodyStart), "<w:sz w:val=\"", doc.fontScale), "<w:szCs w:val=\"", doc.fontScale);
        }
        return out;
    }

    /** Multiplie les nombres qui suivent [key] (tailles de police). */
    function scaleAttr(xml, key, k) {
        let out = new SB();
        let i = 0;
        while (true) {
            let j = xml.indexOf(key, i);
            if (j < 0) break;
            let st = j + key.length;
            let e = st;
            let v = 0;
            while (e < xml.length && xml.charAt(e) >= '0' && xml.charAt(e) <= '9') {
                v = v * 10 + (xml.charAt(e) - '0');
                e++;
            }
            out.append(xml.substring(i, st));
            if (e > st) out.append(Math.max(1, Math.round(v * k)));
            i = e;
        }
        out.append(xml.substring(i));
        return out.toString();
    }

    // ------------------------------------------------------------ CV (4 modèles)

    function tintHex(c, t) {
        let r = (c >> 16) & 0xFF, g = (c >> 8) & 0xFF, bl = c & 0xFF;
        r = ~~(r + (255 - r) * t); g = ~~(g + (255 - g) * t); bl = ~~(bl + (255 - bl) * t);
        return hex(0xFF000000 | (r << 16) | (g << 8) | bl);
    }

    /** Taille en demi-points multipliée par la taille du texte choisie. */
    function hp(halfPts) {
        return Math.max(2, Math.round(halfPts * doc.fontScale));
    }

    /** Photo ronde (image carrée recadrée en cercle), avec un anneau facultatif. */
    function cvPhoto(img, d, ring, ringW) {
        let idx = addImage(img.data, img.type);
        let id = drawingId++;
        return "<w:r><w:drawing><wp:inline distT=\"0\" distB=\"0\" distL=\"0\" distR=\"0\"><wp:extent cx=\"" + d + "\" cy=\"" + d + "\"/>"
                + "<wp:effectExtent l=\"" + ringW + "\" t=\"" + ringW + "\" r=\"" + ringW + "\" b=\"" + ringW + "\"/><wp:docPr id=\"" + id + "\" name=\"Photo " + id + "\"/>"
                + "<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect=\"1\"/></wp:cNvGraphicFramePr>"
                + "<a:graphic><a:graphicData uri=\"http://schemas.openxmlformats.org/drawingml/2006/picture\"><pic:pic><pic:nvPicPr><pic:cNvPr id=\"" + id
                + "\" name=\"photo.jpeg\"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed=\"rIdImg" + idx + "\"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>"
                + "<pic:spPr><a:xfrm><a:off x=\"0\" y=\"0\"/><a:ext cx=\"" + d + "\" cy=\"" + d + "\"/></a:xfrm><a:prstGeom prst=\"ellipse\"><a:avLst/></a:prstGeom>"
                + (ring != null ? "<a:ln w=\"" + ringW + "\"><a:solidFill><a:srgbClr val=\"" + ring + "\"/></a:solidFill></a:ln>" : "")
                + "</pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>";
    }

    function cvPara(pPr, runs) {
        return "<w:p><w:pPr>" + pPr + bidi() + "</w:pPr>" + runs + "</w:p>";
    }

    function cvSymbol(kind) {
        if (kind.equals("mail")) return "\u2709 ";
        if (kind.equals("phone")) return "\u2706 ";
        return "\u2302 ";
    }

    /** Titre de section selon le modèle (side = barre latérale). */
    function cvTitle(label, side, first, width) {
        let model = doc.cv.model;
        let p = accent;
        if (model.equals("band")) {
            return cvPara("<w:pBdr><w:bottom w:val=\"single\" w:sz=\"6\" w:space=\"2\" w:color=\"" + p + "\"/></w:pBdr><w:keepNext/><w:spacing w:before=\"" + (first ? 120 : 280)
                    + "\" w:after=\"100\"/>", run("\u25CF  ", false, false, hp(16), p, null) + run(label, true, false, hp(25), "1F2937", null));
        }
        if (model.equals("center")) {
            let top = first ? "" : "<w:pBdr><w:top w:val=\"single\" w:sz=\"6\" w:space=\"10\" w:color=\"D1D5DB\"/></w:pBdr>";
            return cvPara(top + "<w:keepNext/><w:spacing w:before=\"" + (first ? 120 : 260) + "\" w:after=\"100\"/>",
                    "<w:r><w:rPr><w:b/><w:color w:val=\"" + p + "\"/><w:spacing w:val=\"20\"/><w:sz w:val=\"" + hp(25) + "\"/><w:szCs w:val=\"" + hp(25) + "\"/></w:rPr><w:t xml:space=\"preserve\">"
                            + esc(label) + "</w:t></w:r>");
        }
        if (model.equals("light")) {
            return cvPara("<w:shd w:val=\"clear\" w:color=\"auto\" w:fill=\"" + p + "\"/><w:keepNext/><w:spacing w:before=\"" + (first ? 120 : 300) + "\" w:after=\"100\"/><w:ind w:left=\"60\"/>",
                    run(label, true, false, hp(25), "FFFFFF", null));
        }
        let color = side ? "FFFFFF" : p;
        let line = side ? "FFFFFF" : "BDBDBD";
        return cvPara("<w:pBdr><w:bottom w:val=\"single\" w:sz=\"6\" w:space=\"2\" w:color=\"" + line + "\"/></w:pBdr><w:keepNext/><w:spacing w:before=\"" + (first ? 120 : 300) + "\" w:after=\"100\"/>",
                run(label, true, false, hp(26), color, null));
    }

    function cvBullets(list, color, dot, indent) {
        let b = new SB();
        for (const s of list) {
            b.append(cvPara("<w:spacing w:before=\"0\" w:after=\"30\"/><w:ind w:left=\"" + (indent + 220) + "\" w:hanging=\"220\"/>",
                    run("\u2022", false, false, hp(19), dot, null) + "<w:r><w:tab/></w:r>" + run(s, false, false, hp(19), color, null)));
        }
        return b.toString();
    }

    function cvEntry(e, width, indent, first, education) {
        let b = new SB();
        let model = doc.cv.model;
        let ind = indent > 0 ? "<w:ind w:left=\"" + indent + "\"/>" : "";
        if (model.equals("band")) {
            if (!e.period.isEmpty()) b.append(cvPara("<w:keepNext/><w:spacing w:before=\"" + (first ? 80 : 200) + "\" w:after=\"0\"/>" + ind, run(e.period, false, false, hp(17), "6B7280", null)));
            b.append(cvPara("<w:keepNext/><w:spacing w:before=\"" + (e.period.isEmpty() ? (first ? 80 : 200) : 0) + "\" w:after=\"40\"/>" + ind,
                    run(e.title, true, false, hp(21), "1F2937", null) + (e.org.isEmpty() ? "" : run(" \u2013 " + e.org, false, false, hp(21), "6B7280", null))));
        } else {
            let boldPeriod = model.equals("center");
            b.append(cvPara("<w:keepNext/><w:tabs><w:tab w:val=\"right\" w:pos=\"" + width + "\"/></w:tabs><w:spacing w:before=\"" + (first ? 80 : 200) + "\" w:after=\"0\"/>" + ind,
                    run(e.title, true, false, hp(21), "1F2937", null) + (e.period.isEmpty() ? "" : "<w:r><w:tab/></w:r>" + run(e.period, boldPeriod, false, hp(19), boldPeriod ? "1F2937" : "6B7280", null))));
            if (!e.org.isEmpty()) b.append(cvPara("<w:keepNext/><w:spacing w:before=\"0\" w:after=\"40\"/>" + ind, run(e.org, false, false, hp(19), "6B7280", null)));
        }
        if (education && !e.details.isEmpty()) b.append(cvPara("<w:spacing w:before=\"0\" w:after=\"40\"/>" + ind, run(e.details, false, false, hp(19), "6B7280", null)));
        b.append(cvBullets(e.bullets, "1F2937", "1F2937", indent));
        return b.toString();
    }

    /** Liste sur 3 colonnes (modèle centré). */
    function cvGrid(list, width) {
        let col = ~~(width / 3.0);
        let t = new SB("<w:tbl><w:tblPr><w:tblW w:w=\"" + width + "\" w:type=\"dxa\"/><w:tblBorders><w:top w:val=\"nil\"/><w:left w:val=\"nil\"/>"
                + "<w:bottom w:val=\"nil\"/><w:right w:val=\"nil\"/><w:insideH w:val=\"nil\"/><w:insideV w:val=\"nil\"/></w:tblBorders><w:tblLayout w:type=\"fixed\"/>"
                + "<w:tblCellMar><w:left w:w=\"0\" w:type=\"dxa\"/><w:right w:w=\"80\" w:type=\"dxa\"/></w:tblCellMar></w:tblPr><w:tblGrid>");
        for (let i = 0; i < 3; i++) t.append("<w:gridCol w:w=\"").append(col).append("\"/>");
        t.append("</w:tblGrid>");
        for (let i = 0; i < list.length; i += 3) {
            t.append("<w:tr>");
            for (let k = 0; k < 3; k++) {
                let s = i + k < list.length ? list.get(i + k) : "";
                t.append("<w:tc><w:tcPr><w:tcW w:w=\"").append(col).append("\" w:type=\"dxa\"/></w:tcPr>")
                        .append(s.isEmpty() ? "<w:p/>" : cvPara("<w:spacing w:before=\"0\" w:after=\"30\"/><w:ind w:left=\"220\" w:hanging=\"220\"/>",
                                run("\u2022", false, false, hp(19), "1F2937", null) + "<w:r><w:tab/></w:r>" + run(s, false, false, hp(19), "1F2937", null)))
                        .append("</w:tc>");
            }
            t.append("</w:tr>");
        }
        return t.append("</w:tbl>").toString();
    }

    function cvContactsLine(color, center) {
        let r = new SB();
        let cv = doc.cv;
        for (let i = 0; i < cv.contacts.length; i++) {
            let ct = cv.contacts.get(i);
            if (i > 0) r.append(run("     ", false, false, hp(18), color, null));
            r.append(run(cvSymbol(ct[0]), false, false, hp(18), accent, null)).append(run(ct[1], false, false, hp(18), color, null));
        }
        return r.toString();
    }

    /** Colonne d'une rubrique de CV (modèles à barre latérale) : celle calculée pour le PDF (cv.place), sinon la place habituelle. */
    function cvWhere(sec) {
        let cv = doc.cv;
        let def = { profile: "main", education: "main", skills: "side", languages: "side", interests: "side", references: "main" };
        return (cv.place && cv.place[sec]) || def[sec];
    }

    /** Colonne principale : mêmes rubriques et même ordre que le PDF (export/cv.js). */
    function cvMain(width, indent, firstStart) {
        let b = new SB();
        let cv = doc.cv;
        let model = cv.model;
        let sidebar = model.equals("dark") || model.equals("light");
        let first = firstStart;
        let ind = indent > 0 ? "<w:ind w:left=\"" + indent + "\"/>" : "";
        let cw = width - indent;
        let here = (sec) => !sidebar || cvWhere(sec) === "main";
        let para = (text) => cvPara("<w:spacing w:before=\"40\" w:after=\"60\"/>" + ind, run(text, false, false, hp(19), "1F2937", null));
        let list = (label, items) => {
            if (items.isEmpty()) return;
            b.append(cvTitle(label, false, first, width)); first = false;
            if (model.equals("center")) b.append(cvGrid(items, cw));
            else b.append(para(items.join("   |   ")));
        };
        if (!cv.profile.isEmpty() && here("profile")) { b.append(cvTitle(cv.lProfile, false, first, width)); first = false; b.append(para(cv.profile)); }
        if (!sidebar) list(cv.lSkills, cv.skills);
        if (!cv.experience.isEmpty()) {
            b.append(cvTitle(cv.lExperience, false, first, width)); first = false;
            for (let i = 0; i < cv.experience.length; i++) b.append(cvEntry(cv.experience.get(i), width, indent, i == 0, false));
        }
        if (!cv.education.isEmpty() && here("education")) {
            b.append(cvTitle(cv.lEducation, false, first, width)); first = false;
            for (let i = 0; i < cv.education.length; i++) b.append(cvEntry(cv.education.get(i), width, indent, i == 0, true));
        }
        if (sidebar && here("skills")) list(cv.lSkills, cv.skills);
        if (here("languages")) list(cv.lLanguages, cv.languages);
        if (here("interests")) list(cv.lInterests, cv.interests);
        if (!cv.references.isEmpty() && here("references")) {
            b.append(cvTitle(cv.lReferences, false, first, width));
            b.append(para(cv.references));
        }
        return b.toString();
    }

    /** Colonne de côté : photo, coordonnées, puis les rubriques placées sur le côté (même ordre que le PDF). */
    function cvSide(width) {
        let b = new SB();
        let cv = doc.cv;
        let dark = cv.model.equals("dark");
        let ink = dark ? "FFFFFF" : "1F2937";
        let soft = dark ? "DDE4F0" : "6B7280";
        let dot = dark ? "FFFFFF" : accent;
        if (cv.photo != null) {
            b.append(cvPara("<w:jc w:val=\"center\"/><w:spacing w:before=\"0\" w:after=\"200\"/>", cvPhoto(cv.photo, 1500000, dark ? "FFFFFF" : null, dark ? 57150 : 0)));
        }
        let first = cv.photo == null;
        if (!cv.contacts.isEmpty()) {
            b.append(cvTitle(cv.lContact, true, first, width)); first = false;
            for (const ct of cv.contacts) {
                b.append(cvPara("<w:spacing w:before=\"0\" w:after=\"40\"/>", run(cvSymbol(ct[0]), false, false, hp(18), dark ? "FFFFFF" : accent, null) + run(ct[1], false, false, hp(18), ink, null)));
            }
        }
        let text = (t, size, color, bold, before) => cvPara("<w:spacing w:before=\"" + before + "\" w:after=\"20\"/>", run(t, bold, false, hp(size), color, null));
        for (const sec of ["profile", "education", "skills", "languages", "interests", "references"]) {
            if (cvWhere(sec) !== "side") continue;
            if (sec === "profile" || sec === "references") {
                if (cv[sec].isEmpty()) continue;
                b.append(cvTitle(sec === "profile" ? cv.lProfile : cv.lReferences, true, first, width)); first = false;
                b.append(text(cv[sec], 19, ink, false, 40));
            } else if (sec === "education") {
                if (cv.education.isEmpty()) continue;
                b.append(cvTitle(cv.lEducation, true, first, width)); first = false;
                for (let i = 0; i < cv.education.length; i++) {
                    let e = cv.education.get(i);
                    b.append(text(e.title, 20, ink, true, i == 0 ? 60 : 160));
                    if (!e.org.isEmpty()) b.append(text(e.org, 18, soft, false, 0));
                    if (!e.period.isEmpty()) b.append(text(e.period, 18, soft, false, 0));
                    if (!e.details.isEmpty()) b.append(text(e.details, 18, soft, false, 0));
                    if (!e.bullets.isEmpty()) b.append(cvBullets(e.bullets, ink, dot, 0));
                }
            } else {
                let items = cv[sec];
                if (items.isEmpty()) continue;
                let label = sec === "skills" ? cv.lSkills : sec === "languages" ? cv.lLanguages : cv.lInterests;
                b.append(cvTitle(label, true, first, width)); first = false;
                b.append(cvBullets(items, ink, dot, 0));
            }
        }
        return b.toString();
    }

    function cvBody(b) {
        let cv = doc.cv;
        let model = cv.model;
        let nameFont = headFont;
        let pageW = 11906, pageH = 16838;
        if (model.equals("dark") || model.equals("light")) {
            let sw = ~~(pageW * 0.35), mw = pageW - sw;
            let sideBg = model.equals("dark") ? accent : tintHex(doc.theme.primary, 0.95);
            let sideIn = sw - 400 - 300, mainIn = mw - 440 - 560;
            let main = new SB();
            main.append(cvPara("<w:spacing w:before=\"0\" w:after=\"0\" w:line=\"240\" w:lineRule=\"auto\"/>", run(cv.name, true, false, hp(50), "1F2937", nameFont)));
            if (!cv.job.isEmpty()) main.append(cvPara("<w:spacing w:before=\"60\" w:after=\"120\"/>", run(cv.job, false, false, hp(27), "4B5563", null)));
            main.append(cvMain(mainIn, 0, false));
            b.append("<w:tbl><w:tblPr><w:tblW w:w=\"").append(pageW).append("\" w:type=\"dxa\"/>").append(doc.rtl ? "<w:bidiVisual/>" : "")
                    .append("<w:tblBorders><w:top w:val=\"nil\"/><w:left w:val=\"nil\"/><w:bottom w:val=\"nil\"/><w:right w:val=\"nil\"/><w:insideH w:val=\"nil\"/><w:insideV w:val=\"nil\"/></w:tblBorders>")
                    .append("<w:tblLayout w:type=\"fixed\"/><w:tblCellMar><w:left w:w=\"0\" w:type=\"dxa\"/><w:right w:w=\"0\" w:type=\"dxa\"/></w:tblCellMar></w:tblPr>")
                    .append("<w:tblGrid><w:gridCol w:w=\"").append(sw).append("\"/><w:gridCol w:w=\"").append(mw).append("\"/></w:tblGrid>")
                    .append("<w:tr><w:trPr><w:trHeight w:val=\"").append(pageH - 120).append("\" w:hRule=\"atLeast\"/></w:trPr>")
                    .append("<w:tc><w:tcPr><w:tcW w:w=\"").append(sw).append("\" w:type=\"dxa\"/><w:shd w:val=\"clear\" w:color=\"auto\" w:fill=\"").append(sideBg).append("\"/>")
                    .append("<w:tcMar><w:top w:w=\"560\" w:type=\"dxa\"/><w:left w:w=\"400\" w:type=\"dxa\"/><w:right w:w=\"300\" w:type=\"dxa\"/></w:tcMar></w:tcPr>")
                    .append(cvSide(sideIn)).append("</w:tc>")
                    .append("<w:tc><w:tcPr><w:tcW w:w=\"").append(mw).append("\" w:type=\"dxa\"/>")
                    .append("<w:tcMar><w:top w:w=\"720\" w:type=\"dxa\"/><w:left w:w=\"440\" w:type=\"dxa\"/><w:right w:w=\"560\" w:type=\"dxa\"/></w:tcMar></w:tcPr>")
                    .append(main).append("</w:tc></w:tr></w:tbl>")
                    .append("<w:p><w:pPr><w:spacing w:before=\"0\" w:after=\"0\" w:line=\"20\" w:lineRule=\"exact\"/></w:pPr></w:p>");
            b.append("<w:sectPr><w:pgSz w:w=\"").append(pageW).append("\" w:h=\"").append(pageH).append("\"/>")
                    .append("<w:pgMar w:top=\"0\" w:right=\"0\" w:bottom=\"0\" w:left=\"0\" w:header=\"0\" w:footer=\"0\" w:gutter=\"0\"/></w:sectPr></w:body></w:document>");
            return;
        }
        let m = 851, width = pageW - 2 * m;
        if (model.equals("band")) {
            let bg = tintHex(doc.theme.primary, 0.94);
            let ph = cv.photo != null;
            let pc = ph ? 2000 : 0, tc = width - pc;
            let text = new SB();
            text.append(cvPara("<w:spacing w:before=\"0\" w:after=\"0\"/>", run(cv.name, true, false, hp(44), "1F2937", nameFont)));
            if (!cv.job.isEmpty()) text.append(cvPara("<w:spacing w:before=\"40\" w:after=\"80\"/>", run(cv.job, false, false, hp(24), "4B5563", null)));
            if (!cv.contacts.isEmpty()) text.append(cvPara("<w:pBdr><w:top w:val=\"single\" w:sz=\"6\" w:space=\"6\" w:color=\"" + accent + "\"/></w:pBdr><w:spacing w:before=\"60\" w:after=\"0\"/>", cvContactsLine("1F2937", false)));
            b.append("<w:tbl><w:tblPr><w:tblW w:w=\"").append(width).append("\" w:type=\"dxa\"/>").append(doc.rtl ? "<w:bidiVisual/>" : "")
                    .append("<w:tblBorders><w:top w:val=\"nil\"/><w:left w:val=\"nil\"/><w:bottom w:val=\"nil\"/><w:right w:val=\"nil\"/><w:insideH w:val=\"nil\"/><w:insideV w:val=\"nil\"/></w:tblBorders>")
                    .append("<w:tblLayout w:type=\"fixed\"/><w:tblCellMar><w:top w:w=\"360\" w:type=\"dxa\"/><w:left w:w=\"240\" w:type=\"dxa\"/><w:bottom w:w=\"360\" w:type=\"dxa\"/><w:right w:w=\"240\" w:type=\"dxa\"/></w:tblCellMar></w:tblPr><w:tblGrid>");
            if (ph) b.append("<w:gridCol w:w=\"").append(pc).append("\"/>");
            b.append("<w:gridCol w:w=\"").append(tc).append("\"/></w:tblGrid><w:tr>");
            if (ph) {
                b.append("<w:tc><w:tcPr><w:tcW w:w=\"").append(pc).append("\" w:type=\"dxa\"/><w:shd w:val=\"clear\" w:color=\"auto\" w:fill=\"").append(bg).append("\"/><w:vAlign w:val=\"center\"/></w:tcPr>")
                        .append(cvPara("<w:jc w:val=\"center\"/><w:spacing w:before=\"0\" w:after=\"0\"/>", cvPhoto(cv.photo, 1150000, accent, 19050))).append("</w:tc>");
            }
            b.append("<w:tc><w:tcPr><w:tcW w:w=\"").append(tc).append("\" w:type=\"dxa\"/><w:shd w:val=\"clear\" w:color=\"auto\" w:fill=\"").append(bg).append("\"/><w:vAlign w:val=\"center\"/></w:tcPr>")
                    .append(text).append("</w:tc></w:tr></w:tbl>");
            b.append(cvMain(width, 284, true));
        } else {
            if (cv.photo != null) b.append(cvPara("<w:jc w:val=\"center\"/><w:spacing w:before=\"0\" w:after=\"120\"/>", cvPhoto(cv.photo, 1060000, null, 0)));
            b.append(cvPara("<w:jc w:val=\"center\"/><w:spacing w:before=\"0\" w:after=\"0\"/>", run(cv.name, true, false, hp(52), "1F2937", nameFont)));
            if (!cv.job.isEmpty()) b.append(cvPara("<w:jc w:val=\"center\"/><w:spacing w:before=\"40\" w:after=\"80\"/>", run(cv.job, false, false, hp(27), "4B5563", null)));
            if (!cv.contacts.isEmpty()) b.append(cvPara("<w:jc w:val=\"center\"/><w:spacing w:before=\"60\" w:after=\"0\"/>", cvContactsLine("374151", true)));
            b.append(cvPara("<w:pBdr><w:bottom w:val=\"single\" w:sz=\"6\" w:space=\"1\" w:color=\"D1D5DB\"/></w:pBdr><w:spacing w:before=\"0\" w:after=\"120\"/>", ""));
            b.append(cvMain(width, 0, true));
        }
        b.append("<w:sectPr><w:pgSz w:w=\"").append(pageW).append("\" w:h=\"").append(pageH).append("\"/>")
                .append("<w:pgMar w:top=\"").append(model.equals("band") ? 567 : 851).append("\" w:right=\"").append(m).append("\" w:bottom=\"851\" w:left=\"").append(m)
                .append("\" w:header=\"0\" w:footer=\"0\" w:gutter=\"0\"/></w:sectPr></w:body></w:document>");
    }

    /** Le corps du mémoire a commencé (fin des pages préliminaires). */
    let mainDone = false;

    /** Fin des pages préliminaires : section numérotée i, ii, iii… puis le corps repart à 1. */
    function mainStart(b) {
        mainDone = true;
        if (!doc.romanPrelim) { if (!atPageStart(b)) b.append("<w:p><w:r><w:br w:type=\"page\"/></w:r></w:p>"); return; }
        let pb = "<w:p><w:r><w:br w:type=\"page\"/></w:r></w:p>";
        if (endsWith(b, pb)) b.setLength(b.length - pb.length);
        b.append("<w:p><w:pPr><w:sectPr>").append(doc.theme.runningHeader ? "<w:headerReference w:type=\"default\" r:id=\"rIdHeader\"/>" : "")
                .append("<w:footerReference w:type=\"default\" r:id=\"rIdFooter\"/>").append(pageSize())
                .append("<w:pgNumType w:fmt=\"lowerRoman\" w:start=\"1\"/>")
                .append(doc.cover && !doc.pageBorder ? "<w:titlePg/>" : "").append("</w:sectPr></w:pPr></w:p>");
    }

    /** Modèle « mémoire » : en-tête bilingue + logo, diplôme, thème encadré, auteur, direction, jury, année. */
    function coverMemoire(b) {
        b.append(backgroundParagraph());
        let side = ~~(textWidth * 0.38), mid = textWidth - 2 * side;
        b.append(noBorderTable([side, mid, side]));
        let logo = doc.logoLeft != null ? doc.logoLeft : doc.logoRight;
        b.append("<w:tr>").append(cell(side, headerColumn(doc.headerLeft, 17), "top"))
                .append(cell(mid, logoParagraph(logo, 1150000, 1150000), "center"))
                .append(cell(side, headerColumn(doc.headerRight, 17), "top")).append("</w:tr></w:tbl>");
        let c = new SB();
        for (const l of docLines(doc.institution)) {
            c.append("<w:p><w:pPr><w:spacing w:after=\"40\"/><w:jc w:val=\"center\"/></w:pPr>").append(run(l.toUpperCase(), true, false, 22, null, TNR)).append("</w:p>");
        }
        let first = true;
        for (const l of docLines(doc.extra)) {
            c.append("<w:p><w:pPr><w:spacing w:before=\"").append(first ? 280 : 0).append("\" w:after=\"40\"/><w:jc w:val=\"center\"/></w:pPr>")
                    .append(run(l, false, true, 24, null, TNR)).append("</w:p>");
            first = false;
        }
        if (c.length > 0) b.append(hasBg() ? whiteCard(c.toString(), 0.94) : c.toString());
        b.append("<w:p><w:pPr><w:spacing w:before=\"280\" w:after=\"0\"/></w:pPr></w:p>");
        let ti = "<w:p><w:pPr><w:spacing w:before=\"0\" w:after=\"120\"/><w:jc w:val=\"center\"/></w:pPr>" + runU(doc.themeLabel, true, 20, TNR) + "</w:p>"
                + "<w:p><w:pPr><w:spacing w:after=\"0\"/><w:jc w:val=\"center\"/></w:pPr>" + run(doc.title.toUpperCase(), true, false, 30, accent, headFont) + "</w:p>";
        b.append(cartouche(ti, 0.9));
        let pc = new SB();
        let people = docLines(doc.author);
        if (!people.isEmpty()) {
            pc.append("<w:p><w:pPr><w:spacing w:before=\"0\" w:after=\"80\"/><w:jc w:val=\"center\"/></w:pPr>").append(runU(doc.participantsLabel, true, 22, TNR)).append("</w:p>");
            for (let i = 0; i < people.length; i++) {
                pc.append("<w:p><w:pPr><w:spacing w:after=\"20\"/><w:jc w:val=\"center\"/></w:pPr>")
                        .append(run(i == 0 ? people.get(i).toUpperCase() : people.get(i), i == 0, false, i == 0 ? 26 : 22, null, TNR)).append("</w:p>");
            }
        }
        let sups = docLines(doc.supervision);
        if (!sups.isEmpty()) {
            pc.append("<w:p><w:pPr><w:spacing w:before=\"240\" w:after=\"80\"/><w:jc w:val=\"center\"/></w:pPr>").append(runU(doc.supervisionLabel, true, 22, TNR)).append("</w:p>");
            for (let i = 0; i < sups.length; i++) {
                pc.append("<w:p><w:pPr><w:spacing w:after=\"20\"/><w:jc w:val=\"center\"/></w:pPr>").append(run(sups.get(i), i == 0, false, 22, null, TNR)).append("</w:p>");
            }
        }
        let jury = docLines(doc.infoLines);
        if (!jury.isEmpty()) {
            pc.append("<w:p><w:pPr><w:spacing w:before=\"240\" w:after=\"80\"/><w:jc w:val=\"center\"/></w:pPr>").append(runU(doc.membersLabel, true, 21, TNR)).append("</w:p>");
            for (const j of jury) {
                let k = j.indexOf(':');
                let role = k > 0 ? j.substring(0, k).trim() + " :" : "";
                let name = k > 0 ? j.substring(k + 1).trim() : j.trim();
                pc.append("<w:p><w:pPr><w:tabs><w:tab w:val=\"left\" w:pos=\"3600\"/></w:tabs><w:spacing w:after=\"20\"/><w:ind w:left=\"1134\"/></w:pPr>")
                        .append(run(role, true, false, 21, null, TNR)).append("<w:r><w:tab/></w:r>").append(run(name, false, false, 21, null, TNR)).append("</w:p>");
            }
        }
        if (!doc.group.isEmpty()) {
            pc.append("<w:p><w:pPr><w:spacing w:before=\"200\" w:after=\"0\"/><w:jc w:val=\"center\"/></w:pPr>").append(run(doc.group, false, true, 21, null, TNR)).append("</w:p>");
        }
        if (pc.length > 0) {
            b.append("<w:p><w:pPr><w:spacing w:before=\"360\" w:after=\"0\"/></w:pPr></w:p>");
            b.append(hasBg() ? whiteCard(pc.toString(), 0.94) : pc.toString());
        }
        if (!doc.date.isEmpty()) {
            b.append("<w:p><w:pPr><w:spacing w:before=\"480\" w:after=\"0\"/><w:jc w:val=\"center\"/></w:pPr>")
                    .append(run(doc.yearLabel + " : " + doc.date, true, false, 24, null, TNR)).append("</w:p>");
        }
        coverEnd(b);
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
        coverEnd(b);
    }

    // ------------------------------------------------------------ Couvertures officielles

    let TNR = "Times New Roman";

    /** Cellule de tableau sans bordure. */
    /** Fin de la page de garde : saut de page, ou section à part quand elle a sa bordure. */
    function coverEnd(b) {
        if (!doc.pageBorder) { b.append("<w:p><w:r><w:br w:type=\"page\"/></w:r></w:p>"); return; }
        b.append("<w:p><w:pPr><w:sectPr>").append(pageSize()).append(pageBorders()).append("</w:sectPr></w:pPr></w:p>");
    }

    function pageSize() {
        let w = doc.landscape ? 16838 : 11906, h = doc.landscape ? 11906 : 16838;
        let m = doc.landscape ? 1134 : 1418;
        return "<w:pgSz w:w=\"" + w + "\" w:h=\"" + h + "\"" + (doc.landscape ? " w:orient=\"landscape\"" : "") + "/>"
                + "<w:pgMar w:top=\"" + m + "\" w:right=\"" + m + "\" w:bottom=\"" + m + "\" w:left=\"" + m + "\" w:header=\"708\" w:footer=\"708\" w:gutter=\"0\"/>";
    }

    function pageBorders() {
        let bd = "w:val=\"thinThickSmallGap\" w:sz=\"24\" w:space=\"24\" w:color=\"" + accent + "\"";
        return "<w:pgBorders w:offsetFrom=\"page\"><w:top " + bd + "/><w:left " + bd + "/><w:bottom " + bd + "/><w:right " + bd + "/></w:pgBorders>";
    }

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
        let cx = ~~(doc.landscape ? 16838 : 11906) * 635;
        let cy = ~~(doc.landscape ? 11906 : 16838) * 635;
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

    /** Tableau NOM | PRÉNOM | MATRICULE de la couverture (colonnes choisies par l'utilisateur). */
    function membersTable(widthRatio) {
        let cols = doc.memberHeader.length;
        if (cols == 0 || doc.members.isEmpty()) return "";
        let w = ~~(textWidth * widthRatio), colW = Math.floor(w / cols);
        let bd = "w:val=\"single\" w:sz=\"6\" w:space=\"0\" w:color=\"000000\"";
        let t = new SB("<w:tbl><w:tblPr><w:tblW w:w=\"" + w + "\" w:type=\"dxa\"/><w:jc w:val=\"center\"/>"
                + (doc.rtl ? "<w:bidiVisual/>" : "") + "<w:tblBorders><w:top " + bd + "/><w:left " + bd + "/><w:bottom " + bd + "/><w:right " + bd
                + "/><w:insideH " + bd + "/><w:insideV " + bd + "/></w:tblBorders><w:tblLayout w:type=\"fixed\"/><w:tblCellMar><w:top w:w=\"30\" w:type=\"dxa\"/>"
                + "<w:left w:w=\"100\" w:type=\"dxa\"/><w:bottom w:w=\"30\" w:type=\"dxa\"/><w:right w:w=\"100\" w:type=\"dxa\"/></w:tblCellMar></w:tblPr><w:tblGrid>");
        for (let i = 0; i < cols; i++) t.append("<w:gridCol w:w=\"").append(colW).append("\"/>");
        t.append("</w:tblGrid><w:tr>");
        for (const h of doc.memberHeader) {
            t.append("<w:tc><w:tcPr><w:tcW w:w=\"").append(colW).append("\" w:type=\"dxa\"/><w:shd w:val=\"clear\" w:color=\"auto\" w:fill=\"")
                    .append(light).append("\"/></w:tcPr><w:p><w:pPr><w:spacing w:after=\"0\"/><w:jc w:val=\"center\"/></w:pPr>")
                    .append(run(h, true, false, 22, null, TNR)).append("</w:p></w:tc>");
        }
        t.append("</w:tr>");
        for (const r of doc.members) {
            t.append("<w:tr>");
            for (let i = 0; i < cols; i++) {
                let v = i < r.length ? r.get(i) : "";
                t.append("<w:tc><w:tcPr><w:tcW w:w=\"").append(colW).append("\" w:type=\"dxa\"/><w:shd w:val=\"clear\" w:color=\"auto\" w:fill=\"FFFFFF\"/></w:tcPr>")
                        .append("<w:p><w:pPr><w:spacing w:after=\"0\"/>").append(i == 0 ? "" : "<w:jc w:val=\"center\"/>").append("</w:pPr>")
                        .append(run(v, false, false, 22, null, TNR)).append("</w:p></w:tc>");
            }
            t.append("</w:tr>");
        }
        return t.append("</w:tbl>").toString();
    }

    /** Deux cadres vides « Note finale » et « Observation » pour l'enseignant. */
    function gradeBoxes() {
        let gap = 600, box = Math.floor((textWidth - gap) / 2);
        let bd = "w:val=\"single\" w:sz=\"8\" w:space=\"0\" w:color=\"000000\"";
        let none = "<w:tcBorders><w:top w:val=\"nil\"/><w:left w:val=\"nil\"/><w:bottom w:val=\"nil\"/><w:right w:val=\"nil\"/></w:tcBorders>";
        let boxed = "<w:tcBorders><w:top " + bd + "/><w:left " + bd + "/><w:bottom " + bd + "/><w:right " + bd + "/></w:tcBorders><w:shd w:val=\"clear\" w:color=\"auto\" w:fill=\"FFFFFF\"/>";
        let t = new SB(noBorderTable([box, gap, box]));
        t.append("<w:tr>")
                .append("<w:tc><w:tcPr><w:tcW w:w=\"").append(box).append("\" w:type=\"dxa\"/>").append(none).append("</w:tcPr><w:p><w:pPr><w:spacing w:after=\"60\"/></w:pPr>")
                .append(run(doc.gradeLabel, false, false, 22, null, TNR)).append("</w:p></w:tc>")
                .append("<w:tc><w:tcPr><w:tcW w:w=\"").append(gap).append("\" w:type=\"dxa\"/>").append(none).append("</w:tcPr><w:p/></w:tc>")
                .append("<w:tc><w:tcPr><w:tcW w:w=\"").append(box).append("\" w:type=\"dxa\"/>").append(none).append("</w:tcPr><w:p><w:pPr><w:spacing w:after=\"60\"/><w:jc w:val=\"right\"/></w:pPr>")
                .append(run(doc.observationLabel, false, false, 22, null, TNR)).append("</w:p></w:tc></w:tr>");
        t.append("<w:tr><w:trPr><w:trHeight w:val=\"1600\" w:hRule=\"exact\"/></w:trPr>")
                .append("<w:tc><w:tcPr><w:tcW w:w=\"").append(box).append("\" w:type=\"dxa\"/>").append(boxed).append("</w:tcPr><w:p/></w:tc>")
                .append("<w:tc><w:tcPr><w:tcW w:w=\"").append(gap).append("\" w:type=\"dxa\"/>").append(none).append("</w:tcPr><w:p/></w:tc>")
                .append("<w:tc><w:tcPr><w:tcW w:w=\"").append(box).append("\" w:type=\"dxa\"/>").append(boxed).append("</w:tcPr><w:p/></w:tc></w:tr></w:tbl>");
        return t.toString();
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
        coverEnd(b);
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
        if (!doc.members.isEmpty() && !doc.memberHeader.isEmpty()) {
            pc.append("<w:p><w:pPr><w:spacing w:before=\"0\" w:after=\"160\"/></w:pPr>")
                    .append(runU(doc.participantsLabel, true, 22, TNR)).append("</w:p>")
                    .append(membersTable(hasBg() ? 0.92 : 1.0)).append("<w:p><w:pPr><w:spacing w:after=\"0\"/></w:pPr></w:p>");
        } else if (!people.isEmpty()) {
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
        coverEnd(b);
    }

    /** Modèle « TP » : en-tête bilingue + logo, ruban (matière, créneau, titre, date), membres, examinateur, cadres de note, année. */
    function coverTp(b) {
        b.append(backgroundParagraph());
        let side = ~~(textWidth * 0.38), mid = textWidth - 2 * side;
        b.append(noBorderTable([side, mid, side]));
        let logo = doc.logoLeft != null ? doc.logoLeft : doc.logoRight;
        b.append("<w:tr>").append(cell(side, headerColumn(doc.headerLeft, 17), "top"))
                .append(cell(mid, logoParagraph(logo, 1250000, 1300000), "center"))
                .append(cell(side, headerColumn(doc.headerRight, 17), "top")).append("</w:tr></w:tbl>");
        let lab = new SB();
        for (const l of docLines(doc.institution)) {
            lab.append("<w:p><w:pPr><w:spacing w:after=\"40\"/><w:jc w:val=\"center\"/></w:pPr>").append(run(l.toUpperCase(), true, false, 22, null, TNR)).append("</w:p>");
        }
        if (lab.length > 0) {
            b.append("<w:p><w:pPr><w:spacing w:before=\"160\" w:after=\"0\"/></w:pPr></w:p>");
            b.append(hasBg() ? whiteCard(lab.toString(), 0.9) : lab.toString());
        }
        b.append("<w:p><w:pPr><w:spacing w:before=\"240\" w:after=\"0\"/></w:pPr></w:p>");
        // Ruban du titre
        let banner = docLines(doc.banner);
        if (banner.isEmpty()) {
            if (!doc.subtitle.isEmpty()) banner.add(doc.subtitle);
            if (!doc.title.isEmpty()) banner.add(doc.title);
        }
        let fill = doc.theme.id.equals("modern") ? "1F5F7F" : accent;
        let w = ~~(textWidth * 0.82);
        let bd = "w:val=\"single\" w:sz=\"18\" w:space=\"0\" w:color=\"" + (doc.theme.id.equals("modern") ? "0E3B50" : light) + "\"";
        b.append("<w:tbl><w:tblPr><w:tblW w:w=\"").append(w).append("\" w:type=\"dxa\"/><w:jc w:val=\"center\"/><w:tblBorders>")
                .append("<w:top ").append(bd).append("/><w:left ").append(bd).append("/><w:bottom ").append(bd).append("/><w:right ").append(bd).append("/>")
                .append("</w:tblBorders><w:tblCellMar><w:top w:w=\"200\" w:type=\"dxa\"/><w:left w:w=\"200\" w:type=\"dxa\"/><w:bottom w:w=\"200\" w:type=\"dxa\"/><w:right w:w=\"200\" w:type=\"dxa\"/></w:tblCellMar></w:tblPr>")
                .append("<w:tblGrid><w:gridCol w:w=\"").append(w).append("\"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w=\"").append(w)
                .append("\" w:type=\"dxa\"/><w:shd w:val=\"clear\" w:color=\"auto\" w:fill=\"").append(fill).append("\"/></w:tcPr>");
        for (let i = 0; i < banner.length; i++) {
            b.append("<w:p><w:pPr><w:spacing w:before=\"60\" w:after=\"60\"/><w:jc w:val=\"center\"/></w:pPr>")
                    .append(run(banner.get(i).toUpperCase(), true, false, 28, "FFFFFF", TNR, true)).append("</w:p>");
        }
        if (banner.isEmpty()) b.append("<w:p/>");
        b.append("</w:tc></w:tr></w:tbl>");
        if (!doc.group.isEmpty()) {
            let g = "<w:p><w:pPr><w:spacing w:before=\"0\" w:after=\"0\"/><w:jc w:val=\"center\"/></w:pPr>" + run(doc.group.toUpperCase(), true, false, 24, null, TNR) + "</w:p>";
            b.append("<w:p><w:pPr><w:spacing w:before=\"200\" w:after=\"0\"/></w:pPr></w:p>");
            b.append(hasBg() ? whiteCard(g, 0.6) : g);
        }
        // Membres du groupe
        let m = new SB();
        if (!doc.members.isEmpty() && !doc.memberHeader.isEmpty()) {
            m.append("<w:p><w:pPr><w:spacing w:before=\"0\" w:after=\"120\"/><w:jc w:val=\"center\"/></w:pPr>")
                    .append(run(doc.membersLabel, true, false, 22, null, TNR)).append("</w:p>").append(membersTable(hasBg() ? 0.92 : 1.0))
                    .append("<w:p><w:pPr><w:spacing w:after=\"0\"/></w:pPr></w:p>");
        }
        for (const l of docLines(doc.infoLines)) {
            m.append("<w:p><w:pPr><w:spacing w:after=\"100\"/></w:pPr>").append(run(l.toUpperCase(), true, false, 22, null, TNR)).append("</w:p>");
        }
        if (!doc.supervision.isEmpty()) {
            m.append("<w:p><w:pPr><w:spacing w:before=\"200\" w:after=\"0\"/><w:jc w:val=\"center\"/></w:pPr>")
                    .append(run(doc.supervisionLabel + " : ", false, false, 26, null, TNR))
                    .append(run(docLines(doc.supervision).join(", "), true, false, 26, null, TNR)).append("</w:p>");
        }
        for (const l of docLines(doc.extra)) {
            m.append("<w:p><w:pPr><w:spacing w:before=\"120\" w:after=\"0\"/><w:jc w:val=\"center\"/></w:pPr>").append(run(l, true, false, 22, null, TNR)).append("</w:p>");
        }
        if (m.length > 0) {
            b.append("<w:p><w:pPr><w:spacing w:before=\"240\" w:after=\"0\"/></w:pPr></w:p>");
            b.append(hasBg() ? whiteCard(m.toString(), 0.95) : m.toString());
        }
        if (doc.gradeBoxes) {
            b.append("<w:p><w:pPr><w:spacing w:before=\"240\" w:after=\"0\"/></w:pPr></w:p>");
            b.append(gradeBoxes());
        }
        if (!doc.date.isEmpty()) {
            b.append("<w:p><w:pPr><w:spacing w:before=\"").append(doc.gradeBoxes ? 240 : 900).append("\" w:after=\"0\"/>")
                    .append(hasBg() ? "<w:shd w:val=\"clear\" w:color=\"auto\" w:fill=\"FFFFFF\"/>" : "").append("<w:jc w:val=\"right\"/></w:pPr>")
                    .append(run(doc.yearLabel + " : " + doc.date, true, false, 24, null, TNR)).append("</w:p>");
        }
        coverEnd(b);
    }

    /** Page « Plan de travail ». */
    function toc(b) {
        b.append("<w:p><w:pPr><w:spacing w:after=\"360\"/>").append(bidi()).append("</w:pPr>").append(run(doc.tocTitle, true, false, 24, null, headFont)).append("</w:p>");
        // Vrai sommaire Word : mis à jour avec les numéros de page à l'ouverture (la liste sert de résultat provisoire)
        b.append("<w:p><w:pPr><w:spacing w:after=\"0\"/></w:pPr><w:r><w:fldChar w:fldCharType=\"begin\" w:dirty=\"true\"/></w:r>")
                .append("<w:r><w:instrText xml:space=\"preserve\"> TOC \\o \"1-2\" \\h \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType=\"separate\"/></w:r></w:p>");
        for (let i = 0; i < doc.blocks.length; i++) {
            let blk = doc.blocks.get(i);
            if (blk.type != "HEADING" || blk.level < 1 || blk.level > 2) continue;
            let label = labels.get(i) == null ? blk.text : labels.get(i);
            let ind = blk.level == 1 ? 284 : 1134;
            b.append("<w:p><w:pPr><w:spacing w:after=\"80\"/><w:ind w:left=\"").append(ind).append("\"/>").append(bidi()).append("</w:pPr>")
                    .append(run(label, false, false, 22, null, null)).append("</w:p>");
        }
        b.append("<w:p><w:r><w:fldChar w:fldCharType=\"end\"/></w:r></w:p>");
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
                    let brk = lvl == 1 && doc.breakBeforeH1;
                    if (brk) {
                        // pas de page blanche : le saut déjà présent (fin de couverture, sommaire) est remplacé par « saut avant le titre »
                        let pb = "<w:p><w:r><w:br w:type=\"page\"/></w:r></w:p>";
                        if (endsWith(b, pb)) b.setLength(b.length - pb.length);
                        else if (endsWith(b, "</w:sectPr></w:pPr></w:p>") || endsWith(b, "<w:body>")) brk = false;
                    }
                    p(b, "<w:pPr><w:pStyle w:val=\"Heading" + lvl + "\"/>" + (brk ? "<w:pageBreakBefore/>" : "") + (blk.align != "LEFT" ? jc(blk.align) : "") + bidi() + "</w:pPr>", runs);
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
            case "MATH":
                math(b, blk);
                break;
            case "TOC":
                if (!atPageStart(b)) b.append("<w:p><w:r><w:br w:type=\"page\"/></w:r></w:p>");
                toc(b);
                break;
            case "MAIN":
                mainStart(b);
                break;
            case "SLOT":
            case "CHART":
            case "LIST":
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
                let head = blk.rowHeader && i == 0;
                b.append("<w:tc><w:tcPr><w:tcW w:w=\"").append(colW).append("\" w:type=\"dxa\"/>");
                if (head) b.append("<w:shd w:val=\"clear\" w:color=\"auto\" w:fill=\"").append(accent).append("\"/>");
                else if (ri % 2 == 1 && !blk.rowHeader) b.append("<w:shd w:val=\"clear\" w:color=\"auto\" w:fill=\"").append(light).append("\"/>");
                b.append("</w:tcPr>");
                p(b, "<w:pPr><w:spacing w:after=\"0\"/>" + (blk.rowHeader && !head ? "<w:jc w:val=\"center\"/>" : "") + bidi() + "</w:pPr>",
                        run(t, head, false, 0, head ? "FFFFFF" : null, null));
                b.append("</w:tc>");
            }
            b.append("</w:tr>");
            ri++;
        }
        b.append("</w:tbl><w:p/>");
    }

    /** Équation affichée : centrée ; numérotée « (n) » à droite dans un tableau sans bordure. */
    function math(b, blk) {
        let eq = MathTex.toOmml(blk.text, true);
        if (blk.num.isEmpty()) {
            b.append("<w:p><w:pPr><w:spacing w:before=\"120\" w:after=\"120\"/><w:jc w:val=\"center\"/></w:pPr>").append(eq).append("</w:p>");
            return;
        }
        let side = Math.floor(textWidth / 8), mid = textWidth - 2 * side;
        let none = "<w:top w:val=\"nil\"/><w:left w:val=\"nil\"/><w:bottom w:val=\"nil\"/><w:right w:val=\"nil\"/><w:insideH w:val=\"nil\"/><w:insideV w:val=\"nil\"/>";
        b.append("<w:tbl><w:tblPr><w:tblW w:w=\"").append(textWidth).append("\" w:type=\"dxa\"/>").append(doc.rtl ? "<w:bidiVisual/>" : "")
                .append("<w:tblBorders>").append(none).append("</w:tblBorders><w:tblLayout w:type=\"fixed\"/></w:tblPr><w:tblGrid>")
                .append("<w:gridCol w:w=\"").append(side).append("\"/><w:gridCol w:w=\"").append(mid).append("\"/><w:gridCol w:w=\"").append(side).append("\"/></w:tblGrid><w:tr>");
        let cell = "<w:tc><w:tcPr><w:tcW w:w=\"%W%\" w:type=\"dxa\"/><w:vAlign w:val=\"center\"/></w:tcPr>";
        b.append(cell.replaceAll("%W%", String(side))).append("<w:p/></w:tc>");
        b.append(cell.replaceAll("%W%", String(mid))).append("<w:p><w:pPr><w:spacing w:before=\"120\" w:after=\"120\"/><w:jc w:val=\"center\"/></w:pPr>").append(eq).append("</w:p></w:tc>");
        b.append(cell.replaceAll("%W%", String(side))).append("<w:p><w:pPr><w:jc w:val=\"").append(doc.rtl ? "left" : "right").append("\"/></w:pPr>")
                .append(runPlain(blk.num, false, false, 0, null, null, false)).append("</w:p></w:tc>");
        b.append("</w:tr></w:tbl>");
    }

    function border(side) {
        return "<w:" + side + " w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"D1D5DB\"/>";
    }

    function image(b, blk) {
        let idx = addImage(blk.png, blk.imgType);
        let maxW = ~~textWidth * 635; // twips -> EMU
        let cx = ~~blk.pxW * 9525;
        let cy = ~~blk.pxH * 9525;
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

    /** Le texte en cours commence-t-il une nouvelle page (début, saut de page, nouvelle section) ? */
    function atPageStart(b) {
        return endsWith(b, "<w:p><w:r><w:br w:type=\"page\"/></w:r></w:p>") || endsWith(b, "</w:sectPr></w:pPr></w:p>") || endsWith(b, "<w:body>");
    }

    function endsWith(b, end) {
        return b.length >= end.length && b.substring(b.length - end.length).equals(end);
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
        let spans = MathTex.inlineSpans(text);
        if (spans.isEmpty()) return runPlain(text, bold, italic, halfPts, color, font, underline);
        // Formules « $…$ » dans la phrase : équations Word natives
        let r = new SB();
        let last = 0;
        for (const sp of spans) {
            if (sp[0] > last) r.append(runPlain(text.substring(last, sp[0]), bold, italic, halfPts, color, font, underline));
            r.append(MathTex.toOmml(text.substring(sp[2], sp[3]), false));
            last = sp[1];
        }
        if (last < text.length) r.append(runPlain(text.substring(last), bold, italic, halfPts, color, font, underline));
        return r.toString();
    }

    function runPlain(text, bold, italic, halfPts, color, font, underline) {
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
        return XML_HEAD + "<w:hdr xmlns:w=\"" + W + "\" xmlns:r=\"" + R + "\" xmlns:m=\"" + MathTex.M_NS + "\"><w:p><w:pPr><w:pBdr><w:bottom w:val=\"single\" w:sz=\"4\" w:space=\"4\" w:color=\"" + accent + "\"/></w:pBdr>"
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
