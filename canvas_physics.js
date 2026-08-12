/*
 * [BREADCRUMB: 2026-08-09]
 * DOMÄNE: Canvas Physik-Engine & Animation
 * UPDATE: 
 * - Hard-Constraints nach hinten verschoben: Wände und Gurt sind nun absolut undurchdringlich (Behebt Clipping).
 * - Split-Radius Kollision: Partikel prallen zu 100% an Wänden ab, dürfen sich untereinander aber zu 25% überlappen (erzeugt dichte Fläche).
 * - Partikelgröße für ein solideres Bild leicht erhöht.
 */

let animId;
let lastTime = 0;
let beltOffset = 0;
let particles = [];
let isAnimating = true;

const BELT_THICKNESS = 0.010; 
// Erhöhter optischer Radius (20mm bzw 40mm Durchmesser)
const currentSimRadius = 0.020; 

let hoveredDim = null;
let hitboxes = [];

function getVal(id, fallback) {
    const el = document.getElementById(id);
    if (!el) return fallback;
    const val = parseFloat(el.value);
    return isNaN(val) ? fallback : val;
}

/*
 * [BREADCRUMB: 2026-08-10]
 * DOMÄNE: Canvas Physik-Engine & Animation - Particle Klasse
 * UPDATE: 
 * - Partikel erhalten eine von 4 Steinfarben.
 * - 20% Chance (2 von 10) auf Polygon-Form (Hexagon, Octagon, Dekagon) mit Kontur.
 */
class Particle {
    constructor(x, y, radius) {
        this.x = x;
        this.y = y; 
        this.vx = 0;
        this.vy = 0;
        this.r = radius * (0.85 + Math.random() * 0.3); 
        this.lockedHeight = null; 
        this.belt_h = null; 
        this.state = 'box'; 
        this.dead = false;

        // --- NEU: Optische Eigenschaften ---
        // 4 unterschiedliche Steinfarben
        const stoneColors = ['#5c5c5c', '#7d7a75', '#8f8f8f', '#4a4845'];
        this.color = stoneColors[Math.floor(Math.random() * stoneColors.length)];

        // 20% Wahrscheinlichkeit für Polygon mit Kontur (0.2)
        this.isPolygon = Math.random() < 0.2;
        if (this.isPolygon) {
            const sides = [6, 8, 10]; // Hexagon, Octagon, Dekagon
            this.polySides = sides[Math.floor(Math.random() * sides.length)];
            this.angleOffset = Math.random() * Math.PI * 2; // Zufällige Start-Rotation
        }
    }
}

/*
 * [BREADCRUMB: 2026-08-11]
 * DOMÄNE: Canvas Physik-Engine - toggleAnimation
 * UPDATE: Text durch reine Icon-Symbole ersetzt (▶ / ❚❚).
 */
function toggleAnimation() {
    isAnimating = !isAnimating;
    const btn = document.getElementById('btnAnimToggle');
    if (isAnimating) {
        btn.innerText = "❚❚";
        lastTime = performance.now();
        animId = requestAnimationFrame(renderLoop);
    } else {
        btn.innerText = "▶";
        cancelAnimationFrame(animId);
        animId = null;
    }
}

function drawDimTick(ctx, x, y, isHovered) {
    ctx.beginPath(); ctx.moveTo(x - 3, y + 3); ctx.lineTo(x + 3, y - 3);
    ctx.strokeStyle = isHovered ? '#d9534f' : '#333'; 
    ctx.lineWidth = 0.8; ctx.stroke();
}

/*
 * [BREADCRUMB: 2026-08-12]
 * DOMÄNE: Canvas Rendering & UI - drawDrumArrow
 * UPDATE: 
 * - Mittelkreuze durch gebogene Drehrichtungspfeile (3/4 Kreisbogen mit Pfeilspitze) im Trommelinneren ersetzt.
 */
/*
 * [BREADCRUMB: 2026-08-12]
 * DOMÄNE: Canvas Rendering & UI - drawDrumArrow
 * UPDATE: 
 * - Gebogene Drehrichtungspfeile rotieren nun dynamisch mit der Trommelbewegung.
 */
