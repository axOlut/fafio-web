// Formules LaTeX : copie fidèle de MathTex.java (lecture, Unicode linéaire, Word OMML, mise en page dessinable).
import { esc } from "./util.js";

const isLetter = (c) => /\p{L}/u.test(c);
const isDigit = (c) => c >= "0" && c <= "9";
const isWs = (c) => /\s/.test(c);
const isUpper = (c) => c !== c.toLowerCase() && c === c.toUpperCase();
const f32 = Math.fround;

export class MNode {
    constructor(k, s = "") {
        this.k = k; this.s = s; this.st = ""; this.a = null; this.b = null; this.c = null;
        this.kids = []; this.rows = []; this.em = 0; this.limits = false; this.left = ""; this.right = "";
    }
}

// ================================================================== Tables de symboles

const GREEK = {}, SYM = {}, KIND = {}, BIG = {}, ACC = {}, DELIM = {}, SPACE = {};
const FUNCS = ",sin,cos,tan,cot,sec,csc,arcsin,arccos,arctan,sinh,cosh,tanh,coth,ln,log,lg,exp,det,dim,ker,deg,arg,gcd,Pr,mod,";
const LIMFUNCS = ",lim,max,min,sup,inf,limsup,liminf,";

function sym(kind, names, chars) {
    const n = names.split(" "), c = chars.split(" ");
    for (let i = 0; i < n.length; i++) { SYM[n[i]] = c[i]; KIND[n[i]] = kind; }
}
(() => {
    const g = ("alpha α beta β gamma γ delta δ epsilon ϵ varepsilon ε zeta ζ eta η theta θ vartheta ϑ iota ι kappa κ lambda λ mu μ nu ν "
        + "xi ξ pi π varpi ϖ rho ρ varrho ϱ sigma σ varsigma ς tau τ upsilon υ phi ϕ varphi φ chi χ psi ψ omega ω "
        + "Gamma Γ Delta Δ Theta Θ Lambda Λ Xi Ξ Pi Π Sigma Σ Upsilon Υ Phi Φ Psi Ψ Omega Ω").split(" ");
    for (let i = 0; i < g.length; i += 2) GREEK[g[i]] = g[i + 1];
    sym("op", "times cdot div pm mp ast star circ bullet cup cap wedge vee oplus otimes setminus land lor",
        "× ⋅ ÷ ± ∓ ∗ ⋆ ∘ • ∪ ∩ ∧ ∨ ⊕ ⊗ ∖ ∧ ∨");
    sym("rel", "leq le geq ge neq ne approx equiv sim simeq cong propto to rightarrow leftarrow Rightarrow Leftarrow "
        + "Leftrightarrow leftrightarrow iff implies mapsto in notin ni subset supset subseteq supseteq ll gg perp parallel mid "
        + "longrightarrow Longrightarrow uparrow downarrow gets",
        "≤ ≤ ≥ ≥ ≠ ≠ ≈ ≡ ∼ ≃ ≅ ∝ → → ← ⇒ ⇐ ⇔ ↔ ⟺ ⟹ ↦ ∈ ∉ ∋ ⊂ ⊃ ⊆ ⊇ ≪ ≫ ⊥ ∥ ∣ ⟶ ⟹ ↑ ↓ ←");
    sym("sym", "infty partial nabla forall exists nexists emptyset varnothing angle triangle hbar ell Re Im aleph prime degree "
        + "ldots cdots dots vdots ddots therefore because neg lnot square checkmark dagger",
        "∞ ∂ ∇ ∀ ∃ ∄ ∅ ∅ ∠ △ ℏ ℓ ℜ ℑ ℵ ′ ° … ⋯ … ⋮ ⋱ ∴ ∵ ¬ ¬ □ ✓ †");
    sym("punct", "colon", ":");
    const b = "sum ∑ prod ∏ coprod ∐ int ∫ iint ∬ iiint ∭ oint ∮ bigcup ⋃ bigcap ⋂ bigoplus ⨁ bigotimes ⨂".split(" ");
    for (let i = 0; i < b.length; i += 2) BIG[b[i]] = b[i + 1];
    const a = "vec ⃗ overrightarrow ⃗ hat ̂ widehat ̂ tilde ̃ widetilde ̃ dot ̇ ddot ̈ bar ̅ overline ̅ underline _ check ̌ breve ̆".split(" ");
    for (let i = 0; i < a.length; i += 2) ACC[a[i]] = a[i + 1];
    const d = "( ( ) ) [ [ ] ] { { } } lbrace { rbrace } | | \\| ‖ Vert ‖ vert | langle ⟨ rangle ⟩ lfloor ⌊ rfloor ⌋ lceil ⌈ rceil ⌉ lvert | rvert | lVert ‖ rVert ‖ . .".split(" ");
    for (let i = 0; i < d.length; i += 2) DELIM[d[i]] = d[i + 1];
    Object.assign(SPACE, { ",": 0.17, ":": 0.22, ">": 0.22, ";": 0.28, "!": -0.17, " ": 0.33, quad: 1, qquad: 2, enspace: 0.5, thinspace: 0.17 });
})();
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

// ================================================================== Lecture

class P {
    constructor(s) { this.s = s; this.i = 0; }
    end() { return this.i >= this.s.length; }
    peek() { return this.s.charAt(this.i); }
    skipWs() { while (this.i < this.s.length && isWs(this.s.charAt(this.i))) this.i++; }
    starts(t) { return this.s.startsWith(t, this.i); }
    command() {
        if (this.end()) return " ";
        const st = this.i;
        if (isLetter(this.s.charAt(this.i))) {
            while (this.i < this.s.length && isLetter(this.s.charAt(this.i))) this.i++;
            return this.s.substring(st, this.i);
        }
        this.i++;
        return this.s.substring(st, this.i);
    }
    rawGroup() {
        this.skipWs();
        if (this.end()) return "";
        if (this.peek() !== "{") { this.i++; return this.s.substring(this.i - 1, this.i); }
        let depth = 0; const st = this.i + 1;
        while (this.i < this.s.length) {
            const ch = this.s.charAt(this.i);
            if (ch === "\\") { this.i += 2; continue; }
            if (ch === "{") depth++;
            else if (ch === "}") { depth--; if (depth === 0) { this.i++; return this.s.substring(st, this.i - 1); } }
            this.i++;
        }
        return this.s.substring(Math.min(st, this.s.length));
    }
    optional() {
        this.skipWs();
        if (this.end() || this.peek() !== "[") return null;
        let depth = 0; const st = this.i + 1;
        while (this.i < this.s.length) {
            const ch = this.s.charAt(this.i);
            if (ch === "[") depth++;
            else if (ch === "]") { depth--; if (depth === 0) { this.i++; return this.s.substring(st, this.i - 1); } }
            this.i++;
        }
        return this.s.substring(Math.min(st, this.s.length));
    }
}

