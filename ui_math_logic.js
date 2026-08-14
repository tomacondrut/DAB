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

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
        tab.style.display = 'none';
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    const targetTab = document.getElementById(tabId);
    if (targetTab) {
        targetTab.classList.add('active');
        targetTab.style.display = 'block';
    }

    const targetBtn = document.getElementById(`tab_btn_${tabId}`);
    if (targetBtn) {
        targetBtn.classList.add('active');
    } else {
        const fallbackBtn = document.querySelector(`button[onclick*="'${tabId}'"]`);
        if (fallbackBtn) fallbackBtn.classList.add('active');
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

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

function calculate(switchTabAfterCalc = true) {
    enforceConstraints();
    const rho = parseFloat(document.getElementById('in_rho').value) || 0;
    const v = parseFloat(document.getElementById('in_v').value) || 0;
    const L = parseFloat(document.getElementById('in_L').value) || 0;
    const b = parseFloat(document.getElementById('in_b').value) || 0;
    const h_klappe = parseFloat(document.getElementById('in_h_klappe').value) || 0;

    const H = currentH;
    const m_leer = parseFloat(document.getElementById('in_m_leer').value) || 0;
    const eta = parseFloat(document.getElementById('in_eta').value) || 1;
    const C = parseFloat(document.getElementById('in_C').value) || 2.0;

    const h_silo = parseFloat(document.getElementById('in_h_silo').value) || 0;
    const L_box = parseFloat(document.getElementById('in_L_box').value) || 0;

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

    if (switchTabAfterCalc) {
        switchTab('ergebnisse');
    }
}

function initApp() {
    enforceConstraints();
    const startV = parseFloat(document.getElementById('in_v')?.value) || 0.38;
    syncSpeed(startV, 'init');
    updateGeometry();
    updateLiveConversion('init');
    calculate(false);
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initApp, 60);
} else {
    window.addEventListener('DOMContentLoaded', initApp);
    window.addEventListener('load', initApp);
}