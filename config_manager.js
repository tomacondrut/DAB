/*
 * DOMÄNE: Konfigurations-Management & Meta-Daten
 * FIX: Nutzt nun Blob-Generierung statt data-URI, um "Datei beschädigt" Fehler zu vermeiden.
 * BREADCRUMB: [UPDATE] Vollständige Integration der Silo-Geometrie und Janssen-Schüttgutparameter
 *             in den Speichern- und Laden-Zyklus (saveDAB & loadDAB).
 */

let projMeta = { projekt: "---", ersteller: "---" };

function openMetaModal() {
    document.getElementById('input-projekt').value = projMeta.projekt !== "---" ? projMeta.projekt : "";
    document.getElementById('input-ersteller').value = projMeta.ersteller !== "---" ? projMeta.ersteller : "";
    document.getElementById('metaModal').style.display = 'flex';
}

function closeMetaModal() {
    document.getElementById('metaModal').style.display = 'none';
}

function saveMetaModal() {
    projMeta.projekt = document.getElementById('input-projekt').value.trim() || "---";
    projMeta.ersteller = document.getElementById('input-ersteller').value.trim() || "---";
    document.getElementById('disp-projekt').innerText = projMeta.projekt;
    document.getElementById('disp-ersteller').innerText = projMeta.ersteller;
    closeMetaModal();
}