export function parse(tex) {
    const p = new P(tex == null ? "" : String(tex).replaceAll("\\nonumber", "").replaceAll("\\notag", ""));
    const table = parseTable(p, "");
    if (table.rows.length === 1 && table.rows[0].length === 1) return table.rows[0][0];
    table.s = "aligned";
    return table;
}

function parseTable(p, env) {
    const m = new MNode("mat");
    m.s = env;
    let row = [];
    for (;;) {
        const cell = parseRow(p, true);
        while (!p.end() && p.peek() === "}") { p.i++; cell.kids.push(...parseRow(p, true).kids); }
        row.push(cell);
        if (p.end()) break;
        if (p.starts("&")) { p.i++; continue; }
        if (p.starts("\\\\")) { p.i += 2; p.optional(); m.rows.push(row); row = []; continue; }
        if (p.starts("\\end")) { p.i += 4; p.rawGroup(); break; }
        break;
    }
    const emptyLast = row.length === 1 && row[0].kids.length === 0;
    if (!emptyLast || m.rows.length === 0) m.rows.push(row);
    return m;
}

function parseRow(p, inTable) {
    const row = new MNode("row");
    for (;;) {
        p.skipWs();
        if (p.end()) break;
        const ch = p.peek();
        if (ch === "}") break;
        if (inTable && (ch === "&" || p.starts("\\\\") || p.starts("\\end"))) break;
        if (p.starts("\\right")) break;
        let atom = parseAtom(p, row);
        if (atom == null) continue;
        atom = scripts(p, atom);
        row.kids.push(atom);
    }
    return row;
}

function scripts(p, base) {
    let sup = null, sub = null;
    for (;;) {
        p.skipWs();
        if (p.end()) break;
        const ch = p.peek();
        if (ch === "^" && sup == null) { p.i++; sup = scriptArg(p); }
        else if (ch === "_" && sub == null) { p.i++; sub = scriptArg(p); }
        else if (ch === "'") {
            p.i++;
            const pr = new MNode("sym", "′");
            if (sup == null) sup = new MNode("row");
            if (sup.k !== "row") { const r = new MNode("row"); r.kids.push(sup); sup = r; }
            sup.kids.push(pr);
        } else break;
    }
    if (sup == null && sub == null) return base;
    if (base.k === "big" || (base.k === "fn" && base.limits)) { base.b = sub; base.c = sup; return base; }
    const n = new MNode("scr");
    n.a = base; n.b = sub; n.c = sup;
    return n;
}

function scriptArg(p) {
    p.skipWs();
    if (p.end()) return new MNode("row");
    const ch = p.peek();
    if (ch === "{") {
        p.i++;
        const r = parseRow(p, false);
        if (!p.end() && p.peek() === "}") p.i++;
        return r;
    }
    if (isDigit(ch)) { p.i++; return new MNode("num", ch); }
    const a = parseAtom(p, null);
    return a == null ? new MNode("row") : a;
}

function unaryContext(row) {
    if (row == null || row.kids.length === 0) return true;
    const last = row.kids[row.kids.length - 1], k = last.k;
    return k === "op" || k === "rel" || k === "punct" || (k === "sym" && (last.s === "(" || last.s === "[" || last.s === "{")) || k === "big";
}

const GREEK_CHARS = "αβγδεϵζηθϑικλμνξπϖρϱσςτυϕφχψωΓΔΘΛΞΠΣΥΦΨΩ";

function parseAtom(p, row) {
    const ch = p.peek();
    if (ch === "{") {
        p.i++;
        const r = parseRow(p, false);
        if (!p.end() && p.peek() === "}") p.i++;
        return r;
    }
    if (ch === "\\") { p.i++; return command(p, p.command(), row); }
    p.i++;
    if (isDigit(ch) || (ch === "." && !p.end() && isDigit(p.peek()))) {
        let sb = ch;
        while (!p.end()) {
            const c = p.peek();
            if (isDigit(c)) { sb += c; p.i++; }
            else if ((c === "." || c === ",") && p.i + 1 < p.s.length && isDigit(p.s.charAt(p.i + 1))) { sb += c; p.i++; }
            else break;
        }
        return new MNode("num", sb);
    }
    if (isLetter(ch)) {
        if (GREEK_CHARS.indexOf(ch) >= 0) return new MNode(isUpper(ch) ? "sym" : "id", ch);
        return new MNode("id", ch);
    }
    switch (ch) {
        case "+": return new MNode(unaryContext(row) ? "sym" : "op", "+");
        case "-": return new MNode(unaryContext(row) ? "sym" : "op", "−");
        case "*": return new MNode("op", "∗");
        case "=": case "<": case ">": return new MNode("rel", ch);
        case ":": return new MNode("rel", ":");
        case ",": case ";": return new MNode("punct", ch);
        case "~": { const sp = new MNode("space"); sp.em = 0.33; return sp; }
        case "&": return null;
        case "^": case "_": return null;
        default: break;
    }
    if ("×·÷±∓∪∩".includes(ch)) return new MNode("op", ch);
    if ("≤≥≠≈≡→←⇒⇔↔∈∉⊂⊃⊆⊇∝∼≃".includes(ch)) return new MNode("rel", ch);
    return new MNode("sym", ch);
}

