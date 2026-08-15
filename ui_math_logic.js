/*
 * DOMÄNE: UI & Mathematik nach VDI 2322 + Abzugskraft
 * UPDATE:
 * - Strikte Kopplung an MAX_V = 0.80 m/s im gesamten Modul.
 * - Durchsatzvorgabe (m³/h & kg/s) regelt die Bandgeschwindigkeit v dynamisch bis max 0.80 m/s nach.
 * - Tab-Umschaltung und PDF-Export-Lifecycle bereinigt.
 */

const MAX_SYSTEM_V = 0.80; // Hard-Cap: Maximale Bandgeschwindigkeit

// Synchronisation von Input-Feld und Canvas-Slider
function syncSpeed(val, source = 'manual') {
    let elIn = document.getElementById('in_v');
    let elSl = document.getElementById('canvas_v_slider');
    let elVal = document.getElementById('canvas_v_val');

    let numVal = parseFloat(val);
    if (isNaN(numVal)) numVal = 0;
    if (numVal > MAX_SYSTEM_V) numVal = MAX_SYSTEM_V;
    if (numVal < 0) numVal = 0;

    let strVal = numVal.toFixed(2);

    if (elIn && elIn.value !== strVal) elIn.value = strVal;
    if (elSl && parseFloat(elSl.value) !== numVal) elSl.value = numVal;
    if (elVal) elVal.innerText = strVal;

    if (source === 'manual') {
        updateLiveConversion('speed');
    }
}

// Richtwerte nach VDI 2322 Tabelle 2 für "Normale Anlage" (2*m'G + Sigma m'R)
const VDI_DEFAULT_M_LEER = {
    0.40: 16.5,
    0.50: 21.0,
    0.65: 25.5,
    0.80: 35.0,
    1.00: 52.0,
    1.20: 77.0,
    1.40: 89.0,
    1.60: 130.0
};

function onBeltWidthChange() {
    const el_B = document.getElementById('in_B');
    const el_b = document.getElementById('in_b');
    const el_m_leer = document.getElementById('in_m_leer');

    if (!el_B) return;
    const B_val = parseFloat(el_B.value);

    if (el_m_leer && VDI_DEFAULT_M_LEER[B_val] !== undefined) {
        el_m_leer.value = VDI_DEFAULT_M_LEER[B_val].toFixed(1);
    }

    if (el_b) {
        let suggested_b = Math.max(0.20, B_val - 0.20);
        el_b.value = suggested_b.toFixed(2);
    }

    updateGeometry();
}

// BREADCRUMB: [NEU] Umschaltung zwischen einfachem h_silo und erweitertem Silo-Modell
/*
 * DOMÄNE: Silo Steuerung
 * BREADCRUMB: [CLEANUP] toggleSiloMode entfernt, da hydrostatischer Modus entfällt.
 */
function toggleSiloMode() {
    // Entfällt, da Silo-Layout nun immer aktiv ist
}

// BREADCRUMB: [NEU] Slider und Number-Inputs für das Silo synchronisieren
// BREADCRUMB: [UPDATE] syncSilo mit Symmetrieachsen-Limitierung
/*
 * DOMÄNE: Silo Layout Steuerung
 * BREADCRUMB: [FIX] Dynamische Range-Limits entkoppelt von step-Constraints,
 *                   um ein Blockieren der HTML5-Slider zu verhindern.
 */
/*
 * DOMÄNE: Silo Layout Steuerung
 * BREADCRUMB: [FIX] Slider triggern nun am Ende `calculate(false)`, wodurch
 *                   die Abzugskräfte im UI ohne Klick sofort mit aktualisiert werden.
 */
/*
 * DOMÄNE: Silo Layout Steuerung
 * BREADCRUMB: [UPDATE] Default-Werte auf H=10.0m und hop_a=45° aktualisiert.
 */
/*
 * DOMÄNE: Silo Layout Steuerung
 * BREADCRUMB: [FIX] Striktes Clamping für Slider UND Number-Inputs:
 *             1. Numerische Eingaben werden auf denselben Wertebereich wie die Slider begrenzt.
 *             2. Verhindert unbegrenzte oder negative Maße bei Direkteingabe.
 *             3. Dynamische Begrenzung von Auslaufmaßen und Offsets an die Silogrenzen.
 */
