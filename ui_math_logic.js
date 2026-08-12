/*
 * [BREADCRUMB: 2026-08-09]
 * DOMÄNE: UI & Mathematik nach VDI 2322 + Abzugskraft
 * UPDATE: 
 * - syncSpeed Funktion für den neuen Canvas Slider.
 */

// NEU: Synchronisation von Input-Feld und Canvas-Slider
// BREADCRUMB: [EDIT] MAX_V von 2.0 m/s auf 0.8 m/s beschränkt
function syncSpeed(val, source = 'manual') {
    let elIn = document.getElementById('in_v');
    let elSl = document.getElementById('canvas_v_slider');
    let elVal = document.getElementById('canvas_v_val');

    let numVal = parseFloat(val);
    if (isNaN(numVal)) numVal = 0;
    if (numVal > 0.8) numVal = 0.8; // Hard-Cap: Maximale Bandgeschwindigkeit
    if (numVal < 0) numVal = 0;

    let strVal = numVal.toFixed(2);

    if (elIn && elIn.value !== strVal) elIn.value = strVal;
    if (elSl && parseFloat(elSl.value) !== numVal) elSl.value = numVal;
    if (elVal) elVal.innerText = strVal;

    if (source === 'manual') {
        updateLiveConversion('speed');
    }
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    if(window.event && window.event.currentTarget) {
        window.event.currentTarget.classList.add('active');
    } else {
        document.querySelector(`button[onclick="switchTab('${tabId}')"]`).classList.add('active');
    }
}

function toggleInfo(infoId) {
    const box = document.getElementById(infoId);
    box.style.display = box.style.display === 'block' ? 'none' : 'block';
}

function toggleFlowMode() {
    const modeEl = document.querySelector('input[name="flow_mode"]:checked');
    if (!modeEl) return;
    const mode = modeEl.value;

    document.getElementById('container_geom').style.display = 'none';
    document.getElementById('container_vol').style.display = 'none';
    document.getElementById('container_mass').style.display = 'none';

    if (mode === 'geom') document.getElementById('container_geom').style.display = 'block';
    if (mode === 'vol') document.getElementById('container_vol').style.display = 'flex';
    if (mode === 'mass') document.getElementById('container_mass').style.display = 'flex';

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

    const MAX_V = 2.0; // Deckelung der Geschwindigkeit auf das physikalische Limit

    if (mode === 'geom') {
        // Geschwindigkeit diktiert den Flow
        const Iv = b * h_K * v * 3600;
        const Im = (Iv * rho) / 3600;
        document.getElementById('live_geom_display').innerText = `Theoretischer Durchsatz: ${Iv.toFixed(2)} m³/h (${Im.toFixed(2)} kg/s)`;

        // Werte für die Eingabefelder im Hintergrund vorbereiten, für nahtlose Übergänge
        if (source === 'speed' || source === 'toggle' || source === 'other') {
            let elIv = document.getElementById('in_Iv');
            let elIm = document.getElementById('in_Im');
            if (elIv) elIv.value = Iv.toFixed(1);
            if (elIm) elIm.value = Im.toFixed(2);
        }

    } else if (mode === 'vol') {
        let elIv = document.getElementById('in_Iv');
        let Iv = parseFloat(elIv.value) || 0;

        if (source === 'speed') {
            // Slider wurde manuell bewegt -> Volumenstrom anpassen
            Iv = b * h_K * v * 3600;
            elIv.value = Iv.toFixed(1);
        } else {
            // Flow diktiert die Geschwindigkeit
            let required_v = (b > 0 && h_K > 0) ? Iv / (b * h_K * 3600) : 0;

            // Flow-Cap: Geschwindigkeit ist zu hoch für die Anlage
            if (required_v > MAX_V) {
                required_v = MAX_V;
                Iv = b * h_K * MAX_V * 3600; // Zurückrechnen auf maximal möglichen Flow
                elIv.value = Iv.toFixed(1);
            }
            syncSpeed(required_v, 'auto');
        }

        const Im = (Iv * rho) / 3600;
        document.getElementById('live_mass_display').innerText = `entspricht: ${Im.toFixed(2)} kg/s`;

    } else if (mode === 'mass') {
        let elIm = document.getElementById('in_Im');
        let Im = parseFloat(elIm.value) || 0;

        if (source === 'speed') {
            // Slider wurde manuell bewegt -> Massenstrom anpassen
            Im = b * h_K * v * rho;
            elIm.value = Im.toFixed(2);
        } else {
            // Flow diktiert die Geschwindigkeit
            let required_v = (b > 0 && h_K > 0 && rho > 0) ? Im / (b * h_K * rho) : 0;

            // Flow-Cap: Geschwindigkeit ist zu hoch für die Anlage
            if (required_v > MAX_V) {
                required_v = MAX_V;
                Im = b * h_K * MAX_V * rho; // Zurückrechnen auf maximal möglichen Flow
                elIm.value = Im.toFixed(2);
            }
            syncSpeed(required_v, 'auto');
        }

        const Iv = rho > 0 ? (Im * 3600) / rho : 0;
        document.getElementById('live_vol_display').innerText = `entspricht: ${Iv.toFixed(2)} m³/h`;
    }
}

