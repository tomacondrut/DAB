/*
 * DOMÄNE: Silo Layout Engine & Spannungsfeld-Visualisierung (Janssen-Gewölbe)
 * BREADCRUMB: [FIX] 3D-Geometrie zeichnet nun die Seitenflächen korrekt über den Trichter-Knick (midV).
 *                   Keil- und Pyramidenform wechseln im 3D-Raum und in der Draufsicht absolut fehlerfrei.
 */

let hoveredSiloDim = null;
let siloHitboxes = [];

// 3D Rotations-Zustand
let siloAngleZ = 0;
let siloAnimId = null;
let lastSiloFrameTime = 0;

// Farbpalette für Achsenzuordnung
const COL_TOP = '52, 152, 219';   // Blau (Z-Ebene)
const COL_FRONT = '46, 204, 113';   // Grün (X-Richtung)
const COL_SIDE = '230, 126, 34';   // Orange (Y-Richtung)

function addSiloHitRect(id, x, y, w, h) {
    siloHitboxes.push({ id, x, y, w, h });
}

function drawSiloDimTick(ctx, x, y, isHovered) {
    ctx.beginPath(); ctx.moveTo(x - 3, y + 3); ctx.lineTo(x + 3, y - 3);
    ctx.strokeStyle = isHovered ? '#d9534f' : '#333';
    ctx.lineWidth = 0.8; ctx.stroke();
}

function checkSiloHover(e) {
    const canvas = document.getElementById('siloCanvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    let newHover = null;
    for (let i = siloHitboxes.length - 1; i >= 0; i--) {
        let b = siloHitboxes[i];
        if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
            newHover = b.id; break;
        }
    }

    if (hoveredSiloDim !== newHover) {
        if (hoveredSiloDim) {
            let lbl = document.getElementById('lbl_' + hoveredSiloDim);
            let inp = document.getElementById('in_' + hoveredSiloDim);
            if (lbl) lbl.classList.remove('highlight-label');
            if (inp) inp.classList.remove('highlight-input');
        }
        hoveredSiloDim = newHover;
        if (hoveredSiloDim) {
            let lbl = document.getElementById('lbl_' + hoveredSiloDim);
            let inp = document.getElementById('in_' + hoveredSiloDim);
            if (lbl) lbl.classList.add('highlight-label');
            if (inp) inp.classList.add('highlight-input');
        }
        drawSiloCanvas();
    }
}

function handleSiloClick() {
    if (hoveredSiloDim) {
        let inp = document.getElementById('in_' + hoveredSiloDim);
        if (inp) { inp.focus(); inp.select(); }
    }
}
/*
 * DOMÄNE: Silo Layout Engine & UI-Interaktion
 * BREADCRUMB: [FIX] Native Touch-Events für das Silo-Canvas hinzugefügt, damit Hover-Effekte 
 *             und Bemaßungen auf Smartphones per Finger angetippt und bedient werden können.
 */
function handleSiloTouch(e) {
    if (!e.touches || e.touches.length === 0) return;
    const touch = e.touches[0];
    checkSiloHover({ clientX: touch.clientX, clientY: touch.clientY });
    handleSiloClick();
}




/*
 * DOMÄNE: Silo Layout Engine & Spannungsfeld-Visualisierung (Janssen / Jenike)
 * BREADCRUMB: [FIX] Abriss-Linie & Spacing-Fehler behoben:
 *             1. Kontinuierliche Kontur-Parametrisierung (Wand -> Kuppel -> Wand) für gleichmäßige Linienabstände.
 *             2. Kontrollpunkte strikt auf [0, width_px] begrenzt (verhindert Bezier-Overshoot außerhalb der Wand).
 *             3. Saubere, überschneidungsfreie Einmündung aller Trajektorien bei jedem beliebigen Trichter-Offset.
 */

/*
 * DOMÄNE: Silo Layout Engine & Spannungsfeld-Visualisierung (Janssen / Jenike)
 * BREADCRUMB: [FIX] Exakter Bogen-Anschluss & harmonisches Spacing:
 *             1. Zielpunkte auf dem obersten Trichterbogen nutzen die exakte Bézier-Parametrisierung des Bogens.
 *             2. Saubere Trennung zwischen Wand-Trajektorien und Bogen-Trajektorien ohne Überlagerung/Abriss.
 *             3. Harmonischer Verlauf aus dem zentrierten oberen Ursprung bei jedem Offset.
 */

