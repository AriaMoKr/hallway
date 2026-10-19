# CLAUDE.md

Guidance for Claude Code in this repository.

## What this is

A WebXR hallway (three.js 0.186, plain ES modules, no bundler or build step): a corridor whose
doors lead to other web environments: vrlbry (https://ariamokr.github.io/vrlbry/, AriaMoKr/vrlbry,
whose conventions this project follows) and Breadboard 8-bit's VR view
(https://ariamokr.github.io/breadboard/vr.html). `public/` is the whole site. `README.md` covers
using it, adding a door, what a door's link tells the environment, how environments link back,
and the door views the site publishes for them.

Published at https://ariamokr.github.io/hallway/ from `main` of AriaMoKr/hallway by
`.github/workflows/pages.yml`.

## Commands

```bash
npm install      # postinstall: tools/vendor.mjs copies three, layersharedsession, Trystero (and IWER) into public/vendor/ (gitignored)
npm start        # tools/serve.mjs: public/ on http://localhost:8088/ (IPv6 only on Windows; for a Quest over adb reverse: npm start -- --host 127.0.0.1)
npm test         # node --test "test/*.test.js"
node tools/quest-check.mjs [--local] [--screenshot]   # on a Quest over adb: VR frame timing, the panel, Exit VR; report in perf/ (gitignored)
node tools/door-views.mjs [--port n] [--cdp <url>]    # the view out of every open door, rendered in a browser (a Quest over adb by default) from the dev server: public/views/<id>.jpg + views.json; rerun after changing the hall or its doors
```

## Layout

- `public/js/environments.js`: the doors' data. Keep the `<noscript>` list in `index.html` in step (tested).
- `layout.js`: pure (no three, tested in Node). Hall dimensions (`HALL`), door slots, the plaque beside each open door (`PLAQUE`), `clampToHall` (walking), `doorCrossed` (the threshold that navigates), `castRay` (what a pointer hits: the hall is a box, so picking is plane math, no Raycaster over meshes), `doorSpawn`.
- `arrival.js`: pure. Which door a visitor came back out of: `?from=<id>`, then Back (`back_forward` + the door in sessionStorage), then the referrer.
- `link.js`: pure. The link a door opens (`doorLink`): the environment's URL plus `from`, `back`, `dw`, `dh`, `glow`, in a shared session `room` (on `back` too) and, going through in 3D, the pose in the doorway (`doorPose`: `dx`, `yaw`, `pitch`). The parameters are documented in README's Going in section; keep it in step.
- `together.js`: the shared session (README, "Together"). `Together` starts (`start`, a new room by default), leaves (`stop`), and steps out for a door and back (`pause`, `resume`) a session of the layer from AriaMoKr/layersharedsession (a GitHub dependency pinned to a commit; `session.js` is imported dynamically, so Trystero loads only with a session). The room is in the address (`?room=`, `replaceState`); main.js joins the one an arriving URL names. Per frame `update` sends the head (and the controllers in VR) and draws the others who are in the hallway (page id `hallway`) from their interpolated poses, with no allocation. The app id (`APP_ID`) is the layer's test page's, so that page can watch a hallway room. To take a newer layer, change the commit in package.json and `npm install`.
- `hall.js` builds the scene from `builder.js` (world-space quads and boxes) with lighting baked into vertex colours by `bake.js`. Materials are unlit (`MeshBasicMaterial`); there are no real-time lights or shadows. A new light is an entry in hall.js's `lights` list.
- `portal.js`: the doorway shader. It ray-casts a box behind the opening: the far wall is the preview picture, the floor, ceiling and sides are its edges stretched. The end window uses the same shader without the veil.
- `door-view.js`: the view out of a door, for the environment behind it (README, "The view from your door"): `doorView` (pure: the eye on the threshold, the off-axis frustum onto the opposite wall's plane, the parameters an environment's portal hangs it with) and `renderDoorView` (into a render target, read back to a canvas, the fade hidden, the doorways still). `__hallway.doorViews()` renders every open door's once the previews have loaded (`hall.previewsLoaded`); `tools/door-views.mjs` reloads the page it finds (over DevTools: `Page.reload`) and writes them to `public/views/`. A new or changed door changes the views across the hall: render them again and commit them.
- `textures.js`: every canvas texture (painted at start-up, seeded so they never change). `previewFallback` is a door's picture until its preview loads, or for good when it has none: its title fitted to the middle of the picture, which is all a doorway shows.
- The control panel: its place (between the entrance and the first door on its wall, clear of every door and plaque there: tested) and buttons are in `layout.js` (`PANEL`, `PANEL_BUTTONS`, `panelButtonAt`; `castRay` reports `kind: 'panel'` with `u`, `v`), its drawing in `panel.js` (redrawn only when its state or the button pointed at changes; its Together section shows the shared session: Start / Leave, who else is in it, the invite link), the VR navigation choices it sets (`move`, `turn`) in `settings.js` (localStorage `hallway.nav`). A new button is an entry in `PANEL_BUTTONS`, a label in `panel.js` and a case in `main.js`'s `controls.onPanel`.
- `gamepad.js`: pure. A gamepad as a first-person controller (`readPad`: sticks with a dead zone, the look stick squared for aiming; A, View, the left stick clicked in), standard mapping.
- `controls.js`: desktop, touch, gamepad and XR input into one rig (yaw) + camera (head); the gamepad only while `padEnabled` (main.js: in fullscreen), and while it was used last (`padActive`) the middle of the view is what it points at; in VR the left stick walks or aims a teleport (`move`), the right one snaps or turns smoothly (`turn`), and teleports go through `onTeleport` (main.js blinks the view). `main.js`: renderer, loop, going through doors (`go`: fade, then `location.assign` of the door's link), arrival, VR entry including `sessiongranted`, fullscreen (the overlay's button, with webkit fallbacks; it turns the gamepad on and off).

## Conventions

- Client URLs stay relative: the site may live under a path (`/hallway/`). Tested.
- Quest 3 is the performance target. Keep draw calls few (one mesh per material: merge static geometry into a `Builder`), allocate nothing per frame (reuse vectors and hit objects, index loops over `session.inputSources`), and keep lighting baked.
- Coordinates: metres, floor y = 0, entrance wall z = 0, hall along -z, left is -x; yaw 0 faces -z.
- Scripted testing: `window.__hallway` (renderer, scene, camera, rig, hall, layout, controls, overlay, fade, `go`, `enterVR`, `together`, `doorViews()`, `tick(dt, n)`, `xrDevice`). A shared session needs two pages: open the same `?room=` in two tabs (each tab is its own visitor), `controls.onPanel('session')` presses Start / Leave, and layersharedsession's test page in the same room shows the session's log. A hidden browser pane gets no animation frames, so drive it with `tick()`. `?xr=emulate` installs IWER; aim its controllers with `xrDevice.controllers.right.position/quaternion`, `updateButtonValue('trigger', 1)`, `updateAxes('thumbstick', x, y)`. A gamepad: replace `navigator.getGamepads` with one returning a fake `{ connected: true, axes, buttons: [{ pressed }] }` and dispatch a `gamepadconnected` event. The browser pane never grants fullscreen: define `document.fullscreenElement` and dispatch `fullscreenchange` (real fullscreen was checked in Quest Browser, pressing the button over DevTools with `userGesture`).
- The embedded browser pane serves the dev server on port 8088 (`.claude/launch.json`). `hallway-quest` serves it on `127.0.0.1:8089` as well, for the tools that reach it from a Quest through `adb reverse` (`--port 8089`): Quest Browser cannot reach the IPv6-only one there (checked).