function saveDAB() {
    const config = {
        meta: projMeta,
        L: getVal('in_L', 3.15),
        B: getVal('in_B', 0.65),
        b: getVal('in_b', 0.45),
        alpha: getVal('in_alpha', 2.0),
        DU: getVal('in_DU', 0.193),
        DA: getVal('in_DA', 0.219),
        h_silo: getVal('in_h_silo', 3.0),
        L_box: getVal('in_L_box', 0.55),
        h_klappe_max: getVal('in_h_klappe_max', 0.32),
        h_klappe: getVal('in_h_klappe', 0.32),
        v: getVal('in_v', 0.38),
        rho: getVal('in_rho', 1600),
        m_leer: getVal('in_m_leer', 21.0),
        C: getVal('in_C', 2.0),
        eta: getVal('in_eta', 0.75),
        mu_g: getVal('in_mu_g', 0.60),
        mu_i: getVal('in_mu_i', 0.50),
        flow_mode: document.querySelector('input[name="flow_mode"]:checked') ? document.querySelector('input[name="flow_mode"]:checked').value : 'geom',

        // --- NEU: Silo-Parameter für den Export ---
        silo_L: getVal('in_silo_L', 3.0),
        silo_B: getVal('in_silo_B', 3.0),
        silo_H: getVal('in_silo_H', 10.0),
        out_L: getVal('in_out_L', 0.55),
        out_B: getVal('in_out_B', 0.45),
        out_x: getVal('in_out_x', 0.0),
        out_y: getVal('in_out_y', 0.0),
        hop_a: getVal('in_hop_a', 45),
        hop_type: document.querySelector('input[name="hop_type"]:checked') ? document.querySelector('input[name="hop_type"]:checked').value : '4',
        silo_rho: getVal('in_silo_rho', 1600),
        silo_mu_i: getVal('in_silo_mu_i', 0.50),
        silo_mu_w: getVal('in_silo_mu_w', 0.40)
    };

    // Robuste Blob-Generierung (verhindert JSON Parsing Errors beim erneuten Laden)
    const blob = new Blob([JSON.stringify(config, null, 4)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    const safeProjName = projMeta.projekt !== "---" ? projMeta.projekt.replace(/[^a-zA-Z0-9\-_ÄÖÜäöü]/g, '_') : "Projekt";

    a.href = url;
    a.download = `${safeProjName}_Konfiguration.dab`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/*
 * DOMÄNE: Konfigurations-Management (.dab Laden)
 * FIX: Strikte Trennung von Dateianalyse (JSON.parse) und UI-Logik.
 * Verhindert, dass harmlose Rendering-Fehler als "Datei beschädigt" interpretiert werden.
 */
function loadDAB(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        let config;

        // 1. SCHRITT: Datei strikt parsen
        try {
            config = JSON.parse(e.target.result);
        } catch (err) {
            console.error("Datei Parse-Fehler:", err);
            alert("Die .dab Datei konnte nicht gelesen werden. Sie ist möglicherweise beschädigt.");
            document.getElementById('dabFileInput').value = '';
            return;
        }

        // 2. SCHRITT: UI aktualisieren und Berechnungen triggern
        try {
            const setVal = (id, val) => {
                const el = document.getElementById(id);
                if (el && val !== undefined) el.value = val;
            };

            // Metadaten setzen
            if (config.meta) {
                projMeta = config.meta;
                const elProj = document.getElementById('disp-projekt');
                const elErst = document.getElementById('disp-ersteller');
                if (elProj) elProj.innerText = projMeta.projekt;
                if (elErst) elErst.innerText = projMeta.ersteller;
            }

            // Basis-Zahlenwerte Bandanlage setzen
            setVal('in_L', config.L);
            setVal('in_B', config.B !== undefined ? Number(config.B).toFixed(2) : undefined);
            setVal('in_b', config.b);
            setVal('in_alpha', config.alpha);
            setVal('in_DU', config.DU);
            setVal('in_DA', config.DA);
            setVal('in_h_silo', config.h_silo);
            setVal('in_L_box', config.L_box);
            setVal('in_h_klappe_max', config.h_klappe_max);
            setVal('in_h_klappe', config.h_klappe);
            setVal('in_v', config.v);
            setVal('in_rho', config.rho);
            setVal('in_m_leer', config.m_leer);
            setVal('in_C', config.C);
            setVal('in_eta', config.eta);
            setVal('in_mu_g', config.mu_g);
            setVal('in_mu_i', config.mu_i);

            // --- NEU: Silo-Parameter inkl. Slider-Sync laden ---
            setVal('in_silo_L', config.silo_L); setVal('sl_silo_L', config.silo_L);
            setVal('in_silo_B', config.silo_B); setVal('sl_silo_B', config.silo_B);
            setVal('in_silo_H', config.silo_H); setVal('sl_silo_H', config.silo_H);

            setVal('in_out_L', config.out_L); setVal('sl_out_L', config.out_L);
            setVal('in_out_B', config.out_B); setVal('sl_out_B', config.out_B);
            setVal('in_out_x', config.out_x); setVal('sl_out_x', config.out_x);
            setVal('in_out_y', config.out_y); setVal('sl_out_y', config.out_y);

            setVal('in_hop_a', config.hop_a); setVal('sl_hop_a', config.hop_a);

            setVal('in_silo_rho', config.silo_rho); setVal('sl_silo_rho', config.silo_rho);
            setVal('in_silo_mu_i', config.silo_mu_i); setVal('sl_silo_mu_i', config.silo_mu_i);
            setVal('in_silo_mu_w', config.silo_mu_w); setVal('sl_silo_mu_w', config.silo_mu_w);

            // Flow-Mode (Radio Buttons)
            if (config.flow_mode) {
                const radio = document.querySelector(`input[name="flow_mode"][value="${config.flow_mode}"]`);
                if (radio) {
                    radio.checked = true;
                    if (typeof toggleFlowMode === 'function') toggleFlowMode();
                }
            }

            // Trichter-Typ (Radio Buttons)
            if (config.hop_type) {
                const radioHop = document.querySelector(`input[name="hop_type"][value="${config.hop_type}"]`);
                if (radioHop) radioHop.checked = true;
            }

            // Simulation und Grafik synchronisieren
            if (typeof syncSpeed === 'function') syncSpeed(config.v);

            // Render- & Rechen-Updates (Fehlertolerant via Timeout)
            setTimeout(() => {
                if (typeof resetBoxParticles === 'function') resetBoxParticles();
                if (typeof updateGeometry === 'function') updateGeometry();
                if (typeof calcSiloPressure === 'function') calcSiloPressure();
                if (typeof drawSiloCanvas === 'function') drawSiloCanvas();
                if (typeof calculate === 'function') calculate();
            }, 50);

        } catch (err) {
            console.warn("Hinweis: Datei wurde geladen, aber beim Aktualisieren der Grafik trat eine Unstimmigkeit auf.", err);
        }

        // Input immer zurücksetzen, damit dieselbe Datei sofort nochmal geladen werden kann
        document.getElementById('dabFileInput').value = '';
    };

    // Datei einlesen
    reader.readAsText(file);
}