function drawJanssenStressArches(ctx, width_px, H_silo_px, hop_H_px, out_center_px, out_w_px, mu_i, mu_w, colorRGB) {
    ctx.save();

    const vert_H_px = H_silo_px - hop_H_px;
    const topY = -H_silo_px;
    const transY = -hop_H_px;
    const siloCenterX = width_px / 2;

    // -------------------------------------------------------------------------
    // 1. TRICHTER: Stützbögen (Passiver Zustand / Radialfeld)
    // -------------------------------------------------------------------------
    let topDomeApexX = siloCenterX;
    let topDomeApexY = transY;

    if (hop_H_px > 5) {
        const numDomes = 4;
        const offsetRatio = out_center_px / width_px;

        for (let k = 1; k <= numDomes; k++) {
            const frac = 1.0 - ((k - 1) / numDomes);
            const y_base = -hop_H_px * frac;

            const bot_leftX = out_center_px - out_w_px / 2;
            const bot_rightX = out_center_px + out_w_px / 2;

            const leftX = 0 * frac + bot_leftX * (1 - frac);
            const rightX = width_px * frac + bot_rightX * (1 - frac);

            const localApexX = leftX + (rightX - leftX) * offsetRatio;
            const localWidth = rightX - leftX;
            const domeRise = localWidth * 0.32;
            const apexY = y_base - domeRise;

            if (k === 1) {
                topDomeApexX = localApexX;
                topDomeApexY = apexY;
            }

            ctx.beginPath();
            ctx.moveTo(leftX, y_base);
            ctx.quadraticCurveTo(localApexX, apexY, rightX, y_base);
            ctx.strokeStyle = `rgba(${colorRGB}, ${0.55 + (1 - frac) * 0.35})`;
            ctx.lineWidth = 1.3;
            ctx.stroke();
        }
    } else {
        topDomeApexX = out_center_px;
    }

    // -------------------------------------------------------------------------
    // 2. SCHACHT: Harmonische Trajektorien (Zentrierter Start oben)
    // -------------------------------------------------------------------------
    if (vert_H_px > 12) {
        const originX = siloCenterX;
        const virtualOriginY = topY - vert_H_px * 0.70;

        ctx.strokeStyle = `rgba(${colorRGB}, 0.60)`;
        ctx.lineWidth = 1.25;

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, topY, width_px, vert_H_px);
        ctx.clip();

        // Mathematisch exakte Punktberechnung auf dem obersten Trichterbogen
        const getDomePoint = (t) => {
            const P0x = 0, P0y = transY;
            const P1x = topDomeApexX, P1y = topDomeApexY;
            const P2x = width_px, P2y = transY;

            const x = Math.pow(1 - t, 2) * P0x + 2 * (1 - t) * t * P1x + Math.pow(t, 2) * P2x;
            const y = Math.pow(1 - t, 2) * P0y + 2 * (1 - t) * t * P1y + Math.pow(t, 2) * P2y;
            return { x, y };
        };

        const drawFlowLine = (targetX, targetY) => {
            const vertDrop = targetY - virtualOriginY;

            const cp1X = originX + (targetX - originX) * 0.05;
            const cp1Y = virtualOriginY + vertDrop * 0.52;

            const rawCp2X = targetX + (originX - targetX) * 0.20;
            const cp2X = Math.max(0, Math.min(width_px, rawCp2X));
            const cp2Y = targetY - vertDrop * 0.16;

            ctx.beginPath();
            ctx.moveTo(originX, virtualOriginY);
            ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, targetX, targetY);
            ctx.stroke();
        };

        // A. Äußere Wandlinien (gestaffelt an die vertikalen Schachtwände)
        const numWallLines = 4;
        for (let i = 1; i <= numWallLines; i++) {
            const frac = i / (numWallLines + 0.85);
            const targetY = topY + frac * vert_H_px;

            drawFlowLine(0, targetY);        // Linke Wand
            drawFlowLine(width_px, targetY); // Rechte Wand
        }

        // B. Innere Linien (exakt auf der Parabel des obersten Trichterbogens verteilt)
        const numDomeLines = 4;
        for (let j = 1; j <= numDomeLines; j++) {
            const t = j / (numDomeLines + 1); // Gleichmäßige Verteilung über t in (0, 1)
            const pt = getDomePoint(t);

            drawFlowLine(pt.x, pt.y);
        }

        ctx.restore();
    }

    ctx.restore();
}