function command(p, name, row) {
    if (has(GREEK, name)) return new MNode(isUpper(name.charAt(0)) ? "sym" : "id", GREEK[name]);
    if (has(SPACE, name)) { const sp = new MNode("space"); sp.em = SPACE[name]; return sp; }
    if (has(SYM, name)) return new MNode(KIND[name], SYM[name]);
    if (has(BIG, name)) {
        const n = new MNode("big", BIG[name]);
        n.limits = !name.includes("int");
        p.skipWs();
        if (p.starts("\\limits")) { p.i += 7; n.limits = true; }
        else if (p.starts("\\nolimits")) { p.i += 9; n.limits = false; }
        return n;
    }
    if (FUNCS.includes("," + name + ",")) return new MNode("fn", name);
    if (LIMFUNCS.includes("," + name + ",")) {
        const n = new MNode("fn", name === "limsup" ? "lim sup" : name === "liminf" ? "lim inf" : name);
        n.limits = true;
        return n;
    }
    if (has(ACC, name)) {
        const n = new MNode("acc", ACC[name]);
        n.em = name.startsWith("under") ? -1 : name === "vec" || name === "overrightarrow" ? 1 : 0;
        n.left = name;
        n.a = arg(p);
        return n;
    }
    switch (name) {
        case "frac": case "dfrac": case "tfrac": case "cfrac": {
            const n = new MNode("frac");
            n.a = arg(p); n.b = arg(p);
            return n;
        }
        case "binom": case "dbinom": case "tbinom": {
            const f = new MNode("frac", "nobar");
            f.a = arg(p); f.b = arg(p);
            const d = new MNode("delim");
            d.left = "("; d.right = ")"; d.a = f;
            return d;
        }
        case "sqrt": {
            const n = new MNode("sqrt");
            const idx = p.optional();
            if (idx != null) n.b = parse(idx);
            n.a = arg(p);
            return n;
        }
        case "text": case "textrm": case "mbox": case "textit": case "textnormal": case "mathrm": case "textup": case "operatorname": {
            const raw = p.rawGroup();
            if (name === "operatorname") return new MNode("fn", raw);
            if (name.startsWith("text") || name === "mbox") return new MNode("text", raw.replaceAll("\\", ""));
            const r = parse(raw);
            setStyle(r, "p");
            return r;
        }
        case "mathbf": case "textbf": case "boldsymbol": case "bm": {
            const r = name === "textbf" ? new MNode("text", p.rawGroup()) : parse(p.rawGroup());
            setStyle(r, "b");
            return r;
        }
        case "mathit": case "mathsf": case "mathtt":
            return parse(p.rawGroup());
        case "mathbb": return new MNode("sym", mapChars(p.rawGroup(), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "𝔸𝔹ℂ𝔻𝔼𝔽𝔾ℍ𝕀𝕁𝕂𝕃𝕄ℕ𝕆ℙℚℝ𝕊𝕋𝕌𝕍𝕎𝕏𝕐ℤ"));
        case "mathcal": case "mathscr": return new MNode("sym", mapChars(p.rawGroup(), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "𝒜ℬ𝒞𝒟ℰℱ𝒢ℋℐ𝒥𝒦ℒℳ𝒩𝒪𝒫𝒬ℛ𝒮𝒯𝒰𝒱𝒲𝒳𝒴𝒵"));
        case "left": {
            const l = delimiter(p);
            const body = parseRow(p, false);
            let r = ".";
            if (p.starts("\\right")) { p.i += 6; r = delimiter(p); }
            const d = new MNode("delim");
            d.left = l; d.right = r; d.a = body;
            return d;
        }
        case "big": case "Big": case "bigg": case "Bigg": case "bigl": case "bigr": case "Bigl": case "Bigr": case "biggl": case "biggr": case "middle":
            return new MNode("sym", delimiter(p));
        case "begin": {
            const env = p.rawGroup().trim();
            if (env === "array") p.rawGroup();
            return parseTable(p, env);
        }
        case "{": return new MNode("sym", "{");
        case "}": return new MNode("sym", "}");
        case "%": return new MNode("sym", "%");
        case "$": return new MNode("sym", "$");
        case "#": return new MNode("sym", "#");
        case "&": return new MNode("sym", "&");
        case "_": return new MNode("sym", "_");
        case "|": return new MNode("sym", "‖");
        case "lbrace": return new MNode("sym", "{");
        case "rbrace": return new MNode("sym", "}");
        case "langle": return new MNode("sym", "⟨");
        case "rangle": return new MNode("sym", "⟩");
        case "displaystyle": case "textstyle": case "limits": case "nolimits": case "left.": return null;
        default: return new MNode("text", name);
    }
}

function delimiter(p) {
    p.skipWs();
    if (p.end()) return ".";
    const ch = p.peek();
    if (ch === "\\") {
        p.i++;
        const c = p.command();
        let d = has(DELIM, c) ? DELIM[c] : null;
        if (d == null && c === "|") d = "‖";
        return d == null ? "." : d;
    }
    p.i++;
    return has(DELIM, ch) ? DELIM[ch] : ch;
}

function arg(p) {
    p.skipWs();
    if (p.end()) return new MNode("row");
    if (p.peek() === "{") {
        p.i++;
        const r = parseRow(p, false);
        if (!p.end() && p.peek() === "}") p.i++;
        return r;
    }
    const a = parseAtom(p, null);
    return a == null ? new MNode("row") : a;
}

function mapChars(input, from, to) {
    let sb = "";
    const cps = Array.from(to);
    for (let i = 0; i < input.length; i++) {
        const k = from.indexOf(input.charAt(i));
        if (k >= 0 && k < cps.length) sb += cps[k];
        else if (!isWs(input.charAt(i))) sb += input.charAt(i);
    }
    return sb;
}

function setStyle(n, st) {
    if (n == null) return;
    n.st = st;
    for (const k of n.kids) setStyle(k, st);
    setStyle(n.a, st); setStyle(n.b, st); setStyle(n.c, st);
}

// ================================================================== Repérage dans le texte

export function inlineSpans(text) {
    const out = [];
    if (text == null || String(text).indexOf("$") < 0) return out;
    text = String(text);
    let i = 0; const n = text.length;
    while (i < n) {
        const ch = text.charAt(i);
        if (ch === "\\") { i += 2; continue; }
        if (ch === "$" && i + 2 < n && text.charAt(i + 1) === "$") {
            const j = text.indexOf("$$", i + 2);
            if (j > i + 2) { out.push([i, j + 2, i + 2, j]); i = j + 2; continue; }
            i += 2;
            continue;
        }
        if (ch === "$" && i + 1 < n && !isWs(text.charAt(i + 1))) {
            let j = i + 1, found = -1;
            while (j < n) {
                const c = text.charAt(j);
                if (c === "\\") { j += 2; continue; }
                if (c === "$") {
                    const ok = !isWs(text.charAt(j - 1)) && (j + 1 >= n || !isDigit(text.charAt(j + 1)));
                    if (ok) found = j;
                    break;
                }
                j++;
            }
            if (found > 0) { out.push([i, found + 1, i + 1, found]); i = found + 1; continue; }
        }
        i++;
    }
    return out;
}

