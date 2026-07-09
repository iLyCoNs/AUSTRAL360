// ==========================================
// GEOMETRY ENGINE - REAL WORLD METRICS
// ==========================================
window.GeometryEngine = {
    // Convierte Grados a Radianes
    deg2rad(deg) { return deg * Math.PI / 180; },
    // Convierte Radianes a Grados
    rad2deg(rad) { return rad * 180 / Math.PI; },

    // Proyecta un punto esférico (pitch, yaw) a un plano de suelo (x, y) en Metros Reales
    // - pitch = 0 es horizonte, pitch = -90 es nadir (abajo directo)
    // - altitud = altura del dron en metros
    angularToGround(pitch, yaw) {
        let altitud = (window.ConfigProyecto && window.ConfigProyecto.altitudDron) ? parseFloat(window.ConfigProyecto.altitudDron) : 100;
        
        // Evitar proyectar el horizonte o el cielo al suelo plano (distancia infinita)
        let safePitch = Math.min(pitch, -0.5); 
        
        // theta = ángulo desde el nadir (pitch -90 = 0 grados, pitch 0 = 90 grados)
        const theta = this.deg2rad(90 + safePitch);
        
        // d = distancia desde el origen (nadir) hasta el punto en el suelo
        const d = altitud * Math.tan(theta);
        
        const yawRad = this.deg2rad(yaw);
        
        return {
            x: d * Math.sin(yawRad),
            y: d * Math.cos(yawRad)
        };
    },

    // Reproyecta un punto del plano (x, y) en Metros a un punto esférico (pitch, yaw)
    groundToAngular(x, y) {
        let altitud = (window.ConfigProyecto && window.ConfigProyecto.altitudDron) ? parseFloat(window.ConfigProyecto.altitudDron) : 100;
        
        const d = Math.sqrt(x * x + y * y);
        const thetaRad = Math.atan2(d, altitud);
        
        let pitch = this.rad2deg(thetaRad) - 90;
        let yaw = this.rad2deg(Math.atan2(x, y));
        
        return { pitch, yaw };
    },

    // Calcula el área de un polígono en metros cuadrados
    // points = array de {x, y}
    calculatePolygonAreaM2(points) {
        if (!points || points.length < 3) return 0;
        let area = 0;
        for (let i = 0; i < points.length; i++) {
            let j = (i + 1) % points.length;
            area += points[i].x * points[j].y - points[j].x * points[i].y;
        }
        return Math.abs(area) / 2;
    },

    // Genera un polígono de calle (offset) a partir de un eje en (x, y)
    // eje = array de {x, y}
    // ancho = float en metros
    // Retorna { left: [{x, y}...], right: [{x, y}...] }
    buildStreetOffset(eje, ancho, isClosed = false) {
        if (!eje || eje.length < 2) return null;
        
        const left = [];
        const right = [];
        const halfWidth = ancho / 2;
        const n = eje.length;

        // Función auxiliar para normalizar un vector
        const normalize = (vx, vy) => {
            const len = Math.hypot(vx, vy);
            if (len === 0) return { x: 0, y: 0 };
            return { x: vx / len, y: vy / len };
        };

        for (let i = 0; i < n; i++) {
            let prev = isClosed ? eje[(i - 1 + n) % n] : (i > 0 ? eje[i - 1] : null);
            let curr = eje[i];
            let next = isClosed ? eje[(i + 1) % n] : (i < n - 1 ? eje[i + 1] : null);

            let nx1 = 0, ny1 = 0, nx2 = 0, ny2 = 0;
            let count = 0;

            if (prev) {
                const dir = normalize(curr.x - prev.x, curr.y - prev.y);
                // Normal is perpendicular (-y, x)
                nx1 = -dir.y;
                ny1 = dir.x;
                count++;
            }
            if (next) {
                const dir = normalize(next.x - curr.x, next.y - curr.y);
                nx2 = -dir.y;
                ny2 = dir.x;
                count++;
            }

            // Mitre joint (promedio de las normales de entrada y salida)
            let avgNx = (nx1 + nx2) / count;
            let avgNy = (ny1 + ny2) / count;
            const avgNorm = normalize(avgNx, avgNy);
            
            // Factor de corrección para esquinas afiladas (mitre factor)
            // dot product of the two segment directions
            let miterFactor = 1;
            if (prev && next) {
                const dir1 = normalize(curr.x - prev.x, curr.y - prev.y);
                const dir2 = normalize(next.x - curr.x, next.y - curr.y);
                const dot = dir1.x * dir2.x + dir1.y * dir2.y;
                const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
                // Math.sin(angle/2) previene que el factor crezca al infinito
                if (angle > 0.05) {
                    miterFactor = 1 / Math.max(0.2, Math.sin(angle / 2));
                }
            }

            left.push({
                x: curr.x + avgNorm.x * halfWidth * miterFactor,
                y: curr.y + avgNorm.y * halfWidth * miterFactor
            });
            
            right.push({
                x: curr.x - avgNorm.x * halfWidth * miterFactor,
                y: curr.y - avgNorm.y * halfWidth * miterFactor
            });
        }

        return { left, right };
    },

    // Envoltura para Calle Curva: Recibe [[pitch, yaw], ...], proyecta, hace offset, devuelve esféricas
    buildCalleCurvaEsferica(ejeAngular, anchoMetros, isClosed = false, tieneRetorno = false) {
        if (!ejeAngular || ejeAngular.length < 2) return null;
        
        // 1. Proyectar eje al suelo
        const ejeSuelo = ejeAngular.map(pt => this.angularToGround(pt[0], pt[1]));
        
        // 2. Aplicar el algoritmo matemático puro en el plano (Metros reales)
        const offsetSuelo = this.buildStreetOffset(ejeSuelo, anchoMetros, isClosed);
        if (!offsetSuelo) return null;

        // 2.5 Lógica de Retorno (Cul-de-sac) en la punta
        if (tieneRetorno && !isClosed) {
            const pLast = ejeSuelo[ejeSuelo.length - 1];
            const pPrev = ejeSuelo[ejeSuelo.length - 2];
            // Vector dirección final
            const dirX = pLast.x - pPrev.x;
            const dirY = pLast.y - pPrev.y;
            const len = Math.hypot(dirX, dirY);
            const ndx = dirX / len;
            const ndy = dirY / len;
            
            const radioRetorno = anchoMetros * 0.8; 
            const centroRetorno = { x: pLast.x + ndx * (anchoMetros * 0.3), y: pLast.y + ndy * (anchoMetros * 0.3) };
            
            // Generar semi-círculo suave para el Cul-de-sac
            const lLast = offsetSuelo.left[offsetSuelo.left.length - 1];
            const rLast = offsetSuelo.right[offsetSuelo.right.length - 1];
            
            // Insertar vértices semicirculares en la punta
            // (Esta es una simplificación; idealmente usaríamos arcos paramétricos)
            // Para conectar right con left, simplemente unimos
            // La geometría se cierra en fillPoly.
        }

        // 3. Devolver los vértices reproyectados a (pitch, yaw)
        const leftAngular = offsetSuelo.left.map(pt => {
            const res = this.groundToAngular(pt.x, pt.y);
            return [res.pitch, res.yaw];
        });
        
        const rightAngular = offsetSuelo.right.map(pt => {
            const res = this.groundToAngular(pt.x, pt.y);
            return [res.pitch, res.yaw];
        });

        // 4. Armar polígono de relleno
        let fillPoly = [...leftAngular];
        if (tieneRetorno && !isClosed) {
            // Unir el cul de sac
            const pLast = ejeSuelo[ejeSuelo.length - 1];
            const pPrev = ejeSuelo[ejeSuelo.length - 2];
            const dirX = pLast.x - pPrev.x;
            const dirY = pLast.y - pPrev.y;
            const len = Math.hypot(dirX, dirY);
            const nrx = dirY / len; // Normal Right
            const nry = -dirX / len; 

            // Punto extremo de la curva (cap)
            const capRadio = anchoMetros * 0.8;
            const capPointSuelo = {
                x: pLast.x + (dirX/len) * capRadio,
                y: pLast.y + (dirY/len) * capRadio
            };
            const capAngular = this.groundToAngular(capPointSuelo.x, capPointSuelo.y);
            
            fillPoly.push([capAngular.pitch, capAngular.yaw]);
        }
        
        fillPoly = fillPoly.concat([...rightAngular].reverse());

        return {
            left: leftAngular,
            right: rightAngular,
            fillPoly: fillPoly
        };
    }
};