function drawDrumArrow(ctx, x, y, radius, scale, rotAngle, isHovered) {
    const r = radius * scale * 0.55; // Pfeilradius relativ zur Trommel
    const startAngle = -Math.PI * 0.75;
    const endAngle = Math.PI * 0.4;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotAngle); // Dynamische Rotation basierend auf dem Band-Offset

    // Gebogener Bogen
    ctx.beginPath();
    ctx.arc(0, 0, r, startAngle, endAngle, false);
    ctx.strokeStyle = isHovered ? '#d9534f' : '#333333';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Pfeilspitze
    const arrowX = r * Math.cos(endAngle);
    const arrowY = r * Math.sin(endAngle);
    const arrowSize = 4.5;
    const tangentAngle = endAngle + Math.PI / 2;

    ctx.beginPath();
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(
        arrowX - arrowSize * Math.cos(tangentAngle - Math.PI / 6),
        arrowY - arrowSize * Math.sin(tangentAngle - Math.PI / 6)
    );
    ctx.lineTo(
        arrowX - arrowSize * Math.cos(tangentAngle + Math.PI / 6),
        arrowY - arrowSize * Math.sin(tangentAngle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fillStyle = isHovered ? '#d9534f' : '#333333';
    ctx.fill();

    ctx.restore();
}

/*
 * [BREADCRUMB: 2026-08-09]
 * DOMÄNE: Canvas Physik-Engine & Animation - initParticles
 * UPDATE: 
 * - `boxHeight` für Physik (physicsBoxHeight) signifikant erhöht (+ 0.60 statt + 0.10), um eine höhere unsichtbare Säule mit mehr Partikeln zu erzeugen.
 * - (Dismissed: Optische Boxhöhe erhöht, da dies die Proportionen der UI-Darstellung ruiniert hätte. Trennung von Physik- und Optik-Höhe eingeführt).
 * -physicsBoxHeight auf + 0.15 reduziert, da durch den stabileren PBD - Solver kein riesiger unsichtbarer Puffer mehr nötig ist.
 */
function initParticles() {
    particles = [];
    const L_box = getVal('in_L_box', 0.55);
    const alpha = getVal('in_alpha', 2) * Math.PI / 180;
    const h_klappe_max = getVal('in_h_klappe_max', 0.32);

    const DU = getVal('in_DU', 0.193);
    const rU_outer = Math.abs(DU / 2) + BELT_THICKNESS;
    const U_top_y = rU_outer * Math.cos(alpha);

    // REDUZIERT: Nur noch minimaler unsichtbarer Puffer über der Box
    const physicsBoxHeight = h_klappe_max + 0.15;

    // Raster-Spawnen: Breiter fächern, da Überlappung erwünscht
    const colWidth = currentSimRadius * 1.5;
    const numCols = Math.floor((L_box - 0.04) / colWidth);

    for (let c = 0; c < numCols; c++) {
        let px = 0.02 + c * colWidth;
        let beltY = U_top_y + Math.tan(alpha) * px;

        let rows = Math.floor(physicsBoxHeight / (currentSimRadius * 1.5));
        for (let r = 0; r < rows; r++) {
            let py = beltY + currentSimRadius + r * (currentSimRadius * 1.5);
            if (py > beltY + physicsBoxHeight) break;
            let jx = px + (Math.random() - 0.5) * 0.005;
            let jy = py + (Math.random() - 0.5) * 0.005;
            particles.push(new Particle(jx, jy, currentSimRadius));
        }
    }

    for (let k = 0; k < 60; k++) updatePhysics(0.016, true);
}

function renderLoop(timestamp) {
    if (!isAnimating) return;
    if (!lastTime) lastTime = timestamp;
    let dt = (timestamp - lastTime) / 1000;
    if (dt > 0.1) dt = 0.1;
    lastTime = timestamp;

    updatePhysics(dt, false);
    drawConveyorCanvas();

    // NEU: Live-Anzeige der Partikel im Info-Modal aktualisieren
    const elPtc = document.getElementById('live_particle_count');
    if (elPtc) elPtc.innerText = particles.length;

    animId = requestAnimationFrame(renderLoop);
}

/*
 * [BREADCRUMB: 2026-08-09]
 * DOMÄNE: Canvas Physik-Engine & Animation - updatePhysics (Ausschnitt)
 * UPDATE: 
 * - Gap-Spawner-Logik angepasst: Nutzt nun ebenfalls `physicsBoxHeight` (+ 0.60), damit der Partikel-Puffer während der Animation konstant hoch gefüllt bleibt.
 */
/*
 * [BREADCRUMB: 2026-08-10]
 * DOMÄNE: Canvas Physik-Engine & Animation - updatePhysics (Scherkraft & Abzug)
 * UPDATE: 
 * - Zustand 'belt' vollständig entfernt: Partikel bleiben auch auf dem Fördergurt dynamisches Schüttgut ('box').
 * - Massive Scherkraft-Übertragung (Viscous Cohesion) im Solver integriert: Untere Schichten schleppen die oberen mit.
 * - Partikel formen nun nach dem Schieber ein natürliches Schüttgutprofil und werden nicht mehr künstlich eingefroren.
 * - Performance der Kollisionsschleife durch (j = i + 1) halbiert.
 */
/*
 * [BREADCRUMB: 2026-08-10]
 * DOMÄNE: Canvas Physik-Engine & Animation - updatePhysics (Gurt-Abzug & Durchfall-Fix)
 * UPDATE: 
 * - Reibungs- & Scherkraftradius erweitert (1.1x allowedDist): Untere Schichten ziehen obere Schichten mit.
 * - Vertikale Fallbremse (Drag) im Stapel: Verhindert das Durchschlagen nachrückender Partikel nach 5 Sekunden.
 * - Haftreibung am Gurt und untereinander für realistischen Schüttgutabzug aus dem Kasten.
 */
/*
 * [BREADCRUMB: 2026-08-10]
 * DOMÄNE: Canvas Physik-Engine & Animation - updatePhysics (Low-Speed Stability)
 * UPDATE: 
 * - "Material-Kollaps" bei geringen Bandgeschwindigkeiten behoben:
 *   1. Überlappungs-Korrektur von 0.25 auf 0.45 angehoben (höhere statische Tragkraft/Steifigkeit).
 *   2. Vertikale Schwerkraftdämpfung stabilisiert das Fundament auch im Fast-Stillstand.
 *   3. Scherkraft-Kopplung dynamisch an die Bandgeschwindigkeit angepasst.
 */
/*
 * [BREADCRUMB: 2026-08-10]
 * DOMÄNE: Canvas Physik-Engine & Animation - updatePhysics (Rolliger Kies / Rigidity)
 * UPDATE: 
 * - Sticky-Verhalten um 50% reduziert: Drag-Radius entfernt, reines Berührungsmodell.
 * - Impulskopplung auf reale Trockenreibung von Kies drosseln (0.3 statt 0.6..0.85).
 * - Hohe statische Stützkraft erhalten, damit starre Steine nicht ineinander absinken.
 */
/*
 * [BREADCRUMB: 2026-08-10]
 * DOMÄNE: Canvas Physik-Engine & Animation - updatePhysics (Position-Based Velocity Fix)
 * UPDATE: 
 * - Instabilität & Kollaps im Einlaufkasten endgültig behoben:
 *   1. Positionsbasierte Geschwindigkeitskorrektur (Post-Solver Velocity Derivation) verhindert Energieaufbau.
 *   2. Dichtebremse (Damping) nimmt fallenden Partikeln sofort den Schwung, sobald sie auf den Stapel treffen.
 *   3. Harter Kontakt ohne Verkleben für starren Kies.
 */
/*
 * [BREADCRUMB: 2026-08-10]
 * DOMÄNE: Canvas Physik-Engine & Animation - updatePhysics (Gurt-Mitnahme & Scherkraft)
 * UPDATE: 
 * - Durchrutschen der untersten Schicht behoben:
 *   1. Geschwindigkeitskopplung (Scherkraft) im Solver wiedereingeführt (untere Steine schieben obere mit).
 *   2. Gurt-Impuls wird gestaffelt von unten nach oben durchgereicht, statt nur auf Y=0 zu wirken.
 * - Stabilität & PBD-Geschwindigkeits-Rekonstruktion vollständig erhalten.
 */
/*
 * [BREADCRUMB: 2026-08-10]
 * DOMÄNE: Canvas Physik-Engine & Animation - updatePhysics (Abwurfdichte & Scherkraft)
 * UPDATE: 
 * - Förderimpuls auf höhere Schichten erweitert (p.r * 5.0 statt 2.5): Verhindert das Ausdünnen zu einer einzelnen Parabel.
 * - Kochen der mittleren Schicht behoben: Dämpfung durch echte viskose Reibung im Solver ersetzt statt harter Bremse.
 * - Scherkraft-Kopplung im Solver auf 55% erhöht für realistischen Schüttgut-Blockabzug.
 */
/*
 * [BREADCRUMB: 2026-08-10]
 * DOMÄNE: Canvas Physik-Engine & Animation - updatePhysics (Low-Speed Pressure Cap)
 * UPDATE: 
 * - Rausfliegen/Katapultieren bei niedrigen Bandgeschwindigkeiten (v = 0.1) behoben:
 *   1. Gap-Spawner spritzt keine Partikel mehr in einen bereits komprimierten Stapel nach.
 *   2. Velocity Cap auf PBD-Positionen im Kasten: Interner Korrekturdruck kann keine überhöhten Impulse erzeugen.
 */
/*
 * [BREADCRUMB: 2026-08-10]
 * DOMÄNE: Canvas Physik-Engine & Animation - updatePhysics (High-Speed Flow)
 * UPDATE: 
 * - Nachrutsch-Verzögerung bei v = 2.0 m/s behoben:
 *   1. Dynamische Spawner-Frequenz: Bei hoher Bandgeschwindigkeit werden bis zu 4 Partikel zeitgleich gespawnt.
 *   2. Dynamische Fallgeschwindigkeit (Terminal Velocity) & Initial-Schwung beim Spawnen.
 *   3. Scherkraft-Kopplung wirkt im Kasten nur seitlich/horizontal, um das freie Fallen nicht zu bremsen.
 */
/*
 * [BREADCRUMB: 2026-08-10]
 * DOMÄNE: Canvas Physik-Engine & Animation - updatePhysics (Explosions-Fix)
 * UPDATE: 
 * - Schlagartiges "Kochen" nach 2 Sekunden behoben:
 *   1. Entkopplung der PBD-Positionskorrektur von der Geschwindigkeits-Rekonstruktion.
 *   2. Reibungs- & Gurt-Mitnahme direkt in die Geschwindigkeits-Integration integriert (kein künstlicher Druckaufbau).
 *   3. Dämpfung im Kasten verhindert das Aufschaukeln der kinetischen Energie dauerhaft.
 */
/*
 * [BREADCRUMB: 2026-08-10]
 * DOMÄNE: Canvas Physik-Engine & Animation - updatePhysics (Stützkraft & Abwurfprofil)
 * UPDATE: 
 * - Kollabieren bei v -> 0 behoben: Überlappungskorrektur auf 0.65 angehoben (hohe statische Tragkraft).
 * - Verdünnung an der Abwurfkante behoben: Übergang zu 'fall' an den vorderen Trommelscheitel verschoben.
 * - Basismitnahme über die gesamte Schichthöhe garantiert ein homogenes Abwurfprofil.
 */
/*
 * [BREADCRUMB: 2026-08-10]
 * DOMÄNE: Canvas Physik-Engine & Animation - updatePhysics (Unified Physics & Natural Parabola)
 * UPDATE: 
 * - Künstliche Parabel-Logik ('fall' state) restlos entfernt! Trommel wird nun als echte physikalische Rundung berechnet.
 * - Verschmelzen der Bodenschichten endgültig gelöst: Kombination aus 100% Positionskorrektur + Geschwindigkeits-Impuls (Impulse Resolution).
 * - Schwerkraft komprimiert die Steine nicht mehr, sie liegen als unnachgiebiges Gitter aufeinander.
 */
/*
 * [BREADCRUMB: 2026-08-10]
 * DOMÄNE: Canvas Physik-Engine & Animation - updatePhysics (Ultimate Stability)
 * UPDATE: 
 * - Kochen/Explodieren behoben: Reine Positions-Rekonstruktion (PBD) trennt Druck von Geschwindigkeit.
 * - Verschmelzen behoben: Solver auf 10 Iterationen + Over-Relaxation (0.6) macht den Stapel felsenhart.
 * - Mitnahme/Scherkraft: Ein dedizierter "Viscosity Pass" am Ende zieht die oberen Schichten stabil mit.
 */
/*
 * [BREADCRUMB: 2026-08-10]
 * DOMÄNE: Canvas Physik-Engine & Animation - updatePhysics (Volumetrische Parabel)
 * UPDATE: 
 * - Ausdünnen der Abwurfparabel behoben: 'fall'-Partikel nehmen nun vollständig an der PBD-Kollision teil.
 * - Geschwindigkeit-Rekonstruktion (Schritt 3) auf alle Partikel ausgeweitet, damit fliegendes Material durch Stöße auffächert.
 * - Explosions-Cap für fliegende Partikel auf 10.0 angehoben, um freien Fall nicht künstlich zu bremsen.
 */
/*
 * [BREADCRUMB: 2026-08-11]
 * DOMÄNE: Canvas Physik-Engine & Animation - updatePhysics (Friction & Rest Angle)
 * UPDATE: 
 * - Reibwerte (mu_g, mu_i) direkt in die Physik-Engine integriert.
 * - 'mu_i' dämpft die horizontale PBD-Positionskorrektur (erzeugt echten Schüttwinkel).
 * - 'mu_g' erzwingt starke Haftreibung der untersten Schicht an der Gurtgeschwindigkeit.
 * - "Liquid Flow" Bug bei stehendem Band (v=0) behoben: Material bildet nun einen stabilen Haufen und fließt nicht unendlich weiter.
 * - Spawner pausiert bei v=0, um Überdruck im Kasten zu vermeiden.
 */
function updatePhysics(dt, isWarmup = false) {
    const v_belt = isWarmup ? 0 : getVal('in_v', 0);
    const L = getVal('in_L', 1);
    const alpha_deg = getVal('in_alpha', 2);
    const alpha = alpha_deg * Math.PI / 180;
    const L_box = getVal('in_L_box', 0.55);
    const h_klappe = getVal('in_h_klappe', 0.32);
    const h_klappe_max = getVal('in_h_klappe_max', 0.32);

    // NEU: Reibwerte direkt aus der UI abrufen
    const mu_g = getVal('in_mu_g', 0.60);
    const mu_i = getVal('in_mu_i', 0.40);

    const DU = getVal('in_DU', 0.193);
    const DA = getVal('in_DA', 0.219);
    const rU = Math.abs(DU / 2);
    const rA = Math.abs(DA / 2);
    const rU_outer = rU + BELT_THICKNESS;
    const rA_outer = rA + BELT_THICKNESS;

    const beta = Math.asin((rA_outer - rU_outer) / L);
    const gamma = alpha - beta;
    const cx_A = L * Math.cos(gamma);
    const cy_A = L * Math.sin(gamma);

    const nx_top = -Math.sin(alpha);
    const U_top_y = rU_outer * Math.cos(alpha);
    const A_top_x = cx_A + rA_outer * nx_top;

    // Geometrie Shift
    const currentGeomHash = `${alpha.toFixed(4)}_${U_top_y.toFixed(4)}`;
    if (typeof window.lastGeomHash === 'undefined') {
        window.lastGeomHash = currentGeomHash;
        window.lastGeomAlpha = alpha;
        window.lastGeomU = U_top_y;
    }
    if (window.lastGeomHash !== currentGeomHash && !isWarmup) {
        for (let p of particles) {
            let old_beltY = window.lastGeomU + Math.tan(window.lastGeomAlpha) * p.x;
            let new_beltY = U_top_y + Math.tan(alpha) * p.x;
            p.y += (new_beltY - old_beltY);
        }
        window.lastGeomHash = currentGeomHash;
        window.lastGeomAlpha = alpha;
        window.lastGeomU = U_top_y;
    }

    const physicsBoxHeight = h_klappe_max + 0.15;

    let particlesOnBelt = 0;
    for (let p of particles) {
        if (p.state === 'box' && p.x > L_box) particlesOnBelt++;
    }

    let anim_v_belt = v_belt;
    if (h_klappe <= 0.001 && particlesOnBelt === 0) anim_v_belt = 0;

    if (!isWarmup) beltOffset += anim_v_belt * dt;

    // --- GAP SPAWNER ---
    // --- GAP SPAWNER (REIN VOLUMENGESTEUERT) ---
    /*
     * [BREADCRUMB: 2026-08-12]
     * DOMÄNE: Canvas Physik-Engine - updatePhysics (Always-On Refill)
     * UPDATE: 
     * - Spawner prüft den Füllstand nun IMMER, auch bei stehendem Band (v = 0).
     * - Verhindert das Leerlaufen des Kastens in allen Betriebszuständen.
     * - Sanfte Batch-Größe bei Stillstand verhindert Überdruckartefakte.
     */
    if (!isWarmup) {
        const colWidth = currentSimRadius * 1.5;
        const numCols = Math.floor((L_box - 0.04) / colWidth);
        let colMaxY = new Array(numCols).fill(0);

        for (let p of particles) {
            if (p.state === 'box' || p.x <= L_box) {
                let colIdx = Math.floor((p.x - 0.02) / colWidth);
                if (colIdx >= 0 && colIdx < numCols) {
                    if (p.y > colMaxY[colIdx]) colMaxY[colIdx] = p.y;
                }
            }
        }

        // Immer aktiv: Bei v = 0 wird sanft mit Batch-Größe 1 nachgefüllt
        const spawnBatchSize = anim_v_belt > 0.0001
            ? Math.max(1, Math.min(4, Math.ceil(anim_v_belt * 2.5)))
            : 1;

        for (let c = 0; c < numCols; c++) {
            let px = 0.02 + c * colWidth;
            let beltY = U_top_y + Math.tan(alpha) * px;
            let targetY = beltY + physicsBoxHeight;

            let currentMaxY = colMaxY[c];
            if (currentMaxY === 0) currentMaxY = beltY;

            let gap = targetY - currentMaxY;

            // Sobald eine Lücke da ist, wird nachgespeist (egal ob Band steht oder läuft)
            if (gap > currentSimRadius * 1.5 && particles.length < 8000) {
                let numToSpawn = Math.min(spawnBatchSize, Math.floor(gap / (currentSimRadius * 1.2)));
                for (let s = 0; s < numToSpawn; s++) {
                    let py = targetY - (s * currentSimRadius * 1.2);
                    let newP = new Particle(px + (Math.random() - 0.5) * 0.004, py, currentSimRadius);

                    newP.vy = -0.5; // Sanfter Fallimpuls nach unten
                    particles.push(newP);
                }
            }
        }
    }

    // --- 1. INTEGRATION (Vorhersage der Bewegung) ---
    /*
     * [BREADCRUMB: 2026-08-12]
     * DOMÄNE: Canvas Physik-Engine - updatePhysics (Dynamic Overburden Pressure)
     * UPDATE: 
     * - Silo-Auflastdruck (a_silo) wird bei ruhendem Band (anim_v_belt < 0.0001) deaktiviert.
     * - Nachgespawnte Partikel lagern sich bei v = 0 druckfrei ab, ohne Material aus dem Kasten zu pressen.
     * - Bei laufendem Band greift der Auflastdruck wieder voll proportional zur Silohöhe.
     */
    const targetVx = anim_v_belt * Math.cos(alpha);
    const targetVy = anim_v_belt * Math.sin(alpha);

    // Silo-Höhe für den Auflastdruck abrufen
    const h_silo_val = getVal('in_h_silo', 3.0);

    // NEU: Auflastdruck ist NUR aktiv, wenn das Band sich auch bewegt!
    const isMoving = anim_v_belt > 0.0001;
    const a_silo = isMoving ? (h_silo_val * 5.0) : 0;

    for (let p of particles) {
        p.prevX = p.x;
        p.prevY = p.y;

        if (p.state === 'box') {
            let current_g = 9.81;

            // Silo-Druck wirkt nur im geschlossenen Einlaufkasten und nur bei Bandlauf
            if (p.x <= L_box) {
                current_g += a_silo;
            }

            p.vy -= current_g * dt;

            // Terminal Velocity: Bei Stillstand sanft (-5.0), bei Fahrt druckskaliert
            let fallLimit = -5.0 - (a_silo * 0.1);
            if (p.vy < fallLimit) p.vy = fallLimit;

            let beltY = U_top_y + Math.tan(alpha) * p.x;
            let isTouchingBelt = (p.y <= beltY + p.r + 0.05);

            if (isTouchingBelt) {
                // Gurt-Reibung: Zwingt Partikel an die Band-Geschwindigkeit
                let beltFriction = Math.min(1.0, mu_g * 1.2);
                p.vx += (targetVx - p.vx) * beltFriction;
                p.vy += (targetVy - p.vy) * beltFriction;
            }

            // Statische Haftreibung bei stehendem Band
            if (!isMoving) {
                p.vx *= (1 - mu_i * 0.1);
            }

            p.x += p.vx * dt;
            p.y += p.vy * dt;
        }
        else if (p.state === 'fall') {
            p.vy -= 9.81 * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;

            let dx = p.x - cx_A; let dy = p.y - cy_A;
            let dist = Math.sqrt(dx * dx + dy * dy);
            let minDist = rA_outer + p.r;
            if (dist < minDist && p.y > cy_A - minDist) {
                p.x = cx_A + (dx / dist) * minDist;
                p.y = cy_A + (dy / dist) * minDist;
                // Abrutschen an der Trommel verhindern
                p.vx += ((dy / dist) * anim_v_belt - p.vx) * mu_g;
                p.vy += ((-dx / dist) * anim_v_belt - p.vy) * mu_g;
            }
            if (p.y < cy_A - rA_outer - 2.0 || p.x > L + 1.5) p.dead = true;
        }
    }

    // --- 2. STARRER PBD-SOLVER ---
    const SOLVER_ITERATIONS = 10;

    for (let iter = 0; iter < SOLVER_ITERATIONS; iter++) {
        for (let i = 0; i < particles.length; i++) {
            let pi = particles[i];

            for (let j = i + 1; j < particles.length; j++) {
                let pj = particles[j];

                let dx = pi.x - pj.x;
                let dy = pi.y - pj.y;
                let distSq = dx * dx + dy * dy;
                let allowedDist = (pi.r + pj.r) * 0.95;

                if (distSq < allowedDist * allowedDist && distSq > 0) {
                    let dist = Math.sqrt(distSq);
                    let overlap = allowedDist - dist;
                    let nx = dx / dist;
                    let ny = dy / dist;

                    let correction = overlap * 0.6;
                    let horizFriction = 1.0;

                    // NEU: Schüttwinkel durch PBD-Dämpfung simulieren!
                    if (pi.state === 'box' && pj.state === 'box') {
                        // Innere Reibung blockiert das horizontale Auseinanderrutschen
                        horizFriction = Math.max(0.1, 1.0 - mu_i * 0.85);

                        // Wenn Band steht, blockiert die Reibung fast komplett (Haufen bleibt extrem stabil)
                        if (anim_v_belt < 0.01) {
                            horizFriction = Math.max(0.02, 1.0 - mu_i * 1.5);
                        }
                    }

                    pi.x += nx * correction * horizFriction;
                    pi.y += ny * correction;
                    pj.x -= nx * correction * horizFriction;
                    pj.y -= ny * correction;
                }
            }

            // Boundary Constraints (Gurt & Wände)
            let beltY = U_top_y + Math.tan(alpha) * pi.x;
            let klappeY = U_top_y + Math.tan(alpha) * L_box + h_klappe;

            if (pi.x <= A_top_x) {
                if (pi.y < beltY + pi.r) {
                    pi.y = beltY + pi.r;
                }
            } else {
                let dx = pi.x - cx_A;
                let dy = pi.y - cy_A;
                let dist = Math.sqrt(dx * dx + dy * dy);
                let minDist = rA_outer + pi.r;
                if (dist < minDist && pi.y > cy_A - minDist) {
                    pi.x = cx_A + (dx / dist) * minDist;
                    pi.y = cy_A + (dy / dist) * minDist;
                }
            }

            if (pi.x < pi.r) pi.x = pi.r; // Rückwand

            if (pi.x > L_box - pi.r && pi.x < L_box) { // Schieber
                if (h_klappe <= 0.001 || pi.y > klappeY - pi.r * 0.5) {
                    pi.x = L_box - pi.r;
                }
            }
        }
    }

    // --- 3. GESCHWINDIGKEITEN & DÄMPFUNG ---
    for (let p of particles) {
        p.vx = (p.x - p.prevX) / dt;
        p.vy = (p.y - p.prevY) / dt;

        let maxSpeed = p.state === 'fall' ? 10.0 : Math.max(3.0, anim_v_belt * 2.5);
        let speedSq = p.vx * p.vx + p.vy * p.vy;

        if (speedSq > maxSpeed * maxSpeed) {
            let scale = maxSpeed / Math.sqrt(speedSq);
            p.vx *= scale;
            p.vy *= scale;
        }

        if (p.state === 'box') {
            // Innere Reibungsdämpfung (Material beruhigt sich relativ zum Band)
            let relVx = p.vx - targetVx;
            p.vx -= relVx * (mu_i * 0.1);

            if (p.x <= L_box) {
                p.vx *= 0.85;
                p.vy *= 0.85;
            }

            // Absoluter Stopp, wenn Band steht (Brems-Haftreibung greift)
            if (anim_v_belt < 0.01) {
                p.vx *= (1.0 - mu_g);
                if (Math.abs(p.vx) < 0.01) p.vx = 0;
            }
        }
    }

    // --- 4. VISCOUS SHEAR (Scherkraft über mu_i) ---
    for (let i = 0; i < particles.length; i++) {
        let pi = particles[i];
        if (pi.state !== 'box') continue;

        for (let j = i + 1; j < particles.length; j++) {
            let pj = particles[j];
            if (pj.state !== 'box') continue;

            let dx = pi.x - pj.x;
            let dy = pi.y - pj.y;
            let distSq = dx * dx + dy * dy;
            let allowedDist = (pi.r + pj.r) * 1.1;

            if (distSq < allowedDist * allowedDist) {
                let meanVx = (pi.vx + pj.vx) * 0.5;
                let meanVy = (pi.vy + pj.vy) * 0.5;

                // Innere Reibung (mu_i) bestimmt, wie sehr sich die Schichten blockhaft mitreißen
                let shearWeight = Math.min(1.0, mu_i * 1.5);

                pi.vx = pi.vx * (1 - shearWeight) + meanVx * shearWeight;
                pi.vy = pi.vy * (1 - shearWeight) + meanVy * shearWeight;
                pj.vx = pj.vx * (1 - shearWeight) + meanVx * shearWeight;
                pj.vy = pj.vy * (1 - shearWeight) + meanVy * shearWeight;
            }
        }
    }

    for (let p of particles) {
        if (p.state === 'box' && p.x > cx_A) {
            p.state = 'fall';
        }
    }

    particles = particles.filter(p => !p.dead);
}
function checkHover(e) {
    const canvas = document.getElementById('conveyorCanvas');
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    let newHover = null;
    for (let i = hitboxes.length - 1; i >= 0; i--) {
        let b = hitboxes[i];
        if (b.type === 'circle') {
            const dx = mx - b.x; const dy = my - b.y;
            if (Math.sqrt(dx*dx + dy*dy) <= b.r) { newHover = b.id; break; }
        } else {
            if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) { newHover = b.id; break; }
        }
    }

    if (hoveredDim !== newHover) {
        if(hoveredDim) {
            let lbl = document.getElementById('lbl_' + hoveredDim);
            let inp = document.getElementById('in_' + hoveredDim);
            if(lbl) lbl.classList.remove('highlight-label');
            if(inp) inp.classList.remove('highlight-input');
            if(hoveredDim === 'H') {
                let elH = document.getElementById('live_H_display');
                if(elH) elH.classList.remove('highlight-label');
            }
        }
        hoveredDim = newHover;
        if(hoveredDim) {
            let lbl = document.getElementById('lbl_' + hoveredDim);
            let inp = document.getElementById('in_' + hoveredDim);
            if(lbl) lbl.classList.add('highlight-label');
            if(inp) inp.classList.add('highlight-input');
            if(hoveredDim === 'H') {
                let elH = document.getElementById('live_H_display');
                if(elH) elH.classList.add('highlight-label');
            }
        }
        if (!isAnimating) drawConveyorCanvas(); 
    }
}