export const hasInline = (text) => inlineSpans(text).length > 0;

export function displayOf(line) {
    if (line == null) return null;
    const t = String(line).trim();
    if (t.length >= 4 && t.startsWith("$$") && t.endsWith("$$")) return t.substring(2, t.length - 2).trim();
    if (t.length >= 4 && t.startsWith("\\[") && t.endsWith("\\]")) return t.substring(2, t.length - 2).trim();
    return null;
}

export const numbered = (tex) => tex != null && !tex.includes("\\nonumber") && !tex.includes("\\notag");

export function inlineToUnicode(text) {
    const spans = inlineSpans(text);
    if (spans.length === 0) return text;
    let sb = "", last = 0;
    for (const sp of spans) {
        sb += text.substring(last, sp[0]);
        sb += toUnicode(text.substring(sp[2], sp[3]));
        last = sp[1];
    }
    return sb + text.substring(last);
}

// ================================================================== Unicode linéaire

const SUP_FROM = "′0123456789+−-=()niaebcdfghjklmoprstuvwxyzABDEGHIJKLMNOPRTUVW";
const SUP_TO = "′⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁻⁼⁽⁾ⁿⁱᵃᵉᵇᶜᵈᶠᵍʰʲᵏˡᵐᵒᵖʳˢᵗᵘᵛʷˣʸᶻᴬᴮᴰᴱᴳᴴᴵᴶᴷᴸᴹᴺᴼᴾᴿᵀᵁⱽᵂ";
const SUB_FROM = "0123456789+−-=()aehijklmnoprstuvx";
const SUB_TO = "₀₁₂₃₄₅₆₇₈₉₊₋₋₌₍₎ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ";

export const toUnicode = (tex) => lin(parse(tex)).trim();

function script(s, from, to, mark) {
    let sb = "", ok = s.length > 0;
    for (let i = 0; i < s.length && ok; i++) {
        const k = from.indexOf(s.charAt(i));
        if (k < 0) ok = false; else sb += to.charAt(k);
    }
    if (ok) return sb;
    return s.length === 1 ? mark + s : mark + "(" + s + ")";
}

function wrap(s) {
    let simple = s.length <= 1;
    if (!simple) {
        simple = true;
        for (let i = 0; i < s.length; i++) {
            const c = s.charAt(i);
            if (c === " " || c === "+" || c === "−" || c === "/" || c === "=" || c === "×" || c === "⋅") { simple = false; break; }
        }
        if (s.startsWith("(") && s.endsWith(")")) simple = true;
    }
    return simple ? s : "(" + s + ")";
}

function lin(n) {
    if (n == null) return "";
    switch (n.k) {
        case "row": {
            if (n.kids.length === 1) return lin(n.kids[0]);
            let sb = "";
            for (const k of n.kids) {
                const t = lin(k);
                if (k.k === "rel" || k.k === "op") sb += " " + t + " ";
                else if (k.k === "punct") sb += t + " ";
                else if (k.k === "fn" && k.b == null) sb += t + " ";
                else sb += t;
            }
            return sb.replaceAll("  ", " ");
        }
        case "space": return n.em > 0.2 ? " " : n.em > 0 ? " " : "";
        case "scr": {
            let base = lin(n.a);
            if (n.b != null) base += script(lin(n.b).replaceAll(" ", ""), SUB_FROM, SUB_TO, "_");
            if (n.c != null) base += script(lin(n.c).replaceAll(" ", ""), SUP_FROM, SUP_TO, "^");
            return base;
        }
        case "frac": return wrap(lin(n.a).trim()) + "/" + wrap(lin(n.b).trim());
        case "sqrt": {
            const idx = n.b == null ? "" : script(lin(n.b), SUP_FROM, SUP_TO, "");
            return idx + "√" + wrap(lin(n.a).trim());
        }
        case "big": case "fn": {
            let s = n.s;
            if (n.k === "fn" && n.limits && n.b != null) return s + "(" + lin(n.b).replaceAll(" ", "") + ") ";
            if (n.b != null) s += script(lin(n.b).replaceAll(" ", ""), SUB_FROM, SUB_TO, "_");
            if (n.c != null) s += script(lin(n.c).replaceAll(" ", ""), SUP_FROM, SUP_TO, "^");
            return s + (n.k === "big" ? " " : "");
        }
        case "delim": return (n.left === "." ? "" : n.left) + lin(n.a).trim() + (n.right === "." ? "" : n.right);
        case "acc": {
            const body = lin(n.a).trim();
            if (n.em < 0) return body;
            return body.length === 1 ? body + n.s : body === "" ? "" : body + n.s;
        }
        case "mat": {
            let sb = "";
            for (let r = 0; r < n.rows.length; r++) {
                if (r > 0) sb += "; ";
                const row = n.rows[r];
                for (let c = 0; c < row.length; c++) {
                    if (c > 0) sb += n.s === "cases" ? ", " : " ";
                    sb += lin(row[c]).trim();
                }
            }
            const d = matDelims(n.s);
            return (d[0] === "." ? "" : d[0]) + sb + (d[1] === "." ? "" : d[1]);
        }
        default: return n.s;
    }
}

function matDelims(env) {
    switch (env) {
        case "pmatrix": return ["(", ")"];
        case "bmatrix": return ["[", "]"];
        case "Bmatrix": return ["{", "}"];
        case "vmatrix": return ["|", "|"];
        case "Vmatrix": return ["‖", "‖"];
        case "cases": return ["{", "."];
        default: return [".", "."];
    }
}

// ================================================================== Word (OMML)

export const M_NS = "http://schemas.openxmlformats.org/officeDocument/2006/math";

export function toOmml(tex, display) {
    const inner = om(parse(tex));
    return display ? "<m:oMathPara><m:oMath>" + inner + "</m:oMath></m:oMathPara>" : "<m:oMath>" + inner + "</m:oMath>";
}

