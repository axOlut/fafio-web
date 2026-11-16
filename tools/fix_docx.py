import re, subprocess, sys
J='/home/claude/fafio-android/app/src/main/java/com/axolut/fafio/doc/DocxWriter.java'
s=subprocess.run(['python3','tools/j2js.py',J],capture_output=True,text=True,check=True).stdout
s=s.replace('class DocxWriter {','import { Zip, SB, esc, XML_HEAD } from "./util.js";\nimport { Block, lines as docLines } from "./doc.js";\n\n/** Génère un vrai fichier Word (.docx) modifiable. Renvoie un Uint8Array. */\nexport function writeDocx(doc) {',1)
s=re.sub(r'    DocxWriter\(Doc doc\) \{\n(.*?)\n    \}\n', lambda m: m.group(1).replace('this.','')+'\n', s, flags=re.S)
s=re.sub(r'    function write\(doc, out\) \{\n.*?\n    \}\n','',s,flags=re.S)
s=s.replace('let doc ;\n','').replace('doc = doc;\n','')
s=s.replace('let zip = Zip.open(out);','let zip = Zip.open();')
s=s.replace('zip.finish();\n        zip.flush();','return zip.finish();')
i=s.index('    let fontEmbeds'); j=s.index('    function fontTable()')
s=s[:i]+'''    let fontEmbeds = new Map();

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

'''+s[j:]
s=s.replace('java.util.LinkedHashSet<String> names = new java.util.LinkedHashSet<>();','let names = new Set();')
s=s.replace('let names = new java.util.LinkedHashSet<>();','let names = new Set();')
s=re.sub(r'    function run\(text, bold, italic, halfPts, color, font\) \{\n        return run\(text, bold, italic, halfPts, color, font, false\);\n    \}\n','',s)
s=s.replace('function run(text, bold, italic, halfPts, color, font, underline) {','function run(text, bold, italic, halfPts, color, font, underline = false) {')
s=s.replace('function writeTo(out) {','function writeTo() {')
s=re.sub(r'new int\[\]\{([^}]*)\}', r'[\1]', s)
s=s.replace('Doc.lines(','docLines(').replace('Doc.Block.image(','Block.image(')
s=s.replace('String.join(", ", docLines(doc.supervision))','docLines(doc.supervision).join(", ")')
for a,b in [('cy = maxCx * img.h / Math.max(1, img.w);','cy = Math.floor(maxCx * img.h / Math.max(1, img.w));'),
 ('cx = maxCy * img.w / Math.max(1, img.h);','cx = Math.floor(maxCy * img.w / Math.max(1, img.h));'),
 ('let half = textWidth / 2;','let half = Math.floor(textWidth / 2);'),
 ('let colW = textWidth / cols;','let colW = Math.floor(textWidth / cols);'),
 ('cy = cy * maxW / cx;','cy = Math.floor(cy * maxW / cx);'),
 ('cx = cx * maxH / cy;','cx = Math.floor(cx * maxH / cy);'),
 ('colW = w / cols;','colW = Math.floor(w / cols);'),
 ('let gap = 600, box = (textWidth - gap) / 2;','let gap = 600, box = Math.floor((textWidth - gap) / 2);')]:
    assert a in s, a; s=s.replace(a,b)
s=s.rstrip(); assert s.endswith('}')
s=s[:-1]+'    return writeTo();\n}\n'
open('js/docx.js','w').write(s)
print('ok')