function handleCanvasClick(e) {
    if (hoveredDim) {
        if (hoveredDim === 'H') return; 
        let inputEl = document.getElementById('in_' + hoveredDim);
        if (inputEl) {
            inputEl.focus();
            inputEl.select();
        }
    }
}

/*
 * [BREADCRUMB: 2026-08-11]
 * DOMÄNE: Canvas Rendering & UI - drawTopView
 * UPDATE: 
 * - Draufsicht (Top View) als separates Modul hinzugefügt.
 * - Bandbreite (B) und lichte Weite (b) werden dynamisch aus UI gelesen.
 * - Trommeln (+100mm beidseitig) und Welle (+100mm beidseitig, 80mm Durchmesser) implementiert.
 * - Mittellinien für Wellen und Bandsymmetrie integriert.
 * - Seitenschürzen öffnen sich ab der Einlauf-Rückenwand um 2° nach außen.
 */
/*
 * [BREADCRUMB: 2026-08-11]
 * DOMÄNE: Canvas Rendering & UI - drawTopView (Aktualisiert)
 * UPDATE: 
 * - Z-Index korrigiert: Gurt (schwarz) liegt nun über den Trommeln/Wellen.
 * - Positionen getauscht: Draufsicht wird nun im oberen Canvas-Bereich gezeichnet.
 * - Schieber-Vorderkante in Orange (Breite dynamisch an den 2° Öffnungswinkel angepasst).
 * - Interaktive Bemaßungen (Hitbox & Highlight) für DU, DA und lichte Weite (b) integriert.
 * - Fläche für F_Boden (A = L_box * b) als Text-Overlay im Einlaufbereich berechnet und eingeblendet.
 */
