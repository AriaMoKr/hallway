// The view out of a door (README, "The view from your door"): what someone standing in a doorway
// sees of the hall, rendered as one picture for the environment behind that door, so that the way
// back to the hallway in that environment shows the hall as it is, from the right place.
//
// The picture is a perspective view from the doorway at eye height, looking straight across the
// hall, projected onto the plane of the opposite wall and reaching well above, below and to both
// sides (the floor and ceiling in front of that wall project onto it too). Hung that far behind
// an opening, with its horizon at eye height, it looks right through the opening: this is what
// the doorways' shader does with a picture (portal.js: the picture is the far wall of a box
// behind the opening). The parameters an environment needs for that come with it (doorView).
//
// tools/door-views.mjs renders them in a browser and writes public/views/: <id>.jpg for every
// open door, and views.json with their parameters. It also renders the link preview's picture
// (public/social.jpg, index.html's og:image): the hall from near the entrance, looking down it
// and a little into the first door, so its room shows through.

import * as THREE from 'three';

/** The pictures: their size, and how far they reach below and above eye level at the far wall (m). */
export const VIEW = { width: 2048, height: 1024, eye: 1.6, below: 4.0, above: 2.5, inset: 0.06 };

/**
 * A door's view: the eye (in the doorway, just inside the hall, so the jambs are behind it), the
 * yaw it looks along (straight across the hall), the frustum at 1 m (left, right, top, bottom),
 * and the parameters an environment hangs the picture with (as portal.js's portalMaterial takes
 * them): `depth` behind its opening, `pictureHeight`, the horizon at `eye` above its sill and at
 * `horizon` of the picture's height from its bottom, `aspect` its width over its height. Pure.
 */
export function doorView(L, door, view = VIEW) {
  const side = door.side;
  const depth = 2 * L.halfWidth - view.inset; // to the opposite wall
  const pictureHeight = view.below + view.above;
  const aspect = view.width / view.height;
  const half = (pictureHeight * aspect) / 2;
  return {
    eye: { x: side * (L.halfWidth - view.inset), y: view.eye, z: door.z },
    yaw: (side * Math.PI) / 2, // a left door (−x) looks toward +x
    frustum: { left: -half / depth, right: half / depth, top: view.above / depth, bottom: -view.below / depth },
    params: {
      depth: round(depth), pictureHeight: round(pictureHeight), eye: view.eye,
      horizon: round(view.below / pictureHeight), aspect: round(aspect),
    },
  };
}

const round = (v) => Math.round(v * 1e4) / 1e4;

/**
 * The link preview's picture: its size (2:1, as vrlbry's), the eye (x, y, z: on the right of the
 * hall, short of the first pair of doors), its yaw and pitch (radians, as the viewer's: turned
 * toward the first door, on the left) and vertical field of view (degrees).
 */
export const HALL_VIEW = { width: 1280, height: 640, x: 0.8, y: 1.6, z: -1.9, yaw: 0.3, pitch: -0.05, fov: 62 };

/**
 * Renders a door's view into a canvas (sRGB, as the screen would show it): the hall as built,
 * the other doorways with their pictures, without the fade around the viewer's own head.
 * @returns {HTMLCanvasElement}
 */
export function renderDoorView(renderer, scene, hall, door, { hide = [], view = VIEW } = {}) {
  const f = doorView(hall.layout, door, view);
  const near = 0.05;
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(f.eye.x, f.eye.y, f.eye.z);
  camera.rotation.set(0, f.yaw, 0);
  const { left, right, top, bottom } = f.frustum;
  camera.projectionMatrix.makePerspective(left * near, right * near, top * near, bottom * near, near, 80);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  return renderStill(renderer, scene, hall, camera, view, hide);
}

/**
 * Renders the link preview's picture (HALL_VIEW) into a canvas, as renderDoorView does a door's.
 * @returns {HTMLCanvasElement}
 */
export function renderHallView(renderer, scene, hall, { hide = [], view = HALL_VIEW } = {}) {
  const camera = new THREE.PerspectiveCamera(view.fov, view.width / view.height, 0.05, 80);
  camera.position.set(view.x, view.y, view.z);
  camera.rotation.set(view.pitch, view.yaw, 0, 'YXZ');
  return renderStill(renderer, scene, hall, camera, view, hide);
}

/** The scene from camera into a width × height canvas, with the doorways still and hide hidden. */
function renderStill(renderer, scene, hall, camera, { width, height }, hide) {
  camera.updateMatrixWorld(true);
  const target = new THREE.WebGLRenderTarget(width, height, { samples: 4 });
  target.texture.colorSpace = THREE.SRGBColorSpace;
  // The doorways still, as they are when nobody stands near.
  const kept = hall.portals.map((p) => [p.mesh.material.uniforms.uGlow.value, p.mesh.material.uniforms.uTime.value]);
  for (const p of hall.portals) {
    p.mesh.material.uniforms.uGlow.value = 0;
    p.mesh.material.uniforms.uTime.value = 0;
  }
  const shown = hide.map((o) => o.visible);
  for (const o of hide) o.visible = false;
  const before = renderer.getRenderTarget();
  try {
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    const pixels = new Uint8Array(width * height * 4);
    renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext('2d');
    const image = g.createImageData(width, height);
    const row = width * 4;
    for (let y = 0; y < height; y++) image.data.set(pixels.subarray((height - 1 - y) * row, (height - y) * row), y * row);
    g.putImageData(image, 0, 0);
    return canvas;
  } finally {
    renderer.setRenderTarget(before);
    target.dispose();
    hide.forEach((o, i) => { o.visible = shown[i]; });
    hall.portals.forEach((p, i) => {
      p.mesh.material.uniforms.uGlow.value = kept[i][0];
      p.mesh.material.uniforms.uTime.value = kept[i][1];
    });
  }
}
