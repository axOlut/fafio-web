// Dessin des formules (boîtes de js/math.js) sur un canvas : PDF, aperçu, vignettes.
import { layout } from "../math.js";

export const MATH_FONT = '"Cambria Math", "STIX Two Math", Cambria, "Times New Roman", "Noto Serif", Times, serif';

function font(size, italic, bold) {
    return `${italic ? "italic " : ""}${bold ? "bold " : ""}${size}px ${MATH_FONT}`;
}

export function measurer(ctx) {
    return (s, size, italic, bold) => {
        ctx.font = font(size, italic, bold);
        return ctx.measureText(s).width;
    };
}

/** Met en page [tex] avec les mesures du canvas [ctx]. */
export function mathBox(ctx, tex, size, display) {
    ctx.save();
    const b = layout(tex, size, display, measurer(ctx));
    ctx.restore();
    return b;
}

/** Dessine la boîte [box] avec sa ligne de base en (x, y). */
export function drawMath(ctx, box, x, y, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (const o of box.ops) {
        if (o.t === 0) {
            ctx.font = font(o.size, o.italic, o.bold);
            if (o.sx !== 1 || o.sy !== 1) {
                ctx.save();
                ctx.translate(x + o.x, y + o.y);
                ctx.scale(o.sx, o.sy);
                ctx.fillText(o.s, 0, 0);
                ctx.restore();
            } else ctx.fillText(o.s, x + o.x, y + o.y);
        } else if (o.t === 1) {
            ctx.fillRect(x + o.x, y + o.y, o.w, o.h);
        } else if (o.pts) {
            ctx.lineWidth = o.lw;
            ctx.beginPath();
            ctx.moveTo(x + o.pts[0], y + o.pts[1]);
            for (let i = 2; i < o.pts.length; i += 2) ctx.lineTo(x + o.pts[i], y + o.pts[i + 1]);
            ctx.stroke();
        }
    }
    ctx.restore();
}
