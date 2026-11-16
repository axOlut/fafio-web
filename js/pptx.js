







/**
 * Génère une vraie présentation PowerPoint (.pptx), modifiable dans PowerPoint, WPS Office et Google Slides.
 * Le thème et le masque proviennent d'un modèle PowerPoint standard (dossier assets/pptx).
 */
import { Zip, SB, esc, XML_HEAD } from "./util.js";
import { lines as docLines } from "./doc.js";

/** Génère une présentation PowerPoint (.pptx). assets = { "pptx/theme1.xml": "...", ... }. Renvoie un Uint8Array. */
export function writePptx(doc, assets) {


    let P = "http://schemas.openxmlformats.org/presentationml/2006/main";
    let A = "http://schemas.openxmlformats.org/drawingml/2006/main";
    let R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
    let RE = "http://schemas.openxmlformats.org/package/2006/relationships";

    let SW = 12192000; // 16:9
    let SH = 6858000;
    let IN = 914400;

        let accent ;
    let headFont ;
    let bodyFont ;
    let media = [];
    let mediaExt = [];
    /** Les diapositives ont une image de fond (thème illustré). */
    let bgImg ;

                accent = doc.theme.primaryHex();
        headFont = doc.theme.headFont;
        bodyFont = doc.theme.bodyFont;
        bgImg = doc.theme.slideBg != null;


    function writeTo() {
        if (bgImg) {
            media.add(doc.theme.slideBg.data);
            mediaExt.add(doc.theme.slideBg.type);
        }
        let slideXml = [];
        let slideMedia = [];

        // 1. Diapositive de titre
        slideXml.add(titleSlide());
        slideMedia.add([]);
        // 2. Diapositives de contenu
        let number = 2;
        for (const s of doc.slides) {
            let imgs = [];
            slideXml.add(s.statement ? statementSlide(s) : contentSlide(s, number, imgs));
            slideMedia.add(imgs);
            number++;
        }

        let zip = Zip.open();
        let n = slideXml.length;
        Zip.put(zip, "[Content_Types].xml", contentTypes(n));
        Zip.put(zip, "_rels/.rels", XML_HEAD + "<Relationships xmlns=\"" + RE + "\">"
                + "<Relationship Id=\"rId1\" Type=\"" + R + "/officeDocument\" Target=\"ppt/presentation.xml\"/>"
                + "<Relationship Id=\"rId2\" Type=\"" + RE + "/metadata/core-properties\" Target=\"docProps/core.xml\"/>"
                + "<Relationship Id=\"rId3\" Type=\"" + R + "/extended-properties\" Target=\"docProps/app.xml\"/>"
                + "</Relationships>");
        Zip.put(zip, "docProps/core.xml", Zip.coreProps(doc.title, doc.author.isEmpty() ? "FAFIO" : doc.author));
        Zip.put(zip, "docProps/app.xml", XML_HEAD + "<Properties xmlns=\"http://schemas.openxmlformats.org/officeDocument/2006/extended-properties\" "
                + "xmlns:vt=\"http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes\"><Application>FAFIO</Application>"
                + "<PresentationFormat>Widescreen</PresentationFormat><Slides>" + n + "</Slides></Properties>");
        Zip.put(zip, "ppt/presentation.xml", presentation(n));
        Zip.put(zip, "ppt/_rels/presentation.xml.rels", presentationRels(n));
        Zip.put(zip, "ppt/slideMasters/slideMaster1.xml", read(assets, "pptx/slideMaster1.xml"));
        Zip.put(zip, "ppt/slideMasters/_rels/slideMaster1.xml.rels", XML_HEAD + "<Relationships xmlns=\"" + RE + "\">"
                + "<Relationship Id=\"rId1\" Type=\"" + R + "/slideLayout\" Target=\"../slideLayouts/slideLayout1.xml\"/>"
                + "<Relationship Id=\"rId2\" Type=\"" + R + "/theme\" Target=\"../theme/theme1.xml\"/>"
                + "</Relationships>");
        Zip.put(zip, "ppt/slideLayouts/slideLayout1.xml", read(assets, "pptx/slideLayout1.xml"));
        Zip.put(zip, "ppt/slideLayouts/_rels/slideLayout1.xml.rels", XML_HEAD + "<Relationships xmlns=\"" + RE + "\">"
                + "<Relationship Id=\"rId1\" Type=\"" + R + "/slideMaster\" Target=\"../slideMasters/slideMaster1.xml\"/>"
                + "</Relationships>");
        Zip.put(zip, "ppt/theme/theme1.xml", read(assets, "pptx/theme1.xml"));
        Zip.put(zip, "ppt/presProps.xml", read(assets, "pptx/presProps.xml"));
        Zip.put(zip, "ppt/viewProps.xml", read(assets, "pptx/viewProps.xml"));
        Zip.put(zip, "ppt/tableStyles.xml", read(assets, "pptx/tableStyles.xml"));
        for (let i = 0; i < n; i++) {
            Zip.put(zip, "ppt/slides/slide" + (i + 1) + ".xml", slideXml.get(i));
            let rels = new SB(XML_HEAD + "<Relationships xmlns=\"" + RE + "\">"
                    + "<Relationship Id=\"rId1\" Type=\"" + R + "/slideLayout\" Target=\"../slideLayouts/slideLayout1.xml\"/>");
            if (bgImg) rels.append("<Relationship Id=\"rIdBg\" Type=\"").append(R).append("/image\" Target=\"../media/image1.").append(mediaExt.get(0)).append("\"/>");
            for (let k = 0; k < slideMedia.get(i).length; k++) {
                rels.append("<Relationship Id=\"rId").append(k + 2).append("\" Type=\"").append(R)
                        .append("/image\" Target=\"../media/image").append(slideMedia.get(i).get(k)).append(".")
                        .append(mediaExt.get(slideMedia.get(i).get(k) - 1)).append("\"/>");
            }
            Zip.put(zip, "ppt/slides/_rels/slide" + (i + 1) + ".xml.rels", rels.append("</Relationships>").toString());
        }
        for (let i = 0; i < media.length; i++) {
            Zip.put(zip, "ppt/media/image" + (i + 1) + "." + mediaExt.get(i), media.get(i));
        }
        return zip.finish();
    }

    // ------------------------------------------------------------ Diapositives

    let shapeId ;

    function slideStart(bgHex) {
        shapeId = 2;
        return XML_HEAD + "<p:sld xmlns:a=\"" + A + "\" xmlns:r=\"" + R + "\" xmlns:p=\"" + P + "\"><p:cSld>"
                + (bgImg
                    ? "<p:bg><p:bgPr><a:blipFill dpi=\"0\" rotWithShape=\"1\"><a:blip r:embed=\"rIdBg\"/><a:srcRect/><a:stretch><a:fillRect/></a:stretch></a:blipFill><a:effectLst/></p:bgPr></p:bg>"
                    : "<p:bg><p:bgPr><a:solidFill><a:srgbClr val=\"" + bgHex + "\"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>")
                + "<p:spTree><p:nvGrpSpPr><p:cNvPr id=\"1\" name=\"\"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>"
                + "<p:grpSpPr><a:xfrm><a:off x=\"0\" y=\"0\"/><a:ext cx=\"0\" cy=\"0\"/><a:chOff x=\"0\" y=\"0\"/><a:chExt cx=\"0\" cy=\"0\"/></a:xfrm></p:grpSpPr>";
    }

    function slideEnd() {
        return "</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>";
    }

    function titleSlide() {
        if (bgImg) return titleSlideOnImage();
        let b = new SB(slideStart(accent));
        // bande décorative
        b.append(rect(0, SH - ~~(0.35 * IN), SW, ~~(0.35 * IN), "FFFFFF", 25));
        b.append(rect(~~(0.8 * IN), ~~(2.15 * IN), ~~(1.2 * IN), ~~(0.08 * IN), "FFFFFF", 100));
        if (!doc.institution.isEmpty()) {
            b.append(text(~~(0.8 * IN), ~~(0.6 * IN), SW - ~~(1.6 * IN), ~~(0.6 * IN),
                    para(doc.institution.toUpperCase(), 1600, true, false, "FFFFFF", bodyFont, "l", false), "t"));
        }
        b.append(text(~~(0.8 * IN), ~~(2.35 * IN), SW - ~~(1.6 * IN), ~~(1.9 * IN),
                para(doc.title, 4400, true, false, "FFFFFF", headFont, "l", false), "t"));
        let sub = new SB();
        if (!doc.subtitle.isEmpty()) sub.append(para(doc.subtitle, 2200, false, true, "E5E7EB", headFont, "l", false));
        if (!doc.author.isEmpty()) {
            for (const l of docLines(doc.author)) sub.append(para(l, 1800, false, false, "FFFFFF", bodyFont, "l", false));
        }
        if (!doc.date.isEmpty()) sub.append(para(doc.date, 1400, false, false, "E5E7EB", bodyFont, "l", false));
        if (sub.length > 0) {
            b.append(text(~~(0.8 * IN), ~~(4.35 * IN), SW - ~~(1.6 * IN), ~~(1.9 * IN), sub.toString(), "t"));
        }
        return b.append(slideEnd()).toString();
    }

    /** Diapositive de titre sur fond illustré : panneau blanc translucide à gauche. */
    function titleSlideOnImage() {
        let b = new SB(slideStart("FFFFFF"));
        let px = ~~(0.55 * IN), py = ~~(0.8 * IN), pw = ~~(7.4 * IN), ph = SH - ~~(1.6 * IN);
        b.append(roundRect(px, py, pw, ph, "FFFFFF", 88, accent));
        b.append(rect(px + ~~(0.45 * IN), py + ~~(0.45 * IN), ~~(1.1 * IN), ~~(0.07 * IN), accent, 100));
        let tx = px + ~~(0.45 * IN), tw = pw - ~~(0.9 * IN);
        let t = new SB();
        if (!doc.institution.isEmpty()) t.append(para(doc.institution.toUpperCase(), 1300, true, false, accent, bodyFont, "l", false));
        t.append(para(doc.title, doc.title.length > 60 ? 3200 : 3800, true, false, "111827", headFont, "l", false));
        if (!doc.subtitle.isEmpty()) t.append(para(doc.subtitle, 2000, false, true, "4B5563", headFont, "l", false));
        b.append(text(tx, py + ~~(0.7 * IN), tw, ~~(3.2 * IN), t.toString(), "t"));
        let sub = new SB();
        for (const l of docLines(doc.author)) sub.append(para(l, 1500, false, false, "1F2937", bodyFont, "l", false));
        if (!doc.date.isEmpty()) sub.append(para(doc.date, 1300, true, false, accent, bodyFont, "l", false));
        if (sub.length > 0) b.append(text(tx, py + ph - ~~(1.9 * IN), tw, ~~(1.6 * IN), sub.toString(), "b"));
        return b.append(slideEnd()).toString();
    }

    function roundRect(x, y, w, h, fill, alphaPct, lineHex) {
        let id = shapeId++;
        return "<p:sp><p:nvSpPr><p:cNvPr id=\"" + id + "\" name=\"Panneau " + id + "\"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>"
                + "<p:spPr><a:xfrm><a:off x=\"" + x + "\" y=\"" + y + "\"/><a:ext cx=\"" + w + "\" cy=\"" + h + "\"/></a:xfrm>"
                + "<a:prstGeom prst=\"roundRect\"><a:avLst><a:gd name=\"adj\" fmla=\"val 6000\"/></a:avLst></a:prstGeom><a:solidFill><a:srgbClr val=\"" + fill + "\">"
                + (alphaPct < 100 ? "<a:alpha val=\"" + (alphaPct * 1000) + "\"/>" : "") + "</a:srgbClr></a:solidFill>"
                + (lineHex == null ? "<a:ln><a:noFill/></a:ln>" : "<a:ln w=\"12700\"><a:solidFill><a:srgbClr val=\"" + lineHex + "\"><a:alpha val=\"40000\"/></a:srgbClr></a:solidFill></a:ln>")
                + "</p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang=\"fr-FR\"/></a:p></p:txBody></p:sp>";
    }

    function statementSlide(s) {
        let b = new SB(slideStart(doc.style == "CLASSIC" ? "FFFFFF" : "F5F6FA"));
        if (bgImg) b.append(roundRect(~~(1.5 * IN), ~~(1.9 * IN), SW - ~~(3.0 * IN), ~~(3.1 * IN), "FFFFFF", 88, accent));
        b.append(rect(Math.floor(SW / 2) - ~~(0.6 * IN), ~~(2.3 * IN), ~~(1.2 * IN), ~~(0.08 * IN), accent, 100));
        b.append(text(~~(1.0 * IN), ~~(2.6 * IN), SW - ~~(2.0 * IN), ~~(1.8 * IN),
                para(s.title, 4000, true, false, accent, headFont, "ctr", false), "t"));
        return b.append(slideEnd()).toString();
    }

    function contentSlide(s, number, imgs) {
        let b = new SB(slideStart("FFFFFF"));
        let left = ~~(0.7 * IN);
        if (bgImg) {
            b.append(roundRect(~~(0.4 * IN), ~~(0.3 * IN), SW - ~~(0.8 * IN), SH - ~~(0.6 * IN), "FFFFFF", 90, accent));
        } else if (doc.style == "MODERN") {
            b.append(rect(0, 0, ~~(0.18 * IN), SH, accent, 100));
        } else if (doc.style == "ELEGANT") {
            b.append(rect(0, 0, SW, ~~(0.12 * IN), accent, 100));
        }
        let titleColor = accent;
        b.append(text(left, ~~(0.45 * IN), SW - 2 * left, ~~(0.95 * IN),
                para(s.title, 3200, true, doc.style == "ELEGANT", titleColor, headFont, "l", false), "b"));
        b.append(rect(left, ~~(1.45 * IN), ~~(1.0 * IN), ~~(0.05 * IN), accent, 100));

        let hasImg = s.png != null && s.pxW > 0 && s.pxH > 0;
        let textW = hasImg ? Math.floor((SW - 2 * left) / 2) - ~~(0.2 * IN) : SW - 2 * left;
        if (!s.bullets.isEmpty()) {
            let ps = new SB();
            let size = s.bullets.length > 6 ? 1800 : 2000;
            for (const it of s.bullets) ps.append(para(it, size, false, false, "1F2937", bodyFont, "l", true));
            b.append(text(left, ~~(1.75 * IN), textW, SH - ~~(2.6 * IN), ps.toString(), "t"));
        }
        if (hasImg) {
            media.add(s.png);
            mediaExt.add("jpeg".equals(s.imgType) ? "jpeg" : "png");
            let mediaIdx = media.length;
            imgs.add(mediaIdx);
            let boxX = s.bullets.isEmpty() ? left : left + textW + ~~(0.4 * IN);
            let boxW = s.bullets.isEmpty() ? SW - 2 * left : SW - left - boxX;
            let boxY = ~~(1.75 * IN), boxH = SH - ~~(2.6 * IN) - (s.caption.isEmpty() ? 0 : ~~(0.45 * IN));
            let cx = boxW, cy = Math.floor(boxW * s.pxH / s.pxW);
            if (cy > boxH) { cy = boxH; cx = Math.floor(boxH * s.pxW / s.pxH); }
            let x = boxX + Math.floor((boxW - cx) / 2), y = boxY + Math.floor((boxH - cy) / 2);
            let id = shapeId++;
            b.append("<p:pic><p:nvPicPr><p:cNvPr id=\"").append(id).append("\" name=\"Image ").append(id).append("\"/>")
                    .append("<p:cNvPicPr><a:picLocks noChangeAspect=\"1\"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>")
                    .append("<p:blipFill><a:blip r:embed=\"rId").append(imgs.length + 1).append("\"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>")
                    .append("<p:spPr><a:xfrm><a:off x=\"").append(x).append("\" y=\"").append(y).append("\"/><a:ext cx=\"").append(cx)
                    .append("\" cy=\"").append(cy).append("\"/></a:xfrm><a:prstGeom prst=\"rect\"><a:avLst/></a:prstGeom></p:spPr></p:pic>");
            if (!s.caption.isEmpty()) {
                b.append(text(boxX, Math.min(y + cy + ~~(0.08 * IN), SH - ~~(0.85 * IN)), boxW, ~~(0.4 * IN),
                        para(s.caption, 1300, false, true, "4B5563", bodyFont, "ctr", false), "t"));
            }
        }
        if (!s.tableRows.isEmpty() && !s.tableHeader.isEmpty()) b.append(table(s, left, ~~(1.75 * IN), SW - 2 * left));
        // numéro de diapositive
        b.append(text(SW - ~~(1.5 * IN), SH - ~~(0.6 * IN), ~~(1.0 * IN), ~~(0.4 * IN),
                para(String(number), 1200, false, false, "9CA3AF", bodyFont, "r", false), "ctr"));
        return b.append(slideEnd()).toString();
    }

    // ------------------------------------------------------------ Formes

    /** Tableau natif PowerPoint (modifiable). */
    function table(s, x, y, w) {
        let cols = s.tableHeader.length;
        let colW = Math.floor(w / cols), rowH = ~~(0.42 * IN);
        let size = s.tableRows.length > 8 ? 1300 : 1600;
        let id = shapeId++;
        let t = new SB();
        t.append("<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id=\"").append(id).append("\" name=\"Tableau ").append(id).append("\"/>")
                .append("<p:cNvGraphicFramePr><a:graphicFrameLocks noGrp=\"1\"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr>")
                .append("<p:xfrm><a:off x=\"").append(x).append("\" y=\"").append(y).append("\"/><a:ext cx=\"").append(colW * cols)
                .append("\" cy=\"").append(rowH * (s.tableRows.length + 1)).append("\"/></p:xfrm>")
                .append("<a:graphic><a:graphicData uri=\"http://schemas.openxmlformats.org/drawingml/2006/table\"><a:tbl><a:tblPr firstRow=\"1\"/><a:tblGrid>");
        for (let i = 0; i < cols; i++) t.append("<a:gridCol w=\"").append(colW).append("\"/>");
        t.append("</a:tblGrid>");
        t.append("<a:tr h=\"").append(rowH).append("\">");
        for (const h of s.tableHeader) t.append(tableCell(h, size, true, "FFFFFF", accent));
        t.append("</a:tr>");
        let ri = 0;
        for (const r of s.tableRows) {
            t.append("<a:tr h=\"").append(rowH).append("\">");
            for (let i = 0; i < cols; i++) t.append(tableCell(i < r.length ? r.get(i) : "", size, false, "1F2937", ri % 2 == 1 ? doc.theme.lightHex() : "FFFFFF"));
            t.append("</a:tr>");
            ri++;
        }
        return t.append("</a:tbl></a:graphicData></a:graphic></p:graphicFrame>").toString();
    }

    function tableCell(text, size, bold, color, fill) {
        let ln = "<a:solidFill><a:srgbClr val=\"D1D5DB\"/></a:solidFill>";
        return "<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang=\"fr-FR\" sz=\"" + size + "\"" + (bold ? " b=\"1\"" : "") + " dirty=\"0\">"
                + "<a:solidFill><a:srgbClr val=\"" + color + "\"/></a:solidFill><a:latin typeface=\"" + esc(bodyFont) + "\"/></a:rPr><a:t>" + esc(text) + "</a:t></a:r></a:p></a:txBody>"
                + "<a:tcPr marL=\"91440\" marR=\"91440\" marT=\"45720\" marB=\"45720\" anchor=\"ctr\">"
                + "<a:lnL w=\"9525\">" + ln + "</a:lnL><a:lnR w=\"9525\">" + ln + "</a:lnR><a:lnT w=\"9525\">" + ln + "</a:lnT><a:lnB w=\"9525\">" + ln + "</a:lnB>"
                + "<a:solidFill><a:srgbClr val=\"" + fill + "\"/></a:solidFill></a:tcPr></a:tc>";
    }

    function rect(x, y, w, h, fill, alphaPct) {
        let id = shapeId++;
        return "<p:sp><p:nvSpPr><p:cNvPr id=\"" + id + "\" name=\"Forme " + id + "\"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>"
                + "<p:spPr><a:xfrm><a:off x=\"" + x + "\" y=\"" + y + "\"/><a:ext cx=\"" + w + "\" cy=\"" + h + "\"/></a:xfrm>"
                + "<a:prstGeom prst=\"rect\"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val=\"" + fill + "\">"
                + (alphaPct < 100 ? "<a:alpha val=\"" + (alphaPct * 1000) + "\"/>" : "") + "</a:srgbClr></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr>"
                + "<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang=\"fr-FR\"/></a:p></p:txBody></p:sp>";
    }

    function text(x, y, w, h, paragraphs, anchor) {
        let id = shapeId++;
        return "<p:sp><p:nvSpPr><p:cNvPr id=\"" + id + "\" name=\"Texte " + id + "\"/><p:cNvSpPr txBox=\"1\"/><p:nvPr/></p:nvSpPr>"
                + "<p:spPr><a:xfrm><a:off x=\"" + x + "\" y=\"" + y + "\"/><a:ext cx=\"" + w + "\" cy=\"" + h + "\"/></a:xfrm>"
                + "<a:prstGeom prst=\"rect\"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>"
                + "<p:txBody><a:bodyPr wrap=\"square\" lIns=\"0\" tIns=\"0\" rIns=\"0\" bIns=\"0\" anchor=\"" + anchor + "\"><a:normAutofit/></a:bodyPr>"
                + "<a:lstStyle/>" + paragraphs + "</p:txBody></p:sp>";
    }

    function para(t, size, bold, italic, color, font, algn, bullet) {
        let b = new SB("<a:p><a:pPr algn=\"").append(doc.rtl && "l".equals(algn) ? "r" : algn).append("\"")
                .append(doc.rtl ? " rtl=\"1\"" : "");
        if (bullet) {
            b.append(" marL=\"342900\" indent=\"-342900\"><a:spcBef><a:spcPts val=\"900\"/></a:spcBef>")
                    .append("<a:buClr><a:srgbClr val=\"").append(accent).append("\"/></a:buClr>")
                    .append("<a:buFont typeface=\"Arial\"/><a:buChar char=\"•\"/></a:pPr>");
        } else {
            b.append("><a:buNone/></a:pPr>");
        }
        b.append("<a:r><a:rPr lang=\"fr-FR\" sz=\"").append(size).append("\" b=\"").append(bold ? 1 : 0).append("\" i=\"").append(italic ? 1 : 0)
                .append("\" dirty=\"0\"><a:solidFill><a:srgbClr val=\"").append(color).append("\"/></a:solidFill>")
                .append("<a:latin typeface=\"").append(font).append("\"/><a:cs typeface=\"").append(font).append("\"/></a:rPr>")
                .append("<a:t>").append(esc(t)).append("</a:t></a:r></a:p>");
        return b.toString();
    }

    // ------------------------------------------------------------ Parties fixes

    function presentation(n) {
        let b = new SB(XML_HEAD);
        b.append("<p:presentation xmlns:a=\"").append(A).append("\" xmlns:r=\"").append(R).append("\" xmlns:p=\"").append(P).append("\" saveSubsetFonts=\"1\">")
                .append("<p:sldMasterIdLst><p:sldMasterId id=\"2147483648\" r:id=\"rId1\"/></p:sldMasterIdLst><p:sldIdLst>");
        for (let i = 0; i < n; i++) {
            b.append("<p:sldId id=\"").append(256 + i).append("\" r:id=\"rId").append(10 + i).append("\"/>");
        }
        b.append("</p:sldIdLst><p:sldSz cx=\"").append(SW).append("\" cy=\"").append(SH).append("\"/>")
                .append("<p:notesSz cx=\"6858000\" cy=\"9144000\"/>")
                .append("<p:defaultTextStyle><a:defPPr><a:defRPr lang=\"fr-FR\"/></a:defPPr></p:defaultTextStyle></p:presentation>");
        return b.toString();
    }

    function presentationRels(n) {
        let b = new SB(XML_HEAD + "<Relationships xmlns=\"" + RE + "\">"
                + "<Relationship Id=\"rId1\" Type=\"" + R + "/slideMaster\" Target=\"slideMasters/slideMaster1.xml\"/>"
                + "<Relationship Id=\"rId2\" Type=\"" + R + "/theme\" Target=\"theme/theme1.xml\"/>"
                + "<Relationship Id=\"rId3\" Type=\"" + R + "/presProps\" Target=\"presProps.xml\"/>"
                + "<Relationship Id=\"rId4\" Type=\"" + R + "/viewProps\" Target=\"viewProps.xml\"/>"
                + "<Relationship Id=\"rId5\" Type=\"" + R + "/tableStyles\" Target=\"tableStyles.xml\"/>");
        for (let i = 0; i < n; i++) {
            b.append("<Relationship Id=\"rId").append(10 + i).append("\" Type=\"").append(R).append("/slide\" Target=\"slides/slide").append(i + 1).append(".xml\"/>");
        }
        return b.append("</Relationships>").toString();
    }

    function contentTypes(n) {
        let pml = "application/vnd.openxmlformats-officedocument.presentationml.";
        let b = new SB(XML_HEAD + "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">"
                + "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>"
                + "<Default Extension=\"xml\" ContentType=\"application/xml\"/>"
                + "<Default Extension=\"png\" ContentType=\"image/png\"/>"
                + "<Default Extension=\"jpeg\" ContentType=\"image/jpeg\"/>"
                + "<Override PartName=\"/ppt/presentation.xml\" ContentType=\"" + pml + "presentation.main+xml\"/>"
                + "<Override PartName=\"/ppt/slideMasters/slideMaster1.xml\" ContentType=\"" + pml + "slideMaster+xml\"/>"
                + "<Override PartName=\"/ppt/slideLayouts/slideLayout1.xml\" ContentType=\"" + pml + "slideLayout+xml\"/>"
                + "<Override PartName=\"/ppt/theme/theme1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.theme+xml\"/>"
                + "<Override PartName=\"/ppt/presProps.xml\" ContentType=\"" + pml + "presProps+xml\"/>"
                + "<Override PartName=\"/ppt/viewProps.xml\" ContentType=\"" + pml + "viewProps+xml\"/>"
                + "<Override PartName=\"/ppt/tableStyles.xml\" ContentType=\"" + pml + "tableStyles+xml\"/>"
                + "<Override PartName=\"/docProps/core.xml\" ContentType=\"application/vnd.openxmlformats-package.core-properties+xml\"/>"
                + "<Override PartName=\"/docProps/app.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.extended-properties+xml\"/>");
        for (let i = 1; i <= n; i++) {
            b.append("<Override PartName=\"/ppt/slides/slide").append(i).append(".xml\" ContentType=\"").append(pml).append("slide+xml\"/>");
        }
        return b.append("</Types>").toString();
    }

    function read(assets, name) {
        const v = assets[name];
        if (v == null) throw new Error("modèle manquant : " + name);
        return v;
    }
    return writeTo();
}
