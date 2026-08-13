/*
 * [BREADCRUMB: 2026-08-13]
 * DOMÄNE: Canvas Physik-Engine & Animation
 * UPDATE: 
 * - Sanfter Spawner-Fallimpuls (-0.1 statt -0.5) verhindert Schockwellen bei langsamer Fahrt.
 * - Gleitende Reibung/Versteifung bei v < 0.5 m/s eliminiert Ruckeln und Sprünge.
 * - Vertikales Kochen im Kasten abgefangen (p.vy > 0.02 gekappt).
 */
/*
 * [BREADCRUMB: 2026-08-13]
 * DOMÄNE: Canvas Physik-Engine & Animation
 * UPDATE: 
 * - Umstellung auf Fixed Time Step (100 Hz) via Accumulator.
 * - Physik ist nun vollständig von der Framerate der Grafikkarte entkoppelt.
 */

let animId;
let lastTime = 0;
let accumulator = 0;       // NEU: Sammelt die vergangene Zeit
const FIXED_DT = 0.01;     // NEU: Exakt 0.01s = 100 Hz
let beltOffset = 0;
let particles = [];
let isAnimating = true;

const BELT_THICKNESS = 0.010;
const currentSimRadius = 0.020;
// ... (Rest bleibt gleich)

let hoveredDim = null;
let hitboxes = [];

function getVal(id, fallback) {
    const el = document.getElementById(id);
    if (!el) return fallback;
    const val = parseFloat(el.value);
    return isNaN(val) ? fallback : val;
}

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

        const stoneColors = ['#5c5c5c', '#7d7a75', '#8f8f8f', '#4a4845'];
        this.color = stoneColors[Math.floor(Math.random() * stoneColors.length)];

        this.isPolygon = Math.random() < 0.2;
        if (this.isPolygon) {
            const sides = [6, 8, 10];
            this.polySides = sides[Math.floor(Math.random() * sides.length)];
            this.angleOffset = Math.random() * Math.PI * 2;
        }
    }
}

