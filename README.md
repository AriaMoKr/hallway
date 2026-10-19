# Hallway

**https://ariamokr.github.io/hallway/**

A WebXR corridor whose doors lead to other environments:
[vrlbry](https://ariamokr.github.io/vrlbry/), a candle-lit virtual library, and
[Breadboard 8-bit](https://ariamokr.github.io/breadboard/vr.html), Ben Eater's 8-bit breadboard
computer in 3D, run live by its simulator. Walk the hallway in VR on a Meta Quest, on a desktop or
on a phone. There is nothing to install.

Each open doorway shows the room behind it: the environment's picture, seen with parallax (and
depth, in a headset), behind a glowing veil. A door without a picture shows its name instead.
Walk through it, click or tap it, or point at it in VR and pull the trigger, and the page goes
there. When you come back, by the environment's own link or with Back, you start in front of the
door you left by. Doors with no environment yet are drawn closed.

## Moving about

| | Look | Walk | Go through a door |
|---|---|---|---|
| Desktop | drag | WASD or arrows (Shift runs), Q/E or ←/→ turn, click the floor | click it, or walk into it |
| Phone | drag | tap the floor | tap it |
| Headset | your head | left stick walks (or aims a teleport), right stick turns, trigger at the floor teleports | trigger (or pinch) at it, or step through it |
| Gamepad, in fullscreen | right stick | left stick (click it in to run) | A with the dot on it, or walk into it |

**Fullscreen**, at the bottom right beside Enter VR, fills the screen with the hallway. To leave
it, press **✕ Exit fullscreen** in the same place, Esc, or View on a gamepad (the button also
called Back, Select, Share or −). In fullscreen a gamepad plays like a first-person game: the left
stick walks, the right one looks, and a dot in the middle of the view shows what A uses (a door,
a button on the control panel, or a spot on the floor to walk to). Out of fullscreen the gamepad
does nothing. A browser that cannot go fullscreen, such as an iPhone's, shows no button.

A control panel hangs on the right-hand wall, between the entrance and the first door. Point at
it (or click it) to enter or exit VR, and to choose how to move in VR:

- **Move: Smooth** (the default): the left stick walks the way you face.
- **Move: Teleport**: push the left stick forward, aim that controller's ray at the floor, and let
  go to be there.
- **Turn: Snap** (the default): the right stick turns you 30° at a time.
- **Turn: Smooth**: the right stick turns you while held.

The trigger (or a pinch) at the floor teleports in either mode, and every teleport blinks the
view black for a moment. The choices are kept in this browser.

## Running it

```bash
npm install     # three.js (and IWER, for emulating a headset), copied into public/vendor/
npm start       # http://localhost:8088/
npm test
```

`public/` is the whole site: any static server can serve it once `npm install` has filled
`public/vendor/`. WebXR needs a secure context. `http://localhost` counts as one.

A Quest connected over adb can open the dev server as `http://localhost:8088/` after
`adb reverse tcp:8088 tcp:8088`, as long as the server listens on IPv4. `npm start` listens on
`localhost`, which can mean IPv6 only (`::1`, as on Windows), and the headset's connections then
never arrive. For a headset, start it as:

```bash
npm start -- --host 127.0.0.1
```

`?xr=emulate` installs Meta's IWER emulator (a virtual Quest 3), so the VR mode can be tried
without a headset.

`node tools/quest-check.mjs` checks the hallway on a Quest connected over adb, which nobody needs
to wear. It opens the published site, or the dev server with `--local` (started as above), enters
VR, times the frames while walking the hall, presses the panel's settings and Exit VR, and writes
a report to `perf/` (`--help` lists the options).

## Adding a door

Add an entry to [`public/js/environments.js`](public/js/environments.js), and a link to the
`<noscript>` list in [`public/index.html`](public/index.html) (a test checks that one is there):

```js
{
  id: 'garden',                         // short, unique; used in ?from=garden
  title: 'Garden',                      // on the plaque beside the door
  subtitle: 'A walled garden at dusk',  // under it
  sign: 'Garden',                       // optional: the kind of place, over the door (else the title)
  url: 'https://example.org/garden/',
  preview: 'https://example.org/garden/social.jpg', // optional; 2:1, readable cross-origin; else the title shows
  color: '#7fc4a0',                     // the doorway's glow
},
```

Doors fill the hall from the entrance, left then right, and the hall gets longer as the list
does. The `url` can be any page of a site, not only its front page: Breadboard 8-bit's door opens
its VR view, `vr.html`. A preview is the room seen through the doorway. A screenshot taken at eye
height, looking straight ahead, works best: its horizon is placed at eye level, a little above
the middle.

A new door changes what the doors across the hall look out on, so render the door views again
(see "The view from your door") and commit them with it.

The `url` may have a query of its own, but not the parameters below, which the hallway adds (a
test checks).

## Going in

A door opens its environment's `url` with the visit added to the query, so the environment can
carry the view on from the doorway. Walking through vrlbry's door a little right of centre,
turned slightly to the right and looking a little down, opens:

```
https://ariamokr.github.io/vrlbry/?place=%7Egutenberg_en_all_2025-11&from=hallway&back=https%3A%2F%2Fariamokr.github.io%2Fhallway%2F%3Ffrom%3Dvrlbry&dx=0.12&yaw=-8&pitch=-3&dw=1.1&dh=2.25&glow=d9b26a
```

| Parameter | Example | Meaning |
|---|---|---|
| `from` | `hallway` | Who sent the visitor. |
| `back` | `https://ariamokr.github.io/hallway/?from=vrlbry` | The way back: a link to it brings the visitor out in front of this door. |
| `dx` | `0.12` | Where the visitor went through: metres from the doorway's centre, + to their right as they face in. Always within the opening. |
| `yaw` | `-8` | Which way they faced: degrees from straight in, + to the left (as three.js's `rotation.y`), from -90 to 90. |
| `pitch` | `-3` | How far up they looked, in degrees, + up. Left out in VR, where the headset gives it. |
| `dw`, `dh` | `1.1`, `2.25` | The doorway's width and height in metres. |
| `glow` | `d9b26a` | The doorway's colour (the door's `color`), hex without the `#`. |

`dx`, `yaw` and `pitch` are there only when the visitor goes in through the doorway in 3D, by
walking through it or by pointing at it. Pointing from across the hall gives the pose they
pointed from, with `dx` kept within the opening. The doors list beside the view sends the rest
without them, and the `<noscript>` list links to the bare `url`.

An environment can use them to:

- **Carry the view on.** The doorway shows the environment's preview as if it was taken from the
  threshold at eye height (1.6 m), facing straight in. Arriving the visitor where the preview was
  taken, moved `dx` sideways and turned by `yaw`, continues what they saw through the doorway.
- **Draw its own door back**, `dw` by `dh`, glowing in `glow`, leading to `back`.
- **Read them once.** Take them off the address with `history.replaceState` after reading them,
  so a reload, Back or a shared link doesn't repeat the arrival. Reading `location.search` takes
  no time, so it doesn't delay the VR hand-over (below).

An environment that ignores them loses nothing: they are ordinary query parameters. The VR
movement choices from the control panel are not in the link: they are in `localStorage` under
`hallway.nav` (`{"move":"smooth","turn":"snap"}`), which environments on `ariamokr.github.io` can
read.

## Linking back

An environment brings visitors back by linking to the hallway with its own id, the URL a door's
link gives as `back`:

```
https://ariamokr.github.io/hallway/?from=vrlbry
```

Without `?from=`, the hallway also recognizes a referrer from inside an environment's URL, and
Back from an environment returns to the door the visitor left by.

**Staying in VR across the trip.** When a page navigates during an immersive session, Quest
Browser can grant the next page a session without a click: it fires `sessiongranted` on
`navigator.xr`. The hallway listens for it, so a visitor who walks back in from an environment's
VR stays in VR. For the same to work in the other direction, an environment listens too and
starts its session at once:

```js
navigator.xr?.addEventListener('sessiongranted', () => {
  // The same call the page's Enter VR button makes.
  navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] })
    .then((session) => renderer.xr.setSession(session));
});
```

Without that listener, the visitor arrives at the environment's 2D page and presses its Enter VR
button. vrlbry listens; Breadboard 8-bit's VR view does not yet.

The hand-over has two limits, measured on a Quest with Quest Browser 152 (vrlbry,
[`7eca62b`](https://github.com/AriaMoKr/vrlbry/commit/7eca62b)):

- **One origin only.** A navigation to another origin (another domain, or another port) gets no
  grant, so the visitor arrives at the 2D page. The hallway, vrlbry and Breadboard 8-bit are all on
  `ariamokr.github.io`, so the hand-over can work between them.
- **About 5 seconds.** The grant arrives about 0.1 s after the next page starts. A request made up
  to 4.7 s later starts the session, while one at 5.2 s is refused as needing a click. Ask for the
  session as soon as the page can draw a frame, not once everything else has loaded.

## The view from your door

An environment's way back to the hallway can show the hallway as seen from its own door. For every
open door the site publishes that view, rendered from the doorway at eye height looking straight
across the hall:

```
https://ariamokr.github.io/hallway/views/views.json
https://ariamokr.github.io/hallway/views/<id>.jpg
```

`views.json` has, for each door id, its picture's file name and how to hang it behind an opening
of your own (2:1, 2048 × 1024):

```json
"vrlbry": { "image": "vrlbry.jpg", "depth": 2.94, "pictureHeight": 6.5, "eye": 1.6, "horizon": 0.6154, "aspect": 2 }
```

The picture is a flat wall `depth` metres behind the opening, `pictureHeight` tall and `aspect`
times as wide, centred on the opening, with its horizon `eye` metres above the sill and at
`horizon` of its height from its bottom. It is a perspective view projected onto the plane of the
opposite wall, so the floor and ceiling in front of that wall are in it too: hung that way (as
`public/js/portal.js` hangs a picture), the hall looks right through your doorway, with some
parallax. [vrlbry](https://github.com/AriaMoKr/vrlbry) shows its view through the door back in
its library, and keeps a painted one for when this file cannot be read.

The views change when the hall or its doors do. To render them again with a Quest connected over
adb, serve the site on IPv4 (see "Running it") and run the tool with the same port:

```bash
node tools/serve.mjs --host 127.0.0.1 --port 8089
node tools/door-views.mjs --port 8089
```

The tool opens the hallway in Quest Browser and reloads it there before rendering, since a tab
left open from an earlier run still shows the hall as it was then. With a desktop browser instead,
start it with `--remote-debugging-port`, open the dev server in it, and pass `--cdp <its address>`.
The tool writes `public/views/<id>.jpg` and `views.json`, to be committed with the change.

## Publishing

`.github/workflows/pages.yml` publishes `public/` to GitHub Pages
(https://ariamokr.github.io/hallway/, from [AriaMoKr/hallway](https://github.com/AriaMoKr/hallway))
on every push to `main`. In the repository's Settings → Pages, the source must be "GitHub
Actions". Every URL in the page is relative, so the hallway would also work at another path or at
the account's own root.
