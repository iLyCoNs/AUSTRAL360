const THREE = require('three');

function testYaw(threeYaw) {
    const threeCamera = new THREE.PerspectiveCamera(100, 1, 0.1, 1000);
    threeCamera.rotation.order = 'YXZ';
    threeCamera.rotation.y = THREE.MathUtils.degToRad(threeYaw);
    threeCamera.rotation.x = 0;
    threeCamera.updateMatrixWorld();

    const mouse = new THREE.Vector2(0, 0); // Center
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, threeCamera);

    // Create a sphere
    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1);
    const material = new THREE.MeshBasicMaterial();
    const threeMesh = new THREE.Mesh(geometry, material);
    threeMesh.updateMatrixWorld();

    const intersects = raycaster.intersectObject(threeMesh);
    if (intersects.length > 0) {
        const p = intersects[0].point;
        const yaw = Math.atan2(p.x, -p.z) * (180 / Math.PI);
        const getYaw = -threeYaw;
        let y_diff = yaw - getYaw;
        while (y_diff > 180) y_diff -= 360;
        while (y_diff < -180) y_diff += 360;
        
        console.log(`threeYaw: ${threeYaw} -> p=(${p.x.toFixed(0)}, ${p.y.toFixed(0)}, ${p.z.toFixed(0)}), calcYaw=${yaw.toFixed(0)}, getYaw=${getYaw}, diff=${y_diff.toFixed(0)}`);
    } else {
        console.log("No intersection!");
    }
}

testYaw(0);
testYaw(45);
testYaw(90);
testYaw(135);
testYaw(180);
testYaw(-45);
testYaw(-90);
testYaw(-135);
testYaw(-180);
