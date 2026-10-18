# CLAUDE.md

Guidance for Claude Code in this repository.

## What this is

A WebXR hallway (three.js 0.186, plain ES modules, no bundler or build step): a corridor whose
doors lead to other web environments, the first being vrlbry (https://ariamokr.github.io/vrlbry/,
AriaMoKr/vrlbry, whose conventions this project follows). `public/` is the whole site.
`README.md` covers using it, adding a door and how environments link back.

Published at https://ariamokr.github.io/hallway/ from `main` of AriaMoKr/hallway by
`.github/workflows/pages.yml`.

## Commands

```bash
npm install      # postinstall: tools/vendor.mjs copies three (and IWER) into public/vendor/ (gitignored)
npm start        # tools/serve.mjs: public/ on http://localhost:8088/
npm test         # node --test "test/*.test.js"
node tools/quest-check.mjs [--local] [--screenshot]   # on a Quest over adb: VR frame timing, the panel, Exit VR; report in perf/ (gitignored)
node tools/door-views.mjs [--port n] [--cdp <url>]    # the view out of every open door, rendered in a browser (a Quest over adb by default) from the dev server: public/views/<id>.jpg + views.json; rerun after changing the hall or its doors
```

## Layout

- `public/js/environments.js`: the doors' data. Keep the `<noscript>` list in `index.html` in step (tested).
- `layout.js`: pure (no three, tested in Node). Hall dimensions (`HALL`), door slots, `clampToHall` (walking), `doorCrossed` (the threshold that navigates), `castRay` (what a pointer hits: the hall is a box, so picking is plane math, no Raycaster over meshes), `doorSpawn`.
- `arrival.js`: pure. Which door a visitor came back out of: `?from=<id>`, then Back (`back_forward` + the door in sessionStorage), then the referrer.
- `link.js`: pure. The link a door opens (`doorLink`): the environment's URL plus `from`, `back`, `dw`, `dh`, `glow` and, going through in 3D, the pose in the doorway (`doorPose`: `dx`, `yaw`, `pitch`). The parameters are documented in README's Going in section; keep it in step.
- `hall.js` builds the scene from `builder.js` (world-space quads and boxes) with lighting baked into vertex colours by `bake.js`. Materials are unlit (`MeshBasicMaterial`); there are no real-time lights or shadows. A new light is an entry in hall.js's `lights` list.
- `portal.js`: the doorway shader. It ray-casts a box behind the opening: the far wall is the preview picture, the floor, ceiling and sides are its edges stretched. The end window uses the same shader without the veil.
- `door-view.js`: the view out of a door, for the environment behind it (README, "The view from your door"): `doorView` (pure: the eye on the threshold, the off-axis frustum onto the opposite wall's plane, the parameters an environment's portal hangs it with) and `renderDoorView` (into a render target, read back to a canvas, the fade hidden, the doorways still). `__hallway.doorViews()` renders every open door's once the previews have loaded (`hall.previewsLoaded`); `tools/door-views.mjs` writes them to `public/views/`. `tools/serve.mjs` listens on IPv6 localhost by default: for `adb reverse` from a Quest, give it `--host 127.0.0.1`.
- `textures.js`: every canvas texture (painted at start-up, seeded so they never change).
- The control panel: its place and buttons are in `layout.js` (`PANEL`, `PANEL_BUTTONS`, `panelButtonAt`; `castRay` reports `kind: 'panel'` with `u`, `v`), its drawing in `panel.js` (redrawn only when its state or the button pointed at changes), the VR navigation choices it sets (`move`, `turn`) in `settings.js` (localStorage `hallway.nav`). A new button is an entry in `PANEL_BUTTONS`, a label in `panel.js` and a case in `main.js`'s `controls.onPanel`.
- `controls.js`: desktop, touch and XR input into one rig (yaw) + camera (head); in VR the left stick walks or aims a teleport (`move`), the right one snaps or turns smoothly (`turn`), and teleports go through `onTeleport` (main.js blinks the view). `main.js`: renderer, loop, going through doors (`go`: fade, then `location.assign` of the door's link), arrival, VR entry including `sessiongranted`.

## Conventions

- Client URLs stay relative: the site may live under a path (`/hallway/`). Tested.
- Quest 3 is the performance target. Keep draw calls few (one mesh per material: merge static geometry into a `Builder`), allocate nothing per frame (reuse vectors and hit objects, index loops over `session.inputSources`), and keep lighting baked.
- Coordinates: metres, floor y = 0, entrance wall z = 0, hall along -z, left is -x; yaw 0 faces -z.
- Scripted testing: `window.__hallway` (renderer, scene, camera, rig, hall, layout, controls, fade, `go`, `enterVR`, `tick(dt, n)`, `xrDevice`). A hidden browser pane gets no animation frames, so drive it with `tick()`. `?xr=emulate` installs IWER; aim its controllers with `xrDevice.controllers.right.position/quaternion`, `updateButtonValue('trigger', 1)`, `updateAxes('thumbstick', x, y)`.
- The embedded browser pane serves the dev server on port 8088 (`.claude/launch.json`).
