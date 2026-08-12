/*
 * DOMÄNE: PDF Export (html2pdf.js)
 * UPDATE / FIX: 
 * - SyntaxError (Invalid Unicode escape sequence) durch doppeltes Maskieren der LaTeX-Backslashes behoben.
 * - Robuster Try-Catch-Block hinzugefügt.
 * - Ausfallsicherer Image-Loader für das Logo (Timeout nach 3 Sekunden).
 * - Leistungsanzeige auf 1 Nachkommastelle (XX.X kW) normiert.
 * - Dynamische Textausrichtung am Betriebspunkt (springt nach links, wenn zu weit rechts).
 */

async function generatePDF() {
    const btn = document.getElementById('btnExportPDF');
    if (!btn) return;

    const originalText = btn.innerText;
    btn.innerText = 'Wird generiert...';
    btn.disabled = true;

    try {
        // 1. Zwangsberechnung VOR dem PDF-Export
        if (typeof calculate === 'function') {
            calculate();
        }

        // Metadaten
        const projName = typeof projMeta !== 'undefined' && projMeta.projekt !== "---" ? projMeta.projekt : "Unbenanntes Projekt";
        const creator = typeof projMeta !== 'undefined' && projMeta.ersteller !== "---" ? projMeta.ersteller : "---";
        const date = new Date().toLocaleDateString('de-DE');

        const today = new Date();
        const yy = String(today.getFullYear()).slice(-2);
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const safeProjName = projName.replace(/[^a-zA-Z0-9\-_ÄÖÜäöü]/g, '_');
        const exportFileName = `${yy}${mm}${dd}_${safeProjName}_Abzugsband_Auslegung.pdf`;

        // 2. Logo ausfallsicher laden (Timeout verhindert endloses Hängen)
        const loadLogo = () => new Promise(resolve => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width; canvas.height = img.height;
                canvas.getContext('2d').drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = () => resolve('');
            img.src = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSAAjJb2w86L8F8qhLZ2Pm1qh2vOXiwZZpsgvMTKa7iDCsxsuPAy4LD9CuM&s=10';
            setTimeout(() => resolve(''), 3000);
        });

        const base64Logo = await loadLogo();

        // 3. Parameter-Helfer
        const getParams = () => {
            const val = (id, fallback) => {
                const el = document.getElementById(id);
                return el ? (parseFloat(el.value) || fallback) : fallback;
            };
            return {
                v: val('in_v', 0),
                rho: val('in_rho', 0),
                L: val('in_L', 0),
                b: val('in_b', 0),
                h_k: val('in_h_klappe', 0.32),
                h_k_max: val('in_h_klappe_max', 0.32),
                m_leer: val('in_m_leer', 0),
                eta: val('in_eta', 0.75),
                C: val('in_C', 2.0),
                h_silo: val('in_h_silo', 0),
                L_box: val('in_L_box', 0),
                mu_g: val('in_mu_g', 0.6),
                mu_i: val('in_mu_i', 0.4),
                H_m: typeof currentH !== 'undefined' ? currentH : 0
            };
        };

        function calcPower(v_eval, hk_eval, p) {
            const g = 9.81;
            const f = 0.020;
            const Iv = p.b * hk_eval * v_eval * 3600;
            const ImN = (Iv * p.rho) / 3600;
            const mL = v_eval > 0 ? ImN / v_eval : 0;
            const FSt = p.H_m * g * mL;
            const FH = p.L * f * g * (mL + p.m_leer);
            const F_Boden = p.rho * g * p.h_silo * p.L_box * p.b;
            const F_Abzug = (F_Boden * p.mu_g) + (p.rho * g * p.h_silo * p.b * hk_eval * p.mu_i);
            const FW = p.C * FH + FSt + F_Abzug;
            const PW = FW * v_eval;
            return (PW / p.eta) / 1000;
        }

        // --- DIAGRAMM 1: P_M vs. v ---
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
            const w = cvs.width - padL - padR;
            const h = cvs.height - padT - padB;

            // BREADCRUMB: [EDIT] Diagramm-Skalierung im PDF-Export auf maxV = 0.8 m/s angepasst
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
                ctx.fillText(yVal.toFixed(1), padL - 8 * s, yPos); // 1 Nachkommastelle
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

            // Aktueller Betriebspunkt Diagramm 1 (Horizontal Aligned)
            if (p.v <= maxV) {
                const cx = padL + (p.v / maxV) * w;
                const cy = padT + h - (PM_current / yMax) * h;

                // Gestrichelte Führungslinien
                ctx.setLineDash([4 * s, 4 * s]); ctx.strokeStyle = '#e67e22'; ctx.lineWidth = 1 * s;
                ctx.beginPath(); ctx.moveTo(cx, padT + h); ctx.lineTo(cx, cy); ctx.lineTo(padL, cy); ctx.stroke();
                ctx.setLineDash([]);

                // Betriebspunkt-Kreis
                ctx.beginPath(); ctx.arc(cx, cy, 5 * s, 0, 2 * Math.PI); ctx.fillStyle = '#e67e22'; ctx.fill();

                // Exakt horizontale Ausrichtung (textBaseline = 'middle')
                ctx.fillStyle = '#2c3e50';
                ctx.textBaseline = 'middle';
                ctx.font = `bold ${11 * s}px Arial`;

                const isRightHalf = cx > (padL + w * 0.6);
                ctx.textAlign = isRightHalf ? 'right' : 'left';
                const offsetX = isRightHalf ? -12 * s : 12 * s; // Horizontaler Abstand zum Punkt

                ctx.fillText(`Betriebspunkt: v = ${p.v.toFixed(2)} m/s | PM = ${PM_current.toFixed(1)} kW`, cx + offsetX, cy);
            }
            return cvs.toDataURL('image/png');
        }

        // --- DIAGRAMM 2: P_M vs. h_Klappe ---
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
            const w = cvs.width - padL - padR;
            const h = cvs.height - padT - padB;

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
                ctx.fillText(yVal.toFixed(1), padL - 8 * s, yPos); // 1 Nachkommastelle
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

            // Aktueller Betriebspunkt Diagramm 2 (Horizontal Aligned)
            if (p.h_k >= minH && p.h_k <= maxH) {
                const cx = padL + ((p.h_k - minH) / (maxH - minH)) * w;
                const cy = padT + h - (PM_current / yMax) * h;

                // Gestrichelte Führungslinien
                ctx.setLineDash([4 * s, 4 * s]); ctx.strokeStyle = '#e67e22'; ctx.lineWidth = 1 * s;
                ctx.beginPath(); ctx.moveTo(cx, padT + h); ctx.lineTo(cx, cy); ctx.lineTo(padL, cy); ctx.stroke();
                ctx.setLineDash([]);

                // Betriebspunkt-Kreis
                ctx.beginPath(); ctx.arc(cx, cy, 5 * s, 0, 2 * Math.PI); ctx.fillStyle = '#e67e22'; ctx.fill();

                // Exakt horizontale Ausrichtung (textBaseline = 'middle')
                ctx.fillStyle = '#2c3e50';
                ctx.textBaseline = 'middle';
                ctx.font = `bold ${11 * s}px Arial`;

                const isRightHalf = cx > (padL + w * 0.6);
                ctx.textAlign = isRightHalf ? 'right' : 'left';
                const offsetX = isRightHalf ? -12 * s : 12 * s; // Horizontaler Abstand zum Punkt

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
        pdfContainer.style.fontFamily = 'Arial, sans-serif';
        pdfContainer.style.color = '#333';
        pdfContainer.style.background = '#fff';
        pdfContainer.style.boxSizing = 'border-box';
        pdfContainer.style.overflow = 'hidden';

        let logoHtml = base64Logo ? `<img src="${base64Logo}" style="height: 45px;" alt="Logo">` : '';

        const getV = (id) => { const el = document.getElementById(id); return el ? el.value : '-'; };
        const getT = (id) => { const el = document.getElementById(id); return el ? el.innerText : '-'; };
        const getRawMath = (key) => (window.lastCalculatedMath && window.lastCalculatedMath[key]) ? window.lastCalculatedMath[key] : '';

        const canvas = document.getElementById('conveyorCanvas');
        const canvasImgUrl = canvas ? canvas.toDataURL('image/png') : '';
        const missingCalcNote = '<em>Keine Formeldaten verfügbar.</em>';

        // 4. HTML Zusammenbau (Doppelte Backslashes für MathJax Strings)
        pdfContainer.innerHTML = `
            <!-- SEITE 1: ÜBERSICHT -->
            <div style="background: white; padding: 20px; box-sizing: border-box; font-family: Arial, sans-serif;">
                <div style="border-bottom: 2px solid #009B4C; padding-bottom: 10px; margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 8px;">
                        <div>${logoHtml}</div>
                        <h1 style="color: #2c3e50; margin: 0 0 5px 0; font-size: 22px;">Auslegung Dosierabzugsband</h1>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 13px; color: #666;">
                        <div><strong>Projekt:</strong> ${projName}</div>
                        <div><strong>Ersteller:</strong> ${creator}</div>
                        <div><strong>Datum:</strong> ${date}</div>
                    </div>
                </div>

                <div style="background: #f9f9f9; padding: 10px 15px; border-radius: 4px; border-left: 4px solid #009B4C; margin-bottom: 15px;">
                    <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #2c3e50;">Eingabeparameter</h3>
                    <div style="display: flex; justify-content: space-between; font-size: 12px; line-height: 1.6;">
                        <div style="width: 48%;">
                            <strong>Achsabstand (\\(L\\)):</strong> ${getV('in_L')} m<br>
                            <strong>Neigung (\\(\\alpha\\)):</strong> ${getV('in_alpha')}°<br>
                            <strong>Gurtbreite (\\(B\\)):</strong> ${getV('in_B')} m<br>
                            <strong>Förderbreite (\\(b\\)):</strong> ${getV('in_b')} m<br>
                            <strong>Trommeln (\\(D_U / D_A\\)):</strong> Ø ${getV('in_DU')} m / Ø ${getV('in_DA')} m
                        </div>
                        <div style="width: 48%;">
                            <strong>Geschwindigkeit (\\(v\\)):</strong> ${getV('in_v')} m/s<br>
                            <strong>Schüttdichte (\\(\\rho\\)):</strong> ${getV('in_rho')} kg/m³<br>
                            <strong>Silo-Füllhöhe (\\(h_{\\mathrm{Silo}}\\)):</strong> ${getV('in_h_silo')} m<br>
                            <strong>Einlauflänge (\\(L_{\\mathrm{Box}}\\)):</strong> ${getV('in_L_box')} m<br>
                            <strong>Schütthöhe (\\(h_{\\mathrm{Klappe}}\\)):</strong> ${getV('in_h_klappe')} m (max. ${getV('in_h_klappe_max')} m)
                        </div>
                    </div>
                </div>

                <h3 style="background: #f4f4f9; padding: 6px 12px; font-size: 14px; border-left: 4px solid #e67e22; margin: 0 0 10px 0; color: #2c3e50;">Systemgeometrie</h3>
                <div style="margin-bottom: 15px; text-align: center; border: 1px solid #eee; border-radius: 4px; padding: 5px;">
                    ${canvasImgUrl ? `<img src="${canvasImgUrl}" style="max-width: 100%; height: auto; display: block; margin: 0 auto;">` : '<em>Keine Grafik verfügbar</em>'}
                </div>

                <h3 style="background: #f4f4f9; padding: 6px 12px; font-size: 14px; border-left: 4px solid #009B4C; margin: 0 0 10px 0; color: #2c3e50;">Berechnungsergebnisse (Zusammenfassung)</h3>
                <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 15px;">
                    <div style="width: 48%; border: 1px solid #eee; background: #fafafa; padding: 10px; border-radius: 4px; box-sizing: border-box;">
                        <div style="font-size: 10px; color: #666; text-transform: uppercase; font-weight: bold;">Streckenlast Gut (\\(m_L'\\))</div>
                        <div style="font-size: 16px; color: #2c3e50; font-weight: bold; margin-top: 4px;">${getT('out_mL')}</div>
                    </div>
                    <div style="width: 48%; border: 1px solid #eee; background: #fafafa; padding: 10px; border-radius: 4px; box-sizing: border-box;">
                        <div style="font-size: 10px; color: #666; text-transform: uppercase; font-weight: bold;">Zusätzliche Abzugskraft (\\(F_{\\mathrm{Abzug}}\\))</div>
                        <div style="font-size: 16px; color: #e67e22; font-weight: bold; margin-top: 4px;">${getT('out_FAbz')}</div>
                    </div>
                    <div style="width: 48%; border: 1px solid #eee; background: #fafafa; padding: 10px; border-radius: 4px; box-sizing: border-box;">
                        <div style="font-size: 10px; color: #666; text-transform: uppercase; font-weight: bold;">Gesamtwiderstand (\\(F_W\\))</div>
                        <div style="font-size: 16px; color: #2c3e50; font-weight: bold; margin-top: 4px;">${getT('out_FW')}</div>
                    </div>
                    <div style="width: 48%; border: 2px solid #009B4C; background: #eafaf1; padding: 10px; border-radius: 4px; box-sizing: border-box;">
                        <div style="font-size: 10px; color: #009B4C; text-transform: uppercase; font-weight: bold;">Erf. Motorleistung (\\(P_{M,\\mathrm{erf}}\\))</div>
                        <div style="font-size: 18px; color: #009B4C; font-weight: bold; margin-top: 4px;">${getT('out_PM')}</div>
                    </div>
                </div>
            </div>

            <div class="html2pdf__page-break"></div>

            <!-- SEITE 2: FORMELN IN LATEX -->
            <div style="background: white; padding: 20px; box-sizing: border-box; font-family: Arial, sans-serif;">
                <div style="border-bottom: 2px solid #009B4C; padding-bottom: 10px; margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 8px;">
                        <div>${logoHtml}</div>
                        <h1 style="color: #2c3e50; margin: 0 0 5px 0; font-size: 22px;">Detaillierte Berechnungsgänge</h1>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 13px; color: #666;">
                        <div><strong>Projekt:</strong> ${projName}</div>
                        <div><strong>Ersteller:</strong> ${creator}</div>
                        <div><strong>Datum:</strong> ${date}</div>
                    </div>
                </div>

                <h3 style="background: #f4f4f9; padding: 6px 12px; font-size: 14px; border-left: 4px solid #009B4C; margin: 0 0 15px 0; color: #2c3e50;">Formeln & Rechenwege (nach VDI 2322)</h3>

                <div style="font-size: 12px; color: #333; line-height: 1.5; text-align: center;">
                    <div style="background: #f9f9f9; padding: 12px; margin-bottom: 12px; border-radius: 4px; border-left: 4px solid #34495e;">
                        ${getRawMath('info_mL') || missingCalcNote}
                    </div>
                    
                    <div style="background: #fef9e7; padding: 12px; margin-bottom: 12px; border-radius: 4px; border-left: 4px solid #e67e22;">
                        ${getRawMath('info_FAbz') || missingCalcNote}
                    </div>

                    <div style="background: #f9f9f9; padding: 12px; margin-bottom: 12px; border-radius: 4px; border-left: 4px solid #34495e;">
                        <p style="margin:0 0 5px 0; text-align:left;"><strong>Steigungswiderstand (\\(F_{\\mathrm{St}}\\)):</strong></p>
                        ${getRawMath('info_FSt') || missingCalcNote}
                    </div>

                    <div style="background: #f9f9f9; padding: 12px; margin-bottom: 12px; border-radius: 4px; border-left: 4px solid #34495e;">
                        <p style="margin:0 0 5px 0; text-align:left;"><strong>Hauptwiderstand (\\(F_H\\)):</strong></p>
                        ${getRawMath('info_FH') || missingCalcNote}
                    </div>

                    <div style="background: #f9f9f9; padding: 12px; margin-bottom: 12px; border-radius: 4px; border-left: 4px solid #34495e;">
                        <p style="margin:0 0 5px 0; text-align:left;"><strong>Gesamtwiderstand (\\(F_W\\)):</strong></p>
                        ${getRawMath('info_FW') || missingCalcNote}
                    </div>

                    <div style="background: #f9f9f9; padding: 12px; margin-bottom: 12px; border-radius: 4px; border-left: 4px solid #009B4C;">
                        <p style="margin:0 0 5px 0; text-align:left;"><strong>Leistung an Trommel (\\(P_W\\)):</strong></p>
                        ${getRawMath('info_PW') || missingCalcNote}
                    </div>

                    <div style="background: #eafaf1; padding: 12px; margin-bottom: 12px; border-radius: 4px; border-left: 4px solid #009B4C;">
                        <p style="margin:0 0 5px 0; text-align:left;"><strong>Erforderliche Motorleistung (\\(P_{M,\\mathrm{erf}}\\)):</strong></p>
                        ${getRawMath('info_PM') || missingCalcNote}
                    </div>
                </div>
            </div>

            <div class="html2pdf__page-break"></div>

            <!-- SEITE 3: DIAGRAMME MIT HTML-LATEX OVERLAYS -->
            <div style="background: white; padding: 20px; box-sizing: border-box; font-family: Arial, sans-serif;">
                <div style="border-bottom: 2px solid #009B4C; padding-bottom: 10px; margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 8px;">
                        <div>${logoHtml}</div>
                        <h1 style="color: #2c3e50; margin: 0 0 5px 0; font-size: 22px;">Leistungsdiagramme</h1>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 13px; color: #666;">
                        <div><strong>Projekt:</strong> ${projName}</div>
                        <div><strong>Ersteller:</strong> ${creator}</div>
                        <div><strong>Datum:</strong> ${date}</div>
                    </div>
                </div>

                <!-- DIAGRAMM 1 -->
                <h3 style="background: #f4f4f9; padding: 5px 10px; font-size: 13px; border-left: 4px solid #009B4C; margin: 0 0 8px 0; color: #2c3e50;">1. Erforderliche Motorleistung \\(P_{M,\\mathrm{erf}}\\) vs. Bandgeschwindigkeit \\(v\\)</h3>
                <div style="position: relative; border: 1px solid #e5e5e5; border-radius: 4px; background: #ffffff; margin-bottom: 15px; width: 100%;">
                    <div style="position: absolute; top: 8px; left: 15px; font-size: 11px; color: #2c3e50; font-weight: bold;">
                        \\(\\uparrow\\) Erf. Motorleistung \\(P_{M,\\mathrm{erf}}\\) \\([\\mathrm{kW}]\\)
                    </div>
                    <div style="position: absolute; bottom: 8px; width: 100%; text-align: center; font-size: 11px; color: #2c3e50; font-weight: bold;">
                        Bandgeschwindigkeit \\(v\\) \\([\\mathrm{m/s}]\\) &nbsp;&nbsp; (bei \\(h_{\\mathrm{Klappe}} = ${p.h_k.toFixed(2)} \\text{ m}\\)) \\(\\rightarrow\\)
                    </div>
                    <img src="${chartSpeedUrl}" style="width: 100%; height: auto; display: block; margin: 0;">
                </div>

                <!-- DIAGRAMM 2 -->
                <h3 style="background: #f4f4f9; padding: 5px 10px; font-size: 13px; border-left: 4px solid #009B4C; margin: 0 0 8px 0; color: #2c3e50;">2. Erforderliche Motorleistung \\(P_{M,\\mathrm{erf}}\\) vs. Schütthöhe \\(h_{\\mathrm{Klappe}}\\) (bis \\(h_{\\mathrm{Klappe,max}}\\))</h3>
                <div style="position: relative; border: 1px solid #e5e5e5; border-radius: 4px; background: #ffffff; width: 100%;">
                    <div style="position: absolute; top: 8px; left: 15px; font-size: 11px; color: #2c3e50; font-weight: bold;">
                        \\(\\uparrow\\) Erf. Motorleistung \\(P_{M,\\mathrm{erf}}\\) \\([\\mathrm{kW}]\\)
                    </div>
                    <div style="position: absolute; bottom: 8px; width: 100%; text-align: center; font-size: 11px; color: #2c3e50; font-weight: bold;">
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
            margin: [10, 10, 10, 10],
            filename: exportFileName,
            image: { type: 'jpeg', quality: 1.0 },
            html2canvas: { scale: 2, useCORS: true, scrollX: 0, scrollY: 0 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(pdfContainer).save().then(() => {
            btn.innerText = originalText;
            btn.disabled = false;
        }).catch((err) => {
            console.error("PDF Fehler:", err);
            alert("Fehler bei der PDF Erstellung.");
            btn.innerText = originalText;
            btn.disabled = false;
        });

    } catch (error) {
        console.error("PDF Generierungsfehler:", error);
        alert("Es ist ein Fehler bei der Vorbereitung des Berichts aufgetreten: " + error.message);
        btn.innerText = originalText;
        btn.disabled = false;
    }
}