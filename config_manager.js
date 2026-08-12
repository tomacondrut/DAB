/*
 * DOMÄNE: Konfigurations-Management & Meta-Daten
 * FIX: Nutzt nun Blob-Generierung statt data-URI, um "Datei beschädigt" Fehler zu vermeiden.
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
        mu_i: getVal('in_mu_i', 0.40),
        flow_mode: document.querySelector('input[name="flow_mode"]:checked') ? document.querySelector('input[name="flow_mode"]:checked').value : 'geom'
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

        // 1. SCHRITT: Datei strikt parsen (Hier liegt der Fehler nur an echter Dateibeschädigung)
        try {
            config = JSON.parse(e.target.result);
        } catch (err) {
            console.error("Datei Parse-Fehler:", err);
            alert("Die .dab Datei konnte nicht gelesen werden. Sie ist möglicherweise beschädigt.");
            document.getElementById('dabFileInput').value = ''; // Input zurücksetzen
            return; // Abbruch
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

            // Zahlenwerte setzen
            setVal('in_L', config.L);
            setVal('in_B', config.B);
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

            // Flow-Mode (Radio Buttons)
            if (config.flow_mode) {
                const radio = document.querySelector(`input[name="flow_mode"][value="${config.flow_mode}"]`);
                if (radio) {
                    radio.checked = true;
                    if (typeof toggleFlowMode === 'function') toggleFlowMode();
                }
            }

            // Simulation und Grafik synchronisieren
            if (typeof syncSpeed === 'function') syncSpeed(config.v);

            // Render- & Rechen-Updates (Fehlertolerant)
            setTimeout(() => {
                if (typeof resetBoxParticles === 'function') resetBoxParticles();
                if (typeof updateGeometry === 'function') updateGeometry();
                if (typeof calculate === 'function') calculate();
            }, 50); // Minimales Delay, damit das DOM die Werte sicher geschluckt hat

        } catch (err) {
            console.warn("Hinweis: Datei wurde geladen, aber beim Aktualisieren der Grafik trat eine Unstimmigkeit auf.", err);
            // Kein Alert hier, da die Datei selbst funktioniert hat.
        }

        // Input immer zurücksetzen, damit dieselbe Datei sofort nochmal geladen werden kann
        document.getElementById('dabFileInput').value = '';
    };

    // Datei einlesen
    reader.readAsText(file);
}