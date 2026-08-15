/*
 * DOMÄNE: PDF Export (html2pdf.js)
 * BREADCRUMB: [UPDATE] Standardisierte Isometrie, seitenweise Aufteilung (Kapitel 2-4 auf Seite 3),
 *             kompakt formatierte Rechenschritte und durchgehende Seitennummerierung ("Seite X von Y").
 */


/*
 * DOMÄNE: PDF Export (html2pdf.js)
 * BREADCRUMB: [UPDATE] CSS-basiertes Layout-System (.pdf-page, .pdf-box) für konsistente 
 *             Schriftgrößen-Harmonisierung. Globale Kontrolle von MathJax Container-Größen.
 */
async function generatePDF() {
    const btn = document.getElementById('btnExportPDF');
    if (!btn) return;

    const originalText = btn.innerText;
    btn.innerText = 'Wird generiert...';
    btn.disabled = true;

    try {
        if (typeof calculate === 'function') calculate(false);
        if (typeof calcSiloPressure === 'function') calcSiloPressure();

        // Standardisierte Isometrie (45° Yaw)
        let prevSiloAngle = typeof siloAngleZ !== 'undefined' ? siloAngleZ : 0;
        if (typeof siloAngleZ !== 'undefined') siloAngleZ = Math.PI / 4;
        if (typeof drawSiloCanvas === 'function') drawSiloCanvas();

        const projName = typeof projMeta !== 'undefined' && projMeta.projekt !== "---" ? projMeta.projekt : "Unbenanntes Projekt";
        const creator = typeof projMeta !== 'undefined' && projMeta.ersteller !== "---" ? projMeta.ersteller : "---";
        const date = new Date().toLocaleDateString('de-DE');

        const today = new Date();
        const yy = String(today.getFullYear()).slice(-2);
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const safeProjName = projName.replace(/[^a-zA-Z0-9\-_ÄÖÜäöü]/g, '_');
        const exportFileName = `${yy}${mm}${dd}_${safeProjName}_Abzugsband_Auslegung.pdf`;

        const loadLogo = () => new Promise(resolve => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                const cvs = document.createElement('canvas');
                cvs.width = img.width; cvs.height = img.height;
                cvs.getContext('2d').drawImage(img, 0, 0);
                resolve(cvs.toDataURL('image/png'));
            };
            img.onerror = () => resolve('');
            img.src = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSAAjJb2w86L8F8qhLZ2Pm1qh2vOXiwZZpsgvMTKa7iDCsxsuPAy4LD9CuM&s=10';
            setTimeout(() => resolve(''), 3000);
        });

        const base64Logo = await loadLogo();

        const getParams = () => {
            const val = (id, fallback) => {
                const el = document.getElementById(id);
                return el ? (parseFloat(el.value) || fallback) : fallback;
            };
            return {
                v: val('in_v', 0), rho: val('in_rho', 0), L: val('in_L', 0), b: val('in_b', 0),
                h_k: val('in_h_klappe', 0.32), h_k_max: val('in_h_klappe_max', 0.32), m_leer: val('in_m_leer', 0),
                eta: val('in_eta', 0.75), C: val('in_C', 2.0), h_silo: val('in_silo_H', 0), L_box: val('in_L_box', 0),
                mu_g: val('in_mu_g', 0.6), mu_i: val('in_mu_i', 0.4), H_m: typeof currentH !== 'undefined' ? currentH : 0
            };
        };

        function calcPower(v_eval, hk_eval, p) {
            const g = 9.81; const f = 0.020;
            const Iv = p.b * hk_eval * v_eval * 3600;
            const ImN = (Iv * p.rho) / 3600;
            const mL = v_eval > 0 ? ImN / v_eval : 0;
            const FSt = p.H_m * g * mL;
            const FH = p.L * f * g * (mL + p.m_leer);

            const L_s = parseFloat(document.getElementById('in_silo_L')?.value) || 3.0;
            const B_s = parseFloat(document.getElementById('in_silo_B')?.value) || 3.0;
            const H_s = parseFloat(document.getElementById('in_silo_H')?.value) || 6.0;
            const out_L = parseFloat(document.getElementById('in_out_L')?.value) || 0.55;
            const out_B = parseFloat(document.getElementById('in_out_B')?.value) || 0.45;
            const out_x = parseFloat(document.getElementById('in_out_x')?.value) || 0;
            const out_y = parseFloat(document.getElementById('in_out_y')?.value) || 0;
            const mu_w = parseFloat(document.getElementById('in_silo_mu_w')?.value) || (p.mu_i * 0.8);

            const A_s = L_s * B_s;
            const U_s = 2 * (L_s + B_s);
            const R_hyd = (U_s > 0) ? (A_s / U_s) : 0.5;
            const A_out = out_L * out_B;

            const distsX = [L_s / 2 + out_x - out_L / 2, L_s / 2 - out_x - out_L / 2];
            const distsY = [B_s / 2 + out_y - out_B / 2, B_s / 2 - out_y - out_B / 2];
            const hop_type = document.querySelector('input[name="hop_type"]:checked') ? document.querySelector('input[name="hop_type"]:checked').value : '4';
            const hop_alpha = (parseFloat(document.getElementById('in_hop_a')?.value) || 60) * Math.PI / 180;
            const maxDist = Math.max(...distsX, hop_type === '4' ? Math.max(...distsY) : 0);

            let h_trichter = maxDist * Math.tan(hop_alpha);
            if (h_trichter > H_s) h_trichter = H_s;
            const h_schaft = H_s - h_trichter;

            const phi_i = Math.atan(p.mu_i);
            const K = (1 - Math.sin(phi_i)) / (1 + Math.sin(phi_i));
            const denom = Math.max(0.01, mu_w * K);
            const max_p_v = (p.rho * g * R_hyd) / denom;
            const p_v_schaft = max_p_v * (1 - Math.exp(-(denom * h_schaft) / R_hyd));

            const p_v = (p_v_schaft * (A_out / A_s)) + (p.rho * g * h_trichter * 0.4);
            const F_Boden = p_v * p.L_box * p.b;
            const F_Abzug = (F_Boden * p.mu_g) + (p_v * p.b * hk_eval * p.mu_i);

            const FW = p.C * FH + FSt + F_Abzug;
            const PW = FW * v_eval;
            return (PW / p.eta) / 1000;
        }

        function createPowerVsSpeedChart() {
            const p = getParams();
            const pmEl = document.getElementById('out_PM');
            const PM_current = pmEl ? parseFloat(pmEl.innerText.replace(/[^\d.,]/g, '').replace(',', '.')) || 0 : 0;

            const cvs = document.createElement('canvas');
            cvs.width = 1200; cvs.height = 420;
            const ctx = cvs.getContext('2d');
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cvs.width, cvs.height);

            const s = 2;
            const padL = 60 * s, padR = 40 * s, padT = 35 * s, padB = 40 * s;
            const w = cvs.width - padL - padR; const h = cvs.height - padT - padB;

            const maxV = 0.8;
            const maxPower = Math.max(0.1, calcPower(maxV, p.h_k, p) * 1.15);
            const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50];
            let step = steps.find(st => maxPower / st <= 5) || (maxPower / 4);
            const yMax = Math.ceil(maxPower / step) * step;

            ctx.strokeStyle = '#e5e5e5'; ctx.lineWidth = 1 * s;
            ctx.fillStyle = '#555555'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
            ctx.font = `${11 * s}px Arial`;

            for (let i = 0; i <= 4; i++) {
                let yVal = (yMax / 4) * i;
                let yPos = padT + h - (yVal / yMax) * h;
                ctx.beginPath(); ctx.moveTo(padL, yPos); ctx.lineTo(padL + w, yPos); ctx.stroke();
                ctx.fillText(yVal.toFixed(1), padL - 8 * s, yPos);
            }

            ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            for (let i = 0; i <= 10; i++) {
                let xVal = (maxV / 10) * i;
                let xPos = padL + (xVal / maxV) * w;
                ctx.beginPath(); ctx.moveTo(xPos, padT + h); ctx.lineTo(xPos, padT + h + 5 * s); ctx.stroke();
                ctx.fillText(xVal.toFixed(2), xPos, padT + h + 8 * s);
            }

            ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 1.5 * s;
            ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + h); ctx.lineTo(padL + w, padT + h); ctx.stroke();

            ctx.strokeStyle = '#009B4C'; ctx.lineWidth = 2.5 * s;
            ctx.beginPath();
            for (let i = 0; i <= 50; i++) {
                let v_eval = (maxV / 50) * i;
                let pm = calcPower(v_eval, p.h_k, p);
                let px = padL + (v_eval / maxV) * w;
                let py = padT + h - (pm / yMax) * h;
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.stroke();

            if (p.v <= maxV) {
                const cx = padL + (p.v / maxV) * w;
                const cy = padT + h - (PM_current / yMax) * h;
                ctx.setLineDash([4 * s, 4 * s]); ctx.strokeStyle = '#e67e22'; ctx.lineWidth = 1 * s;
                ctx.beginPath(); ctx.moveTo(cx, padT + h); ctx.lineTo(cx, cy); ctx.lineTo(padL, cy); ctx.stroke();
                ctx.setLineDash([]);
                ctx.beginPath(); ctx.arc(cx, cy, 5 * s, 0, 2 * Math.PI); ctx.fillStyle = '#e67e22'; ctx.fill();

                ctx.fillStyle = '#2c3e50'; ctx.textBaseline = 'middle'; ctx.font = `bold ${11 * s}px Arial`;
                const isRightHalf = cx > (padL + w * 0.6);
                ctx.textAlign = isRightHalf ? 'right' : 'left';
                const offsetX = isRightHalf ? -12 * s : 12 * s;
                ctx.fillText(`Betriebspunkt: v = ${p.v.toFixed(2)} m/s | PM = ${PM_current.toFixed(1)} kW`, cx + offsetX, cy);
            }
            return cvs.toDataURL('image/png');
        }

        function createPowerVsHeightChart() {
            const p = getParams();
            const pmEl = document.getElementById('out_PM');
            const PM_current = pmEl ? parseFloat(pmEl.innerText.replace(/[^\d.,]/g, '').replace(',', '.')) || 0 : 0;

            const cvs = document.createElement('canvas');
            cvs.width = 1200; cvs.height = 420;
            const ctx = cvs.getContext('2d');
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cvs.width, cvs.height);

            const s = 2;
            const padL = 60 * s, padR = 40 * s, padT = 35 * s, padB = 40 * s;
            const w = cvs.width - padL - padR; const h = cvs.height - padT - padB;

            const minH = 0.05;
            const maxH = Math.max(0.10, p.h_k_max);
            const maxPower = Math.max(0.1, calcPower(p.v, maxH, p) * 1.15);
            const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50];
            let step = steps.find(st => maxPower / st <= 5) || (maxPower / 4);
            const yMax = Math.ceil(maxPower / step) * step;

            ctx.strokeStyle = '#e5e5e5'; ctx.lineWidth = 1 * s;
            ctx.fillStyle = '#555555'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
            ctx.font = `${11 * s}px Arial`;

            for (let i = 0; i <= 4; i++) {
                let yVal = (yMax / 4) * i;
                let yPos = padT + h - (yVal / yMax) * h;
                ctx.beginPath(); ctx.moveTo(padL, yPos); ctx.lineTo(padL + w, yPos); ctx.stroke();
                ctx.fillText(yVal.toFixed(1), padL - 8 * s, yPos);
            }

            ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            const xTicks = 8;
            for (let i = 0; i <= xTicks; i++) {
                let xVal = minH + ((maxH - minH) / xTicks) * i;
                let xPos = padL + ((xVal - minH) / (maxH - minH)) * w;
                ctx.beginPath(); ctx.moveTo(xPos, padT + h); ctx.lineTo(xPos, padT + h + 5 * s); ctx.stroke();
                ctx.fillText(xVal.toFixed(2), xPos, padT + h + 8 * s);
            }

            ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 1.5 * s;
            ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + h); ctx.lineTo(padL + w, padT + h); ctx.stroke();

            ctx.strokeStyle = '#009B4C'; ctx.lineWidth = 2.5 * s;
            ctx.beginPath();
            for (let i = 0; i <= 50; i++) {
                let hk = minH + ((maxH - minH) / 50) * i;
                let pm = calcPower(p.v, hk, p);
                let px = padL + ((hk - minH) / (maxH - minH)) * w;
                let py = padT + h - (pm / yMax) * h;
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.stroke();

            if (p.h_k >= minH && p.h_k <= maxH) {
                const cx = padL + ((p.h_k - minH) / (maxH - minH)) * w;
                const cy = padT + h - (PM_current / yMax) * h;
                ctx.setLineDash([4 * s, 4 * s]); ctx.strokeStyle = '#e67e22'; ctx.lineWidth = 1 * s;
                ctx.beginPath(); ctx.moveTo(cx, padT + h); ctx.lineTo(cx, cy); ctx.lineTo(padL, cy); ctx.stroke();
                ctx.setLineDash([]);
                ctx.beginPath(); ctx.arc(cx, cy, 5 * s, 0, 2 * Math.PI); ctx.fillStyle = '#e67e22'; ctx.fill();

                ctx.fillStyle = '#2c3e50'; ctx.textBaseline = 'middle'; ctx.font = `bold ${11 * s}px Arial`;
                const isRightHalf = cx > (padL + w * 0.6);
                ctx.textAlign = isRightHalf ? 'right' : 'left';
                const offsetX = isRightHalf ? -12 * s : 12 * s;
                ctx.fillText(`Betriebspunkt: h_Klappe = ${p.h_k.toFixed(2)} m | PM = ${PM_current.toFixed(1)} kW`, cx + offsetX, cy);
            }
            return cvs.toDataURL('image/png');
        }

        const chartSpeedUrl = createPowerVsSpeedChart();
        const chartHeightUrl = createPowerVsHeightChart();
        const p = getParams();
        const maxH = Math.max(0.10, p.h_k_max);

        const pdfContainer = document.createElement('div');
        pdfContainer.style.width = '680px';
        pdfContainer.style.background = '#fff';
        pdfContainer.style.boxSizing = 'border-box';
        pdfContainer.style.overflow = 'hidden';

        let logoHtml = base64Logo ? `<img src="${base64Logo}" style="height: 40px;" alt="Logo">` : '';

        const getV = (id) => { const el = document.getElementById(id); return el ? el.value : '-'; };
        const getT = (id) => { const el = document.getElementById(id); return el ? el.innerText : '-'; };
        const getRawMath = (key) => (window.lastCalculatedMath && window.lastCalculatedMath[key]) ? window.lastCalculatedMath[key] : '<em>Keine Formeldaten verfügbar.</em>';

        const canvas = document.getElementById('conveyorCanvas');
        const canvasImgUrl = canvas ? canvas.toDataURL('image/png') : '';
        const siloCanvas = document.getElementById('siloCanvas');
        const siloCanvasImgUrl = siloCanvas ? siloCanvas.toDataURL('image/png') : '';

        const s1 = window.lastSiloSteps?.step1 || '';
        const s2 = window.lastSiloSteps?.step2 || '';
        const s3 = window.lastSiloSteps?.step3 || '';
        const s4 = window.lastSiloSteps?.step4 || '';

        const pdfCss = `
            <style>
                .pdf-page { background: white; padding: 20px; box-sizing: border-box; font-family: Arial, sans-serif; font-size: 11px; line-height: 1.5; color: #333; }
                .pdf-header { border-bottom: 2px solid #009B4C; padding-bottom: 10px; margin-bottom: 15px; }
                .pdf-header h1 { color: #2c3e50; margin: 0 0 4px 0; font-size: 20px; }
                .pdf-header-meta { display: flex; justify-content: space-between; font-size: 10px; color: #666; }
                .pdf-section-title { background: #f4f4f9; padding: 6px 10px; font-size: 12px; border-left: 4px solid; margin: 0 0 10px 0; color: #2c3e50; font-weight: bold; }
                .pdf-box { background: #f9f9f9; padding: 10px 14px; border-radius: 4px; margin-bottom: 12px; }
                .pdf-grid-2 { display: flex; justify-content: space-between; font-size: 11px; }
                .pdf-grid-2 > div { width: 48%; }
                
                /* Zentrales MathJax Override für einheitliches Schriftbild */
                mjx-container { font-size: 11px !important; }
            </style>
        `;

        const pageHeader = (title) => `
            <div class="pdf-header">
                <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 6px;">
                    <div>${logoHtml}</div>
                    <h1>${title}</h1>
                </div>
                <div class="pdf-header-meta">
                    <div><strong>Projekt:</strong> ${projName}</div>
                    <div><strong>Ersteller:</strong> ${creator}</div>
                    <div><strong>Datum:</strong> ${date}</div>
                </div>
            </div>
        `;

        pdfContainer.innerHTML = pdfCss + `
            <!-- SEITE 1: ÜBERSICHT BANDANLAGE -->
            <div class="pdf-page">
                ${pageHeader("Auslegung Dosierabzugsband")}
                
                <div class="pdf-box" style="border-left: 4px solid #009B4C;">
                    <div style="font-weight: bold; color: #2c3e50; font-size: 12px; margin-bottom: 6px;">Geometrie & Betriebsparameter Band</div>
                    <div class="pdf-grid-2">
                        <div>
                            <strong>Achsabstand (\\(L\\)):</strong> ${getV('in_L')} m<br>
                            <strong>Neigung (\\(\\alpha\\)):</strong> ${getV('in_alpha')}°<br>
                            <strong>Gurtbreite (\\(B\\)):</strong> ${getV('in_B')} m<br>
                            <strong>Förderbreite (\\(b\\)):</strong> ${getV('in_b')} m<br>
                            <strong>Trommeln (\\(D_U / D_A\\)):</strong> Ø ${getV('in_DU')} m / Ø ${getV('in_DA')} m
                        </div>
                        <div>
                            <strong>Geschwindigkeit (\\(v\\)):</strong> ${getV('in_v')} m/s<br>
                            <strong>Streckenlast Band (\\(m_{\\mathrm{leer}}'\\)):</strong> ${getV('in_m_leer')} kg/m<br>
                            <strong>Wirkungsgrad (\\(\\eta\\)):</strong> ${getV('in_eta')}<br>
                            <strong>Reibwert Gurt (\\(\\mu_G\\)):</strong> ${getV('in_mu_g')}<br>
                            <strong>Längenzuschlag (\\(C\\)):</strong> ${getV('in_C')}
                        </div>
                    </div>
                </div>

                <div class="pdf-section-title" style="border-color: #e67e22;">Systemgeometrie Bandanlage</div>
                <div style="margin-bottom: 15px; text-align: center; border: 1px solid #eee; border-radius: 4px; padding: 5px;">
                    ${canvasImgUrl ? `<img src="${canvasImgUrl}" style="max-width: 100%; height: auto; display: block; margin: 0 auto;">` : '<em>Keine Grafik verfügbar</em>'}
                </div>

                <div class="pdf-section-title" style="border-color: #009B4C;">Berechnungsergebnisse (Zusammenfassung)</div>
                <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 15px;">
                    <div style="width: 48%; border: 1px solid #eee; background: #fafafa; padding: 8px 12px; border-radius: 4px; box-sizing: border-box;">
                        <div style="font-size: 9px; color: #666; text-transform: uppercase; font-weight: bold;">Streckenlast Gut (\\(m_L'\\))</div>
                        <div style="font-size: 14px; color: #2c3e50; font-weight: bold; margin-top: 2px;">${getT('out_mL')}</div>
                    </div>
                    <div style="width: 48%; border: 1px solid #eee; background: #fafafa; padding: 8px 12px; border-radius: 4px; box-sizing: border-box;">
                        <div style="font-size: 9px; color: #666; text-transform: uppercase; font-weight: bold;">Zusätzliche Abzugskraft (\\(F_{\\mathrm{Abzug}}\\))</div>
                        <div style="font-size: 14px; color: #e67e22; font-weight: bold; margin-top: 2px;">${getT('out_FAbz')}</div>
                    </div>
                    <div style="width: 48%; border: 1px solid #eee; background: #fafafa; padding: 8px 12px; border-radius: 4px; box-sizing: border-box;">
                        <div style="font-size: 9px; color: #666; text-transform: uppercase; font-weight: bold;">Gesamtwiderstand (\\(F_W\\))</div>
                        <div style="font-size: 14px; color: #2c3e50; font-weight: bold; margin-top: 2px;">${getT('out_FW')}</div>
                    </div>
                    <div style="width: 48%; border: 2px solid #009B4C; background: #eafaf1; padding: 8px 12px; border-radius: 4px; box-sizing: border-box;">
                        <div style="font-size: 9px; color: #009B4C; text-transform: uppercase; font-weight: bold;">Erf. Motorleistung (\\(P_{M,\\mathrm{erf}}\\))</div>
                        <div style="font-size: 15px; color: #009B4C; font-weight: bold; margin-top: 2px;">${getT('out_PM')}</div>
                    </div>
                </div>
            </div>

            <div class="html2pdf__page-break"></div>

            <!-- SEITE 2: SILO LAYOUT & BERECHNUNG SCHRITT 1 -->
            <div class="pdf-page">
                ${pageHeader("Siloauslegung & Schüttgutmechanik")}

                <div class="pdf-box" style="border-left: 4px solid #009B4C;">
                    <div style="font-weight: bold; color: #2c3e50; font-size: 12px; margin-bottom: 6px;">Schüttgut & Silogeometrie</div>
                    <div class="pdf-grid-2">
                        <div>
                            <strong>Dimensionen (X/Y/Z):</strong> ${getV('in_silo_L')} m / ${getV('in_silo_B')} m / ${getV('in_silo_H')} m<br>
                            <strong>Auslauf (X/Y):</strong> ${getV('in_out_L')} m / ${getV('in_out_B')} m<br>
                            <strong>Offsets (eX/eY):</strong> ${getV('in_out_x')} m / ${getV('in_out_y')} m<br>
                            <strong>Neigung (\\(\\alpha_{\\mathrm{Hop}}\\)):</strong> ${getV('in_hop_a')}°
                        </div>
                        <div>
                            <strong>Schüttdichte (\\(\\rho\\)):</strong> ${getV('in_silo_rho')} kg/m³<br>
                            <strong>Innere Reibung (\\(\\mu_i\\)):</strong> ${getV('in_silo_mu_i')}<br>
                            <strong>Wandreibung (\\(\\mu_w\\)):</strong> ${getV('in_silo_mu_w')}<br>
                            <strong>Druck Anfahrlast (\\(p_{v,\\mathrm{Füll}}\\)):</strong> ${getT('out_silo_pv_fuell')}<br>
                            <strong>Druck Dauerbetrieb (\\(p_{v,\\mathrm{Fließ}}\\)):</strong> ${getT('out_silo_pv')}
                        </div>
                    </div>
                </div>

                <div class="pdf-section-title" style="border-color: #e67e22;">Visualisierung Silo & Spannungsfelder</div>
                <div style="margin-bottom: 15px; text-align: center; border: 1px solid #eee; border-radius: 4px; padding: 5px;">
                    ${siloCanvasImgUrl ? `<img src="${siloCanvasImgUrl}" style="max-width: 100%; height: auto; display: block; margin: 0 auto;">` : '<em>Keine Grafik verfügbar</em>'}
                </div>

                <div class="pdf-section-title" style="border-color: #009B4C;">Detaillierte Berechnungsschritte (Janssen & Trichter)</div>
                ${s1}
            </div>

            <div class="html2pdf__page-break"></div>

            <!-- SEITE 3: SILO-BERECHNUNG SCHRITT 2, 3 & 4 -->
            <div class="pdf-page">
                ${pageHeader("Silo-Spannungsberechnungen (Fortsetzung)")}
                ${s2}
                ${s3}
                ${s4}
            </div>

            <div class="html2pdf__page-break"></div>

            <!-- SEITE 4: FORMELN IN LATEX (VDI 2322) -->
            <div class="pdf-page">
                ${pageHeader("Detaillierte Berechnungsgänge")}

                <div class="pdf-section-title" style="border-color: #009B4C;">Formeln & Rechenwege (nach VDI 2322)</div>
                <div style="text-align: center;">
                    <div class="pdf-box" style="border-left: 4px solid #34495e;">${getRawMath('info_mL')}</div>
                    <div class="pdf-box" style="border-left: 4px solid #e67e22;">${getRawMath('info_FAbz')}</div>
                    <div class="pdf-box" style="border-left: 4px solid #34495e;">${getRawMath('info_FSt')}</div>
                    <div class="pdf-box" style="border-left: 4px solid #34495e;">${getRawMath('info_FH')}</div>
                    <div class="pdf-box" style="border-left: 4px solid #34495e;">${getRawMath('info_FW')}</div>
                    <div class="pdf-box" style="border-left: 4px solid #009B4C;">${getRawMath('info_PW')}</div>
                    <div class="pdf-box" style="border-left: 4px solid #009B4C; background: #eafaf1;">${getRawMath('info_PM')}</div>
                </div>
            </div>

            <div class="html2pdf__page-break"></div>

            <!-- SEITE 5: DIAGRAMME -->
            <div class="pdf-page">
                ${pageHeader("Leistungsdiagramme")}

                <div class="pdf-section-title" style="border-color: #009B4C;">1. Erforderliche Motorleistung \\(P_{M,\\mathrm{erf}}\\) vs. Bandgeschwindigkeit \\(v\\)</div>
                <div style="position: relative; border: 1px solid #e5e5e5; border-radius: 4px; background: #ffffff; margin-bottom: 15px; width: 100%;">
                    <div style="position: absolute; top: 8px; left: 15px; font-size: 10px; color: #2c3e50; font-weight: bold;">\\(\\uparrow\\) Erf. Motorleistung \\(P_{M,\\mathrm{erf}}\\) \\([\\mathrm{kW}]\\)</div>
                    <div style="position: absolute; bottom: 8px; width: 100%; text-align: center; font-size: 10px; color: #2c3e50; font-weight: bold;">
                        Bandgeschwindigkeit \\(v\\) \\([\\mathrm{m/s}]\\) &nbsp;&nbsp; (bei \\(h_{\\mathrm{Klappe}} = ${p.h_k.toFixed(2)} \\text{ m}\\)) \\(\\rightarrow\\)
                    </div>
                    <img src="${chartSpeedUrl}" style="width: 100%; height: auto; display: block; margin: 0;">
                </div>

                <div class="pdf-section-title" style="border-color: #009B4C;">2. Erforderliche Motorleistung \\(P_{M,\\mathrm{erf}}\\) vs. Schütthöhe \\(h_{\\mathrm{Klappe}}\\) (bis \\(h_{\\mathrm{Klappe,max}}\\))</div>
                <div style="position: relative; border: 1px solid #e5e5e5; border-radius: 4px; background: #ffffff; width: 100%;">
                    <div style="position: absolute; top: 8px; left: 15px; font-size: 10px; color: #2c3e50; font-weight: bold;">\\(\\uparrow\\) Erf. Motorleistung \\(P_{M,\\mathrm{erf}}\\) \\([\\mathrm{kW}]\\)</div>
                    <div style="position: absolute; bottom: 8px; width: 100%; text-align: center; font-size: 10px; color: #2c3e50; font-weight: bold;">
                        Schütthöhe \\(h_{\\mathrm{Klappe}}\\) \\([\\mathrm{m}]\\) &nbsp;&nbsp; (bis \\(h_{\\mathrm{Klappe,max}} = ${maxH.toFixed(2)} \\text{ m} \\,|\\, v = ${p.v.toFixed(2)} \\text{ m/s}\\)) \\(\\rightarrow\\)
                    </div>
                    <img src="${chartHeightUrl}" style="width: 100%; height: auto; display: block; margin: 0;">
                </div>
            </div>
        `;

        pdfContainer.style.position = 'absolute';
        pdfContainer.style.left = '-9999px';
        document.body.appendChild(pdfContainer);

        if (window.MathJax && window.MathJax.typesetPromise) {
            try {
                await window.MathJax.typesetPromise([pdfContainer]);
                const mjxContainers = pdfContainer.querySelectorAll('mjx-container');
                mjxContainers.forEach(container => {
                    const svg = container.querySelector('svg');
                    if (svg) {
                        container.innerHTML = '';
                        container.appendChild(svg);
                    }
                });
            } catch (e) { console.error("Fehler beim Formel-Rendern:", e); }
        }

        pdfContainer.style.position = 'static';
        pdfContainer.style.left = 'auto';
        pdfContainer.remove();

        const opt = {
            margin: [10, 10, 15, 10],
            filename: exportFileName,
            image: { type: 'jpeg', quality: 1.0 },
            html2canvas: { scale: 2, useCORS: true, scrollX: 0, scrollY: 0 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        const worker = html2pdf().set(opt).from(pdfContainer).toPdf().get('pdf').then((pdf) => {
            const totalPages = pdf.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                pdf.setPage(i);
                pdf.setFontSize(9);
                pdf.setTextColor(130, 130, 130);
                pdf.text(`Seite ${i} von ${totalPages}`, pdf.internal.pageSize.getWidth() / 2, pdf.internal.pageSize.getHeight() - 8, { align: 'center' });
            }
        }).save();

        await worker;

        btn.innerText = originalText;
        btn.disabled = false;

        // Ursprünglichen 3D-Rotationszustand wiederherstellen
        if (typeof siloAngleZ !== 'undefined') {
            siloAngleZ = prevSiloAngle;
        }

    } catch (error) {
        console.error("PDF Generierungsfehler:", error);
        alert("Es ist ein Fehler bei der Vorbereitung des Berichts aufgetreten: " + error.message);
        btn.innerText = originalText;
        btn.disabled = false;
    }
}