function mr(text, sty) {
    if (text === "") return "";
    let b = "<m:r>";
    if (sty === "p") b += '<m:rPr><m:sty m:val="p"/></m:rPr>';
    else if (sty === "b") b += '<m:rPr><m:sty m:val="b"/></m:rPr>';
    else if (sty === "t") b += "<m:rPr><m:nor/></m:rPr>";
    b += '<w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr>';
    return b + '<m:t xml:space="preserve">' + esc(text) + "</m:t></m:r>";
}

const e = (tag, inner) => "<m:" + tag + ">" + inner + "</m:" + tag + ">";

function om(n) {
    if (n == null) return "";
    switch (n.k) {
        case "row": return omRow(n.kids);
        case "id": return mr(n.s, n.st);
        case "num": return mr(n.s, n.st === "b" ? "b" : "");
        case "text": return mr(n.s, n.st === "b" ? "b" : "t");
        case "fn": {
            const name = mr(n.s, "p");
            if (n.b != null && n.limits) return e("limLow", e("e", name) + e("lim", om(n.b)));
            if (n.b != null || n.c != null) return scrOm(name, n.b, n.c);
            return name;
        }
        case "space": {
            const sp = n.em >= 1.9 ? "  " : n.em >= 0.9 ? " " : n.em >= 0.25 ? " " : n.em > 0 ? " " : "";
            return mr(sp, "");
        }
        case "scr": return scrOm(om(n.a), n.b, n.c);
        case "frac":
            return "<m:f>" + (n.s === "nobar" ? '<m:fPr><m:type m:val="noBar"/></m:fPr>' : "") + e("num", om(n.a)) + e("den", om(n.b)) + "</m:f>";
        case "sqrt":
            if (n.b == null) return '<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/>' + e("e", om(n.a)) + "</m:rad>";
            return "<m:rad>" + e("deg", om(n.b)) + e("e", om(n.a)) + "</m:rad>";
        case "big": return nary(n, "");
        case "delim": return '<m:d><m:dPr><m:begChr m:val="' + dch(n.left) + '"/><m:endChr m:val="' + dch(n.right) + '"/></m:dPr>' + e("e", om(n.a)) + "</m:d>";
        case "acc": {
            if (n.em < 0) return '<m:bar><m:barPr><m:pos m:val="bot"/></m:barPr>' + e("e", om(n.a)) + "</m:bar>";
            if (n.left === "bar" || n.left === "overline") return '<m:bar><m:barPr><m:pos m:val="top"/></m:barPr>' + e("e", om(n.a)) + "</m:bar>";
            return '<m:acc><m:accPr><m:chr m:val="' + n.s + '"/></m:accPr>' + e("e", om(n.a)) + "</m:acc>";
        }
        case "mat": return matOm(n);
        default: return mr(n.s, n.st === "b" ? "b" : n.k === "sym" || n.k === "op" || n.k === "rel" ? "" : n.st);
    }
}

const dch = (d) => (d === "." ? "" : esc(d));

function scrOm(base, sub, sup) {
    if (sub != null && sup != null) return "<m:sSubSup>" + e("e", base) + e("sub", om(sub)) + e("sup", om(sup)) + "</m:sSubSup>";
    if (sup != null) return "<m:sSup>" + e("e", base) + e("sup", om(sup)) + "</m:sSup>";
    return "<m:sSub>" + e("e", base) + e("sub", om(sub)) + "</m:sSub>";
}

function omRow(kids) {
    let b = "";
    for (let i = 0; i < kids.length; i++) {
        const k = kids[i];
        if (k.k === "big") {
            let j = i + 1;
            while (j < kids.length && kids[j].k !== "rel") j++;
            b += nary(k, omRow(kids.slice(i + 1, j)));
            i = j - 1;
            continue;
        }
        b += om(k);
    }
    return b;
}

function nary(n, body) {
    let b = "<m:nary><m:naryPr>";
    if (n.s !== "∫") b += '<m:chr m:val="' + n.s + '"/>';
    b += '<m:limLoc m:val="' + (n.limits ? "undOvr" : "subSup") + '"/>';
    if (n.b == null) b += '<m:subHide m:val="1"/>';
    if (n.c == null) b += '<m:supHide m:val="1"/>';
    return b + "</m:naryPr>" + e("sub", om(n.b)) + e("sup", om(n.c)) + e("e", body) + "</m:nary>";
}

function matOm(n) {
    if (["aligned", "align", "align*", "gather", "split", "eqnarray"].includes(n.s)) {
        let b = "<m:eqArr>";
        for (const row of n.rows) {
            let r = "";
            for (const c of row) r += om(c);
            b += e("e", r);
        }
        return b + "</m:eqArr>";
    }
    let cols = 0;
    for (const row of n.rows) cols = Math.max(cols, row.length);
    let b = '<m:m><m:mPr><m:mcs><m:mc><m:mcPr><m:count m:val="' + Math.max(1, cols)
        + '"/><m:mcJc m:val="' + (n.s === "cases" ? "left" : "center") + '"/></m:mcPr></m:mc></m:mcs></m:mPr>';
    for (const row of n.rows) {
        b += "<m:mr>";
        for (let c = 0; c < cols; c++) b += e("e", c < row.length ? om(row[c]) : "");
        b += "</m:mr>";
    }
    b += "</m:m>";
    const d = matDelims(n.s);
    if (d[0] === "." && d[1] === ".") return b;
    return '<m:d><m:dPr><m:begChr m:val="' + dch(d[0]) + '"/><m:endChr m:val="' + dch(d[1]) + '"/></m:dPr>' + e("e", b) + "</m:d>";
}

// ================================================================== Mise en page (dessin)

export class MOp {
    constructor() { this.t = 0; this.x = 0; this.y = 0; this.w = 0; this.h = 0; this.size = 0; this.sx = 1; this.sy = 1; this.lw = 0; this.s = ""; this.italic = false; this.bold = false; this.pts = null; }
    copy(dx, dy) {
        const o = new MOp();
        Object.assign(o, this);
        o.x = f32(this.x + dx); o.y = f32(this.y + dy);
        if (this.pts) o.pts = this.pts.map((v, i) => f32(v + (i % 2 === 0 ? dx : dy)));
        return o;
    }
}

