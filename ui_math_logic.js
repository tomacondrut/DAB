/*
 * [BREADCRUMB: 2026-08-09]
 * DOMÄNE: UI & Mathematik nach VDI 2322 + Abzugskraft
 * UPDATE: 
 * - syncSpeed Funktion für den neuen Canvas Slider.
 */

// NEU: Synchronisation von Input-Feld und Canvas-Slider
function syncSpeed(val) {
    let elIn = document.getElementById('in_v');
    let elSl = document.getElementById('canvas_v_slider');
    let elVal = document.getElementById('canvas_v_val');
    
    if (elIn && elIn.value !== val) elIn.value = val;
    if (elSl && elSl.value !== val) elSl.value = val;
    if (elVal) elVal.innerText = parseFloat(val).toFixed(2);
    
    updateLiveConversion();
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
    if(!modeEl) return;
    const mode = modeEl.value;
    
    document.getElementById('container_geom').style.display = 'none';
    document.getElementById('container_vol').style.display = 'none';
    document.getElementById('container_mass').style.display = 'none';

    if (mode === 'geom') document.getElementById('container_geom').style.display = 'block';
    if (mode === 'vol') document.getElementById('container_vol').style.display = 'flex';
    if (mode === 'mass') document.getElementById('container_mass').style.display = 'flex';
    
    updateLiveConversion();
}

function updateLiveConversion() {
    let elRho = document.getElementById('in_rho');
    let elV = document.getElementById('in_v');
    let elB = document.getElementById('in_b');
    let elHk = document.getElementById('in_h_klappe');
    let elMode = document.querySelector('input[name="flow_mode"]:checked');
    
    if(!elRho || !elV || !elB || !elHk || !elMode) return;

    const rho = parseFloat(elRho.value) || 0;
    const v = parseFloat(elV.value) || 0;
    const b = parseFloat(elB.value) || 0; 
    const h_K = parseFloat(elHk.value) || 0;
    const mode = elMode.value;

    if (mode === 'geom') {
        const Iv = b * h_K * v * 3600;
        const Im = (Iv * rho) / 3600;
        document.getElementById('live_geom_display').innerText = `Theoretischer Durchsatz: ${Iv.toFixed(2)} m³/h (${Im.toFixed(2)} kg/s)`;
    } else if (mode === 'vol') {
        const Iv = parseFloat(document.getElementById('in_Iv').value) || 0;
        const Im = (Iv * rho) / 3600;
        document.getElementById('live_mass_display').innerText = `entspricht: ${Im.toFixed(2)} kg/s`;
    } else {
        const Im = parseFloat(document.getElementById('in_Im').value) || 0;
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
function enforceConstraints() {
    let alpha = document.getElementById('in_alpha');
    let h_klappe = document.getElementById('in_h_klappe');
    let h_klappe_max = document.getElementById('in_h_klappe_max');
    let el_B = document.getElementById('in_B');
    let el_b = document.getElementById('in_b');
    let el_DA = document.getElementById('in_DA');
    let el_DU = document.getElementById('in_DU');
    let el_L_box = document.getElementById('in_L_box');

    if (!alpha || !h_klappe || !h_klappe_max || !el_B || !el_b) return;

    // L_box Schranken (ohne harten Physik-Stopp während des Tippens)
    if (el_L_box && el_L_box.value !== "") {
        let lbox_val = parseFloat(el_L_box.value);
        if (!isNaN(lbox_val)) {
            if (lbox_val < 0.30) el_L_box.value = "0.30";
            if (lbox_val > 1.00) el_L_box.value = "1.00";
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
    const mu_g = parseFloat(document.getElementById('in_mu_g').value) || 0.6;
    const mu_i = parseFloat(document.getElementById('in_mu_i').value) || 0.5;

    const modeEl = document.querySelector('input[name="flow_mode"]:checked');
    if(!modeEl) return;
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

    document.getElementById('out_mL').innerText = mL.toFixed(2) + " kg/m";
    document.getElementById('out_FAbz').innerText = F_Abzug.toFixed(2) + " N";
    document.getElementById('out_FSt').innerText = FSt.toFixed(2) + " N";
    document.getElementById('out_FH').innerText = FH.toFixed(2) + " N";
    document.getElementById('out_FW').innerText = FW.toFixed(2) + " N";
    document.getElementById('out_PW').innerText = PW.toFixed(2) + " W";
    document.getElementById('out_PM').innerText = PM_kW.toFixed(3) + " kW";

    document.getElementById('info_mL').innerHTML = latex_mL;

    document.getElementById('info_FAbz').innerHTML = String.raw`
    <p><strong>Ermittlung der Abzugskraft:</strong></p>
    $$ F_{Boden} = \rho \cdot g \cdot h_{Silo} \cdot L_{box} \cdot b = ${F_Boden.toFixed(2)} \text{ N} $$
    $$ F_{Abzug} = F_{Boden} \cdot \mu_G + (\rho \cdot g \cdot h_{Silo} \cdot b \cdot h_{Klappe} \cdot \mu_i) = ${F_Abzug.toFixed(2)} \text{ N} $$
    `;
    document.getElementById('info_FSt').innerHTML = String.raw`
    $$ F_{St} = H \cdot g \cdot m_L' = ${FSt.toFixed(2)} \text{ N} $$
    `;
    document.getElementById('info_FH').innerHTML = String.raw`
    $$ F_H = L \cdot f \cdot g \cdot (m_L' + m_{leer}') = ${FH.toFixed(2)} \text{ N} $$
    `;
    document.getElementById('info_FW').innerHTML = String.raw`
    $$ F_W = C \cdot F_H + F_{St} + F_{Abzug} = ${FW.toFixed(2)} \text{ N} $$
    `;
    document.getElementById('info_PW').innerHTML = String.raw`
    $$ P_W = F_W \cdot v = ${PW.toFixed(2)} \text{ W} $$
    `;
    document.getElementById('info_PM').innerHTML = String.raw`
    $$ P_{M,erf} = \frac{P_W}{\eta_{ges}} = ${PM_kW.toFixed(3)} \text{ kW} $$
    `;

    if (window.MathJax) {
        MathJax.typesetPromise().catch((err) => console.log('MathJax Fehler: ', err));
    }
    switchTab('ergebnisse');
}