function toggleAnimation() {
    isAnimating = !isAnimating;
    const btn = document.getElementById('btnAnimToggle');
    if (isAnimating) {
        btn.innerText = "❚❚";
        lastTime = performance.now();
        accumulator = 0; // WICHTIG: Zeitspeicher zurücksetzen
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

function drawDrumArrow(ctx, x, y, radius, scale, rotAngle, isHovered) {
    const r = radius * scale * 0.55;
    const startAngle = -Math.PI * 0.75;
    const endAngle = Math.PI * 0.4;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotAngle);

    ctx.beginPath();
    ctx.arc(0, 0, r, startAngle, endAngle, false);
    ctx.strokeStyle = isHovered ? '#d9534f' : '#333333';
    ctx.lineWidth = 1.5;
    ctx.stroke();

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

function initParticles() {
    particles = [];
    const L_box = getVal('in_L_box', 0.55);
    const alpha = getVal('in_alpha', 2) * Math.PI / 180;
    const h_klappe_max = getVal('in_h_klappe_max', 0.32);

    const DU = getVal('in_DU', 0.193);
    const rU_outer = Math.abs(DU / 2) + BELT_THICKNESS;
    const U_top_y = rU_outer * Math.cos(alpha);

    // ENTKOPPLUNG: Physikalische Höhe fest bei max. 0.45m deckeln. 
    // Schützt den Solver, während die Grafik (boxHeight) weiter wachsen darf.
    const physicsBoxHeight = h_klappe_max + 0.45;

    // Raster-Spawnen im Einlaufkasten

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

    for (let k = 0; k < 60; k++) updatePhysics(FIXED_DT, true);
}
/*
 * [BREADCRUMB: 2026-08-13]
 * DOMÄNE: Canvas Physik-Engine & Animation (Render Loop)
 * UPDATE: 
 * - Ziel: 100 Hz Fixed Time Step (FIXED_DT = 0.01) erzwingen.
 * - Verworfen: Der 60 Hz Fallback (0.01666) wurde verworfen, da 100 Hz gewünscht ist.
 * - Lösung: Spiral of Death Schutz mit Max 4 Steps & Panic-Drop hinzugefügt, um CPU-Überlastung auf mobilen Geräten abzufangen, ohne die 100 Hz Zielrate aufzugeben.
 */


function renderLoop(timestamp) {
    if (!isAnimating) return;
    if (!lastTime) lastTime = timestamp;

    let frameTime = (timestamp - lastTime) / 1000;

    // Schutz gegen extreme Lags bei Tab-Wechsel
    if (frameTime > 0.1) frameTime = 0.1;
    lastTime = timestamp;

    accumulator += frameTime;

    // Escape Hatch: Erlaubt maximal 4 Physik-Schritte pro Bild.
    // Bei einem 60fps Display benötigt 100Hz im Schnitt 1,6 Schritte. 4 gibt genug Puffer.
    let simulatedSteps = 0;
    const MAX_STEPS = 4;

    while (accumulator >= FIXED_DT && simulatedSteps < MAX_STEPS) {
        updatePhysics(FIXED_DT, false);
        accumulator -= FIXED_DT;
        simulatedSteps++;
    }

    // PANIK-DROP: Verhindert die Todesspirale auf langsamen Handys
    // Überschüssige Zeit wird abgeworfen, um ein extremes Aufschaukeln zu stoppen.
    if (accumulator >= FIXED_DT) {
        accumulator = accumulator % FIXED_DT;
    }

    drawConveyorCanvas();

    const elPtc = document.getElementById('live_particle_count');
    if (elPtc) elPtc.innerText = particles.length;

    animId = requestAnimationFrame(renderLoop);
}

function updatePhysics(dt, isWarmup = false) {
    const v_belt = isWarmup ? 0 : getVal('in_v', 0);
    const L = getVal('in_L', 1);
    const alpha_deg = getVal('in_alpha', 2);
    const alpha = alpha_deg * Math.PI / 180;
    const L_box = getVal('in_L_box', 0.55);
    const h_klappe = getVal('in_h_klappe', 0.32);
    const h_klappe_max = getVal('in_h_klappe_max', 0.32);

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

    // ENTKOPPLUNG: Spawner-Zielhöhe ebenfalls bei 0.45m deckeln.
    const physicsBoxHeight = Math.min(h_klappe_max + 0.15, 0.45);

    let particlesOnBelt = 0;
    for (let p of particles) {
        if (p.state === 'box' && p.x > L_box) particlesOnBelt++;
    }

    let anim_v_belt = v_belt;
    if (h_klappe <= 0.001 && particlesOnBelt === 0) anim_v_belt = 0;

    if (!isWarmup) beltOffset += anim_v_belt * dt;

    // --- GAP SPAWNER ---
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

        // Bei großer Höhe Batch-Größe fest auf max. 2 begrenzen, um Überdruck-Stöße zu verhindern
        const spawnBatchSize = anim_v_belt > 0.0001
            ? Math.max(1, Math.min(2, Math.ceil(anim_v_belt * 1.5)))
            : 1;

        for (let c = 0; c < numCols; c++) {
            let px = 0.02 + c * colWidth;
            let beltY = U_top_y + Math.tan(alpha) * px;
            let targetY = beltY + physicsBoxHeight;

            let currentMaxY = colMaxY[c];
            if (currentMaxY === 0) currentMaxY = beltY;

            let gap = targetY - currentMaxY;

            if (gap > currentSimRadius * 1.5 && particles.length < 8000) {
                let numToSpawn = Math.min(spawnBatchSize, Math.floor(gap / (currentSimRadius * 1.2)));
                for (let s = 0; s < numToSpawn; s++) {
                    let py = targetY - (s * currentSimRadius * 1.2);
                    let newP = new Particle(px + (Math.random() - 0.5) * 0.004, py, currentSimRadius);

                    // FIX 1: Reduzierter Fallimpuls verhindert Stau-Druck
                    newP.vy = -0.1;
                    particles.push(newP);
                }
            }
        }
    }

    // --- 1. INTEGRATION ---
    const targetVx = anim_v_belt * Math.cos(alpha);
    const targetVy = anim_v_belt * Math.sin(alpha);

    const h_silo_val = getVal('in_h_silo', 3.0);
    const effective_h_silo = Math.min(h_silo_val, 4.0);

    const isMoving = anim_v_belt > 0.0001;
    const a_silo = isMoving ? (effective_h_silo * 5.0) : 0;

    for (let p of particles) {
        p.prevX = p.x;
        p.prevY = p.y;

        if (p.state === 'box') {
            let current_g = 9.81;

            if (p.x <= L_box) {
                current_g += a_silo;
            }

            p.vy -= current_g * dt;

            // Im Kasten das Nachstürzen hart abfangen, egal wie hoch das Silo ist
            if (p.x <= L_box) {
                if (p.vy < -1.2) p.vy = -1.2;
            } else {
                let fallLimit = -5.0 - (a_silo * 0.1);
                if (p.vy < fallLimit) p.vy = fallLimit;
            }

            let beltY = U_top_y + Math.tan(alpha) * p.x;
            let isTouchingBelt = (p.y <= beltY + p.r + 0.05);

            if (isTouchingBelt) {
                let beltFriction = Math.min(1.0, mu_g * 1.2);
                p.vx += (targetVx - p.vx) * beltFriction;
                p.vy += (targetVy - p.vy) * beltFriction;
            }

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

                    // FIX: Faktor auf 0.35 gesenkt für 100 Hz Stabilität
                    let correction = overlap * 0.35;
                    let horizFriction = 1.0;

                    // NEU: Dämpft die seitliche Kompression im Kasten
                    if (pi.x <= L_box || pj.x <= L_box) {
                        nx *= 0.5;
                    }

                    if (pi.state === 'box' && pj.state === 'box') {
                        // UPDATE: Faktor 0.85 * 0.60 = 0.51 (skaliert mu_i = 0.50 auf das Verhalten von 0.30)
                        horizFriction = Math.max(0.1, 1.0 - mu_i * 0.51);

                        // FIX 2: Gleitende Versteifung bei langsamen Geschwindigkeiten (< 0.5 m/s)
                        if (anim_v_belt < 0.5) {
                            let slowFactor = 1.0 - (anim_v_belt / 0.5);
                            // UPDATE: Faktor 1.5 * 0.60 = 0.90
                            let maxSlowFriction = Math.max(0.02, 1.0 - mu_i * 0.90);
                            horizFriction = horizFriction * (1 - slowFactor) + maxSlowFriction * slowFactor;
                        }
                    }

                    pi.x += nx * correction * horizFriction;
                    pi.y += ny * correction;
                    pj.x -= nx * correction * horizFriction;
                    pj.y -= ny * correction;
                }
            }

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

            if (pi.x < pi.r) pi.x = pi.r;

            if (pi.x > L_box - pi.r && pi.x < L_box) {
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
            let relVx = p.vx - targetVx;
            // UPDATE: Faktor 0.1 * 0.60 = 0.06
            p.vx -= relVx * (mu_i * 0.06);

            if (p.x <= L_box) {
                if (p.vy > 0.02) p.vy = 0.02;
                p.vx *= 0.85;
                p.vy *= 0.85;
            } else if (p.x > L_box && p.x < L_box + 0.2) {
                // NEU: Entspannungszone nach dem Schieber (verhindert das Aufquellen/Auseinanderdrücken)
                if (p.vy > 0) p.vy *= 0.2; // Dämpft vertikales Aufsteigen beim Austritt
                p.vx = p.vx * 0.9 + targetVx * 0.1; // Zwingt das Material sanft auf Bandgeschwindigkeit
            }

            // FIX 3 (Fortsetzung): Stufenloser Übergang in die Brems-Haftreibung bei v < 0.1 m/s
            if (anim_v_belt < 0.1) {
                let stopFactor = 1.0 - (anim_v_belt / 0.1);
                p.vx *= (1.0 - (mu_g * stopFactor));
                p.vy *= (1.0 - (0.5 * stopFactor));
                if (Math.abs(p.vx) < 0.01) p.vx = 0;
            }
        }
    }

    // --- 4. VISCOUS SHEAR ---
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

                // UPDATE: Faktor 1.5 * 0.60 = 0.90
                let shearWeight = Math.min(1.0, mu_i * 0.90);

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
            if (Math.sqrt(dx * dx + dy * dy) <= b.r) { newHover = b.id; break; }
        } else {
            if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) { newHover = b.id; break; }
        }
    }

    if (hoveredDim !== newHover) {
        if (hoveredDim) {
            let lbl = document.getElementById('lbl_' + hoveredDim);
            let inp = document.getElementById('in_' + hoveredDim);
            if (lbl) lbl.classList.remove('highlight-label');
            if (inp) inp.classList.remove('highlight-input');
            if (hoveredDim === 'H') {
                let elH = document.getElementById('live_H_display');
                if (elH) elH.classList.remove('highlight-label');
            }
        }
        hoveredDim = newHover;
        if (hoveredDim) {
            let lbl = document.getElementById('lbl_' + hoveredDim);
            let inp = document.getElementById('in_' + hoveredDim);
            if (lbl) lbl.classList.add('highlight-label');
            if (inp) inp.classList.add('highlight-input');
            if (hoveredDim === 'H') {
                let elH = document.getElementById('live_H_display');
                if (elH) elH.classList.add('highlight-label');
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
    const shaftR = 0.025;

    function ty(y_m) { return cy_top + y_m * scale; }

    ctx.save();

    function drawDrumAxis(cx, D, dimId) {
        const r = D / 2;

        ctx.fillStyle = '#95a5a6';
        ctx.fillRect(tx(cx - shaftR), ty(-shaftLength / 2), shaftR * 2 * scale, shaftLength * scale);
        ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
        ctx.strokeRect(tx(cx - shaftR), ty(-shaftLength / 2), shaftR * 2 * scale, shaftLength * scale);

        ctx.fillStyle = '#bdc3c7';
        ctx.fillRect(tx(cx - r), ty(-drumLength / 2), r * 2 * scale, drumLength * scale);
        ctx.strokeRect(tx(cx - r), ty(-drumLength / 2), r * 2 * scale, drumLength * scale);

        ctx.beginPath();
        ctx.moveTo(tx(cx), ty(-shaftLength / 2 - 0.10));
        ctx.lineTo(tx(cx), ty(shaftLength / 2 + 0.10));
        ctx.strokeStyle = '#c0392b';
        ctx.lineWidth = 0.8;
        ctx.setLineDash([10, 4, 2, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

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

    const beltLeftX = cx_U - rU_outer;
    const beltRightX = cx_A + rA_outer;

    ctx.fillStyle = '#222222';
    ctx.fillRect(tx(beltLeftX), ty(-B / 2), (beltRightX - beltLeftX) * scale, B * scale);

    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(tx(beltLeftX), ty(-B / 2), (beltRightX - beltLeftX) * scale, B * scale);

    const skirtTan = Math.tan(1 * Math.PI / 180);
    const w_start = b / 2;
    const w_end = Math.min(B / 2 - 0.01, b / 2 + (cx_A - cx_U) * skirtTan);

    ctx.beginPath();
    ctx.moveTo(tx(cx_U), ty(-w_start));
    ctx.lineTo(tx(cx_A), ty(-w_end));
    ctx.moveTo(tx(cx_U), ty(w_start));
    ctx.lineTo(tx(cx_A), ty(w_end));

    ctx.strokeStyle = '#d9534f';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(tx(cx_U), ty(-w_start));
    ctx.lineTo(tx(cx_U), ty(w_start));
    ctx.strokeStyle = '#ff8c00';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    const schieberX = tx(cx_U + L_box);
    const w_schieber = b / 2 + L_box * skirtTan;

    ctx.beginPath();
    ctx.moveTo(schieberX, ty(-w_schieber));
    ctx.lineTo(schieberX, ty(w_schieber));
    ctx.strokeStyle = '#ff8c00';
    ctx.lineWidth = 3.5;
    ctx.stroke();

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

    const padX = 140;
    const padY = 40;
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

    const boxHeight = h_klappe_max + 0.10;
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

    ctx.save();
    ctx.beginPath();

    ctx.moveTo(0, ty(boxY_top));
    ctx.lineTo(tx(boxX2), ty(boxY_top));

    const endBeltX = cx_A + rA_outer;
    const endBeltY = cy_A + rA_outer + h_klappe_max + 0.30;
    ctx.lineTo(tx(endBeltX), ty(endBeltY));

    ctx.lineTo(W, ty(endBeltY));
    ctx.lineTo(W, H_canvas);
    ctx.lineTo(0, H_canvas);
    ctx.closePath();
    ctx.clip();

    particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.beginPath();

        if (p.isPolygon) {
            const sides = p.polySides;
            const radius = p.r * scale;

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

            ctx.strokeStyle = '#111111';
            ctx.lineWidth = 1.0;
            ctx.stroke();

        } else {
            ctx.arc(tx(p.x), ty(p.y), p.r * scale, 0, 2 * Math.PI);
            ctx.fill();
        }
    });

    ctx.restore();

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

    const rotU = beltOffset / rU_outer;
    const rotA = beltOffset / rA_outer;

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

    let colorH = hoveredDim === 'H' ? '#d9534f' : dimColor;
    const dimX_H = Math.max(tx(cx_A) + 120, ax_top + 130);
    const dimX_Alpha = dimX_H + 90;

    ctx.beginPath();
    ctx.moveTo(ux_top, uy_top); ctx.lineTo(dimX_Alpha + 20, uy_top);
    ctx.strokeStyle = colorH; ctx.lineWidth = 0.5; ctx.setLineDash([8, 4]); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(ax_top, ay_top); ctx.lineTo(dimX_H + 5, ay_top);
    ctx.strokeStyle = colorH; ctx.lineWidth = 0.5; ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(dimX_H, uy_top); ctx.lineTo(dimX_H, ay_top);
    ctx.strokeStyle = hoveredDim === 'H' ? '#d9534f' : '#0056b3'; ctx.lineWidth = hoveredDim === 'H' ? 1.2 : 0.8; ctx.stroke();
    drawDimTick(ctx, dimX_H, uy_top, hoveredDim === 'H'); drawDimTick(ctx, dimX_H, ay_top, hoveredDim === 'H');

    const textH = `H = ${typeof currentH !== 'undefined' ? currentH.toFixed(2).replace('.', ',') : 0} m`;
    const midY_H = (uy_top + ay_top) / 2;

    ctx.fillStyle = hoveredDim === 'H' ? '#d9534f' : '#0056b3';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
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

    const cy_TopView = 130;
    drawTopView(ctx, scale, tx, cy_TopView, addHitRect);
}

function bootPhysics() {
    try {
        const canvas = document.getElementById('conveyorCanvas');
        if (canvas) {
            canvas.addEventListener('mousemove', checkHover);
            canvas.addEventListener('click', handleCanvasClick);
            canvas.addEventListener('mouseout', () => { checkHover({ clientX: 0, clientY: 0 }); });
        }
        initParticles();
        if (typeof updateGeometry === 'function') updateGeometry();
    } catch (e) {
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