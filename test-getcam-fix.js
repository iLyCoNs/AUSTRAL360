const THREE = require('three');

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

// getCam con pitch negado internamente (para compensar getVectorFromPitchYaw)
function buildGetCamFixed(camPitch, camYaw) {
    const cp = -camPitch * Math.PI / 180; // NEGADO
    const cy = camYaw * Math.PI / 180;
    const sin_cp = Math.sin(cp), cos_cp = Math.cos(cp);
    return function getCam(pitch, yaw) {
        const p = -pitch * Math.PI / 180; // NEGADO
        const y = yaw * Math.PI / 180;
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
    // Con -pitch y -yaw negados ambos:
    return { stored_pitch: -pitch, stored_yaw: -yaw, p };
}

// TEST varios escenarios
function runTest(threeYaw, threePitch, screenX, screenY, label) {
    const threeCamera = new THREE.PerspectiveCamera(100, 1, 0.1, 1000);
    threeCamera.rotation.order = 'YXZ';
    threeCamera.rotation.y = THREE.MathUtils.degToRad(threeYaw);
    threeCamera.rotation.x = THREE.MathUtils.degToRad(threePitch);
    threeCamera.updateMatrixWorld();

    const r = simulateRaycaster(threeCamera, screenX, screenY);
    if (!r) { console.log(`${label}: No intersección`); return; }

    const getCam = buildGetCamFixed(threePitch, threeYaw);
    const c = getCam(r.stored_pitch, r.stored_yaw);
    const screenY_out = 0.5 - c.y / c.z; // proporcional, centrado en 0.5

    console.log(`${label}:`);
    console.log(`  Hit Y=${r.p.y.toFixed(0)} | stored(${r.stored_pitch.toFixed(1)},${r.stored_yaw.toFixed(1)}) | z=${c.z.toFixed(3)} | screenY~${screenY_out.toFixed(2)}`);
    console.log(`  z>0(visible)? ${c.z > 0.001 ? 'SI ✓' : 'NO ✗'}  |  y_neg(suelo)? ${c.y < 0 ? 'SI ✓' : 'NO ✗'}`);
}

runTest(0, 0, 0, -0.8, 'Cam=0,0 Click=suelo');
runTest(0, 0, 0, 0.8, 'Cam=0,0 Click=cielo');
runTest(45, 0, 0, -0.8, 'Cam=45,0 Click=suelo');
runTest(0, -30, 0, -0.5, 'Cam=0,-30pitch Click=suelo');
