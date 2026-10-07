import * as THREE from "three";

// Render a separate still so taking a postcard never changes the driving camera
// or screen dimensions. The temporary target is released after readback.
export function chaiPostcard(renderer, scene, camera, place, groundY, title) {
  const w = 1128,
    h = 705;
  let photoCamera = camera;
  if (place.yaw !== undefined) {
    const co = Math.cos(place.yaw),
      si = Math.sin(place.yaw);
    photoCamera = new THREE.PerspectiveCamera(48, w / h, 0.1, 1600);
    photoCamera.position.set(
      place.x + 7 * co - 8 * si,
      groundY + 5.2,
      place.z - 7 * si - 8 * co,
    );
    photoCamera.lookAt(place.x + si * 1.5, groundY + 1.2, place.z + co * 1.5);
  } else {
    photoCamera = camera.clone();
    photoCamera.aspect = w / h;
    photoCamera.updateProjectionMatrix();
  }
  const target = new THREE.WebGLRenderTarget(w, h);
  target.texture.colorSpace = THREE.SRGBColorSpace;
  const previous = renderer.getRenderTarget();
  const pixels = new Uint8Array(w * h * 4);
  try {
    renderer.setRenderTarget(target);
    renderer.render(scene, photoCamera);
    renderer.readRenderTargetPixels(target, 0, 0, w, h, pixels);
  } finally {
    renderer.setRenderTarget(previous);
    target.dispose();
  }
  const photo = document.createElement("canvas");
  photo.width = w;
  photo.height = h;
  const image = photo.getContext("2d").createImageData(w, h);
  for (let y = 0; y < h; y++)
    image.data.set(
      pixels.subarray((h - y - 1) * w * 4, (h - y) * w * 4),
      y * w * 4,
    );
  photo.getContext("2d").putImageData(image, 0, 0);
  const card = document.createElement("canvas");
  card.width = 1200;
  card.height = 880;
  const ctx = card.getContext("2d");
  ctx.fillStyle = "#eee7d6";
  ctx.fillRect(0, 0, card.width, card.height);
  ctx.drawImage(photo, 36, 36);
  ctx.fillStyle = "#254446";
  ctx.font = "18px sans-serif";
  ctx.fillText("WANDERLANE  /  TAKE THE LONG WAY", 40, 780);
  ctx.font = "30px Georgia, serif";
  ctx.fillText(place.label, 40, 825, 1120);
  ctx.font = "16px sans-serif";
  ctx.fillText(
    `${title} · Original Pune-inspired stop · synthetic terrain`,
    40,
    856,
    1120,
  );
  return card.toDataURL("image/png");
}
