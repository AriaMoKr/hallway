// Builds the hallway: floor, walls, ceiling and trim as a few merged meshes with baked lighting,
// a portal in every open doorway, a closed door in the others, signs, lamps and the end window.
import * as THREE from 'three';
import { PANEL, WINDOW, layoutHall } from './layout.js';
import { Builder } from './builder.js';
import { bake, boxOcclusion, lightAt } from './bake.js';
import * as T from './textures.js';
import { openingGeometry, placePortal, portalMaterial, setPicture } from './portal.js';
import { ControlPanel } from './panel.js';

const lin = (hex) => {
  const c = new THREE.Color(hex); // three converts sRGB hex to its linear working space
  return [c.r, c.g, c.b];
};
const WHITE = [1, 1, 1];
const WOOD = lin('#6a4329');
const DARK_WOOD = lin('#3e2617');
const BRASS = lin('#c9a15a');
const CREAM = lin('#e6dbc3');

// The room seen through a doorway: its picture hangs this far back, its horizon at eye height.
const PICTURE = { depth: 2.4, height: 3.0, eye: 1.6, horizon: 0.56 };

export function buildHall(envs, { anisotropy = 1 } = {}) {
  const L = layoutHall(envs);
  const { width: W, height: H, doorWidth: DW, doorHeight: DH, reveal: R } = L.hall;
  const hw = L.halfWidth, z0 = L.zStart, z1 = L.zEnd;
  const group = new THREE.Group();
  group.name = 'hall';

  // Light, baked into every vertex below.
  const warm = lin('#ffd9a8');
  const lights = [];
  for (const z of L.lamps) lights.push({ p: [0, 2.66, z], c: warm, i: 1.25, r: 1.45, wrap: 0.15 });
  for (const d of L.doors) {
    if (d.env) lights.push({ p: [d.side * (hw + 0.35), 1.15, d.z], c: lin(d.env.color), i: 1.6, r: 0.95, wrap: 0.3 });
  }
  lights.push({ p: [0, 1.9, z1 + 0.25], c: lin('#9aa8d8'), i: 0.45, r: 1.1, wrap: 0.2 });
  const lighting = { lights, sky: lin('#83745f'), ground: lin('#5e5142') };
  const occlusion = boxOcclusion({ x0: -hw, x1: hw, y0: 0, y1: H, z0: z1, z1: z0 });
  const lit = (builder) => bake(builder, lighting, occlusion).toGeometry();
  const lightColor = (p, n) => {
    const c = lightAt(p, n, lighting);
    return new THREE.Color(c[0], c[1], c[2]);
  };
  const add = (geometry, material, name) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    group.add(mesh);
    return mesh;
  };

  // Floor.
  const floor = new Builder();
  floor.quad([-hw, 0, z0], [W, 0, 0], [0, 0, z1 - z0], { normal: [0, 1, 0], seg: 0.25, uv: (p) => [p[0], p[2]] });
  add(lit(floor), new THREE.MeshBasicMaterial({ map: T.floorTexture(), vertexColors: true }), 'floor');

  // Walls, with an opening for each door and the window.
  const walls = new Builder();
  const sideUV = (p) => [p[2] / 1.6, p[1] / H];
  const endUV = (p) => [p[0] / 1.6, p[1] / H];
  const sideRect = (side, zA, zB, y0, y1) =>
    walls.quad([side * hw, y0, zA], [0, 0, zB - zA], [0, y1 - y0, 0], { normal: [-side, 0, 0], uv: sideUV, seg: 0.3 });
  for (const side of [-1, 1]) {
    let za = z0;
    for (const d of L.doors.filter((d) => d.side === side).sort((a, b) => b.z - a.z)) {
      sideRect(side, za, d.z + DW / 2, 0, H);
      sideRect(side, d.z + DW / 2, d.z - DW / 2, DH, H);
      za = d.z - DW / 2;
    }
    sideRect(side, za, z1, 0, H);
  }
  const endRect = (xa, xb, y0, y1) =>
    walls.quad([xa, y0, z1], [xb - xa, 0, 0], [0, y1 - y0, 0], { normal: [0, 0, 1], uv: endUV, seg: 0.3 });
  const wx = WINDOW.width / 2;
  endRect(-hw, -wx, 0, H);
  endRect(wx, hw, 0, H);
  endRect(-wx, wx, 0, WINDOW.bottom);
  endRect(-wx, wx, WINDOW.top, H);
  walls.quad([hw, 0, z0], [-W, 0, 0], [0, H, 0], { normal: [0, 0, -1], uv: endUV, seg: 0.3 });
  add(lit(walls), new THREE.MeshBasicMaterial({ map: T.wallTexture(H), vertexColors: true }), 'walls');

  // Ceiling.
  const ceiling = new Builder();
  ceiling.quad([-hw, H, z1], [W, 0, 0], [0, 0, z0 - z1], { normal: [0, -1, 0], seg: 0.3, uv: (p) => [p[0] / 2, p[2] / 2] });
  add(lit(ceiling), new THREE.MeshBasicMaterial({ map: T.ceilingTexture(), vertexColors: true }), 'ceiling');

  // Trim: everything untextured (casings, reveals, beams, lamp fittings, sign brackets), one mesh.
  const trim = new Builder();
  const box = (a, b, albedo, skip) =>
    trim.box([Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])], [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])], { albedo, skip });
  const slabs = new Builder();
  for (const d of L.doors) {
    const s = d.side, wall = s * hw, zn = d.z + DW / 2, zf = d.z - DW / 2;
    // Casing on the wall's face.
    box([wall, 0, zn], [wall - s * 0.035, DH + 0.1, zn + 0.1], WOOD);
    box([wall, 0, zf - 0.1], [wall - s * 0.035, DH + 0.1, zf], WOOD);
    box([wall, DH + 0.1, zf - 0.13], [wall - s * 0.05, DH + 0.23, zn + 0.13], WOOD);
    // The opening's jambs, head and sill, as deep as the wall.
    trim.quad([wall, 0, zn], [s * R, 0, 0], [0, DH, 0], { normal: [0, 0, -1], albedo: WOOD });
    trim.quad([wall, 0, zf], [s * R, 0, 0], [0, DH, 0], { normal: [0, 0, 1], albedo: WOOD });
    trim.quad([wall, DH, zf], [s * R, 0, 0], [0, 0, DW], { normal: [0, -1, 0], albedo: WOOD });
    trim.quad([wall, 0.002, zf], [s * R, 0, 0], [0, 0, DW], { normal: [0, 1, 0], albedo: DARK_WOOD });
    if (!d.env) {
      // A closed door, set back in the opening, with its handle on the right.
      const x = s * (hw + 0.07);
      slabs.quad([x, 0, d.z - s * (DW / 2)], [0, 0, s * DW], [0, DH, 0], { normal: [-s, 0, 0] });
      const kz = d.z + s * (DW / 2 - 0.12);
      box([x, 0.98, kz - 0.03], [x - s * 0.07, 1.04, kz + 0.03], BRASS);
      box([x, 0.9, kz - 0.025], [x - s * 0.012, 1.12, kz + 0.025], BRASS);
    }
  }
  for (const z of L.beams) box([-hw, H - 0.2, z - 0.11], [hw, H, z + 0.11], CREAM, ['+y']);
  for (const z of L.lamps) {
    box([-0.1, H - 0.025, z - 0.1], [0.1, H, z + 0.1], CREAM, ['+y']);
    box([-0.009, 2.78, z - 0.009], [0.009, H - 0.025, z + 0.009], BRASS);
    box([-0.05, 2.75, z - 0.05], [0.05, 2.8, z + 0.05], BRASS);
  }
  // The window: reveals, casing, sill and glazing bars.
  const wd = 0.2;
  trim.quad([-wx, WINDOW.bottom, z1], [0, 0, -wd], [0, WINDOW.top - WINDOW.bottom, 0], { normal: [1, 0, 0], albedo: CREAM });
  trim.quad([wx, WINDOW.bottom, z1], [0, 0, -wd], [0, WINDOW.top - WINDOW.bottom, 0], { normal: [-1, 0, 0], albedo: CREAM });
  trim.quad([-wx, WINDOW.top, z1 - wd], [WINDOW.width, 0, 0], [0, 0, wd], { normal: [0, -1, 0], albedo: CREAM });
  trim.quad([-wx, WINDOW.bottom, z1 - wd], [WINDOW.width, 0, 0], [0, 0, wd], { normal: [0, 1, 0], albedo: CREAM });
  box([-wx - 0.12, WINDOW.bottom, z1], [-wx, WINDOW.top + 0.12, z1 + 0.04], WOOD);
  box([wx, WINDOW.bottom, z1], [wx + 0.12, WINDOW.top + 0.12, z1 + 0.04], WOOD);
  box([-wx - 0.15, WINDOW.top, z1], [wx + 0.15, WINDOW.top + 0.14, z1 + 0.05], WOOD);
  box([-wx - 0.18, WINDOW.bottom - 0.06, z1], [wx + 0.18, WINDOW.bottom + 0.02, z1 + 0.1], WOOD);
  box([-0.022, WINDOW.bottom, z1 - 0.13], [0.022, WINDOW.top, z1 - 0.09], DARK_WOOD);
  box([-wx, 2.1, z1 - 0.13], [wx, 2.145, z1 - 0.09], DARK_WOOD);

  // Signs: a plaque beside each open door and a sign hanging out over it.
  const signs = [];
  const sign = (texture, w, h, position, yaw, normal) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texture, color: lightColor(position, normal) }));
    mesh.position.set(position[0], position[1], position[2]);
    mesh.rotation.y = yaw;
    group.add(mesh);
    signs.push(mesh);
    return mesh;
  };
  for (const d of L.doors) {
    if (!d.env) continue;
    const s = d.side, wall = s * hw;
    const pz = d.z + DW / 2 + 0.1 + 0.36;
    box([wall, 1.33, pz - 0.3], [wall - s * 0.012, 1.67, pz + 0.3], DARK_WOOD);
    sign(T.plaqueTexture(d.env), 0.56, 0.3, [wall - s * 0.014, 1.5, pz], -s * Math.PI / 2, [-s, 0, 0]).name = `plaque ${d.env.id}`;
    const blade = T.bladeTexture(d.env);
    const bx = wall - s * 0.4;
    box([wall - s * 0.09, 2.515, d.z - 0.005], [wall - s * 0.71, 2.725, d.z + 0.005], DARK_WOOD);
    box([wall, 2.74, d.z - 0.01], [wall - s * 0.74, 2.76, d.z + 0.01], BRASS);
    box([wall - s * 0.14, 2.725, d.z - 0.004], [wall - s * 0.15, 2.74, d.z + 0.004], BRASS);
    box([wall - s * 0.65, 2.725, d.z - 0.004], [wall - s * 0.66, 2.74, d.z + 0.004], BRASS);
    sign(blade, 0.62, 0.2, [bx, 2.62, d.z + 0.006], 0, [0, 0, 1]).name = `blade ${d.env.id}`;
    sign(blade, 0.62, 0.2, [bx, 2.62, d.z - 0.006], Math.PI, [0, 0, -1]).name = `blade ${d.env.id} (back)`;
  }
  box([-0.68, 1.47, -0.02], [0.68, 2.03, 0], DARK_WOOD);
  sign(T.titleTexture(), 1.3, 0.5, [0, 1.75, -0.022], Math.PI, [0, 0, -1]).name = 'title';

  // The control panel, in a wooden frame on the wall.
  const pw = PANEL.side * hw;
  box([pw, PANEL.y - PANEL.height / 2 - 0.025, PANEL.z - PANEL.width / 2 - 0.025], [pw - PANEL.side * (PANEL.depth - 0.004), PANEL.y + PANEL.height / 2 + 0.025, PANEL.z + PANEL.width / 2 + 0.025], DARK_WOOD);
  const panel = new ControlPanel({ halfWidth: hw, anisotropy, color: lightColor([pw, PANEL.y, PANEL.z], [-PANEL.side, 0, 0]) });
  group.add(panel.mesh);

  add(lit(trim), new THREE.MeshBasicMaterial({ vertexColors: true }), 'trim');
  if (slabs.count) add(lit(slabs), new THREE.MeshBasicMaterial({ map: T.doorTexture(), vertexColors: true }), 'closed doors');

  // Lamps: glowing globes and their halos.
  const globes = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 20, 14), new THREE.MeshBasicMaterial({ color: '#fff3d8' }), L.lamps.length);
  globes.name = 'lamps';
  const m = new THREE.Matrix4();
  const haloMaterial = new THREE.SpriteMaterial({ map: T.haloTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5 });
  L.lamps.forEach((z, i) => {
    globes.setMatrixAt(i, m.makeTranslation(0, 2.66, z));
    const halo = new THREE.Sprite(haloMaterial);
    halo.position.set(0, 2.66, z);
    halo.scale.setScalar(1.1);
    group.add(halo);
  });
  group.add(globes);

  // The view out of the window.
  const windowHeight = WINDOW.top - WINDOW.bottom;
  const view = new THREE.Mesh(
    openingGeometry(WINDOW.width, windowHeight),
    portalMaterial({ map: T.skyTexture(), width: WINDOW.width, height: windowHeight, depth: 40, pictureHeight: 50, eye: 1.55 - WINDOW.bottom, horizon: 0.3 }),
  );
  view.name = 'window';
  view.position.set(0, WINDOW.bottom, z1 - 0.15);
  group.add(view);
  placePortal(view);

  // A portal in each open doorway.
  const portals = [];
  const previews = []; // settled once each picture has loaded or failed
  const loader = new THREE.TextureLoader();
  for (const d of L.doors) {
    if (!d.env) continue;
    const fallback = T.previewFallback(d.env);
    const material = portalMaterial({ map: fallback, width: DW, height: DH, depth: PICTURE.depth, pictureHeight: PICTURE.height, eye: PICTURE.eye, horizon: PICTURE.horizon, color: d.env.color });
    const mesh = new THREE.Mesh(openingGeometry(DW, DH), material);
    mesh.name = `portal ${d.env.id}`;
    mesh.position.set(d.side * (hw + R), 0, d.z);
    mesh.rotation.y = -d.side * Math.PI / 2;
    group.add(mesh);
    placePortal(mesh);
    const portal = { door: d, mesh, glow: 0 };
    portals.push(portal);
    if (d.env.preview) {
      let settle;
      previews.push(new Promise((r) => { settle = r; }));
      loader.load(
        d.env.preview,
        (texture) => {
          settle();
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = fallback.anisotropy;
          setPicture(material, texture, texture.image.width / texture.image.height);
          fallback.dispose();
        },
        undefined,
        () => {
          settle();
          console.warn(`hallway: no preview for ${d.env.id} (${d.env.preview})`);
        },
      );
    }
  }

  /** Per frame: the veils drift, and a doorway brightens when pointed at or stood near. */
  function update(time, dt, head, hoverDoor) {
    const k = 1 - Math.exp(-dt * 7);
    for (const p of portals) {
      const dx = head.x - p.door.side * hw, dz = head.z - p.door.z;
      const target = p.door === hoverDoor ? 1 : dx * dx + dz * dz < 1.7 * 1.7 ? 0.45 : 0;
      p.glow += (target - p.glow) * k;
      const u = p.mesh.material.uniforms;
      u.uGlow.value = p.glow;
      u.uTime.value = time;
    }
  }

  return { group, layout: L, portals, signs, panel, update, previewsLoaded: Promise.all(previews) };
}