/*
 * [BREADCRUMB: 2026-08-10]
 * DOMÄNE: UI & Mathematik - enforceConstraints
 * UPDATE: 
 * - L_box Begrenzung auf Min: 0.30 m / Max: 1.00 m angepasst.
 * - Bei Verringerung von L_box wird die Physik-Engine neu initialisiert (bootPhysics/initParticles),
 *   um Einklemmungen/Abstürze durch schrumpfendes Volumen zu verhindern.
 */
/*
 * [BREADCRUMB: 2026-08-10]
 * DOMÄNE: UI & Mathematik - Absturzsichere L_box Validierung
 * UPDATE: 
 * - Keine automatischen Physik-Resets mehr bei Tastatureingabe (behebt Absturz).
 * - L_box sauber zwischen 0.30m und 1.00m eingegrenzt.
 * - resetBoxParticles() löscht nur überstehende Partikel sanft aus dem Speicher.
 */
/*
 * DOMÄNE: UI & Mathematik - enforceConstraints
 * UPDATE: Bandlänge (L) auf max 5.0m und min (L_box + 0.3m) limitiert.
 */
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

    if (!alpha || !h_klappe || !h_klappe_max || !el_B || !el_b) return;

    // L_box Schranken
    if (el_L_box && el_L_box.value !== "") {
        let lbox_val = parseFloat(el_L_box.value);
        if (!isNaN(lbox_val)) {
            if (lbox_val < 0.30) el_L_box.value = "0.30";
            if (lbox_val > 1.00) el_L_box.value = "1.00";
        }
    }

    // NEU: Achsabstand / Bandlänge (L) Schranken
    if (el_L && el_L_box) {
        let l_val = parseFloat(el_L.value);
        let lbox_val = parseFloat(el_L_box.value);
        if (!isNaN(l_val) && !isNaN(lbox_val)) {
            let min_L = lbox_val + 0.300; // Darf nie kürzer als Einlaufkasten + 300mm sein
            if (l_val < min_L) {
                el_L.value = min_L.toFixed(3);
            } else if (l_val > 5.000) {
                el_L.value = "5.000"; // Max 5 Meter
            }
        }
    }

    // Limits nach Vorgabe
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

// Wurde L_box geändert, werden gefangene Partikel sanft entfernt, anstatt die Engine zu killen
function resetBoxParticles() {
    enforceConstraints();
    const L_box = parseFloat(document.getElementById('in_L_box').value) || 0.55;

    // Entfernt Partikel, die durch das Verkleinern außerhalb des Kastens einklemmten
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
        if(elHDisp) elHDisp.innerText = `Förderhöhe (H): ${currentH.toFixed(3)} m`;
        
        updateLiveConversion();
        
        if(typeof isAnimating !== 'undefined' && !isAnimating && typeof drawConveyorCanvas === 'function') {
            drawConveyorCanvas();
        }
    } catch(e) {
        console.warn("Fehler in updateGeometry:", e);
    }
}

function openAbzugModal() {
    const modal = document.getElementById('modal_abzug');
    if (modal) {
        modal.style.display = 'flex';
        // Zwingt MathJax dazu, die Formeln im Modal neu zu rendern, sobald es geöffnet wird
        if (window.MathJax) {
            MathJax.typesetPromise([modal]).catch((err) => console.log('MathJax Modal Fehler:', err));
        }
    }
}