export class MBox {
    constructor() { this.w = 0; this.asc = 0; this.desc = 0; this.ops = []; this.kind = "ord"; }
    put(b, dx, dy) { for (const o of b.ops) this.ops.push(o.copy(dx, dy)); }
}

const ASC = f32(0.72), DESC = f32(0.22), AXIS = f32(0.26);
// Calcul en flottants 32 bits, comme la version Java (résultats identiques au centième près).
const F = (x) => f32(x);

class L {
    constructor(m, base) { this.m = m; this.base = base; }
    script(size) { return Math.max(F(size * F(0.7)), F(this.base * F(0.5))); }
}

/** measure(s, size, italic, bold) → largeur en points. */
export function layout(tex, size, display, measure) {
    return lay(parse(tex), F(size), display, new L(measure, F(size)));
}

function text(l, s, size, italic, bold) {
    const b = new MBox();
    const o = new MOp();
    o.t = 0; o.s = s; o.size = size; o.italic = italic; o.bold = bold;
    b.ops.push(o);
    b.w = F(F(l.m(s, size, italic, bold)) + (italic ? F(size * F(0.03)) : 0));
    b.asc = F(size * ASC);
    b.desc = F(size * DESC);
    return b;
}

function rule(x, y, w, h) { const o = new MOp(); o.t = 1; o.x = F(x); o.y = F(y); o.w = F(w); o.h = F(h); return o; }
function line(lw, ...pts) { const o = new MOp(); o.t = 2; o.lw = F(lw); o.pts = pts.map(F); return o; }

function lay(n, size, display, l) {
    if (n == null) { const b = new MBox(); b.asc = F(size * ASC); b.desc = F(size * DESC); return b; }
    const bold = n.st === "b";
    switch (n.k) {
        case "row": return row(n.kids, size, display, l);
        case "id": { const b = text(l, n.s, size, n.st !== "p" && !bold, bold); b.kind = "ord"; return b; }
        case "num": case "sym": { const b = text(l, n.s, size, false, bold); b.kind = n.k === "sym" && isOpen(n.s) ? "open" : "ord"; return b; }
        case "text": { const b = text(l, n.s, size, false, bold); b.kind = "ord"; return b; }
        case "op": { const b = text(l, n.s, size, false, bold); b.kind = "op"; return b; }
        case "rel": { const b = text(l, n.s, size, false, bold); b.kind = "rel"; return b; }
        case "punct": { const b = text(l, n.s, size, false, bold); b.kind = "punct"; return b; }
        case "space": { const b = new MBox(); b.w = F(F(n.em) * size); b.kind = "space"; return b; }
        case "fn": return fn(n, size, display, l);
        case "scr": return scr(lay(n.a, size, display, l), n.a, n.b, n.c, size, display, l);
        case "frac": return frac(n, size, display, l);
        case "sqrt": return sqrt(n, size, display, l);
        case "big": return big(n, size, display, l);
        case "delim": return delim(lay(n.a, size, display, l), n.left, n.right, size, l);
        case "acc": return acc(n, size, display, l);
        case "mat": return mat(n, size, display, l);
        default: return text(l, n.s, size, false, bold);
    }
}

const isOpen = (s) => s === "(" || s === "[" || s === "{" || s === "⟨";

function row(kids, size, display, l) {
    const out = new MBox();
    out.asc = F(size * ASC);
    out.desc = F(size * DESC);
    let x = 0, prev = "start";
    for (let i = 0; i < kids.length; i++) {
        const b = lay(kids[i], size, display, l);
        const kind = b.kind;
        let gap = 0;
        if (kind === "op" || prev === "op") gap = prev === "start" || prev === "open" ? 0 : F(size * F(0.22));
        if (kind === "rel" || prev === "rel") gap = prev === "start" ? 0 : F(size * F(0.28));
        if (prev === "punct") gap = F(size * F(0.17));
        if (prev === "fnword" && kind !== "open" && kind !== "delim") gap = F(size * F(0.17));
        if (kind === "fnword" && (prev === "ord" || prev === "delim")) gap = F(size * F(0.17));
        if (prev === "big") gap = F(size * F(0.1));
        x = F(x + gap);
        out.put(b, x, 0);
        x = F(x + b.w);
        out.asc = Math.max(out.asc, b.asc);
        out.desc = Math.max(out.desc, b.desc);
        prev = kind;
    }
    out.w = x;
    out.kind = "ord";
    return out;
}

function fn(n, size, display, l) {
    const name = text(l, n.s, size, false, n.st === "b");
    name.kind = "fnword";
    if (n.b == null && n.c == null) return name;
    if (n.limits && display) { const out = limits(name, n.b, n.c, size, display, l); out.kind = "fnword"; return out; }
    const out = scr(name, null, n.b, n.c, size, display, l);
    out.kind = "fnword";
    return out;
}

function scr(base, baseNode, subN, supN, size, display, l) {
    const ss = l.script(size);
    const sup = supN == null ? null : lay(supN, ss, false, l);
    const sub = subN == null ? null : lay(subN, ss, false, l);
    const out = new MBox();
    out.put(base, 0, 0);
    out.asc = base.asc;
    out.desc = base.desc;
    const italicBase = baseNode != null && baseNode.k === "id";
    const x = base.w;
    let u = 0, d = 0;
    if (sup != null) u = Math.max(F(size * F(0.42)), F(base.asc - F(ss * F(0.38))));
    if (sub != null) d = Math.max(F(size * F(0.22)), F(base.desc + F(ss * F(0.1))));
    if (sup != null && sub != null) {
        const gap = F(F(u - sup.desc) - F(d - sub.asc));
        const min = F(size * F(0.12));
        if (gap < min) { const fix = F(F(min - gap) / 2); u = F(u + fix); d = F(d + fix); }
    }
    let w = 0;
    if (sup != null) {
        out.put(sup, F(x + (italicBase ? F(size * F(0.04)) : 0)), -u);
        out.asc = Math.max(out.asc, F(u + sup.asc));
        w = Math.max(w, F(sup.w + (italicBase ? F(size * F(0.04)) : 0)));
    }
    if (sub != null) {
        out.put(sub, F(x - (italicBase ? F(size * F(0.02)) : 0)), d);
        out.desc = Math.max(out.desc, F(d + sub.desc));
        w = Math.max(w, sub.w);
    }
    out.w = F(F(x + w) + F(size * F(0.04)));
    out.kind = base.kind;
    return out;
}