function syncSilo(param, value, fromInput = false) {
    let val = parseFloat(value);
    if (isNaN(val)) return;

    // Hilfsfunktion zum Begrenzen (Clamping)
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    let elL = document.getElementById('in_silo_L');
    let elB = document.getElementById('in_silo_B');
    let elH = document.getElementById('in_silo_H');
    let elOL = document.getElementById('in_out_L');
    let elOB = document.getElementById('in_out_B');
    let elOx = document.getElementById('in_out_x');
    let elOy = document.getElementById('in_out_y');
    let elHa = document.getElementById('in_hop_a');

    let L = elL ? (parseFloat(elL.value) || 3.0) : 3.0;
    let B = elB ? (parseFloat(elB.value) || 3.0) : 3.0;
    let H = elH ? (parseFloat(elH.value) || 10.0) : 10.0;
    let oL = elOL ? (parseFloat(elOL.value) || 0.55) : 0.55;
    let oB = elOB ? (parseFloat(elOB.value) || 0.45) : 0.45;
    let ox = elOx ? (parseFloat(elOx.value) || 0.0) : 0.0;
    let oy = elOy ? (parseFloat(elOy.value) || 0.0) : 0.0;
    let ha = elHa ? (parseFloat(elHa.value) || 45.0) : 45.0;

    // 1. Eingabewert zuweisen & feste globale Grenzen erzwingen
    if (param === 'L') L = clamp(val, 1.0, 10.0);
    if (param === 'B') B = clamp(val, 1.0, 10.0);
    if (param === 'H') H = clamp(val, 1.0, 20.0);
    if (param === 'oL') oL = clamp(val, 0.2, 1.0);
    if (param === 'oB') oB = clamp(val, 0.2, 1.0);
    if (param === 'ox') ox = clamp(val, -5.0, 5.0);
    if (param === 'oy') oy = clamp(val, -5.0, 5.0);
    if (param === 'ha') ha = clamp(val, 30.0, 85.0);

    // 2. Geometrische Plausibilität (Auslauf darf nicht größer als Silo sein)
    if (oL > L) oL = L;
    if (oB > B) oB = B;

    // 3. Offset-Grenzen dynamisch anpassen
    const maxOx = Math.max(0, (L - oL) / 2);
    const maxOy = Math.max(0, (B - oB) / 2);

    ox = clamp(ox, -maxOx, maxOx);
    oy = clamp(oy, -maxOy, maxOy);

    // 4. UI synchronisieren (Slider & Number-Inputs aktualisieren)
    const updateControl = (idSuffix, currentVal, decimals = 2, minLimit = null, maxLimit = null) => {
        const sl = document.getElementById('sl_' + idSuffix);
        const inp = document.getElementById('in_' + idSuffix);

        if (sl) {
            if (minLimit !== null) sl.min = minLimit;
            if (maxLimit !== null) sl.max = maxLimit;
            sl.value = currentVal;
        }
        if (inp) {
            if (minLimit !== null) inp.min = minLimit;
            if (maxLimit !== null) inp.max = maxLimit;
            inp.value = decimals === 0 ? Math.round(currentVal) : currentVal.toFixed(decimals);
        }
    };

    updateControl('silo_L', L, 1, 1.0, 10.0);
    updateControl('silo_B', B, 1, 1.0, 10.0);
    updateControl('silo_H', H, 1, 1.0, 20.0);
    updateControl('out_L', oL, 2, 0.2, Math.min(1.0, L));
    updateControl('out_B', oB, 2, 0.2, Math.min(1.0, B));
    updateControl('out_x', ox, 2, -maxOx, maxOx);
    updateControl('out_y', oy, 2, -maxOy, maxOy);
    updateControl('hop_a', ha, 0, 30, 85);

    if (typeof drawSiloCanvas === 'function') drawSiloCanvas();
    if (typeof calcSiloPressure === 'function') calcSiloPressure();
    if (typeof calculate === 'function') calculate(false);
}
/*
 * BREADCRUMB: [UPDATE] switchTab friert nun die Partikelsimulation ein, 
 * um CPU-Ressourcen für die Silo-Eingaben freizugeben.
/*
 * DOMÄNE: UI Tab Management & Performance Routing
 * BREADCRUMB: [UPDATE] Vollständige switchTab-Funktion:
 *             1. Saubere Umschaltung der Tab-Inhalte und aktiven Buttons inklusive display-Toggle.
 *             2. Animations-Pause/Resume zur Ressourcenschonung im Hintergrund.
 *             3. Automatischer Trigger von calcSiloPressure() und drawSiloCanvas() beim Wechsel auf 'silo' / 'tab_silo'.
 */
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
        tab.style.display = 'none';
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Unterstützt sowohl 'silo' als auch 'tab_silo' als ID
    const cleanId = tabId.replace(/^tab_/, '');
    const targetTab = document.getElementById(tabId) || document.getElementById('tab_' + cleanId);
    if (targetTab) {
        targetTab.classList.add('active');
        targetTab.style.display = 'block';
    }

    const targetBtn = document.getElementById(`tab_btn_${cleanId}`) || document.getElementById(`tab_btn_${tabId}`);
    if (targetBtn) {
        targetBtn.classList.add('active');
    } else {
        const fallbackBtn = document.querySelector(`button[onclick*="'${tabId}'"]`) || document.querySelector(`button[onclick*="'${cleanId}'"]`);
        if (fallbackBtn) fallbackBtn.classList.add('active');
    }

    // =========================================================================
    // SILO-TRIGGER: Druckberechnung & Canvas-Rendering sofort aktualisieren
    // =========================================================================
    if (cleanId === 'silo') {
        if (typeof calcSiloPressure === 'function') calcSiloPressure();
        if (typeof drawSiloCanvas === 'function') drawSiloCanvas();
    }

    // =========================================================================
    // PERFORMANCE-BOOST: Simulation im Hintergrund pausieren
    // =========================================================================
    if (typeof isAnimating !== 'undefined' && typeof toggleAnimation === 'function') {
        if (cleanId !== 'eingaben') {
            // Wenn der Tab verlassen wird und die Animation läuft -> einfrieren
            if (isAnimating) {
                window.wasAnimatingBeforeSwitch = true;
                toggleAnimation(); // Pausiert die Engine und ändert den Button auf ▶
            }
        } else {
            // Wenn wir zum Haupt-Tab zurückkehren und sie vorher lief -> fortsetzen
            if (window.wasAnimatingBeforeSwitch && !isAnimating) {
                toggleAnimation(); // Startet die Engine und ändert den Button auf ❚❚
                window.wasAnimatingBeforeSwitch = false;
            }
        }
    }
}

function toggleInfo(infoId) {
    const box = document.getElementById(infoId);
    if (box) {
        box.style.display = box.style.display === 'block' ? 'none' : 'block';
    }
}

function toggleFlowMode() {
    const modeEl = document.querySelector('input[name="flow_mode"]:checked');
    if (!modeEl) return;
    const mode = modeEl.value;

    const cGeom = document.getElementById('container_geom');
    const cVol = document.getElementById('container_vol');
    const cMass = document.getElementById('container_mass');

    if (cGeom) cGeom.style.display = 'none';
    if (cVol) cVol.style.display = 'none';
    if (cMass) cMass.style.display = 'none';

    if (mode === 'geom' && cGeom) cGeom.style.display = 'block';
    if (mode === 'vol' && cVol) cVol.style.display = 'flex';
    if (mode === 'mass' && cMass) cMass.style.display = 'flex';

    updateLiveConversion('toggle');
}



function updateLiveConversion(source = 'other') {
    let elRho = document.getElementById('in_rho');
    let elV = document.getElementById('in_v');
    let elB = document.getElementById('in_b');
    let elHk = document.getElementById('in_h_klappe');
    let elMode = document.querySelector('input[name="flow_mode"]:checked');

    if (!elRho || !elV || !elB || !elHk || !elMode) return;

    const rho = parseFloat(elRho.value) || 0;
    let v = parseFloat(elV.value) || 0;
    const b = parseFloat(elB.value) || 0;
    const h_K = parseFloat(elHk.value) || 0;
    const mode = elMode.value;

    // Maximale Durchsätze bei gegebener Geometrie und v_max = 0.80 m/s
    const max_Iv_limit = b * h_K * MAX_SYSTEM_V * 3600;
    const max_Im_limit = (max_Iv_limit * rho) / 3600;

    let elIv = document.getElementById('in_Iv');
    let elIm = document.getElementById('in_Im');

    if (mode === 'geom') {
        const Iv = b * h_K * v * 3600;
        const Im = (Iv * rho) / 3600;
        const elGeom = document.getElementById('live_geom_display');
        if (elGeom) {
            elGeom.innerText = `Theoretischer Durchsatz: ${Iv.toFixed(2)} m³/h (${Im.toFixed(2)} kg/s)`;
        }

        if (source === 'speed' || source === 'toggle' || source === 'other' || source === 'init') {
            if (elIv) elIv.value = Iv.toFixed(1);
            if (elIm) elIm.value = Im.toFixed(2);
        }

    } else if (mode === 'vol') {
        let Iv = parseFloat(elIv.value) || 0;

        if (source === 'speed') {
            Iv = b * h_K * v * 3600;
            if (Iv > max_Iv_limit) Iv = max_Iv_limit;
            elIv.value = Iv.toFixed(1);
        } else {
            // Volumenstrom diktiert Geschwindigkeit
            let required_v = (b > 0 && h_K > 0) ? Iv / (b * h_K * 3600) : 0;

            if (required_v > MAX_SYSTEM_V) {
                required_v = MAX_SYSTEM_V;
                Iv = max_Iv_limit;
                elIv.value = Iv.toFixed(1);
            }
            syncSpeed(required_v, 'auto');
        }

        const Im = (Iv * rho) / 3600;
        const elMassDisp = document.getElementById('live_mass_display');
        if (elMassDisp) {
            elMassDisp.innerText = `entspricht: ${Im.toFixed(2)} kg/s`;
        }

    } else if (mode === 'mass') {
        let Im = parseFloat(elIm.value) || 0;

        if (source === 'speed') {
            Im = b * h_K * v * rho;
            if (Im > max_Im_limit) Im = max_Im_limit;
            elIm.value = Im.toFixed(2);
        } else {
            // Massenstrom diktiert Geschwindigkeit
            let required_v = (b > 0 && h_K > 0 && rho > 0) ? Im / (b * h_K * rho) : 0;

            if (required_v > MAX_SYSTEM_V) {
                required_v = MAX_SYSTEM_V;
                Im = max_Im_limit;
                elIm.value = Im.toFixed(2);
            }
            syncSpeed(required_v, 'auto');
        }

        const Iv = rho > 0 ? (Im * 3600) / rho : 0;
        const elVolDisp = document.getElementById('live_vol_display');
        if (elVolDisp) {
            elVolDisp.innerText = `entspricht: ${Iv.toFixed(2)} m³/h`;
        }
    }
}

