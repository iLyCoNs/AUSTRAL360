const THREE = require('three');

function testPitchYaw(threePitch, threeYaw, clickY) {
    const threeCamera = new THREE.PerspectiveCamera(100, 1, 0.1, 1000);
    threeCamera.rotation.order = 'YXZ';
    threeCamera.rotation.y = THREE.MathUtils.degToRad(threeYaw);
    threeCamera.rotation.x = THREE.MathUtils.degToRad(threePitch);
    threeCamera.updateMatrixWorld();

    // clickY: positive means top of screen, negative means bottom of screen.
    const mouse = new THREE.Vector2(0, clickY); 
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, threeCamera);

    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1);
    const material = new THREE.MeshBasicMaterial();
    const threeMesh = new THREE.Mesh(geometry, material);
    threeMesh.updateMatrixWorld();

    const intersects = raycaster.intersectObject(threeMesh);
    if (intersects.length > 0) {
        const p = intersects[0].point;
        const radius = 500;
        const ratioY = Math.max(-1, Math.min(1, p.y / radius));
        const pitch = Math.asin(ratioY) * (180 / Math.PI);
        const yaw = Math.atan2(p.x, -p.z) * (180 / Math.PI);
        
        console.log(`Cam[P:${threePitch}, Y:${threeYaw}], Click[0, ${clickY}] -> pitch=${pitch.toFixed(1)}, yaw=${yaw.toFixed(1)}`);
    } else {
        console.log("No intersection!");
    }
}

console.log("Looking at SKY:");
testPitchYaw(60, 0, 0);
testPitchYaw(60, 0, 0.5); // Click higher in sky
testPitchYaw(60, 0, -0.5); // Click lower in sky

console.log("Looking at GROUND:");
testPitchYaw(-60, 0, 0);
testPitchYaw(-60, 0, 0.5); // Click higher
testPitchYaw(-60, 0, -0.5); // Click lower

console.log("Looking at SKY, panned right:");
testPitchYaw(60, -45, 0);
testPitchYaw(60, -45, 0.5); 
testPitchYaw(60, -45, -0.5); 
