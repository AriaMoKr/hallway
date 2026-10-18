// Builds the hall's static geometry in world coordinates: subdivided quads and boxes, each vertex
// with an albedo, so bake.js can light them per vertex. One Builder becomes one mesh (one draw call).
import * as THREE from 'three';

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const length = (a) => Math.hypot(a[0], a[1], a[2]);

export class Builder {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.uvs = [];
    this.albedo = [];
    this.indices = [];
    this.colors = null; // filled by bake()
  }

  get count() {
    return this.positions.length / 3;
  }

  /**
   * A rectangle from corner o along u and v, subdivided into cells of at most `seg` metres.
   * Its front faces u × v; `normal` flips it to face that way instead. Texture coordinates are
   * `uv(point)` when given (world-mapped surfaces), else 0…1 along u and v.
   */
  quad(o, u, v, { seg = 0.3, normal = null, uv = null, albedo = [1, 1, 1] } = {}) {
    let n = cross(u, v);
    if (normal && dot(n, normal) < 0) {
      [u, v] = [v, u];
      n = cross(u, v);
    }
    const ln = length(n);
    n = [n[0] / ln, n[1] / ln, n[2] / ln];
    const nu = Math.max(1, Math.ceil(length(u) / seg));
    const nv = Math.max(1, Math.ceil(length(v) / seg));
    const base = this.count;
    for (let j = 0; j <= nv; j++) {
      for (let i = 0; i <= nu; i++) {
        const s = i / nu, t = j / nv;
        const p = [o[0] + u[0] * s + v[0] * t, o[1] + u[1] * s + v[1] * t, o[2] + u[2] * s + v[2] * t];
        this.positions.push(p[0], p[1], p[2]);
        this.normals.push(n[0], n[1], n[2]);
        const tc = uv ? uv(p) : [s, t];
        this.uvs.push(tc[0], tc[1]);
        this.albedo.push(albedo[0], albedo[1], albedo[2]);
      }
    }
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const a = base + j * (nu + 1) + i;
        const b = a + 1, c = a + nu + 2, d = a + nu + 1;
        this.indices.push(a, b, c, a, c, d);
      }
    }
    return this;
  }

  /** An axis-aligned box from min to max; `skip` names faces left out ('+x', '-y', …). */
  box(min, max, { skip = [], seg = 0.6, albedo } = {}) {
    const [x0, y0, z0] = min, [x1, y1, z1] = max;
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    const o = { seg, albedo };
    if (!skip.includes('+x')) this.quad([x1, y0, z1], [0, 0, -dz], [0, dy, 0], { ...o, normal: [1, 0, 0] });
    if (!skip.includes('-x')) this.quad([x0, y0, z0], [0, 0, dz], [0, dy, 0], { ...o, normal: [-1, 0, 0] });
    if (!skip.includes('+y')) this.quad([x0, y1, z1], [dx, 0, 0], [0, 0, -dz], { ...o, normal: [0, 1, 0] });
    if (!skip.includes('-y')) this.quad([x0, y0, z0], [dx, 0, 0], [0, 0, dz], { ...o, normal: [0, -1, 0] });
    if (!skip.includes('+z')) this.quad([x0, y0, z1], [dx, 0, 0], [0, dy, 0], { ...o, normal: [0, 0, 1] });
    if (!skip.includes('-z')) this.quad([x1, y0, z0], [-dx, 0, 0], [0, dy, 0], { ...o, normal: [0, 0, -1] });
    return this;
  }

  toGeometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.colors ?? this.albedo, 3));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.indices, 1) : new THREE.Uint16BufferAttribute(this.indices, 1));
    g.computeBoundingSphere();
    return g;
  }
}