function enforceConstraints() {
    let alpha = document.getElementById('in_alpha');
    let h_klappe = document.getElementById('in_h_klappe');
    let h_klappe_max = document.getElementById('in_h_klappe_max');
    let el_B = document.getElementById('in_B');
    let el_b = document.getElementById('in_b');
    let el_DA = document.getElementById('in_DA');
    let el_DU = document.getElementById('in_DU');
    let el_L_box = document.getElementById('in_L_box');
    let el_L = document.getElementById('in_L');

    let el_rho = document.getElementById('in_rho');
    let el_m_leer = document.getElementById('in_m_leer');
    let el_C = document.getElementById('in_C');
    let el_eta = document.getElementById('in_eta');

    if (!alpha || !h_klappe || !h_klappe_max || !el_B || !el_b) return;

    if (el_rho && el_rho.value !== "") {
        let val = parseFloat(el_rho.value);
        if (!isNaN(val)) {
            if (val < 100) el_rho.value = "100";
            if (val > 5000) el_rho.value = "5000";
        }
    }

    if (el_m_leer && el_m_leer.value !== "") {
        let val = parseFloat(el_m_leer.value);
        if (!isNaN(val)) {
            if (val < 5.0) el_m_leer.value = "5.0";
            if (val > 150.0) el_m_leer.value = "150.0";
        }
    }

    if (el_C && el_C.value !== "") {
        let val = parseFloat(el_C.value);
        if (!isNaN(val)) {
            if (val < 1.0) el_C.value = "1.0";
            if (val > 10.0) el_C.value = "10.0";
        }
    }

    if (el_eta && el_eta.value !== "") {
        let val = parseFloat(el_eta.value);
        if (!isNaN(val)) {
            if (val < 0.30) el_eta.value = "0.30";
            if (val > 0.98) el_eta.value = "0.98";
        }
    }

    if (el_L_box && el_L_box.value !== "") {
        let lbox_val = parseFloat(el_L_box.value);
        if (!isNaN(lbox_val)) {
            if (lbox_val < 0.30) el_L_box.value = "0.30";
            if (lbox_val > 1.00) el_L_box.value = "1.00";
        }
    }

    let el_v = document.getElementById('in_v');
    if (el_v && el_v.value !== "") {
        let v_val = parseFloat(el_v.value);
        if (!isNaN(v_val)) {
            if (v_val > MAX_SYSTEM_V) el_v.value = MAX_SYSTEM_V.toFixed(2);
            if (v_val < 0) el_v.value = "0.00";
        }
    }

    if (el_L && el_L_box) {
        let l_val = parseFloat(el_L.value);
        let lbox_val = parseFloat(el_L_box.value);
        if (!isNaN(l_val) && !isNaN(lbox_val)) {
            let min_L = lbox_val + 0.300;
            if (l_val < min_L) {
                el_L.value = min_L.toFixed(3);
            } else if (l_val > 5.000) {
                el_L.value = "5.000";
            }
        }
    }

    let alpha_val = parseFloat(alpha.value);
    if (alpha_val < 0) alpha.value = 0;
    if (alpha_val > 10) alpha.value = 10;

    if (el_DA) {
        let da_val = parseFloat(el_DA.value);
        if (da_val > 0.500) el_DA.value = 0.500;
        if (da_val < 0.100) el_DA.value = 0.100;
    }
    if (el_DU) {
        let du_val = parseFloat(el_DU.value);
        if (du_val > 0.400) el_DU.value = 0.400;
        if (du_val < 0.100) el_DU.value = 0.100;
    }

    let max_val = parseFloat(h_klappe_max.value);
    if (isNaN(max_val)) max_val = 0.32;
    if (max_val < 0.10) { max_val = 0.10; h_klappe_max.value = 0.10; }
    else if (max_val > 0.50) { max_val = 0.50; h_klappe_max.value = 0.50; }

    let current_val = parseFloat(h_klappe.value);
    if (isNaN(current_val)) current_val = 0.32;
    if (current_val < 0) { h_klappe.value = 0; }
    else if (current_val > max_val) { h_klappe.value = max_val; }

    let B_val = parseFloat(el_B.value);
    if (isNaN(B_val) || B_val < 0.30) { B_val = 0.30; el_B.value = 0.30; }

    let b_val = parseFloat(el_b.value);
    if (isNaN(b_val)) b_val = 0.20;
    if (b_val < 0.20) { b_val = 0.20; el_b.value = 0.20; }
    if (b_val > B_val - 0.10) { b_val = B_val - 0.10; el_b.value = b_val.toFixed(2); }
}

function resetBoxParticles() {
    enforceConstraints();
    const L_box = parseFloat(document.getElementById('in_L_box').value) || 0.55;

    if (typeof particles !== 'undefined' && Array.isArray(particles)) {
        particles = particles.filter(p => !(p.state === 'box' && p.x > L_box && p.x < L_box + 0.15));
    }
}

let currentH = 0;

function updateGeometry() {
    try {
        enforceConstraints();
        const L = parseFloat(document.getElementById('in_L').value) || 0.1;
        const alpha_deg = parseFloat(document.getElementById('in_alpha').value) || 0;
        const DU = parseFloat(document.getElementById('in_DU').value) || 0.1;
        const DA = parseFloat(document.getElementById('in_DA').value) || 0.1;

        const alpha_rad = alpha_deg * Math.PI / 180;
        const rU = Math.abs(DU / 2);
        const rA = Math.abs(DA / 2);

        if (L >= Math.abs(rA - rU)) {
            const beta = Math.asin((rA - rU) / L);
            const gamma = alpha_rad - beta;
            const cy_U = 0;
            const cy_A = L * Math.sin(gamma);
            const U_top_y = cy_U + rU * Math.cos(alpha_rad);
            const A_top_y = cy_A + rA * Math.cos(alpha_rad);
            currentH = A_top_y - U_top_y;
        } else {
            currentH = 0;
        }

        const elHDisp = document.getElementById('live_H_display');
        if (elHDisp) elHDisp.innerText = `Förderhöhe (H): ${currentH.toFixed(3)} m`;

        updateLiveConversion();

        if (typeof isAnimating !== 'undefined' && !isAnimating && typeof drawConveyorCanvas === 'function') {
            drawConveyorCanvas();
        }
    } catch (e) {
        console.warn("Fehler in updateGeometry:", e);
    }
}

function openAbzugModal() {
    const modal = document.getElementById('modal_abzug');
    if (modal) {
        modal.style.display = 'flex';
        if (window.MathJax) {
            MathJax.typesetPromise([modal]).catch((err) => console.log('MathJax Modal Fehler:', err));
        }
    }
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        if (window.MathJax) {
            MathJax.typesetPromise([modal]).catch((err) => console.log('MathJax Fehler:', err));
        }
    }
}

/*
 * BREADCRUMB: [NEU] Wrapper zum Öffnen des Info-Modals der Silo-Berechnung.
 * Erzwingt eine Live-Neuberechnung im Hintergrund, bevor das Modal gerendert wird.
 */