function frac(n, size, display, l) {
    const fs = display ? size : Math.max(F(size * F(0.8)), F(l.base * F(0.5)));
    const num = lay(n.a, fs, display, l);
    const den = lay(n.b, fs, display, l);
    const t = n.s === "nobar" ? 0 : Math.max(F(0.5), F(size * F(0.05)));
    const a = F(size * AXIS), g = F(size * F(0.14)), pad = F(size * F(0.1));
    const w = F(Math.max(num.w, den.w) + F(2 * pad));
    const out = new MBox();
    const nb = F(F(F(-a - F(t / 2)) - g) - num.desc);
    const db = F(F(F(-a + F(t / 2)) + g) + den.asc);
    out.put(num, F(F(w - num.w) / 2), nb);
    out.put(den, F(F(w - den.w) / 2), db);
    if (t > 0) out.ops.push(rule(F(size * F(0.04)), F(-a - F(t / 2)), F(w - F(size * F(0.08))), t));
    out.w = w;
    out.asc = F(-nb + num.asc);
    out.desc = F(db + den.desc);
    out.kind = "ord";
    return out;
}

function sqrt(n, size, display, l) {
    const body = lay(n.a, size, display, l);
    const t = Math.max(F(0.5), F(size * F(0.05)));
    const g = F(size * F(0.12));
    const top = F(-F(F(body.asc + g) + F(t / 2)));
    const bot = body.desc;
    const h = F(bot - top);
    const idx = n.b == null ? null : lay(n.b, Math.max(F(size * F(0.5)), F(l.base * F(0.45))), false, l);
    const off = idx == null ? 0 : Math.max(0, F(idx.w - F(size * F(0.3))));
    const signW = F(size * F(0.55));
    const out = new MBox();
    const x0 = off;
    out.ops.push(line(t, x0, F(bot - F(F(0.38) * h)), F(x0 + F(size * F(0.12))), F(bot - F(F(0.46) * h)),
        F(x0 + F(size * F(0.3))), bot, F(F(x0 + signW) - F(size * F(0.05))), top, F(F(F(x0 + signW) + body.w) + F(size * F(0.12))), top));
    if (idx != null) out.put(idx, 0, F(F(bot - F(F(0.52) * h)) - idx.desc));
    out.put(body, F(F(x0 + signW) + F(size * F(0.04))), 0);
    out.w = F(F(F(x0 + signW) + body.w) + F(size * F(0.16)));
    out.asc = F(-top + t);
    out.desc = F(body.desc + F(size * F(0.04)));
    if (idx != null) out.asc = Math.max(out.asc, F(-F(F(bot - F(F(0.52) * h)) - idx.desc) + idx.asc));
    out.kind = "ord";
    return out;
}

function bigSymbol(n, size, display, l) {
    const integral = n.s.indexOf("∫") >= 0 || "∬∭∮".includes(n.s);
    const bs = F(size * F(display ? (integral ? 1.9 : 1.7) : (integral ? 1.3 : 1.15)));
    const g = text(l, n.s, bs, false, false);
    const a = F(size * AXIS);
    const baseY = F(-a + F(F(F(F(0.75) - F(0.2)) * bs) / 2));
    const out = new MBox();
    out.put(g, 0, baseY);
    out.w = F(g.w + (integral ? F(size * F(0.05)) : 0));
    out.asc = F(F(F(0.75) * bs) - baseY);
    out.desc = F(baseY + F(F(0.2) * bs));
    out.kind = "big";
    return out;
}

function big(n, size, display, l) {
    const s = bigSymbol(n, size, display, l);
    if (n.b == null && n.c == null) return s;
    if (n.limits && display) return limits(s, n.b, n.c, size, display, l);
    const out = scr(s, null, n.b, n.c, size, display, l);
    out.kind = "big";
    return out;
}

function limits(base, subN, supN, size, display, l) {
    const ss = l.script(size);
    const sup = supN == null ? null : lay(supN, ss, false, l);
    const sub = subN == null ? null : lay(subN, ss, false, l);
    let w = base.w;
    if (sup != null) w = Math.max(w, sup.w);
    if (sub != null) w = Math.max(w, sub.w);
    const out = new MBox();
    out.put(base, F(F(w - base.w) / 2), 0);
    out.asc = base.asc;
    out.desc = base.desc;
    const g = F(size * F(0.08));
    if (sup != null) {
        const y = F(F(-base.asc - g) - sup.desc);
        out.put(sup, F(F(w - sup.w) / 2), y);
        out.asc = F(-y + sup.asc);
    }
    if (sub != null) {
        const y = F(F(base.desc + g) + sub.asc);
        out.put(sub, F(F(w - sub.w) / 2), y);
        out.desc = F(y + sub.desc);
    }
    out.w = w;
    out.kind = base.kind;
    return out;
}

function delim(body, left, right, size, l) {
    const a = F(size * AXIS);
    const half = F(Math.max(F(body.asc - a), F(body.desc + a)) + F(size * F(0.08)));
    const total = Math.max(F(size * F(0.95)), F(2 * half));
    const out = new MBox();
    let x = 0;
    const lb = delimBox(left, total, size, l);
    if (lb != null) { out.put(lb, 0, 0); x = F(x + lb.w); }
    out.put(body, x, 0);
    x = F(x + body.w);
    const rb = delimBox(right, total, size, l);
    if (rb != null) { out.put(rb, x, 0); x = F(x + rb.w); }
    out.w = x;
    out.asc = Math.max(body.asc, F(F(total / 2) + a));
    out.desc = Math.max(body.desc, F(F(total / 2) - a));
    out.kind = "delim";
    return out;
}

