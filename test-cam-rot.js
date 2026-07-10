const THREE = require('three');

const camera = new THREE.PerspectiveCamera(100, 1, 0.1, 1000);
camera.rotation.order = 'YXZ';

console.log("Initial forward vector:", new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion));

camera.rotation.x = THREE.MathUtils.degToRad(60); // Positive 60
camera.updateMatrixWorld();
console.log("Forward vector with pitch +60:", new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion));

camera.rotation.x = THREE.MathUtils.degToRad(-60); // Negative 60
camera.updateMatrixWorld();
console.log("Forward vector with pitch -60:", new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion));