function openSiloCalcModal() {
    if (typeof calcSiloPressure === 'function') {
        calcSiloPressure(); // Zwingt den Solver, den LaTeX-String mit aktuellen Werten neu zu generieren
    }
    openModal('modal_silo_calc_steps');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

/*
 * DOMÄNE: Hauptberechnung DAB & Janssen-Kopplung
 * BREADCRUMB: [UPDATE] Vollständige Umstellung auf Janssen-Schacht & Trichtergewölbe.
 *             Hydrostatischer Fallback wurde restlos entfernt.
 */
/*
 * DOMÄNE: Hauptberechnung DAB & Janssen-Kopplung
 * BREADCRUMB: [UPDATE] Vollständige Umstellung auf Janssen-Schacht & Trichtergewölbe.
 *             Hydrostatischer Fallback wurde restlos entfernt.
 * BREADCRUMB: [FIX] Berechnung gibt nun präzise die Leistung für das Anfahren (Losbrechmoment) 
 *             und den regulären Fließbetrieb getrennt aus. Scherung nutzt horizontalen Druck p_h.
 */
/*
 * DOMÄNE: Hauptberechnung DAB & Janssen-Kopplung
 * BREADCRUMB: [FIX] Fehlende Formelgenerierung für die Streckenlast (info_mL) hinzugefügt, 
 *             damit diese im PDF-Export nicht mehr als "Keine Formeldaten verfügbar" erscheint.
 */
/*
 * DOMÄNE: Hauptberechnung DAB & Janssen-Kopplung
 * BREADCRUMB: [UPDATE] Formel-Outputs (HTML/LaTeX) für den PDF-Druck auf eine 
 *             einheitliche Basis-Schriftgröße (11px) und 12px-Überschriften harmonisiert.
 */
function calculate(switchTabAfterCalc = true) {
    enforceConstraints();

    if (typeof calcSiloPressure === 'function') calcSiloPressure();
    const press = window.lastCalculatedPressures || { p_v_fuell: 0, p_v_fliess: 0, K: 0.3 };

    const rho = parseFloat(document.getElementById('in_rho')?.value) || 0;
    const v = parseFloat(document.getElementById('in_v')?.value) || 0;
    const L = parseFloat(document.getElementById('in_L')?.value) || 0;
    const b = parseFloat(document.getElementById('in_b')?.value) || 0;
    const h_klappe = parseFloat(document.getElementById('in_h_klappe')?.value) || 0;
    const H = currentH;
    const m_leer = parseFloat(document.getElementById('in_m_leer')?.value) || 0;
    const eta = parseFloat(document.getElementById('in_eta')?.value) || 1;
    const C = parseFloat(document.getElementById('in_C')?.value) || 2.0;
    const L_box = parseFloat(document.getElementById('in_L_box')?.value) || 0.55;

    const mu_g = parseFloat(document.getElementById('in_mu_g')?.value) || 0.60;
    const mu_i = parseFloat(document.getElementById('in_mu_i')?.value) || 0.50;

    let ImN_kg_s = 0;
    const modeEl = document.querySelector('input[name="flow_mode"]:checked');
    const mode = modeEl ? modeEl.value : 'geom';

    if (mode === 'geom') {
        ImN_kg_s = (b * h_klappe * v * 3600 * rho) / 3600;
    } else if (mode === 'vol') {
        ImN_kg_s = ((parseFloat(document.getElementById('in_Iv')?.value) || 0) * rho) / 3600;
    } else {
        ImN_kg_s = parseFloat(document.getElementById('in_Im')?.value) || 0;
    }

    const mL = v > 0 ? ImN_kg_s / v : 0;
    const g = 9.81;
    const f = 0.020;

    const FSt = H * g * mL;
    const FH = L * f * g * (mL + m_leer);

    const A_boden = L_box * b;
    const A_scher = b * h_klappe;

    // 1. ANFAHREN (p_v_fuell)
    const F_Boden_Anfahr = press.p_v_fuell * A_boden;
    const p_h_Anfahr = press.K * press.p_v_fuell;
    const F_Scher_Anfahr = p_h_Anfahr * A_scher * mu_i;
    const F_Abzug_Anfahr = (F_Boden_Anfahr * mu_g) + F_Scher_Anfahr;

    const FW_Anfahr = C * FH + FSt + F_Abzug_Anfahr;
    const PW_Anfahr = FW_Anfahr * v;
    const PM_kW_Anfahr = (PW_Anfahr / eta) / 1000;

    // 2. FLIESSBETRIEB (p_v_fliess)
    const F_Boden_Fliess = press.p_v_fliess * A_boden;
    const p_h_Fliess = press.K * press.p_v_fliess;
    const F_Scher_Fliess = p_h_Fliess * A_scher * mu_i;
    const F_Beschl = ImN_kg_s * v;
    const F_Abzug_Fliess = (F_Boden_Fliess * mu_g) + F_Scher_Fliess + F_Beschl;

    const FW_Fliess = C * FH + FSt + F_Abzug_Fliess;
    const PW_Fliess = FW_Fliess * v;
    const PM_kW_Fliess = (PW_Fliess / eta) / 1000;

    // UI Updates
    const fUI = (val) => val >= 1000 ? (val / 1000).toFixed(2) + " kN" : val.toFixed(2) + " N";
    const fTex = (val) => val >= 1000 ? (val / 1000).toFixed(2) + " \\text{ kN}" : val.toFixed(2) + " \\text{ N}";

    document.getElementById('out_mL').innerText = mL.toFixed(2) + " kg/m";
    document.getElementById('out_FAbz').innerText = fUI(F_Abzug_Fliess);
    document.getElementById('out_FSt').innerText = fUI(FSt);
    document.getElementById('out_FH').innerText = fUI(FH);
    document.getElementById('out_FW').innerText = fUI(FW_Fliess);
    document.getElementById('out_PW').innerText = PW_Fliess.toFixed(2) + " W";

    const pmAnfahrEl = document.getElementById('out_PM_Anfahr');
    if (pmAnfahrEl) pmAnfahrEl.innerText = PM_kW_Anfahr.toFixed(2) + " kW";
    document.getElementById('out_PM').innerText = PM_kW_Fliess.toFixed(2) + " kW";

    // LaTeX Outputs (Harmonisiert auf 11px)
    const html_mL = String.raw`
    <div style="font-size: 11px;">
        <p style="margin:0 0 6px 0; text-align:left; font-size: 12px; color: #2c3e50;"><strong>Streckenlast Fördergut (\(m_L'\)):</strong></p>
        $$ m_L' = \frac{\dot{m}}{v} = \frac{${ImN_kg_s.toFixed(2)} \text{ kg/s}}{${v.toFixed(2)} \text{ m/s}} = \mathbf{${mL.toFixed(2)} \text{ kg/m}} $$
    </div>`;

    const html_FAbz = String.raw`
    <div style="font-size: 11px;">
        <p style="margin:0 0 6px 0; text-align:left; font-size: 12px; color: #2c3e50;"><strong>Ermittlung der Abzugskraft (Fließbetrieb):</strong></p>
        $$ F_{\mathrm{Boden}} = p_{v,\text{Fließ}} \cdot L_{\mathrm{box}} \cdot b = ${(press.p_v_fliess / 1000).toFixed(2)} \text{ kPa} \cdot ${L_box} \cdot ${b} = ${fTex(F_Boden_Fliess)} $$
        $$ F_{\mathrm{Scher}} = (K \cdot p_{v,\text{Fließ}}) \cdot (b \cdot h_{\mathrm{Klappe}}) \cdot \mu_i = ${fTex(F_Scher_Fliess)} $$
        $$ F_{\mathrm{Beschl}} = \dot{m} \cdot v = ${ImN_kg_s.toFixed(2)} \text{ kg/s} \cdot ${v.toFixed(2)} \text{ m/s} = ${fTex(F_Beschl)} $$
        $$ F_{\mathrm{Abzug, Fließ}} = F_{\mathrm{Boden}} \cdot \mu_G + F_{\mathrm{Scher}} + F_{\mathrm{Beschl}} = \mathbf{${fTex(F_Abzug_Fliess)}} $$
    </div>`;

    const html_PM_Anfahr = String.raw`
    <div style="font-size: 11px;">
        <p style="margin:0 0 6px 0; text-align:left; font-size: 12px; color: #2c3e50;"><strong>Losbrechmoment / Anfahrlast:</strong></p>
        <p style="font-size:10px; color:#d35400; margin-bottom: 6px;">Anlage fährt gegen maximalen Fülldruck (\(p_{v,\text{Füll}} = ${(press.p_v_fuell / 1000).toFixed(2)}\text{ kPa}\)) an:</p>
        $$ F_{\mathrm{Abzug, Anfahr}} = (p_{v,\text{Füll}} \cdot L_{\mathrm{box}} \cdot b \cdot \mu_G) + (K \cdot p_{v,\text{Füll}} \cdot b \cdot h_{\mathrm{Klappe}} \cdot \mu_i) = ${fTex(F_Abzug_Anfahr)} $$
        $$ F_{W,\mathrm{Anfahr}} = C \cdot F_H + F_{\mathrm{St}} + F_{\mathrm{Abzug, Anfahr}} = ${fTex(FW_Anfahr)} $$
        $$ P_{M,\mathrm{Anfahr}} = \frac{F_{W,\mathrm{Anfahr}} \cdot v}{\eta_{\mathrm{ges}}} = \mathbf{${PM_kW_Anfahr.toFixed(2)} \text{ kW}} $$
    </div>`;

    const html_FSt = String.raw`<div style="font-size: 11px;"><p style="margin:0 0 6px 0; text-align:left; font-size: 12px; color: #2c3e50;"><strong>Steigungswiderstand (\(F_{\mathrm{St}}\)):</strong></p>$$ F_{\mathrm{St}} = H \cdot g \cdot m_L' = ${fTex(FSt)} $$</div>`;
    const html_FH = String.raw`<div style="font-size: 11px;"><p style="margin:0 0 6px 0; text-align:left; font-size: 12px; color: #2c3e50;"><strong>Hauptwiderstand (\(F_H\)):</strong></p>$$ F_H = L \cdot f \cdot g \cdot (m_L' + m_{\mathrm{leer}}') = ${fTex(FH)} $$</div>`;
    const html_FW = String.raw`<div style="font-size: 11px;"><p style="margin:0 0 6px 0; text-align:left; font-size: 12px; color: #2c3e50;"><strong>Gesamtwiderstand (\(F_W\)):</strong></p>$$ F_{W,\mathrm{Fließ}} = C \cdot F_H + F_{\mathrm{St}} + F_{\mathrm{Abzug,Fließ}} = ${fTex(FW_Fliess)} $$</div>`;
    const html_PW = String.raw`<div style="font-size: 11px;"><p style="margin:0 0 6px 0; text-align:left; font-size: 12px; color: #2c3e50;"><strong>Leistung an Trommel (\(P_W\)):</strong></p>$$ P_{W,\mathrm{Fließ}} = F_{W,\mathrm{Fließ}} \cdot v = ${PW_Fliess >= 1000 ? (PW_Fliess / 1000).toFixed(2) + " \\text{ kW}" : PW_Fliess.toFixed(2) + " \\text{ W}"} $$</div>`;
    const html_PM = String.raw`<div style="font-size: 11px;"><p style="margin:0 0 6px 0; text-align:left; font-size: 12px; color: #2c3e50;"><strong>Erforderliche Motorleistung (\(P_{M,\mathrm{erf}}\)):</strong></p>$$ P_{M,\mathrm{erf, Fließ}} = \frac{P_{W,\mathrm{Fließ}}}{\eta_{\mathrm{ges}}} = \mathbf{${PM_kW_Fliess.toFixed(2)} \text{ kW}} $$</div>`;

    const infoMlEl = document.getElementById('info_mL');
    if (infoMlEl) infoMlEl.innerHTML = html_mL;

    document.getElementById('info_FAbz').innerHTML = html_FAbz;
    const pmAnfahrInfoEl = document.getElementById('info_PM_Anfahr');
    if (pmAnfahrInfoEl) pmAnfahrInfoEl.innerHTML = html_PM_Anfahr;
    document.getElementById('info_FSt').innerHTML = html_FSt;
    document.getElementById('info_FH').innerHTML = html_FH;
    document.getElementById('info_FW').innerHTML = html_FW;
    document.getElementById('info_PW').innerHTML = html_PW;
    document.getElementById('info_PM').innerHTML = html_PM;

    window.lastCalculatedMath = {
        info_mL: html_mL,
        info_FAbz: html_FAbz,
        info_PM_Anfahr: html_PM_Anfahr,
        info_FSt: html_FSt,
        info_FH: html_FH,
        info_FW: html_FW,
        info_PW: html_PW,
        info_PM: html_PM
    };

    if (window.MathJax) {
        MathJax.typesetPromise().catch((err) => console.log('MathJax Fehler: ', err));
    }

    if (switchTabAfterCalc) {
        switchTab('ergebnisse');
    }
}

// BREADCRUMB: [NEU] Synchronisiert die Reibwerte und berechnet den Janssen-Druck live
/*
 * DOMÄNE: Silo Schüttgutmechanik & Bodendruck
 * BREADCRUMB: [UPDATE] Vollständiger Zwei-Wege-Sync für Rho, mu_i, mu_w 
 *                   inkl. Umrechnung in kN und Tonnen Auslauflast.
 */

/*
 * DOMÄNE: Silo Schüttgutmechanik & Bodendruck
 * BREADCRUMB: [UPDATE] Vollständiger Zwei-Wege-Sync für Rho, mu_i, mu_w 
 *                   inkl. Umrechnung in kN und Tonnen Auslauflast.
 * BREADCRUMB: [FIX] Cross-Update der Slider und Number-Inputs korrigiert (fromInput-Blockade entfernt).
 */
function syncSiloFriction(param, value) {
    let val = parseFloat(value);
    if (isNaN(val)) return;

    let elRho = document.getElementById('in_silo_rho');
    let slRho = document.getElementById('sl_silo_rho');
    let mainRho = document.getElementById('in_rho');

    let elMuI = document.getElementById('in_silo_mu_i');
    let slMuI = document.getElementById('sl_silo_mu_i');
    let mainMuI = document.getElementById('in_mu_i');

    let elMuW = document.getElementById('in_silo_mu_w');
    let slMuW = document.getElementById('sl_silo_mu_w');

    let rho = elRho ? parseFloat(elRho.value) : 1600;
    let mu_i = elMuI ? parseFloat(elMuI.value) : 0.50;
    let mu_w = elMuW ? parseFloat(elMuW.value) : 0.40;

    if (param === 'rho') {
        rho = Math.max(100, Math.min(5000, val));
        // Immer beide updaten, um Asynchronität zwischen Slider und Num-Input zu verhindern
        if (slRho) slRho.value = rho;
        if (elRho) elRho.value = rho;

        if (mainRho) {
            mainRho.value = rho;
            if (typeof updateLiveConversion === 'function') updateLiveConversion();
        }
    } else if (param === 'mu_i') {
        mu_i = Math.max(0.30, Math.min(1.00, val));
        if (mu_w > mu_i) mu_w = mu_i; // Wandreibung kann physikalisch nicht größer als innere Reibung sein

        if (slMuI) slMuI.value = mu_i;
        if (elMuI) elMuI.value = mu_i.toFixed(2);
        if (mainMuI) mainMuI.value = mu_i.toFixed(2);

        if (slMuW) slMuW.value = mu_w;
        if (elMuW) elMuW.value = mu_w.toFixed(2);
    } else if (param === 'mu_w') {
        mu_w = Math.max(0.10, Math.min(mu_i, val));

        if (slMuW) slMuW.value = mu_w;
        if (elMuW) elMuW.value = mu_w.toFixed(2);
    }

    // Direkt alles grafisch und rechnerisch synchronisieren
    if (typeof calcSiloPressure === 'function') calcSiloPressure();
    if (typeof drawSiloCanvas === 'function') drawSiloCanvas();
    if (typeof calculate === 'function') calculate(false); // Aktualisiert F_Abzug im Haupt-Tab live
}

/*
 * DOMÄNE: Silo Schüttgutmechanik & Bodendruck
 * BREADCRUMB: [UPDATE] Berechnung differenziert nun zwischen Schacht (Janssen-Gleichung) 
 * und Trichter (Spannungsumlagerung & Flächenreduktion). Ein neues Modal gibt alle Rechenschritte sequentiell aus.
 * BREADCRUMB: [FIX] Radikale Überarbeitung der Theorie:
 *             - Füllzustand (Anfahren): Fortsetzung des Schachtdrucks + lokales Eigengewicht (statisch).
 *             - Fließzustand (Dauerbetrieb): Radiales Spannungsfeld nach Jenike entkoppelt den Auslaufdruck.
 */
/*
/*
/*
 * DOMÄNE: Silo Schüttgutmechanik & Bodendruck
 * BREADCRUMB: [UPDATE] Ausgabe im UI-Panel aktualisiert: Beide Druckzustände
 *             (Füllzustand ohne Gewölbe & Fließzustand mit Gewölbe) werden live berechnet und angezeigt.
 */
/*
/*
 * DOMÄNE: Silo Schüttgutmechanik & Bodendruck (Differenzierte Ausgabe)
 * BREADCRUMB: [UPDATE] Trennung von Web-Modal (vollständige Theorie & Herleitungen)
 *             und PDF-Druck (kompakt auf wesentliche Rechenschritte & Werte reduziert).
 */
function calcSiloPressure() {
    const outPvFliess = document.getElementById('out_silo_pv');
    const outTonnesFliess = document.getElementById('out_silo_f_tonnes');
    const outKnFliess = document.getElementById('out_silo_f_kn');

    const outPvFuell = document.getElementById('out_silo_pv_fuell');
    const outTonnesFuell = document.getElementById('out_silo_f_fuell_tonnes');
    const outKnFuell = document.getElementById('out_silo_f_fuell_kn');

    if (!outPvFliess) return;

    const L_s = parseFloat(document.getElementById('in_silo_L')?.value) || 3.0;
    const B_s = parseFloat(document.getElementById('in_silo_B')?.value) || 3.0;
    const H_s = parseFloat(document.getElementById('in_silo_H')?.value) || 10.0;

    const out_L = parseFloat(document.getElementById('in_out_L')?.value) || 0.55;
    const out_B = parseFloat(document.getElementById('in_out_B')?.value) || 0.45;
    const out_x = parseFloat(document.getElementById('in_out_x')?.value) || 0;
    const out_y = parseFloat(document.getElementById('in_out_y')?.value) || 0;

    const rho = parseFloat(document.getElementById('in_silo_rho')?.value) || parseFloat(document.getElementById('in_rho')?.value) || 1600;
    const mu_i = parseFloat(document.getElementById('in_silo_mu_i')?.value) || 0.50;
    const mu_w = parseFloat(document.getElementById('in_silo_mu_w')?.value) || 0.40;

    const g = 9.81;
    const A_s = L_s * B_s;
    const U_s = 2 * (L_s + B_s);
    const R_hyd = (U_s > 0) ? (A_s / U_s) : 0.5;

    // 1. Trichterhöhe bestimmen
    const distsX = [L_s / 2 + out_x - out_L / 2, L_s / 2 - out_x - out_L / 2];
    const distsY = [B_s / 2 + out_y - out_B / 2, B_s / 2 - out_y - out_B / 2];
    const hop_type = document.querySelector('input[name="hop_type"]:checked') ? document.querySelector('input[name="hop_type"]:checked').value : '4';
    const hop_alpha_deg = parseFloat(document.getElementById('in_hop_a')?.value) || 45;
    const hop_alpha = hop_alpha_deg * Math.PI / 180;

    const maxDist = Math.max(...distsX, hop_type === '4' ? Math.max(...distsY) : 0);
    let h_trichter = maxDist * Math.tan(hop_alpha);
    if (h_trichter > H_s) h_trichter = H_s;
    const h_schaft = H_s - h_trichter;

    // 2. Janssen-Parameter
    const phi_i = Math.atan(mu_i);
    const phi_w = Math.atan(mu_w);
    const K = (1 - Math.sin(phi_i)) / (1 + Math.sin(phi_i));
    const denom = Math.max(0.01, mu_w * K);
    const max_p_v = (rho * g * R_hyd) / denom;
    let p_v_schaft = max_p_v * (1 - Math.exp(-(denom * h_schaft) / R_hyd));

    // 3. Füllzustand (Initial Load)
    let p_v_fuell = p_v_schaft + (rho * g * h_trichter * 0.85);

    // 4. Fließzustand (Flow Load)
    const B_out_min = Math.min(out_L, out_B);
    let p_v_fliess = (rho * g * B_out_min) / (2 * K * Math.tan(hop_alpha));

    if (isNaN(p_v_fuell) || p_v_fuell < 0) p_v_fuell = 0;
    if (isNaN(p_v_fliess) || p_v_fliess < 0) p_v_fliess = 0;

    const A_out = out_L * out_B;

    // UI Updates im Panel
    outPvFliess.innerText = (p_v_fliess / 1000).toFixed(2) + " kPa";
    const F_out_fliess_N = p_v_fliess * A_out;
    if (outTonnesFliess) outTonnesFliess.innerText = (F_out_fliess_N / (g * 1000)).toFixed(2) + " t";
    if (outKnFliess) outKnFliess.innerText = `(${(F_out_fliess_N / 1000).toFixed(2)} kN)`;

    if (outPvFuell) outPvFuell.innerText = (p_v_fuell / 1000).toFixed(2) + " kPa";
    const F_out_fuell_N = p_v_fuell * A_out;
    if (outTonnesFuell) outTonnesFuell.innerText = (F_out_fuell_N / (g * 1000)).toFixed(2) + " t";
    if (outKnFuell) outKnFuell.innerText = `(${(F_out_fuell_N / 1000).toFixed(2)} kN)`;

    window.lastCalculatedPressures = { p_v_fuell, p_v_fliess, K };

    const fmt = (num, d = 2) => num.toFixed(d).replace('.', '{,}');

    // =========================================================================
    // A. PDF-REDUZIERTE BLÖCKE (Kompakt auf Rechenschritte & Werte fokussiert)
    // =========================================================================
    const pdf_s1 = String.raw`
        <div style="background: #f8f9fa; padding: 10px 14px; border-radius: 4px; border-left: 4px solid #0056b3; margin-bottom: 12px;">
            <h4 style="color: #0056b3; margin: 0 0 4px 0; font-size: 13px;">1. Schüttgutparameter & Horizontallastverhältnis (Rankine)</h4>
            $$ K = \frac{1 - \sin \phi_i}{1 + \sin \phi_i} = \frac{1 - \sin(${fmt(phi_i * 180 / Math.PI, 1)}^\circ)}{1 + \sin(${fmt(phi_i * 180 / Math.PI, 1)}^\circ)} = \mathbf{${fmt(K, 3)}} $$
            <div style="font-size: 11px; margin-top: 4px; text-align: center;">
                \(\phi_i = \arctan(${fmt(mu_i)}) = ${fmt(phi_i * 180 / Math.PI, 1)}^\circ\) &nbsp;|&nbsp; 
                \(\phi_w = \arctan(${fmt(mu_w)}) = ${fmt(phi_w * 180 / Math.PI, 1)}^\circ\) &nbsp;|&nbsp; 
                \(R_{\mathrm{hyd}} = \frac{A_s}{U_s} = \frac{${fmt(A_s)} \text{ m}^2}{${fmt(U_s)} \text{ m}} = \mathbf{${fmt(R_hyd, 3)} \text{ m}}\)
            </div>
        </div>
    `;

    const pdf_s2 = String.raw`
        <div style="background: #fdfdfd; padding: 10px 14px; border-radius: 4px; border-left: 4px solid #2c3e50; border: 1px solid #e2e8f0; border-left-width: 4px; margin-bottom: 12px;">
            <h4 style="color: #2c3e50; margin: 0 0 4px 0; font-size: 13px;">2. Vertikalspannungsverlauf im Siloschaft (Janssen, 1895)</h4>
            $$ p_{v,\mathrm{max}} = \frac{\rho \cdot g \cdot R_{\mathrm{hyd}}}{\mu_w \cdot K} = \frac{${fmt(rho, 0)} \cdot 9{,}81 \cdot ${fmt(R_hyd, 3)}}{${fmt(mu_w)} \cdot ${fmt(K, 3)}} = ${fmt(max_p_v / 1000)} \text{ kPa} $$
            $$ p_{v,\mathrm{Schaft}} = p_{v,\mathrm{max}} \cdot \left(1 - \exp\left(-\frac{\mu_w \cdot K \cdot h_{\mathrm{Schaft}}}{R_{\mathrm{hyd}}}\right)\right) = \mathbf{${fmt(p_v_schaft / 1000)} \text{ kPa}} \quad (h_{\mathrm{Sch}} = ${fmt(h_schaft)} \text{ m}) $$
        </div>
    `;

    const pdf_s3 = String.raw`
        <div style="background: #fef9e7; padding: 10px 14px; border-radius: 4px; border-left: 4px solid #d35400; margin-bottom: 12px;">
            <h4 style="color: #d35400; margin: 0 0 4px 0; font-size: 13px;">3. Füllzustand (Anfahren / Losbrechmoment ohne Entlastungsgewölbe)</h4>
            $$ p_{v,\mathrm{Füll}} = p_{v,\mathrm{Schaft}} + \rho \cdot g \cdot h_{\mathrm{Trichter}} \cdot 0{,}85 = ${fmt(p_v_schaft / 1000)} + \frac{${fmt(rho, 0)} \cdot 9{,}81 \cdot ${fmt(h_trichter)} \cdot 0{,}85}{1000} = \mathbf{${fmt(p_v_fuell / 1000)} \text{ kPa}} $$
            <p style="font-size: 10px; color: #d35400; margin: 3px 0 0 0;"><strong>Auslegungskriterium:</strong> Maßgebend für das maximale Losbrechmoment des Antriebsmotors.</p>
        </div>
    `;

    const pdf_s4 = String.raw`
        <div style="background: #eafaf1; padding: 10px 14px; border-radius: 4px; border-left: 4px solid #009B4C; margin-bottom: 12px;">
            <h4 style="color: #009B4C; margin: 0 0 4px 0; font-size: 13px;">4. Fließzustand (Stationärer Dauerbetrieb nach Jenike / Johanson)</h4>
            $$ p_{v,\mathrm{Fließ}} = \frac{\rho \cdot g \cdot B_{\mathrm{out,min}}}{2 \cdot K \cdot \tan \alpha_{\mathrm{Hop}}} = \frac{${fmt(rho, 0)} \cdot 9{,}81 \cdot ${fmt(B_out_min)}}{2 \cdot ${fmt(K, 3)} \cdot \tan(${fmt(hop_alpha_deg, 0)}^\circ)} = \mathbf{${fmt(p_v_fliess / 1000)} \text{ kPa}} $$
            <p style="font-size: 10px; color: #009B4C; margin: 3px 0 0 0;"><strong>Auslegungskriterium:</strong> Maßgebend für die stationäre Motorleistung \(P_{M,\mathrm{erf}}\) des Bandförderers.</p>
        </div>
    `;

    // Speichern der komprimierten PDF-Blöcke global für pdf_export.js
    window.lastSiloSteps = { step1: pdf_s1, step2: pdf_s2, step3: pdf_s3, step4: pdf_s4 };

    // =========================================================================
    // B. WEB-MODAL (Vollständige, tiefe physikalische Theorie & Herleitung)
    // =========================================================================
    const stepsDiv = document.getElementById('silo_calc_steps_content');
    if (stepsDiv) {
        stepsDiv.innerHTML = String.raw`
            <div style="background: #f8f9fa; padding: 12px 15px; border-radius: 4px; border-left: 4px solid #0056b3; margin-bottom: 15px;">
                <h3 style="color: #0056b3; margin-top: 0;">1. Schüttgutparameter & Horizontallastverhältnis (Rankine-Theorie)</h3>
                <p>Im Gegensatz zu Newtonschen Fluiden (hydrostatischer Druck \(p = \rho \cdot g \cdot z\)) können Schüttgüter Schubspannungen aufnehmen. Über die innere Reibung \(\mu_i = \tan \phi_i\) stellt sich am Mohrschen Spannungskreis ein fixes Verhältnis zwischen horizontaler und vertikaler Normalspannung ein:</p>
                $$ K = \frac{\sigma_h}{\sigma_v} = \frac{1 - \sin \phi_i}{1 + \sin \phi_i} $$
                <p>Mit den aktuellen Kennwerten ergibt sich:</p>
                <ul>
                    <li>Innerer Reibungswinkel: \(\phi_i = \arctan(\mu_i) = \arctan(${fmt(mu_i)}) = ${fmt(phi_i * 180 / Math.PI, 1)}^\circ\)</li>
                    <li>Wandreibungswinkel: \(\phi_w = \arctan(\mu_w) = \arctan(${fmt(mu_w)}) = ${fmt(phi_w * 180 / Math.PI, 1)}^\circ\)</li>
                    <li>Horizontaldruckbeiwert: \(K = \mathbf{${fmt(K, 3)}}\) (aktiver Grenzzustand nach Rankine)</li>
                    <li>Hydraulischer Radius des Schachts: \(R_{\mathrm{hyd}} = \frac{A_s}{U_s} = \frac{L \cdot B}{2 \cdot (L + B)} = \frac{${fmt(A_s)} \text{ m}^2}{${fmt(U_s)} \text{ m}} = \mathbf{${fmt(R_hyd, 3)} \text{ m}}\)</li>
                </ul>
            </div>

            <div style="background: #fdfdfd; padding: 12px 15px; border-radius: 4px; border: 1px solid #e2e8f0; margin-bottom: 15px;">
                <h3 style="color: #2c3e50; margin-top: 0;">2. Vertikalspannungsverlauf im Siloschaft (Janssen, 1895)</h3>
                <p>An einer horizontalen Schüttgutlamelle der Dicke \(\mathrm{d}z\) herrscht ein Gleichgewicht aus Eigengewicht, vertikalem Druckgradienten und der an der Silowand nach oben gerichteten Wandschubspannung \(\tau_w = \mu_w \cdot \sigma_h = \mu_w \cdot K \cdot \sigma_v\):</p>
                $$ A_s \cdot (\sigma_v + \mathrm{d}\sigma_v) - A_s \cdot \sigma_v + U_s \cdot \tau_w \cdot \mathrm{d}z = A_s \cdot \rho \cdot g \cdot \mathrm{d}z $$
                $$ \frac{\mathrm{d}\sigma_v}{\mathrm{d}z} + \frac{\mu_w \cdot K}{R_{\mathrm{hyd}}} \cdot \sigma_v = \rho \cdot g $$
                <p>Die Integration über die Schafthöhe \(h_{\mathrm{Schaft}} = ${fmt(h_schaft)} \text{ m}\) liefert den charakteristischen Sättigungsverlauf:</p>
                $$ p_{v,\mathrm{max}} = \frac{\rho \cdot g \cdot R_{\mathrm{hyd}}}{\mu_w \cdot K} = \frac{${fmt(rho, 0)} \text{ kg/m}^3 \cdot 9{,}81 \text{ m/s}^2 \cdot ${fmt(R_hyd, 3)} \text{ m}}{${fmt(mu_w)} \cdot ${fmt(K, 3)}} = ${fmt(max_p_v / 1000)} \text{ kPa} $$
                $$ p_{v,\mathrm{Schaft}} = p_{v,\mathrm{max}} \cdot \left(1 - \exp\left(-\frac{\mu_w \cdot K \cdot h_{\mathrm{Schaft}}}{R_{\mathrm{hyd}}}\right)\right) = \mathbf{${fmt(p_v_schaft / 1000)} \text{ kPa}} $$
                <p style="font-size: 0.9em; color: #555;"><em>Erkenntnis:</em> Durch den Wandschub sättigt der Vertikaldruck asymptotisch ab. Ab ca. \(h / R_{\mathrm{hyd}} > 3 \dots 4\) trägt die Silowand das zusätzliche Füllgewicht nahezu vollständig ab.</p>
            </div>

            <div style="background: #fef9e7; padding: 12px 15px; border-radius: 4px; border-left: 4px solid #d35400; margin-bottom: 15px;">
                <h3 style="color: #d35400; margin-top: 0;">3. Füllzustand (Statische Maximallast / Losbrechmoment beim Anfahren)</h3>
                <p>Direkt nach der Befüllung des Silos befindet sich das Gesamtsystem im <strong>aktiven Spannungszustand</strong> (vertikale Hauptspannung größer als horizontale Spannung). Es hat sich noch kein Entlastungsgewölbe im Trichter gebildet:</p>
                <ul>
                    <li>Der volle Janssen-Schachtdruck lastet von oben auf dem Trichter.</li>
                    <li>Das Eigengewicht der Schüttgutsäule im Trichter (\(h_{\mathrm{Trichter}} = ${fmt(h_trichter)} \text{ m}\)) drückt ungemindert auf das ruhende Abzugsband.</li>
                </ul>
                $$ p_{v,\mathrm{Füll}} = p_{v,\mathrm{Schaft}} + \rho \cdot g \cdot h_{\mathrm{Trichter}} \cdot 0{,}85 $$
                $$ p_{v,\mathrm{Füll}} = ${fmt(p_v_schaft / 1000)} \text{ kPa} + \frac{${fmt(rho, 0)} \text{ kg/m}^3 \cdot 9{,}81 \text{ m/s}^2 \cdot ${fmt(h_trichter)} \text{ m} \cdot 0{,}85}{1000} = \mathbf{${fmt(p_v_fuell / 1000)} \text{ kPa}} $$
                <p style="font-size: 0.9em; color: #d35400;"><strong>Praxisrelevanz:</strong> Dieser Wert bestimmt das extrem hohe <strong>Losbrechmoment</strong>, das der Antriebsmotor beim Erststart unter Volllast aufbringen muss.</p>
            </div>

            <div style="background: #eafaf1; padding: 12px 15px; border-radius: 4px; border-left: 4px solid #009B4C;">
                <h3 style="color: #009B4C; margin-top: 0;">4. Fließzustand (Stationärer Dauerbetrieb nach Jenike / Johanson)</h3>
                <p>Sobald das Abzugsband anläuft und Schüttgut abgezogen wird, weicht das Material nach unten aus. Durch die Konvergenz der Trichterwände schlägt das Spannungsfeld an der Trichterspitze in den <strong>passiven Spannungszustand</strong> um (horizontale Spannung wird zur größten Hauptspannung):</p>
                <ul>
                    <li>Es bildet sich ein <strong>radiales Spannungsfeld</strong> (Spannungsgewölbe) aus.</li>
                    <li>Die Last der gesamten Materialsäule darüber stützt sich als Gewölbedruck auf die Trichterwände ab.</li>
                    <li>Die Vertikalspannung an der Auslauföffnung <strong>entkoppelt sich vollständig von der Silohöhe \(H\)</strong> und skaliert nur noch mit der kleinsten Auslaufabmessung \(B_{\mathrm{out,min}} = \min(L_{\mathrm{out}}, B_{\mathrm{out}}) = ${fmt(B_out_min)} \text{ m}\):</li>
                </ul>
                $$ p_{v,\mathrm{Fließ}} = \frac{\rho \cdot g \cdot B_{\mathrm{out,min}}}{2 \cdot K \cdot \tan \alpha_{\mathrm{Hop}}} $$
                $$ p_{v,\mathrm{Fließ}} = \frac{${fmt(rho, 0)} \text{ kg/m}^3 \cdot 9{,}81 \text{ m/s}^2 \cdot ${fmt(B_out_min)} \text{ m}}{2 \cdot ${fmt(K, 3)} \cdot \tan(${fmt(hop_alpha_deg, 0)}^\circ)} = \mathbf{${fmt(p_v_fliess / 1000)} \text{ kPa}} $$
                <p style="font-size: 0.9em; color: #009B4C;"><strong>Konsequenz für den Dauerbetrieb:</strong> Der Druck sinkt im Fließbetrieb drastisch gegenüber dem Füllzustand ab. Dieser Druck bestimmt die kontinuierliche Antriebsleistung \(P_{M,\mathrm{erf,Fließ}}\) des Abzugsförderers.</p>
            </div>
        `;
        if (window.MathJax) {
            MathJax.typesetPromise([stepsDiv]).catch(err => console.log('MathJax Update Error:', err));
        }
    }
}

/*
 * DOMÄNE: App Lifecycle & Initialisierung
 * BREADCRUMB: [UPDATE] initApp um initialen Silo-Sync (3x3x10m, 45°), 
 *             Druckberechnung (calcSiloPressure) und Canvas-Rendering (drawSiloCanvas) erweitert.
 */
function initApp() {
    enforceConstraints();
    const startV = parseFloat(document.getElementById('in_v')?.value) || 0.38;
    syncSpeed(startV, 'init');
    updateGeometry();
    updateLiveConversion('init');

    // Initialer Silo-Sync & Druckberechnung
    if (typeof syncSilo === 'function') syncSilo('H', 10.0, true);
    if (typeof calcSiloPressure === 'function') calcSiloPressure();
    if (typeof drawSiloCanvas === 'function') drawSiloCanvas();

    calculate(false);
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initApp, 60);
} else {
    window.addEventListener('DOMContentLoaded', initApp);
    window.addEventListener('load', initApp);
}