function drawSiloCanvas() {
    const canvas = document.getElementById('siloCanvas');
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H_cvs = canvas.height;

    ctx.clearRect(0, 0, W, H_cvs);
    siloHitboxes = [];

    // Parameter auslesen
    const L_silo = parseFloat(document.getElementById('in_silo_L')?.value) || 3;
    const B_silo = parseFloat(document.getElementById('in_silo_B')?.value) || 3;
    const H_silo = parseFloat(document.getElementById('in_silo_H')?.value) || 6;

    const out_L = parseFloat(document.getElementById('in_out_L')?.value) || 0.55;
    const out_B = parseFloat(document.getElementById('in_out_B')?.value) || 0.45;
    const out_x = parseFloat(document.getElementById('in_out_x')?.value) || 0;
    const out_y = parseFloat(document.getElementById('in_out_y')?.value) || 0;

    const hop_type = document.querySelector('input[name="hop_type"]:checked') ? document.querySelector('input[name="hop_type"]:checked').value : '4';
    const hop_alpha_deg = parseFloat(document.getElementById('in_hop_a')?.value) || 60;
    const hop_alpha = hop_alpha_deg * Math.PI / 180;

    const mu_i = parseFloat(document.getElementById('in_silo_mu_i')?.value) || 0.50;
    const mu_w = parseFloat(document.getElementById('in_silo_mu_w')?.value) || 0.40;

    // Trichterhöhe ermitteln
    const distsX = [L_silo / 2 + out_x - out_L / 2, L_silo / 2 - out_x - out_L / 2];
    const distsY = [B_silo / 2 + out_y - out_B / 2, B_silo / 2 - out_y - out_B / 2];
    const maxDist = Math.max(...distsX, hop_type === '4' ? Math.max(...distsY) : 0);

    let hop_H = maxDist * Math.tan(hop_alpha);
    if (hop_H > H_silo) hop_H = H_silo;
    const vert_H = H_silo - hop_H;

    // 4-ZONEN-LAYOUT (Top, Front, Side, 3D)
    const pad = 25;
    const colW = W / 4;
    const hMax = H_cvs - 2 * pad;

    const s = Math.min((colW - 2 * pad) / Math.max(L_silo, B_silo), hMax / H_silo) * 0.90;
    const techFont = '10px Consolas, "Courier New", monospace';
    const dimColor = '#888888';

    // =========================================================================
    // 1. DRAUFSICHT (Spalte 1, X-Y Ebene, BLAU)
    // BREADCRUMB: [FIX] Auslassöffnung bleibt auch bei Keiltrichter (hop_type 2) 
    //             strikt auf out_B begrenzt (kein Überstrecken auf volle Silobreite).
    // =========================================================================
    const tx_top = (colW - L_silo * s) / 2;
    const ty_top = pad + (hMax - B_silo * s) / 2;

    ctx.save();
    ctx.translate(tx_top, ty_top);

    const cx = (L_silo / 2) * s;
    const cy = (B_silo / 2) * s;
    const cox = cx + (out_x * s);
    const coy = cy - (out_y * s);

    const oL_px = out_L * s;
    const oB_px = out_B * s;
    const ox_rect = cox - oL_px / 2;
    const oy_rect = coy - oB_px / 2;

    // Hintergrund Deckfläche
    ctx.fillStyle = `rgba(${COL_TOP}, 0.15)`;
    ctx.fillRect(0, 0, L_silo * s, B_silo * s);
    ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 1.5;
    ctx.strokeRect(0, 0, L_silo * s, B_silo * s);

    // Auslauföffnung immer mit realer Auslaufbreite (oB_px)
    ctx.fillStyle = `rgba(${COL_TOP}, 0.6)`;
    ctx.fillRect(ox_rect, oy_rect, oL_px, oB_px);
    ctx.strokeRect(ox_rect, oy_rect, oL_px, oB_px);

    // Trichterkanten
    ctx.beginPath();
    if (hop_type === '4') {
        ctx.moveTo(0, 0); ctx.lineTo(ox_rect, oy_rect);
        ctx.moveTo(L_silo * s, 0); ctx.lineTo(ox_rect + oL_px, oy_rect);
        ctx.moveTo(0, B_silo * s); ctx.lineTo(ox_rect, oy_rect + oB_px);
        ctx.moveTo(L_silo * s, B_silo * s); ctx.lineTo(ox_rect + oL_px, oy_rect + oB_px);
    } else {
        // Bei 2 geneigten Wänden (X): Knicklinien entlang der Neigungsflächen zur Öffnung
        ctx.moveTo(0, 0); ctx.lineTo(ox_rect, 0);
        ctx.lineTo(ox_rect, B_silo * s); ctx.lineTo(0, B_silo * s);
        ctx.moveTo(L_silo * s, 0); ctx.lineTo(ox_rect + oL_px, 0);
        ctx.lineTo(ox_rect + oL_px, B_silo * s); ctx.lineTo(L_silo * s, B_silo * s);

        // Begrenzungskanten der Stirnwände zur Öffnung
        ctx.moveTo(ox_rect, 0); ctx.lineTo(ox_rect, oy_rect);
        ctx.moveTo(ox_rect + oL_px, 0); ctx.lineTo(ox_rect + oL_px, oy_rect);
        ctx.moveTo(ox_rect, B_silo * s); ctx.lineTo(ox_rect, oy_rect + oB_px);
        ctx.moveTo(ox_rect + oL_px, B_silo * s); ctx.lineTo(ox_rect + oL_px, oy_rect + oB_px);
    }
    ctx.strokeStyle = '#7f8c8d'; ctx.lineWidth = 1; ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx, -10); ctx.lineTo(cx, B_silo * s + 10);
    ctx.moveTo(-10, cy); ctx.lineTo(L_silo * s + 10, cy);
    ctx.strokeStyle = '#bdc3c7'; ctx.lineWidth = 0.8; ctx.setLineDash([8, 3, 2, 3]); ctx.stroke(); ctx.setLineDash([]);

    ctx.font = techFont;

    // Bemaßungen Top View
    let hL = hoveredSiloDim === 'silo_L';
    let yL = -20;
    ctx.beginPath(); ctx.moveTo(0, yL); ctx.lineTo(L_silo * s, yL);
    ctx.strokeStyle = hL ? '#d9534f' : dimColor; ctx.lineWidth = hL ? 1.2 : 0.6; ctx.stroke();
    drawSiloDimTick(ctx, 0, yL, hL); drawSiloDimTick(ctx, L_silo * s, yL, hL);
    ctx.fillStyle = hL ? '#d9534f' : '#222'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(`L=${L_silo.toFixed(1)}m`, cx, yL - 2);
    addSiloHitRect('silo_L', tx_top, ty_top + yL - 12, L_silo * s, 20);

    let hB = hoveredSiloDim === 'silo_B';
    let xB = -20;
    ctx.beginPath(); ctx.moveTo(xB, 0); ctx.lineTo(xB, B_silo * s);
    ctx.strokeStyle = hB ? '#d9534f' : dimColor; ctx.lineWidth = hB ? 1.2 : 0.6; ctx.stroke();
    drawSiloDimTick(ctx, xB, 0, hB); drawSiloDimTick(ctx, xB, B_silo * s, hB);
    ctx.save(); ctx.translate(xB - 3, cy); ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = hB ? '#d9534f' : '#222'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(`B=${B_silo.toFixed(1)}m`, 0, 0); ctx.restore();
    addSiloHitRect('silo_B', tx_top + xB - 15, ty_top, 20, B_silo * s);

    ctx.fillStyle = '#2c3e50'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center';
    ctx.fillText("Draufsicht (X-Y)", L_silo * s / 2, -35);
    ctx.restore();

    // =========================================================================
    // 2. VORDERANSICHT (Spalte 2, Front X-Z, GRÜN)
    // =========================================================================
    const tx_front = colW + (colW - L_silo * s) / 2;
    const ty_bottom = H_cvs - pad - (hMax - H_silo * s) / 2;

    ctx.save();
    ctx.translate(tx_front, ty_bottom);

    ctx.beginPath();
    ctx.moveTo(0, -H_silo * s);
    ctx.lineTo(L_silo * s, -H_silo * s);
    ctx.lineTo(L_silo * s, -hop_H * s);
    ctx.lineTo(ox_rect + oL_px, 0);
    ctx.lineTo(ox_rect, 0);
    ctx.lineTo(0, -hop_H * s);
    ctx.closePath();
    ctx.fillStyle = `rgba(${COL_FRONT}, 0.12)`;
    ctx.fill();
    ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 1.5; ctx.stroke();

    drawJanssenStressArches(ctx, L_silo * s, H_silo * s, hop_H * s, cox, oL_px, mu_i, mu_w, COL_FRONT);

    if (vert_H > 0) {
        ctx.beginPath(); ctx.moveTo(0, -hop_H * s); ctx.lineTo(L_silo * s, -hop_H * s);
        ctx.strokeStyle = '#95a5a6'; ctx.lineWidth = 0.8; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
    }

    ctx.beginPath();
    ctx.moveTo(cx, -H_silo * s - 8); ctx.lineTo(cx, 10);
    ctx.strokeStyle = '#bdc3c7'; ctx.lineWidth = 0.8; ctx.setLineDash([8, 3, 2, 3]); ctx.stroke(); ctx.setLineDash([]);

    ctx.fillStyle = '#2c3e50'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center';
    ctx.fillText("Vorderansicht (X-Z)", L_silo * s / 2, -H_silo * s - 20);

    let hH = hoveredSiloDim === 'silo_H';
    ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(-15, -H_silo * s);
    ctx.strokeStyle = hH ? '#d9534f' : dimColor; ctx.lineWidth = hH ? 1.2 : 0.6; ctx.stroke();
    drawSiloDimTick(ctx, -15, 0, hH); drawSiloDimTick(ctx, -15, -H_silo * s, hH);
    ctx.fillStyle = hH ? '#d9534f' : '#222'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.font = techFont;
    ctx.fillText(`H=${H_silo.toFixed(1)}m`, -18, -H_silo * s / 2);
    addSiloHitRect('silo_H', tx_front - 50, ty_bottom - H_silo * s, 45, H_silo * s);

    ctx.restore();

    // =========================================================================
    // 3. SEITENANSICHT (Spalte 3, Side Y-Z, ORANGE)
    // BREADCRUMB: [FIX] Bei 2 Wänden (Keil in X) fällt die Stirnwand senkrecht ab 
    //             und setzt unten auf die reale Auslaufbreite ab.
    // =========================================================================
    const tx_side = colW * 2 + (colW - B_silo * s) / 2;
    ctx.save();
    ctx.translate(tx_side, ty_bottom);

    const coy_side = (B_silo / 2 + out_y) * s;
    const oy_rect_side = coy_side - oB_px / 2;
    const hop_H_side = (hop_type === '4') ? hop_H : 0;

    ctx.beginPath();
    ctx.moveTo(0, -H_silo * s);
    ctx.lineTo(B_silo * s, -H_silo * s);
    if (hop_type === '4') {
        ctx.lineTo(B_silo * s, -hop_H * s);
        ctx.lineTo(oy_rect_side + oB_px, 0);
        ctx.lineTo(oy_rect_side, 0);
        ctx.lineTo(0, -hop_H * s);
    } else {
        // Bei Keil fällt die Seitenwand senkrecht ab und schließt unten auf die Öffnung
        ctx.lineTo(B_silo * s, 0);
        ctx.lineTo(oy_rect_side + oB_px, 0);
        ctx.lineTo(oy_rect_side, 0);
        ctx.lineTo(0, 0);
    }
    ctx.closePath();
    ctx.fillStyle = `rgba(${COL_SIDE}, 0.12)`;
    ctx.fill();
    ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 1.5; ctx.stroke();

    drawJanssenStressArches(ctx, B_silo * s, H_silo * s, hop_H_side * s, coy_side, oB_px, mu_i, mu_w, COL_SIDE);

    if (vert_H > 0) {
        ctx.beginPath(); ctx.moveTo(0, -hop_H * s); ctx.lineTo(B_silo * s, -hop_H * s);
        ctx.strokeStyle = '#95a5a6'; ctx.lineWidth = 0.8; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
    }

    ctx.beginPath();
    ctx.moveTo(cy, -H_silo * s - 8); ctx.lineTo(cy, 10);
    ctx.strokeStyle = '#bdc3c7'; ctx.lineWidth = 0.8; ctx.setLineDash([8, 3, 2, 3]); ctx.stroke(); ctx.setLineDash([]);

    ctx.fillStyle = '#2c3e50'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center';
    ctx.fillText("Seitenansicht (Y-Z)", B_silo * s / 2, -H_silo * s - 20);
    ctx.restore();

    /*
     * DOMÄNE: Silo Layout Engine & Spannungsfeld-Visualisierung (3D-Perspektive)
     * BREADCRUMB: [UPDATE] Farbpalette der 3D-Ansicht an die hellen Töne der 2D-Projektionen angepasst:
     *             - Deck-/Bodenfläche in hellem Blau (COL_TOP)
     *             - Front- & Rückwände in hellem Grün (COL_FRONT)
     *             - Seitenflächen in hellem Orange (COL_SIDE)
     *             - Verdeckte Kanten ("X-Ray") in sehr hellem Grau
     */

    // =========================================================================
    // 4. 3D-PERSPEKTIVE (CAD-Stil: Helle Flächenfarben, verdeckte Kanten sehr hell)
    // =========================================================================
    ctx.save();
    const cx_3d = colW * 3 + colW / 2;
    const cy_3d = H_cvs / 2 + 15;
    ctx.translate(cx_3d, cy_3d);

    // Kameraneigung (Blickwinkel von schräg oben)
    const pitch = 22 * Math.PI / 180;
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    const cosA = Math.cos(siloAngleZ);
    const sinA = Math.sin(siloAngleZ);

    const camDist = Math.max(L_silo, B_silo, H_silo) * 2.8;

    function project3D(x, y, z) {
        // Rotation um Z
        const rotX = x * cosA - y * sinA;
        const rotY = x * sinA + y * cosA;
        const rotZ = z - H_silo / 2;

        // Neigung (Pitch)
        const yCam = rotY * cosP - rotZ * sinP;
        const zCam = rotY * sinP + rotZ * cosP;
        const xCam = rotX;

        // Perspektivische Skalierung
        const dist = camDist + yCam;
        const fov = camDist / Math.max(0.1, dist);

        const px = xCam * fov * s * 0.95;
        const py = -zCam * fov * s * 0.95;
        return { x: px, y: py, depth: dist };
    }

    const halfL = L_silo / 2;
    const halfB = B_silo / 2;
    const zTop = H_silo;
    const zHop = hop_H;
    const zBot = 0;

    // Eckpunkte
    const topV = [
        project3D(-halfL, -halfB, zTop), project3D(halfL, -halfB, zTop),
        project3D(halfL, halfB, zTop), project3D(-halfL, halfB, zTop)
    ];

    const midV = [
        project3D(-halfL, -halfB, zHop), project3D(halfL, -halfB, zHop),
        project3D(halfL, halfB, zHop), project3D(-halfL, halfB, zHop)
    ];

    const oxL = out_x - out_L / 2;
    const oxR = out_x + out_L / 2;
    const oyB_actual = (hop_type === '4') ? (out_y - out_B / 2) : -halfB;
    const oyT_actual = (hop_type === '4') ? (out_y + out_B / 2) : halfB;

    const botV = [
        project3D(oxL, oyB_actual, zBot), project3D(oxR, oyB_actual, zBot),
        project3D(oxR, oyT_actual, zBot), project3D(oxL, oyT_actual, zBot)
    ];

    const axisTop = project3D(0, 0, zTop + 0.6);
    const axisBot = project3D(0, 0, zBot - 0.6);

    // CCW-Winding Algorithmus zur Sichtbarkeitsprüfung
    function isFrontFacing(pts) {
        let sum = 0;
        for (let i = 0; i < pts.length; i++) {
            const p1 = pts[i];
            const p2 = pts[(i + 1) % pts.length];
            sum += (p2.x - p1.x) * (p2.y + p1.y);
        }
        return sum > 0;
    }

    // Die 10 Flächen des Silos definieren (helle, harmonische Pastelltöne)
    const faces = [
        { id: 'top', pts: [topV[0], topV[1], topV[2], topV[3]], color: 'rgb(180, 218, 245)' },      // Helles Blau (Draufsicht)
        { id: 'bottom', pts: [botV[0], botV[3], botV[2], botV[1]], color: 'rgb(145, 198, 235)' },   // Blau abgedunkelt

        { id: 'front_s', pts: [topV[0], midV[0], midV[1], topV[1]], color: 'rgb(185, 238, 205)' },  // Helles Grün (Vorderansicht)
        { id: 'back_s', pts: [topV[2], midV[2], midV[3], topV[3]], color: 'rgb(168, 226, 190)' },   // Grün Schattierung
        { id: 'right_s', pts: [topV[1], midV[1], midV[2], topV[2]], color: 'rgb(250, 208, 170)' }, // Helles Orange (Seitenansicht)
        { id: 'left_s', pts: [topV[3], midV[3], midV[0], topV[0]], color: 'rgb(245, 192, 148)' },  // Orange Schattierung

        { id: 'front_t', pts: [midV[0], botV[0], botV[1], midV[1]], color: 'rgb(165, 228, 188)' },  // Trichter Front (Grün)
        { id: 'back_t', pts: [midV[2], botV[2], botV[3], midV[3]], color: 'rgb(150, 215, 175)' },   // Trichter Back (Grün)
        { id: 'right_t', pts: [midV[1], botV[1], botV[2], midV[2]], color: 'rgb(245, 195, 150)' }, // Trichter Right (Orange)
        { id: 'left_t', pts: [midV[3], botV[3], botV[0], midV[0]], color: 'rgb(238, 180, 130)' }   // Trichter Left (Orange)
    ];

    faces.forEach(f => { f.vis = isFrontFacing(f.pts); });

    // Topologie der Kanten definieren
    const edgeDefs = [
        { p1: topV[0], p2: topV[1], f1: 'top', f2: 'front_s' },
        { p1: topV[1], p2: topV[2], f1: 'top', f2: 'right_s' },
        { p1: topV[2], p2: topV[3], f1: 'top', f2: 'back_s' },
        { p1: topV[3], p2: topV[0], f1: 'top', f2: 'left_s' },

        { p1: topV[0], p2: midV[0], f1: 'front_s', f2: 'left_s' },
        { p1: topV[1], p2: midV[1], f1: 'front_s', f2: 'right_s' },
        { p1: topV[2], p2: midV[2], f1: 'back_s', f2: 'right_s' },
        { p1: topV[3], p2: midV[3], f1: 'back_s', f2: 'left_s' },

        ...(vert_H > 0.01 ? [
            { p1: midV[0], p2: midV[1], f1: 'front_s', f2: 'front_t' },
            { p1: midV[1], p2: midV[2], f1: 'right_s', f2: 'right_t' },
            { p1: midV[2], p2: midV[3], f1: 'back_s', f2: 'back_t' },
            { p1: midV[3], p2: midV[0], f1: 'left_s', f2: 'left_t' }
        ] : []),

        { p1: midV[0], p2: botV[0], f1: 'front_t', f2: 'left_t' },
        { p1: midV[1], p2: botV[1], f1: 'front_t', f2: 'right_t' },
        { p1: midV[2], p2: botV[2], f1: 'back_t', f2: 'right_t' },
        { p1: midV[3], p2: botV[3], f1: 'back_t', f2: 'left_t' },

        { p1: botV[0], p2: botV[1], f1: 'bottom', f2: 'front_t' },
        { p1: botV[1], p2: botV[2], f1: 'bottom', f2: 'right_t' },
        { p1: botV[2], p2: botV[3], f1: 'bottom', f2: 'back_t' },
        { p1: botV[3], p2: botV[0], f1: 'bottom', f2: 'left_t' }
    ];

    const faceMap = new Map(faces.map(f => [f.id, f]));
    edgeDefs.forEach(e => {
        const face1 = faceMap.get(e.f1);
        const face2 = faceMap.get(e.f2);
        e.isForeground = (face1 && face1.vis) || (face2 && face2.vis);
    });

    // -------------------------------------------------------------------------
    // CAD RENDERING (1. Opaque Flächen -> 2. Verdeckte Kanten -> 3. Vollkanten)
    // -------------------------------------------------------------------------

    // 1. Deckende Vordergrundflächen füllen
    const visibleFaces = faces.filter(f => f.vis);
    visibleFaces.forEach(f => {
        f.avgDepth = f.pts.reduce((sum, p) => sum + p.depth, 0) / f.pts.length;
    });
    visibleFaces.sort((a, b) => b.avgDepth - a.avgDepth);

    visibleFaces.forEach(f => {
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.moveTo(f.pts[0].x, f.pts[0].y);
        for (let i = 1; i < f.pts.length; i++) {
            ctx.lineTo(f.pts[i].x, f.pts[i].y);
        }
        ctx.closePath();
        ctx.fill();
    });

    // 2. Verdeckte Kanten (Gestrichelt, sehr helles Grau) - Overlay über den Flächen
    ctx.strokeStyle = '#ffffff'; // bzw. 'rgba(255, 255, 255, 0.85)'
    ctx.lineWidth = 1.0;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    edgeDefs.filter(e => !e.isForeground).forEach(e => {
        ctx.moveTo(e.p1.x, e.p1.y);
        ctx.lineTo(e.p2.x, e.p2.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. Sichtbare Vordergrundkanten (Scharf & durchgezogen)
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    edgeDefs.filter(e => e.isForeground).forEach(e => {
        ctx.moveTo(e.p1.x, e.p1.y);
        ctx.lineTo(e.p2.x, e.p2.y);
    });
    ctx.stroke();

    // 4. Symmetrieachse (Rot strichpunktiert)
    ctx.beginPath();
    ctx.moveTo(axisTop.x, axisTop.y);
    ctx.lineTo(axisBot.x, axisBot.y);
    ctx.strokeStyle = '#c0392b';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([10, 3, 2, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#2c3e50';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText("3D-Ansicht (Perspektivisch)", 0, -H_cvs / 2 + 20);

    ctx.restore();
}

// 3D-Animationsschleife
function renderSiloLoop(timestamp) {
    if (!lastSiloFrameTime) lastSiloFrameTime = timestamp;
    const dt = (timestamp - lastSiloFrameTime) / 1000;
    lastSiloFrameTime = timestamp;

    siloAngleZ += dt * 0.45;
    if (siloAngleZ > Math.PI * 2) siloAngleZ -= Math.PI * 2;

    const siloTab = document.getElementById('silo');
    if (siloTab && siloTab.classList.contains('active')) {
        drawSiloCanvas();
    }

    siloAnimId = requestAnimationFrame(renderSiloLoop);
}

function bootSiloCanvas() {
    const canvas = document.getElementById('siloCanvas');
    if (canvas) {
        // Maus-Events (Desktop)
        canvas.addEventListener('mousemove', checkSiloHover);
        canvas.addEventListener('click', handleSiloClick);
        canvas.addEventListener('mouseout', () => { checkSiloHover({ clientX: 0, clientY: 0 }); });

        // Touch-Events (Mobil)
        canvas.addEventListener('touchstart', handleSiloTouch, { passive: true });
        canvas.addEventListener('touchmove', (e) => {
            // Verhindert das Scrollen der Seite, wenn man direkt auf eine Bemaßung wischt
            if (hoveredSiloDim) e.preventDefault();
            handleSiloTouch(e);
        }, { passive: false });
    }

    if (!siloAnimId) {
        lastSiloFrameTime = performance.now();
        siloAnimId = requestAnimationFrame(renderSiloLoop);
    }
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(bootSiloCanvas, 60);
} else {
    window.addEventListener('DOMContentLoaded', bootSiloCanvas);
    window.addEventListener('load', bootSiloCanvas);
}