function delimBox(d, total, size, l) {
    if (d == null || d === "." || d === "") return null;
    const a = F(size * AXIS);
    const sy = Math.max(1, F(total / F(size * F(0.97))));
    const sx = Math.min(F(1.5), F(1 + F(F(sy - 1) * F(0.18))));
    const b = new MBox();
    const o = new MOp();
    o.t = 0; o.s = d; o.size = size; o.sx = sx; o.sy = sy;
    o.y = F(-a + F(F(F(F(F(0.75) - F(0.22)) / 2) * size) * sy));
    o.x = F(size * F(0.02));
    b.ops.push(o);
    b.w = F(F(F(l.m(d, size, false, false)) * sx) + F(size * F(0.06)));
    b.asc = F(F(total / 2) + a);
    b.desc = F(F(total / 2) - a);
    return b;
}

function acc(n, size, display, l) {
    const body = lay(n.a, size, display, l);
    const out = new MBox();
    out.put(body, 0, 0);
    out.w = body.w; out.asc = body.asc; out.desc = body.desc; out.kind = body.kind;
    const t = Math.max(F(0.5), F(size * F(0.045)));
    const x0 = F(size * F(0.05)), x1 = Math.max(F(body.w - F(size * F(0.02))), F(x0 + F(size * F(0.3))));
    if (n.em < 0) {
        const y = F(body.desc + F(size * F(0.06)));
        out.ops.push(rule(0, y, body.w, t));
        out.desc = F(y + t);
        return out;
    }
    const y = F(-body.asc - F(size * F(0.1)));
    const name = n.left;
    if (name === "vec" || name === "overrightarrow") {
        out.ops.push(line(t, x0, y, x1, y));
        out.ops.push(line(t, F(x1 - F(size * F(0.14))), F(y - F(size * F(0.09))), x1, y, F(x1 - F(size * F(0.14))), F(y + F(size * F(0.09)))));
        out.asc = F(-y + F(size * F(0.1)));
    } else if (name === "bar" || name === "overline") {
        out.ops.push(rule(F(x0 * F(0.5)), y, F(body.w - F(x0 * F(0.5))), t));
        out.asc = F(-y + t);
    } else if (name === "hat" || name === "widehat" || name === "check") {
        const mid = F(body.w / 2), hw = Math.min(F(body.w * F(0.45)), F(size * F(0.25))), hh = F(size * F(0.12));
        if (name === "check") out.ops.push(line(t, F(mid - hw), F(y - hh), mid, y, F(mid + hw), F(y - hh)));
        else out.ops.push(line(t, F(mid - hw), y, mid, F(y - hh), F(mid + hw), y));
        out.asc = F(F(-y + hh) + t);
    } else if (name === "dot" || name === "ddot") {
        const r = F(size * F(0.07)), mid = F(body.w / 2);
        if (name === "dot") out.ops.push(rule(F(mid - F(r / 2)), F(y - r), r, r));
        else {
            out.ops.push(rule(F(F(mid - F(size * F(0.12))) - F(r / 2)), F(y - r), r, r));
            out.ops.push(rule(F(F(mid + F(size * F(0.12))) - F(r / 2)), F(y - r), r, r));
        }
        out.asc = F(-y + r);
    } else {
        const mid = F(body.w / 2), hw = Math.min(F(body.w * F(0.45)), F(size * F(0.25))), hh = F(size * F(0.05));
        out.ops.push(line(t, F(mid - hw), y, F(mid - F(hw / 2)), F(y - F(hh * 2)), F(mid + F(hw / 2)), y, F(mid + hw), F(y - F(hh * 2))));
        out.asc = F(F(-y + F(hh * 2)) + t);
    }
    return out;
}

function mat(n, size, display, l) {
    const env = n.s;
    const aligned = ["aligned", "align", "align*", "split", "eqnarray"].includes(env);
    const cases = env === "cases";
    const small = env === "smallmatrix";
    const cs = small ? F(size * F(0.75)) : size;
    let cols = 0;
    for (const r of n.rows) cols = Math.max(cols, r.length);
    const boxes = [];
    const colW = new Array(Math.max(1, cols)).fill(0);
    for (const r of n.rows) {
        const br = [];
        for (let c = 0; c < r.length; c++) {
            const b = lay(r[c], cs, display && (aligned || env === "gather"), l);
            br.push(b);
            colW[c] = Math.max(colW[c], b.w);
        }
        boxes.push(br);
    }
    const rowGap = F(size * F(aligned ? 0.35 : 0.3));
    const gaps = new Array(Math.max(1, cols)).fill(0);
    for (let c = 1; c < cols; c++) gaps[c] = aligned ? (c % 2 === 1 ? F(size * F(0.28)) : F(size * F(1.2))) : cases ? F(size * 1) : F(size * F(0.8));
    const out = new MBox();
    let total = 0;
    const rowAsc = [], rowDesc = [];
    for (let r = 0; r < boxes.length; r++) {
        let as = F(cs * ASC), ds = F(cs * DESC);
        for (const b of boxes[r]) { as = Math.max(as, b.asc); ds = Math.max(ds, b.desc); }
        rowAsc[r] = as; rowDesc[r] = ds;
        total = F(total + F(F(as + ds) + (r > 0 ? rowGap : 0)));
    }
    const a = F(size * AXIS);
    let y = F(-a - F(total / 2));
    let width = 0;
    for (let c = 0; c < cols; c++) width = F(width + F(colW[c] + gaps[c]));
    for (let r = 0; r < boxes.length; r++) {
        if (r > 0) y = F(y + rowGap);
        const base = F(y + rowAsc[r]);
        let x = 0;
        for (let c = 0; c < cols; c++) {
            x = F(x + gaps[c]);
            if (c < boxes[r].length) {
                const b = boxes[r][c];
                let dx;
                if (aligned) dx = c % 2 === 0 ? F(colW[c] - b.w) : 0;
                else if (cases) dx = 0;
                else dx = F(F(colW[c] - b.w) / 2);
                out.put(b, F(x + dx), base);
            }
            x = F(x + colW[c]);
        }
        y = F(base + rowDesc[r]);
    }
    out.w = width;
    out.asc = F(a + F(total / 2));
    out.desc = F(F(total / 2) - a);
    out.kind = "ord";
    const d = matDelims(env);
    if (d[0] === "." && d[1] === ".") return out;
    const pad = new MBox();
    const p = F(size * F(0.12));
    pad.put(out, p, 0);
    pad.w = F(out.w + F(2 * p));
    pad.asc = out.asc;
    pad.desc = out.desc;
    return delim(pad, d[0], d[1], size, l);
}
