/*
 * DOMÄNE: PDF Export (html2pdf.js)
 * FIX: Der "MathJax-Staubsauger" entfernt alle versteckten Text-Ebenen und Screenreader-Formeln,
 * sodass html2canvas NUR noch das saubere, fertig gerenderte SVG-Bild sieht.
 * Überschriften wurden auf sicheres HTML umgestellt.
 */

async function generatePDF() {
    const btn = document.getElementById('btnExportPDF');
    const originalText = btn.innerText;
    btn.innerText = 'Wird generiert...';
    btn.disabled = true;

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

    const logoUrl = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSAAjJb2w86L8F8qhLZ2Pm1qh2vOXiwZZpsgvMTKa7iDCsxsuPAy4LD9CuM&s=10';
    const logoImg = new Image();
    logoImg.crossOrigin = "anonymous";

    const renderPDF = async (base64Logo) => {
        const pdfContainer = document.createElement('div');
        pdfContainer.style.width = '680px';
        pdfContainer.style.fontFamily = 'Arial, sans-serif';
        pdfContainer.style.color = '#333';
        pdfContainer.style.background = '#fff';
        pdfContainer.style.boxSizing = 'border-box';
        pdfContainer.style.overflow = 'hidden';

        let logoHtml = base64Logo ? `<img src="${base64Logo}" style="height: 45px;" alt="Logo">` : '';

        const getV = (id) => document.getElementById(id) ? document.getElementById(id).value : '-';
        const getT = (id) => document.getElementById(id) ? document.getElementById(id).innerText : '-';

        // Greift auf die ungerenderten Roh-LaTeX-Strings zu
        const getRawMath = (key) => (window.lastCalculatedMath && window.lastCalculatedMath[key]) ? window.lastCalculatedMath[key] : '';

        const canvas = document.getElementById('conveyorCanvas');
        const canvasImgUrl = canvas ? canvas.toDataURL('image/png') : '';
        const missingCalcNote = '<em>Keine Formeldaten verfügbar.</em>';

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

                <div style="background: #f9f9f9; padding: 10px 15px; border-radius: 6px; border-left: 4px solid #009B4C; margin-bottom: 15px;">
                    <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #2c3e50;">Eingabeparameter</h3>
                    <div style="display: flex; justify-content: space-between; font-size: 12px; line-height: 1.6;">
                        <div style="width: 48%;">
                            <strong>Länge (L):</strong> ${getV('in_L')} m<br>
                            <strong>Neigung (α):</strong> ${getV('in_alpha')}°<br>
                            <strong>Gurtbreite (B):</strong> ${getV('in_B')} m<br>
                            <strong>Lichte Weite (b):</strong> ${getV('in_b')} m<br>
                            <strong>Trommeln (DU / DA):</strong> Ø ${getV('in_DU')} m / Ø ${getV('in_DA')} m
                        </div>
                        <div style="width: 48%;">
                            <strong>Geschwindigkeit (v):</strong> ${getV('in_v')} m/s<br>
                            <strong>Schüttdichte (ρ):</strong> ${getV('in_rho')} kg/m³<br>
                            <strong>Silo-Füllhöhe:</strong> ${getV('in_h_silo')} m<br>
                            <strong>Einlauflänge Kasten:</strong> ${getV('in_L_box')} m<br>
                            <strong>Schütthöhe Schieber:</strong> ${getV('in_h_klappe')} m
                        </div>
                    </div>
                </div>

                <h3 style="background: #f4f4f9; padding: 6px 12px; font-size: 14px; border-left: 4px solid #e67e22; margin: 0 0 10px 0; color: #2c3e50;">Systemgeometrie</h3>
                <div style="margin-bottom: 15px; text-align: center; border: 1px solid #eee; border-radius: 6px; padding: 5px;">
                    ${canvasImgUrl ? `<img src="${canvasImgUrl}" style="max-width: 100%; height: auto; display: block; margin: 0 auto;">` : '<em>Keine Grafik verfügbar</em>'}
                </div>

                <h3 style="background: #f4f4f9; padding: 6px 12px; font-size: 14px; border-left: 4px solid #009B4C; margin: 0 0 10px 0; color: #2c3e50;">Berechnungsergebnisse (Zusammenfassung)</h3>
                <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 15px;">
                    <div style="width: 48%; border: 1px solid #eee; background: #fafafa; padding: 10px; border-radius: 6px; box-sizing: border-box;">
                        <div style="font-size: 10px; color: #666; text-transform: uppercase; font-weight: bold;">Streckenlast Gut</div>
                        <div style="font-size: 16px; color: #2c3e50; font-weight: bold; margin-top: 4px;">${getT('out_mL')}</div>
                    </div>
                    <div style="width: 48%; border: 1px solid #eee; background: #fafafa; padding: 10px; border-radius: 6px; box-sizing: border-box;">
                        <div style="font-size: 10px; color: #666; text-transform: uppercase; font-weight: bold;">Zusätzliche Abzugskraft</div>
                        <div style="font-size: 16px; color: #e67e22; font-weight: bold; margin-top: 4px;">${getT('out_FAbz')}</div>
                    </div>
                    <div style="width: 48%; border: 1px solid #eee; background: #fafafa; padding: 10px; border-radius: 6px; box-sizing: border-box;">
                        <div style="font-size: 10px; color: #666; text-transform: uppercase; font-weight: bold;">Gesamtwiderstand</div>
                        <div style="font-size: 16px; color: #2c3e50; font-weight: bold; margin-top: 4px;">${getT('out_FW')}</div>
                    </div>
                    <div style="width: 48%; border: 2px solid #009B4C; background: #eafaf1; padding: 10px; border-radius: 6px; box-sizing: border-box;">
                        <div style="font-size: 10px; color: #009B4C; text-transform: uppercase; font-weight: bold;">Erf. Motorleistung</div>
                        <div style="font-size: 18px; color: #009B4C; font-weight: bold; margin-top: 4px;">${getT('out_PM')}</div>
                    </div>
                </div>
            </div>

            <div class="html2pdf__page-break"></div>

            <!-- SEITE 2: FORMELN -->
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

                <h3 style="background: #f4f4f9; padding: 6px 12px; font-size: 14px; border-left: 4px solid #009B4C; margin: 0 0 15px 0; color: #2c3e50;">Formeln & Rechenwege</h3>

                <div style="font-size: 12px; color: #333; line-height: 1.5; text-align: center;">
                    
                    <div style="background: #f9f9f9; padding: 12px; margin-bottom: 12px; border-radius: 6px; border-left: 4px solid #34495e;">
                        ${getRawMath('info_mL') || missingCalcNote}
                    </div>
                    
                    <div style="background: #fef9e7; padding: 12px; margin-bottom: 12px; border-radius: 6px; border-left: 4px solid #e67e22;">
                        ${getRawMath('info_FAbz') || missingCalcNote}
                    </div>

                    <!-- Überschriften mit sicherem HTML statt LaTeX Inline-Math -->
                    <div style="background: #f9f9f9; padding: 12px; margin-bottom: 12px; border-radius: 6px; border-left: 4px solid #34495e;">
                        <p style="margin:0 0 5px 0; text-align:left;"><strong>Steigungswiderstand (F<sub>St</sub>):</strong></p>
                        ${getRawMath('info_FSt') || missingCalcNote}
                    </div>

                    <div style="background: #f9f9f9; padding: 12px; margin-bottom: 12px; border-radius: 6px; border-left: 4px solid #34495e;">
                        <p style="margin:0 0 5px 0; text-align:left;"><strong>Hauptwiderstand (F<sub>H</sub>):</strong></p>
                        ${getRawMath('info_FH') || missingCalcNote}
                    </div>

                    <div style="background: #f9f9f9; padding: 12px; margin-bottom: 12px; border-radius: 6px; border-left: 4px solid #34495e;">
                        <p style="margin:0 0 5px 0; text-align:left;"><strong>Gesamtwiderstand (F<sub>W</sub>):</strong></p>
                        ${getRawMath('info_FW') || missingCalcNote}
                    </div>

                    <div style="background: #f9f9f9; padding: 12px; margin-bottom: 12px; border-radius: 6px; border-left: 4px solid #009B4C;">
                        <p style="margin:0 0 5px 0; text-align:left;"><strong>Leistung an Trommel (P<sub>W</sub>):</strong></p>
                        ${getRawMath('info_PW') || missingCalcNote}
                    </div>

                    <div style="background: #eafaf1; padding: 12px; margin-bottom: 12px; border-radius: 6px; border-left: 4px solid #009B4C;">
                        <p style="margin:0 0 5px 0; text-align:left;"><strong>Erforderliche Motorleistung (P<sub>M,erf</sub>):</strong></p>
                        ${getRawMath('info_PM') || missingCalcNote}
                    </div>

                </div>
            </div>
        `;

        // Einmalig in den DOM hängen, damit MathJax rechnen kann
        pdfContainer.style.position = 'absolute';
        pdfContainer.style.left = '-9999px';
        document.body.appendChild(pdfContainer);

        if (window.MathJax && window.MathJax.typesetPromise) {
            try {
                await window.MathJax.typesetPromise([pdfContainer]);

                // ==============================================================
                // DER MATHJAX "STAUBSAUGER" FÜR HTML2CANVAS
                // ==============================================================
                // Wir suchen alle Container, in denen MathJax eine Formel platziert hat.
                const mjxContainers = pdfContainer.querySelectorAll('mjx-container');

                mjxContainers.forEach(container => {
                    // Wir retten NUR die saubere SVG Grafik
                    const svg = container.querySelector('svg');
                    if (svg) {
                        // Wir leeren den kompletten Container hart aus (löscht Screenreader & Quelltext)
                        container.innerHTML = '';
                        // Wir setzen NUR das SVG wieder ein
                        container.appendChild(svg);
                    }
                });
                // ==============================================================

            } catch (e) { console.error("Fehler beim Formel-Rendern:", e); }
        }

        // Nach dem Rendern Position wiederherstellen für den Export
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
    };

    logoImg.onload = () => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = logoImg.width;
        tempCanvas.height = logoImg.height;
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(logoImg, 0, 0);
        renderPDF(tempCanvas.toDataURL('image/png'));
    };

    logoImg.onerror = () => {
        console.warn("Logo-Download fehlgeschlagen. PDF wird ohne Logo generiert.");
        renderPDF('');
    };

    logoImg.src = logoUrl;
}