/* BREADCRUMB: 2026-08-10 | UI: Universelle Modal-Steuerung für Info-Overlays */
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        if (window.MathJax) {
            MathJax.typesetPromise([modal]).catch((err) => console.log('MathJax Fehler:', err));
        }
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

/*
 * [BREADCRUMB: 2026-08-12]
 * DOMÄNE: UI & Mathematik - calculate
 * UPDATE:
 * - getSafeVal für sicheren Parametereinzug integriert (Zero-Protection & Min-Limit 0.30 für mu_i).
 * - Doppelte Deklarationen und undefinierte raw_*-Variablen bereinigt.
 */
function calculate() {
    enforceConstraints();
    const rho = parseFloat(document.getElementById('in_rho').value) || 0;
    const v = parseFloat(document.getElementById('in_v').value) || 0;
    const L = parseFloat(document.getElementById('in_L').value) || 0;
    const b = parseFloat(document.getElementById('in_b').value) || 0;
    const h_klappe = parseFloat(document.getElementById('in_h_klappe').value) || 0;

    const H = currentH;
    const m_leer = parseFloat(document.getElementById('in_m_leer').value) || 0;
    const eta = parseFloat(document.getElementById('in_eta').value) || 1;
    const C = parseFloat(document.getElementById('in_C').value) || 4.0;

    const h_silo = parseFloat(document.getElementById('in_h_silo').value) || 0;
    const L_box = parseFloat(document.getElementById('in_L_box').value) || 0;

    // --- Sicherer Parametereinzug VOR der Berechnung ---
    /*
     * [BREADCRUMB: 2026-08-12]
     * DOMÄNE: Parameter Guardrails - Friction Coefficients Safe Extractor
     * UPDATE: 
     * - mu_g und mu_i einheitlich auf das Praxis-Intervall [0.30, 1.20] bzw. [0.30, 1.00] eingegrenzt.
     */
    const getSafeFriction = () => {
        const parseClamp = (id, fallback, minVal, maxVal) => {
            const el = document.getElementById(id);
            if (!el) return fallback;
            let val = parseFloat(el.value);
            if (isNaN(val) || val < minVal) return minVal;
            if (val > maxVal) return maxVal;
            return val;
        };

        return {
            mu_g: parseClamp('in_mu_g', 0.60, 0.30, 1.20),
            mu_i: parseClamp('in_mu_i', 0.50, 0.30, 1.00)
        };
    };

    const { mu_g, mu_i } = getSafeFriction();

    const modeEl = document.querySelector('input[name="flow_mode"]:checked');
    if (!modeEl) return;
    const mode = modeEl.value;

    let ImN_kg_s = 0;
    let latex_mL = "";

    if (mode === 'geom') {
        const Iv = b * h_klappe * v * 3600;
        ImN_kg_s = (Iv * rho) / 3600;
        const mL = v > 0 ? ImN_kg_s / v : 0;
        latex_mL = String.raw`
            <p><strong>Streckenlast des Fördergutes (via Abzugs-Querschnitt):</strong></p>
            $$ I_V = b \cdot h_{Klappe} \cdot v \cdot 3600 = ${b} \cdot ${h_klappe} \cdot ${v.toFixed(2)} \cdot 3600 = ${Iv.toFixed(2)} \text{ m}^3\text{/h} $$
            $$ m_L' = \frac{I_V \cdot \rho / 3600}{v} = ${mL.toFixed(2)} \text{ kg/m} $$
        `;
    } else if (mode === 'vol') {
        const Iv = parseFloat(document.getElementById('in_Iv').value) || 0;
        ImN_kg_s = (Iv * rho) / 3600;
        const mL = v > 0 ? ImN_kg_s / v : 0;
        latex_mL = String.raw`
            <p><strong>Streckenlast des Fördergutes:</strong></p>
            $$ m_L' = \frac{I_V \cdot \rho / 3600}{v} = ${mL.toFixed(2)} \text{ kg/m} $$
        `;
    } else {
        ImN_kg_s = parseFloat(document.getElementById('in_Im').value) || 0;
        const mL = v > 0 ? ImN_kg_s / v : 0;
        latex_mL = String.raw`
            <p><strong>Streckenlast des Fördergutes:</strong></p>
            $$ m_L' = \frac{I_m}{v} = ${mL.toFixed(2)} \text{ kg/m} $$
        `;
    }

    const mL = v > 0 ? ImN_kg_s / v : 0;
    const g = 9.81;
    const f = 0.020;

    const FSt = H * g * mL;
    const FH = L * f * g * (mL + m_leer);
    const F_Boden = rho * g * h_silo * L_box * b;
    const F_Abzug = (F_Boden * mu_g) + (rho * g * h_silo * b * h_klappe * mu_i);

    const FW = C * FH + FSt + F_Abzug;
    const PW = FW * v;
    const PM = PW / eta;
    const PM_kW = PM / 1000;

    // --- HILFSFUNKTIONEN FÜR KILONEWTON AUTOMATIK ---
    const fUI = (val) => val >= 1000 ? (val / 1000).toFixed(2) + " kN" : val.toFixed(2) + " N";
    const fTex = (val) => val >= 1000 ? (val / 1000).toFixed(2) + " \\text{ kN}" : val.toFixed(2) + " \\text{ N}";

    document.getElementById('out_mL').innerText = mL.toFixed(2) + " kg/m";
    document.getElementById('out_FAbz').innerText = fUI(F_Abzug);
    document.getElementById('out_FSt').innerText = fUI(FSt);
    document.getElementById('out_FH').innerText = fUI(FH);
    document.getElementById('out_FW').innerText = fUI(FW);
    document.getElementById('out_PW').innerText = PW.toFixed(2) + " W";
    document.getElementById('out_PM').innerText = PM_kW.toFixed(3) + " kW";

    document.getElementById('info_mL').innerHTML = latex_mL;

    const html_FAbz = String.raw`
    <p style="margin:0 0 5px 0; text-align:left;"><strong>Ermittlung der Abzugskraft:</strong></p>
    $$ F_{\mathrm{Boden}} = \rho \cdot g \cdot h_{\mathrm{Silo}} \cdot L_{\mathrm{box}} \cdot b = ${fTex(F_Boden)} $$
    $$ F_{\mathrm{Abzug}} = F_{\mathrm{Boden}} \cdot \mu_G + (\rho \cdot g \cdot h_{\mathrm{Silo}} \cdot b \cdot h_{\mathrm{Klappe}} \cdot \mu_i) = ${fTex(F_Abzug)} $$
    `;
    const html_FSt = String.raw`$$ F_{\mathrm{St}} = H \cdot g \cdot m_L' = ${fTex(FSt)} $$`;
    const html_FH = String.raw`$$ F_H = L \cdot f \cdot g \cdot (m_L' + m_{\mathrm{leer}}') = ${fTex(FH)} $$`;
    const html_FW = String.raw`$$ F_W = C \cdot F_H + F_{\mathrm{St}} + F_{\mathrm{Abzug}} = ${fTex(FW)} $$`;
    const html_PW = String.raw`$$ P_W = F_W \cdot v = ${PW >= 1000 ? (PW / 1000).toFixed(2) + " \\text{ kW}" : PW.toFixed(2) + " \\text{ W}"} $$`;
    const html_PM = String.raw`$$ P_{M,\mathrm{erf}} = \frac{P_W}{\eta_{\mathrm{ges}}} = ${PM_kW.toFixed(3)} \text{ kW} $$`;

    document.getElementById('info_FAbz').innerHTML = html_FAbz;
    document.getElementById('info_FSt').innerHTML = html_FSt;
    document.getElementById('info_FH').innerHTML = html_FH;
    document.getElementById('info_FW').innerHTML = html_FW;
    document.getElementById('info_PW').innerHTML = html_PW;
    document.getElementById('info_PM').innerHTML = html_PM;

    // Speichern für den PDF-Export
    window.lastCalculatedMath = {
        info_mL: latex_mL,
        info_FAbz: html_FAbz,
        info_FSt: html_FSt,
        info_FH: html_FH,
        info_FW: html_FW,
        info_PW: html_PW,
        info_PM: html_PM
    };

    if (window.MathJax) {
        MathJax.typesetPromise().catch((err) => console.log('MathJax Fehler: ', err));
    }
    switchTab('ergebnisse');
}