/*
 * [BREADCRUMB: 2026-08-11]
 * DOMÄNE: Canvas Rendering & UI - drawTopView (Fixes)
 * UPDATE: 
 * - Y-Offset auf 180px verdoppelt (Abstand zur Oberkante).
 * - Wellendurchmesser auf 50mm korrigiert (shaftR = 0.025m).
 * - Gurt umschlingt die Trommeln inklusive Bandstärke an den Außenkanten.
 * - Einlauf-Rückenwand in Orange (#ff8c00) gezeichnet.
 */
/*
 * [BREADCRUMB: 2026-08-11]
 * DOMÄNE: Canvas Rendering & UI - drawTopView (Gurtkontur-Fix)
 * UPDATE: 
 * - Riesiger B-Radius entfernt! Gurtkontur verläuft nun exakt parallel zur Trommelaußenkante (+ BELT_THICKNESS).
 * - Trommeldurchmesser-Bemaßungen sauber ausgerichtet.
 * - Schürzen bleiben innerhalb der Gurtbreite B.
 */
function drawTopView(ctx, scale, tx, cy_top, addHitRect) {
    const B = getVal('in_B', 0.65);
    const b = getVal('in_b', 0.45);
    const L = getVal('in_L', 1);
    const L_box = getVal('in_L_box', 0.55);

    const DU = getVal('in_DU', 0.193);
    const DA = getVal('in_DA', 0.219);
    const alpha = getVal('in_alpha', 2) * Math.PI / 180;

    const rU_outer = Math.abs(DU / 2) + BELT_THICKNESS;
    const rA_outer = Math.abs(DA / 2) + BELT_THICKNESS;

    const beta = Math.asin((rA_outer - rU_outer) / L);
    const gamma = alpha - beta;

    const cx_U = 0;
    const cx_A = L * Math.cos(gamma);

    const drumLength = B + 0.200;
    const shaftLength = drumLength + 0.200;
    const shaftR = 0.025; // 50mm Welle -> 25mm Radius

    function ty(y_m) { return cy_top + y_m * scale; }

    ctx.save();

    // 1. Welle & Trommel (unter dem Gurt)
    function drawDrumAxis(cx, D, dimId) {
        const r = D / 2;

        // Welle (50mm Stärke)
        ctx.fillStyle = '#95a5a6';
        ctx.fillRect(tx(cx - shaftR), ty(-shaftLength / 2), shaftR * 2 * scale, shaftLength * scale);
        ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
        ctx.strokeRect(tx(cx - shaftR), ty(-shaftLength / 2), shaftR * 2 * scale, shaftLength * scale);

        // Trommel
        ctx.fillStyle = '#bdc3c7';
        ctx.fillRect(tx(cx - r), ty(-drumLength / 2), r * 2 * scale, drumLength * scale);
        ctx.strokeRect(tx(cx - r), ty(-drumLength / 2), r * 2 * scale, drumLength * scale);

        // Mittellinie der Welle
        ctx.beginPath();
        ctx.moveTo(tx(cx), ty(-shaftLength / 2 - 0.10));
        ctx.lineTo(tx(cx), ty(shaftLength / 2 + 0.10));
        ctx.strokeStyle = '#c0392b';
        ctx.lineWidth = 0.8;
        ctx.setLineDash([10, 4, 2, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Bemaßung DU/DA über der Trommel
        let isHover = (hoveredDim === dimId);
        let color = isHover ? '#d9534f' : '#0056b3';
        let dimY = ty(-drumLength / 2 - 0.15);

        ctx.beginPath();
        ctx.moveTo(tx(cx - r), ty(-drumLength / 2)); ctx.lineTo(tx(cx - r), dimY - 8);
        ctx.moveTo(tx(cx + r), ty(-drumLength / 2)); ctx.lineTo(tx(cx + r), dimY - 8);
        ctx.strokeStyle = color; ctx.lineWidth = 0.5; ctx.setLineDash([4, 4]); ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.moveTo(tx(cx - r), dimY); ctx.lineTo(tx(cx + r), dimY);
        ctx.strokeStyle = isHover ? '#d9534f' : '#333'; ctx.lineWidth = isHover ? 1.2 : 0.6; ctx.stroke();

        if (typeof drawDimTick === 'function') {
            drawDimTick(ctx, tx(cx - r), dimY, isHover);
            drawDimTick(ctx, tx(cx + r), dimY, isHover);
        }

        ctx.fillStyle = color;
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.font = '12px Consolas, "Courier New", monospace';
        ctx.fillText(`Ø${D.toFixed(3)}`, tx(cx), dimY - 4);

        addHitRect(dimId, tx(cx - r) - 10, dimY - 20, (r * 2 * scale) + 20, 30);
    }

    drawDrumAxis(cx_U, DU, 'DU');
    drawDrumAxis(cx_A, DA, 'DA');

    // 2. Gurt (KORREKTUR: Parallele Außenkanten exakt an der Trommelaußenkante + Gurtstärke)
    const beltLeftX = cx_U - rU_outer;  // Umlenktrommel-Außenkante + t_G
    const beltRightX = cx_A + rA_outer; // Antriebstrommel-Außenkante + t_G

    ctx.fillStyle = '#222222';
    ctx.fillRect(tx(beltLeftX), ty(-B / 2), (beltRightX - beltLeftX) * scale, B * scale);

    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(tx(beltLeftX), ty(-B / 2), (beltRightX - beltLeftX) * scale, B * scale);

    // 3. Seitenschürzen (2° Öffnungswinkel, begrenzt auf die Gurtlänge)
    const skirtTan = Math.tan(1 * Math.PI / 180);
    const w_start = b / 2;
    const w_end = Math.min(B / 2 - 0.01, b / 2 + (cx_A - cx_U) * skirtTan); // Verhindert Überstehen über Gurt

    ctx.beginPath();
    // Obere Schürze
    ctx.moveTo(tx(cx_U), ty(-w_start));
    ctx.lineTo(tx(cx_A), ty(-w_end));
    // Untere Schürze
    ctx.moveTo(tx(cx_U), ty(w_start));
    ctx.lineTo(tx(cx_A), ty(w_end));

    ctx.strokeStyle = '#d9534f';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 4. Hinterwand des Einlaufkastens (Orange)
    ctx.beginPath();
    ctx.moveTo(tx(cx_U), ty(-w_start));
    ctx.lineTo(tx(cx_U), ty(w_start));
    ctx.strokeStyle = '#ff8c00';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // 5. Schieber-Vorderkante (Orange)
    const schieberX = tx(cx_U + L_box);
    const w_schieber = b / 2 + L_box * skirtTan;

    ctx.beginPath();
    ctx.moveTo(schieberX, ty(-w_schieber));
    ctx.lineTo(schieberX, ty(w_schieber));
    ctx.strokeStyle = '#ff8c00';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // 6. Bemaßung: Lichte Weite (b) an der Rückwand
    let isHoverB = (hoveredDim === 'b');
    let colorB = isHoverB ? '#d9534f' : '#888';
    let dimX_b = tx(beltLeftX - 0.12);

    ctx.beginPath();
    ctx.moveTo(tx(cx_U), ty(-w_start)); ctx.lineTo(dimX_b - 10, ty(-w_start));
    ctx.moveTo(tx(cx_U), ty(w_start)); ctx.lineTo(dimX_b - 10, ty(w_start));
    ctx.strokeStyle = colorB; ctx.lineWidth = 0.5; ctx.setLineDash([4, 4]); ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.moveTo(dimX_b, ty(-w_start)); ctx.lineTo(dimX_b, ty(w_start));
    ctx.strokeStyle = isHoverB ? '#d9534f' : '#333'; ctx.lineWidth = isHoverB ? 1.2 : 0.6; ctx.stroke();

    if (typeof drawDimTick === 'function') {
        drawDimTick(ctx, dimX_b, ty(-w_start), isHoverB);
        drawDimTick(ctx, dimX_b, ty(w_start), isHoverB);
    }

    ctx.save();
    ctx.translate(dimX_b - 8, ty(0));
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = isHoverB ? '#d9534f' : '#111';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.font = '12px Consolas, "Courier New", monospace';
    ctx.fillText(`b = ${b.toFixed(2)}`, 0, 0);
    ctx.restore();

    addHitRect('b', dimX_b - 20, ty(-w_start) - 10, 40, (w_start * 2 * scale) + 20);

    // 7. F_Boden Flächentitel im Einlaufkasten
    const area = L_box * b;
    const textX = tx(cx_U + L_box / 2);
    const textY = ty(0);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    const textWidth = 85;
    const textHeight = 35;
    ctx.fillRect(textX - textWidth / 2, textY - textHeight / 2, textWidth, textHeight);
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1;
    ctx.strokeRect(textX - textWidth / 2, textY - textHeight / 2, textWidth, textHeight);

    ctx.fillStyle = '#111';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(`F_Boden`, textX, textY - 6);
    ctx.font = '11px monospace';
    ctx.fillText(`A = ${area.toFixed(2)} m²`, textX, textY + 8);

    // 8. Symmetrie-Mittellinie für das gesamte Band
    ctx.beginPath();
    ctx.moveTo(tx(beltLeftX - 0.2), ty(0));
    ctx.lineTo(tx(beltRightX + 0.2), ty(0));
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.7;
    ctx.setLineDash([18, 6, 4, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
}

/*
 * [BREADCRUMB: 2026-08-09]
 * DOMÄNE: Canvas Rendering & UI - drawConveyorCanvas
 * UPDATE: 
 * - Clipping-Maske (ctx.clip) um die Partikel-Zeichnung herum hinzugefügt.
 * - Schneidet das Rendering präzise an der optischen Oberkante ab.
 * - Verhindert sichtbare, flackernde Halbkreise von Partikeln, die eigentlich zur unsichtbaren höheren Physik-Säule gehören.
 */
/*
 * [BREADCRUMB: 2026-08-10]
 * DOMÄNE: Canvas Rendering & UI - drawConveyorCanvas (Clipping-Fix)
 * UPDATE: 
 * - Dynamischer Clipping-Pfad für Partikel integriert:
 *   Steigt bei steilen Neigungswinkeln (z.B. 10°) parallel zum Fördergurt mit,
 *   sodass Schüttgut auf dem Band nicht mehr waagerecht abgeschnitten wird.
 */
function drawConveyorCanvas() {
    const canvas = document.getElementById('conveyorCanvas');
    if (!canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H_canvas = canvas.height;

    ctx.clearRect(0, 0, W, H_canvas);
    hitboxes = [];

    const L = getVal('in_L', 1);
    const alpha_deg = getVal('in_alpha', 2);
    const DU = getVal('in_DU', 0.193);
    const DA = getVal('in_DA', 0.219);
    const L_box = getVal('in_L_box', 0.55);
    const h_klappe = getVal('in_h_klappe', 0.32);
    const h_klappe_max = getVal('in_h_klappe_max', 0.32);

    const rU = Math.abs(DU / 2);
    const rA = Math.abs(DA / 2);
    const rU_outer = rU + BELT_THICKNESS;
    const rA_outer = rA + BELT_THICKNESS;
    const alpha = alpha_deg * Math.PI / 180;

    if (L < Math.abs(rA_outer - rU_outer)) return;

    const beta = Math.asin((rA_outer - rU_outer) / L);
    const gamma = alpha - beta;

    // HIER: Y-Pad verringern, um Seitenansicht tiefer zu schieben (erhöht den Abstand)
    const padX = 140;
    const padY = 40;  // Auf 40 verringert -> Seitenansicht rückt tiefer nach unten
    const reservedRightSpace = 320;
    const scaleX = (W - padX - reservedRightSpace) / L;
    const fixedSpanY = Math.max(2.5, L * Math.abs(Math.sin(gamma)) + 1.5);
    const scaleY = (H_canvas - 100) / fixedSpanY;
    const scale = Math.min(scaleX, scaleY);

    const cx_U = 0; const cy_U = 0;
    const cx_A = L * Math.cos(gamma); const cy_A = L * Math.sin(gamma);

    const theta_low = alpha - 2 * beta;
    const angle_top_exact = -Math.PI / 2 + alpha;
    const angle_bot_exact = Math.PI / 2 + theta_low;

    const offsetX = padX;
    const offsetY = H_canvas - padY - (0.5 * scale);

    function tx(x) { return offsetX + x * scale; }
    function ty(y) { return offsetY - y * scale; }

    const dimColor = '#888';
    const lineColor = '#333';
    const beltColor = '#222';
    const techFont = '13px Consolas, "Courier New", monospace';
    ctx.font = techFont;

    function addHitRect(id, x, y, w, h) { hitboxes.push({ type: 'rect', id, x, y, w, h }); }
    function addHitCircle(id, x, y, r) { hitboxes.push({ type: 'circle', id, x, y, r }); }

    const boxHeight = h_klappe_max + 0.10; // Optische Höhe (visuell)
    const boxX1 = cx_U; const boxX2 = cx_U + L_box;

    const beltY_x1 = rU_outer * Math.cos(alpha) + Math.tan(alpha) * (boxX1);
    const beltY_x2 = rU_outer * Math.cos(alpha) + Math.tan(alpha) * (boxX2);

    const boxY_top = Math.max(beltY_x1, beltY_x2) + boxHeight;

    ctx.beginPath();
    ctx.moveTo(tx(boxX1), ty(boxY_top));
    ctx.lineTo(tx(boxX1), ty(beltY_x1));
    ctx.lineTo(tx(boxX2), ty(beltY_x2));
    ctx.lineTo(tx(boxX2), ty(boxY_top));
    ctx.fillStyle = 'rgba(233, 236, 239, 0.4)';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(tx(boxX1), ty(boxY_top));
    ctx.lineTo(tx(boxX1), ty(beltY_x1));
    ctx.lineTo(tx(boxX2), ty(beltY_x2));
    ctx.strokeStyle = lineColor; ctx.lineWidth = 1.2; ctx.stroke();

    let colorSchieber = hoveredDim === 'h_klappe' ? '#c0392b' : '#d9534f';
    ctx.beginPath();
    ctx.moveTo(tx(boxX2), ty(boxY_top));
    ctx.lineTo(tx(boxX2), ty(beltY_x2 + h_klappe));
    ctx.strokeStyle = colorSchieber; ctx.lineWidth = hoveredDim === 'h_klappe' ? 4 : 3; ctx.stroke();
    addHitRect('h_klappe', tx(boxX2) - 10, Math.min(ty(boxY_top), ty(beltY_x2 + h_klappe)), 20, Math.abs(ty(boxY_top) - ty(beltY_x2 + h_klappe)));

    // --- NEU: DYNAMISCHER CLIPPING-PFAD FÜR PARTIKEL ---
    ctx.save();
    ctx.beginPath();

    // 1. Kastenoberkante links oben
    ctx.moveTo(0, ty(boxY_top));
    ctx.lineTo(tx(boxX2), ty(boxY_top));

    // 2. Dynamische Oberkante entlang der Förderstrecke (steigt mit Neigungswinkel alpha an)
    const endBeltX = cx_A + rA_outer;
    const endBeltY = cy_A + rA_outer + h_klappe_max + 0.30;
    ctx.lineTo(tx(endBeltX), ty(endBeltY));

    // 3. Rechten und unteren Rand einschließen
    ctx.lineTo(W, ty(endBeltY));
    ctx.lineTo(W, H_canvas);
    ctx.lineTo(0, H_canvas);
    ctx.closePath();
    ctx.clip(); // Ab hier wird alles weggeschnitten, was außerhalb des dynamischen Pfads liegt.

    /*
     * [BREADCRUMB: 2026-08-10]
     * DOMÄNE: Canvas Rendering & UI - drawConveyorCanvas (Partikel Loop)
     * UPDATE: 
     * - Unterscheidung zwischen Standard-Kreisen und Polygonen mit Kontur.
     * - Dynamische Rotation für Polygone basierend auf der X-Koordinate.
     */
    particles.forEach(p => {
        ctx.fillStyle = p.color; // Individuelle Steinfarbe anwenden
        ctx.beginPath();

        if (p.isPolygon) {
            // 1. Polygon zeichnen
            const sides = p.polySides;
            const radius = p.r * scale;

            // Dynamische Rotation (simuliert leichtes Rollen basierend auf x-Position)
            const rot = p.angleOffset + (p.x * 15);

            for (let i = 0; i < sides; i++) {
                const angle = rot + (i * 2 * Math.PI / sides);
                const px = tx(p.x) + radius * Math.cos(angle);
                const py = ty(p.y) + radius * Math.sin(angle);
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();

            // 2. Schwarze Kontur hinzufügen
            ctx.strokeStyle = '#111111';
            ctx.lineWidth = 1.0;
            ctx.stroke();

        } else {
            // 3. Normaler Kreis ohne Kontur (die restlichen 80%)
            ctx.arc(tx(p.x), ty(p.y), p.r * scale, 0, 2 * Math.PI);
            ctx.fill();
        }
    });

    ctx.restore(); // Clipping beenden, damit das Band etc. wieder normal gezeichnet wird.
    // --- ENDE CLIPPING ---

    const beltThickPx = BELT_THICKNESS * scale;
    ctx.beginPath();
    ctx.arc(tx(cx_A), ty(cy_A), (rA * scale) + beltThickPx / 2, angle_top_exact, angle_bot_exact, false);
    ctx.arc(tx(cx_U), ty(cy_U), (rU * scale) + beltThickPx / 2, angle_bot_exact, angle_top_exact + 2 * Math.PI, false);
    ctx.closePath();
    ctx.strokeStyle = beltColor;
    ctx.lineWidth = Math.max(2, beltThickPx);
    ctx.stroke();

    addHitCircle('DU', tx(cx_U), ty(cy_U), rU * scale + 15);
    addHitCircle('DA', tx(cx_A), ty(cy_A), rA * scale + 15);

    let colorDU = hoveredDim === 'DU' ? '#d9534f' : '#0056b3';
    ctx.beginPath(); ctx.arc(tx(cx_U), ty(cy_U), rU * scale, 0, 2 * Math.PI);
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = hoveredDim === 'DU' ? 2 : 1.0; ctx.strokeStyle = colorDU; ctx.stroke();

    let colorDA = hoveredDim === 'DA' ? '#d9534f' : '#0056b3';
    ctx.beginPath(); ctx.arc(tx(cx_A), ty(cy_A), rA * scale, 0, 2 * Math.PI);
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = hoveredDim === 'DA' ? 2 : 1.0; ctx.strokeStyle = colorDA; ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(tx(cx_U), ty(cy_U)); ctx.lineTo(tx(cx_A), ty(cy_A));
    ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 0.5;
    ctx.setLineDash([15, 5, 3, 5]); ctx.stroke(); ctx.setLineDash([]);

    let anim_v_belt = getVal('in_v', 0);
    let particlesOnBelt = particles.filter(p => p.state === 'belt').length;
    if (h_klappe <= 0.001 && particlesOnBelt === 0) anim_v_belt = 0;

    // Rotationswinkel anhand des Band-Offsets und der Trommelradien berechnen
    const rotU = beltOffset / rU_outer;
    const rotA = beltOffset / rA_outer;

    // Dynamisch mitrotierende Pfeile zeichnen
    drawDrumArrow(ctx, tx(cx_U), ty(cy_U), rU, scale, rotU, hoveredDim === 'DU');
    drawDrumArrow(ctx, tx(cx_A), ty(cy_A), rA, scale, rotA, hoveredDim === 'DA');

    ctx.font = techFont;

    const nx_top = -Math.sin(alpha);
    const U_top_y = rU_outer * Math.cos(alpha);
    const A_top_x = cx_A + rA_outer * nx_top;
    const A_top_y = cy_A + rA_outer * Math.cos(alpha);

    const ux_top = tx(cx_U + rU_outer * nx_top);
    const uy_top = ty(U_top_y);
    const ax_top = tx(A_top_x);
    const ay_top = ty(A_top_y);

    let colorLbox = hoveredDim === 'L_box' ? '#d9534f' : dimColor;
    const dimY_Lbox = ty(boxY_top) - 20;
    const lx1 = tx(cx_U); const lx2 = tx(cx_U + L_box);

    ctx.beginPath();
    ctx.moveTo(lx1, ty(boxY_top)); ctx.lineTo(lx1, dimY_Lbox - 10);
    ctx.moveTo(lx2, ty(boxY_top)); ctx.lineTo(lx2, dimY_Lbox - 10);
    ctx.strokeStyle = colorLbox; ctx.lineWidth = 0.5; ctx.setLineDash([8, 4]); ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.moveTo(lx1, dimY_Lbox); ctx.lineTo(lx2, dimY_Lbox);
    ctx.strokeStyle = hoveredDim === 'L_box' ? '#d9534f' : '#333'; ctx.lineWidth = hoveredDim === 'L_box' ? 1.2 : 0.6; ctx.stroke();
    drawDimTick(ctx, lx1, dimY_Lbox, hoveredDim === 'L_box'); drawDimTick(ctx, lx2, dimY_Lbox, hoveredDim === 'L_box');

    ctx.fillStyle = hoveredDim === 'L_box' ? '#d9534f' : '#111';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(`L_Box = ${L_box.toFixed(2).replace('.', ',')} m`, (lx1 + lx2) / 2, dimY_Lbox - 4);
    addHitRect('L_box', lx1, dimY_Lbox - 30, lx2 - lx1, 40);

    /*
         * [BREADCRUMB: 2026-08-12]
         * DOMÄNE: Canvas Rendering & UI - drawConveyorCanvas (Bemaßung H Zentrierung)
         * UPDATE: 
         * - Y-Position des Bemaßungstextes H exakt auf den Mittelpunkt der vertikalen Maßlinie gesetzt.
         * - textBaseline auf 'middle' gestellt, um echte vertikale Zentrierung an der Maßlinie zu garantieren.
         */
    let colorH = hoveredDim === 'H' ? '#d9534f' : dimColor;
    const dimX_H = Math.max(tx(cx_A) + 120, ax_top + 130);
    const dimX_Alpha = dimX_H + 90;

    // Hilfslinien ziehen
    ctx.beginPath();
    ctx.moveTo(ux_top, uy_top); ctx.lineTo(dimX_Alpha + 20, uy_top);
    ctx.strokeStyle = colorH; ctx.lineWidth = 0.5; ctx.setLineDash([8, 4]); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(ax_top, ay_top); ctx.lineTo(dimX_H + 5, ay_top);
    ctx.strokeStyle = colorH; ctx.lineWidth = 0.5; ctx.stroke();

    // Maßlinie ziehen
    ctx.beginPath();
    ctx.moveTo(dimX_H, uy_top); ctx.lineTo(dimX_H, ay_top);
    ctx.strokeStyle = hoveredDim === 'H' ? '#d9534f' : '#0056b3'; ctx.lineWidth = hoveredDim === 'H' ? 1.2 : 0.8; ctx.stroke();
    drawDimTick(ctx, dimX_H, uy_top, hoveredDim === 'H'); drawDimTick(ctx, dimX_H, ay_top, hoveredDim === 'H');

    // EXAKTE ZENTRIERUNG DES TEXTES
    const textH = `H = ${typeof currentH !== 'undefined' ? currentH.toFixed(2).replace('.', ',') : 0} m`;
    const midY_H = (uy_top + ay_top) / 2; // Mathematische Mitte der vertikalen Maßlinie

    ctx.fillStyle = hoveredDim === 'H' ? '#d9534f' : '#0056b3';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle'; // Richtet die Schrift vertikal mittig am Punkt aus
    ctx.fillText(textH, dimX_H + 8, midY_H);

    addHitRect('H', dimX_H - 10, Math.min(uy_top, ay_top), 100, Math.abs(uy_top - ay_top));

    let colorAlpha = hoveredDim === 'alpha' ? '#d9534f' : dimColor;
    const ey = uy_top - Math.tan(alpha) * (dimX_Alpha - ux_top);

    ctx.beginPath();
    ctx.moveTo(ax_top, ay_top); ctx.lineTo(dimX_Alpha + 15, ey);
    ctx.strokeStyle = colorAlpha; ctx.lineWidth = 0.5; ctx.setLineDash([8, 4]); ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.moveTo(dimX_Alpha, uy_top); ctx.lineTo(dimX_Alpha, ey);
    ctx.strokeStyle = hoveredDim === 'alpha' ? '#d9534f' : '#111'; ctx.lineWidth = hoveredDim === 'alpha' ? 1.2 : 0.6; ctx.stroke();
    drawDimTick(ctx, dimX_Alpha, uy_top, hoveredDim === 'alpha'); drawDimTick(ctx, dimX_Alpha, ey, hoveredDim === 'alpha');

    const textAlpha = `${alpha_deg.toFixed(2).replace('.', ',')}°`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillStyle = hoveredDim === 'alpha' ? '#d9534f' : '#111';
    ctx.fillText(textAlpha, dimX_Alpha + 8, uy_top - 6);
    addHitRect('alpha', dimX_Alpha - 10, Math.min(uy_top, ey) - 20, 60, Math.abs(uy_top - ey) + 40);

    let colorL = hoveredDim === 'L' ? '#d9534f' : dimColor;
    ctx.lineWidth = 0.5; ctx.strokeStyle = colorL;

    const dx_L = tx(cx_A) - tx(cx_U);
    const dy_L = ty(cy_A) - ty(cy_U);
    const len_L = Math.sqrt(dx_L * dx_L + dy_L * dy_L);

    const ux = dx_L / len_L; const uy = dy_L / len_L;
    const nx = -uy; const ny = ux;

    const offsetPx = 60 + rU * scale;
    const startX = tx(cx_U); const startY = ty(cy_U);
    const endX = tx(cx_A); const endY = ty(cy_A);

    ctx.beginPath();
    ctx.moveTo(startX - nx * 15, startY - ny * 15);
    ctx.lineTo(startX + nx * (offsetPx + 5), startY + ny * (offsetPx + 5));
    ctx.moveTo(endX - nx * 15, endY - ny * 15);
    ctx.lineTo(endX + nx * (offsetPx + 5), endY + ny * (offsetPx + 5));
    ctx.strokeStyle = colorL; ctx.lineWidth = 0.5; ctx.setLineDash([8, 4]); ctx.stroke();
    ctx.setLineDash([]);

    const L_line_sx = startX + nx * offsetPx;
    const L_line_sy = startY + ny * offsetPx;
    const L_line_ex = endX + nx * offsetPx;
    const L_line_ey = endY + ny * offsetPx;

    ctx.beginPath();
    ctx.moveTo(L_line_sx, L_line_sy); ctx.lineTo(L_line_ex, L_line_ey);
    ctx.strokeStyle = hoveredDim === 'L' ? '#d9534f' : '#333'; ctx.lineWidth = hoveredDim === 'L' ? 1.2 : 0.6; ctx.stroke();
    drawDimTick(ctx, L_line_sx, L_line_sy, hoveredDim === 'L');
    drawDimTick(ctx, L_line_ex, L_line_ey, hoveredDim === 'L');

    const midX = startX + (dx_L / 2) + nx * offsetPx;
    const midY = startY + (dy_L / 2) + ny * offsetPx;

    ctx.save();
    ctx.translate(midX, midY);
    ctx.rotate(Math.atan2(dy_L, dx_L));
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';

    const textL = `L = ${L.toFixed(2).replace('.', ',')} m`;
    ctx.fillStyle = hoveredDim === 'L' ? '#d9534f' : '#222';
    ctx.fillText(textL, 0, -4);
    ctx.restore();

    addHitRect('L', midX - 80, midY - 40, 160, 80);

    // AM ENDE VON drawConveyorCanvas():
    // Abstand der Draufsicht zur Oberkante von 90px auf 180px verdoppelt
    const cy_TopView = 130;
    drawTopView(ctx, scale, tx, cy_TopView, addHitRect);
}

function bootPhysics() {
    try {
        const canvas = document.getElementById('conveyorCanvas');
        if (canvas) {
            canvas.addEventListener('mousemove', checkHover);
            canvas.addEventListener('click', handleCanvasClick);
            canvas.addEventListener('mouseout', () => { checkHover({clientX: 0, clientY: 0}); });
        }
        initParticles();
        if (typeof updateGeometry === 'function') updateGeometry();
    } catch(e) {
        console.warn("Boot Fehler.", e);
    }
    
    if (isAnimating) {
        lastTime = performance.now();
        animId = requestAnimationFrame(renderLoop);
    } else {
        drawConveyorCanvas();
    }
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    bootPhysics();
} else {
    window.addEventListener('DOMContentLoaded', bootPhysics);
}