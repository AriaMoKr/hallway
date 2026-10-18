// Lighting baked into vertex colours once, when the hall is built: the lamps, the doorways' glow,
// a hemisphere of bounced light and darkening into the corners. Nothing is lit per frame, so the
// hall costs a headset only its textures (unlit materials, no real-time lights or shadows).

/**
 * @typedef {{ p: number[], c: number[], i: number, r: number, wrap?: number }} Light
 *   p: position; c: linear colour; i: intensity; r: the distance at which it has fallen to half;
 *   wrap: how far round the side of a surface it reaches (0 = only what faces it)
 */

/** Light (linear RGB) arriving at point p with normal n. Writes into out. */
export function lightAt(p, n, { lights, sky, ground }, out = [0, 0, 0]) {
  const h = 0.5 + 0.5 * n[1];
  let r = ground[0] + (sky[0] - ground[0]) * h;
  let g = ground[1] + (sky[1] - ground[1]) * h;
  let b = ground[2] + (sky[2] - ground[2]) * h;
  for (const L of lights) {
    const dx = L.p[0] - p[0], dy = L.p[1] - p[1], dz = L.p[2] - p[2];
    const d2 = dx * dx + dy * dy + dz * dz;
    const d = Math.sqrt(d2) || 1e-6;
    const wrap = L.wrap ?? 0.1;
    const facing = ((n[0] * dx + n[1] * dy + n[2] * dz) / d + wrap) / (1 + wrap);
    if (facing <= 0) continue;
    const f = (L.i * facing) / (1 + d2 / (L.r * L.r));
    r += L.c[0] * f;
    g += L.c[1] * f;
    b += L.c[2] * f;
  }
  out[0] = r;
  out[1] = g;
  out[2] = b;
  return out;
}

/**
 * Fills builder.colors with albedo × light, times occlusion(p, n) (1 = open, less in corners).
 */
export function bake(builder, env, occlusion = null) {
  const { positions: P, normals: N, albedo: A } = builder;
  const colors = new Float32Array(P.length);
  const p = [0, 0, 0], n = [0, 0, 0], light = [0, 0, 0];
  for (let i = 0; i < P.length; i += 3) {
    p[0] = P[i]; p[1] = P[i + 1]; p[2] = P[i + 2];
    n[0] = N[i]; n[1] = N[i + 1]; n[2] = N[i + 2];
    lightAt(p, n, env, light);
    const ao = occlusion ? occlusion(p, n) : 1;
    colors[i] = A[i] * light[0] * ao;
    colors[i + 1] = A[i + 1] * light[1] * ao;
    colors[i + 2] = A[i + 2] * light[2] * ao;
  }
  builder.colors = colors;
  return builder;
}

/**
 * Occlusion for a box-shaped room: each vertex darkens near the room's planes that meet its own
 * surface at an angle (the floor near the walls, a wall near the floor, ceiling and other walls).
 */
export function boxOcclusion({ x0, x1, y0, y1, z0, z1 }, { strength = 0.38, reach = 0.32 } = {}) {
  const planes = [
    { axis: 0, at: x0 }, { axis: 0, at: x1 },
    { axis: 1, at: y0 }, { axis: 1, at: y1 },
    { axis: 2, at: z0 }, { axis: 2, at: z1 },
  ];
  return (p, n) => {
    let ao = 1;
    for (const pl of planes) {
      if (Math.abs(n[pl.axis]) > 0.5) continue; // parallel to the surface itself
      const d = Math.abs(p[pl.axis] - pl.at);
      ao *= 1 - strength * Math.exp(-d / reach);
    }
    return ao;
  };
}
