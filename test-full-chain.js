const THREE = require('three');

// Simular getVectorFromPitchYaw tal como está en el motor
function getVectorFromPitchYaw(pitch, yaw) {
    const phi = -pitch * Math.PI / 180;
    const theta = -yaw * Math.PI / 180;
    const r = 495;
    return new THREE.Vector3(
        r * Math.cos(phi) * Math.sin(theta),
        r * Math.sin(phi),
        -r * Math.cos(phi) * Math.cos(theta)
    );
}

// Simular getCam tal como está en el motor
function buildGetCam(camPitch, camYaw) {
    const cp = camPitch * Math.PI / 180;
    const cy = camYaw * Math.PI / 180;
    const sin_cp = Math.sin(cp), cos_cp = Math.cos(cp);
    return function getCam(pitch, yaw) {
        const p = pitch * Math.PI / 180, y = yaw * Math.PI / 180;
        let y_diff = y - cy;
        while (y_diff > Math.PI) y_diff -= 2 * Math.PI;
        while (y_diff < -Math.PI) y_diff += 2 * Math.PI;
        const sin_yd = Math.sin(y_diff), cos_yd = Math.cos(y_diff);
        return {
            x: Math.cos(p) * sin_yd,
            y: Math.sin(p) * cos_cp - Math.cos(p) * cos_yd * sin_cp,
            z: Math.sin(p) * sin_cp + Math.cos(p) * cos_yd * cos_cp
        };
    };
}

// Simular raycaster
function simulateRaycaster(threeCamera, screenX, screenY) {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(screenX, screenY);
    raycaster.setFromCamera(mouse, threeCamera);

    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    mesh.updateMatrixWorld();

    const intersects = raycaster.intersectObject(mesh);
    if (!intersects.length) return null;
    const p = intersects[0].point;
    const radius = 500;
    const ratioY = Math.max(-1, Math.min(1, p.y / radius));
    const pitch = Math.asin(ratioY) * (180 / Math.PI);
    const yaw = Math.atan2(p.x, -p.z) * (180 / Math.PI);
    return { raw_pitch: pitch, raw_yaw: yaw, stored_pitch: -pitch, stored_yaw: -yaw, p };
}

// TEST: Camera mirando a threeYaw=0, threePitch=0 (frente)
// Clickeamos en el centro de la pantalla pero abajo (suelo)
{
    const threeCamera = new THREE.PerspectiveCamera(100, 1, 0.1, 1000);
    threeCamera.rotation.order = 'YXZ';
    threeCamera.rotation.y = THREE.MathUtils.degToRad(0);   // threeYaw=0
    threeCamera.rotation.x = THREE.MathUtils.degToRad(0);   // threePitch=0
    threeCamera.updateMatrixWorld();

    const r = simulateRaycaster(threeCamera, 0, -0.8); // 0.8 abajo en NDC = suelo
    if (r) {
        console.log('=== TEST: Camera y=0, x=0, click en suelo ===');
        console.log(`Hit point: (${r.p.x.toFixed(1)}, ${r.p.y.toFixed(1)}, ${r.p.z.toFixed(1)})`);
        console.log(`Raw pitch: ${r.raw_pitch.toFixed(1)}, raw yaw: ${r.raw_yaw.toFixed(1)}`);
        console.log(`Stored (negados): pitch=${r.stored_pitch.toFixed(1)}, yaw=${r.stored_yaw.toFixed(1)}`);
        
        // Verificar que getVectorFromPitchYaw(stored) da el mismo punto
        const v = getVectorFromPitchYaw(r.stored_pitch, r.stored_yaw);
        console.log(`getVectorFromPitchYaw(${r.stored_pitch.toFixed(1)}, ${r.stored_yaw.toFixed(1)}) = (${v.x.toFixed(1)}, ${v.y.toFixed(1)}, ${v.z.toFixed(1)})`);
        console.log(`Hit match? ${Math.abs(v.x - r.p.x) < 10 && Math.abs(v.y - r.p.y) < 10 ? 'SI ✓' : 'NO ✗'}`);
        
        // Verificar getCam
        const getCam = buildGetCam(0, 0); // camPitch=threePitch, camYaw=threeYaw
        const c = getCam(r.stored_pitch, r.stored_yaw);
        console.log(`getCam result: x=${c.x.toFixed(3)}, y=${c.y.toFixed(3)}, z=${c.z.toFixed(3)}`);
        console.log(`z>0 (visible)? ${c.z > 0.001 ? 'SI ✓' : 'NO ✗'}`);
        console.log(`y<0 (suelo en pantalla)? ${c.y < 0 ? 'SI ✓' : 'NO ✗ (aparece en cielo!)'}`);
    }
}
