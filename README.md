# Hallway

**https://ariamokr.github.io/hallway/**

A WebXR corridor whose doors lead to other environments:
[vrlbry](https://ariamokr.github.io/vrlbry/), a candle-lit virtual library;
[Breadboard 8-bit](https://ariamokr.github.io/breadboard/vr.html), Ben Eater's 8-bit breadboard
computer in 3D, run live by its simulator; [music](https://ariamokr.github.io/music/), a music
room where Project Gutenberg's books on music play their scores; and
[Outside](https://ariamokr.github.io/outside/), a small garden with a stream, a pond and a bench to
read on. Walk the hallway in VR on a Meta Quest, on a desktop or on a phone. There is nothing to
install.

![The hallway: a library's bookcases through an open door under a Library sign, and more doors and signs down a chequered floor to a window at dusk](public/social.jpg)

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
| Gamepad | right stick | left stick (click it in to hurry) | aim the dot at it and press A, or walk into it |

A gamepad (Xbox, PlayStation or another Bluetooth pad) works on a desktop or a phone, as it does
in vrlbry: it takes over as soon as you use it, and moving the mouse hands control back. While it
is in use, a dot in the middle of the view shows what A uses (a door, a button on the control
panel, or a spot on the floor to walk to), and grows when it is on something. Browsers show a
page a gamepad only once one of its buttons has been pressed.

**Fullscreen**, at the bottom right beside Enter VR, fills the screen with the hallway. To leave
it, press **✕ Exit fullscreen** in the same place, Esc, or B or Back on a gamepad (Back is also
called View, Select, Share or −). A browser that cannot go fullscreen, such as an iPhone's, shows
no button.

A control panel hangs on the right-hand wall, between the entrance and the first door. Point at
it (or click it) to enter or exit VR, and to choose how to move in VR:

- **Move: Smooth** (the default): the left stick walks the way you face.
- **Move: Teleport**: push the left stick forward, aim that controller's ray at the floor, and let
  go to be there.
- **Turn: Snap** (the default): the right stick turns you 30° at a time.
- **Turn: Smooth**: the right stick turns you while held.

The trigger (or a pinch) at the floor teleports in either mode, and every teleport blinks the
view black for a moment. The choices are kept in this browser.

## Together

The panel's **Start shared session** makes a room and puts it in the address
(`?room=k3vd-q8hn`). That address is the invitation: anyone who opens it joins the room and sees
the others in the hallway, each as a head with a visor on its front, their hands in VR, a ring on
the floor and their name. Arrivals stand on different spots, at the entrance or in front of the
door they came back through, so two who arrive together don't stand inside each other. On a
screen, **Copy invite link** at the bottom right copies the link. **Leave shared session** leaves
the room and takes it out of the address.

While in a session:

- **Your name.** The Together section under the doors list has your colour and your name, "Guest"
  and four letters until you change it. Type a new one and press Enter. Set it before entering VR:
  there is no typing in a headset. The name is kept for the tab and as this browser's name for new
  tabs, on every site of `ariamokr.github.io` (the layer's test page and the environments that
  take part too).
- **Who's here.** The same section lists the others: their colour, name, where they are ("here" in
  the hallway, an environment's title, or "elsewhere") and the round trip to them in ms. The panel
  shows up to four of them and where they are, then "+N more", for VR.
- **How it's going.** The status, in the section and on the panel: "Connecting…" while the session
  starts, "Can't reach the relays" if none answers within 10 s, "Offline" when the browser is,
  "Waiting for others" with nobody else in the room yet, else how many others are here and
  elsewhere. "Couldn't connect to N visitors" means handshakes failed, usually a network that needs
  a TURN relay (the layer's README, Limits).
- **Wave.** The **Wave** button at the bottom right, or a controller's grip in VR (it pulses, so
  you feel it go out), waves to everyone: your head bobs and your name lifts for a moment in their
  hallway, and they get a toast saying you waved. Someone on another page gets the toast only.

The doors keep the session going. A door's link carries the room (`room`, see common's
[Going in](https://github.com/AriaMoKr/common#going-in)), and so does its way back. Going through
a door, the visitor leaves the room at once, so the others see them go. They rejoin when they
come back, and on the other side too once an environment takes part (none does yet). A visitor in
the session but on another page counts as elsewhere.

It runs peer to peer over WebRTC, with no server of its own:
[Trystero](https://github.com/dmotz/trystero) finds the other visitors through public Nostr
relays. The layer on top, [AriaMoKr/layersharedsession](https://github.com/AriaMoKr/layersharedsession),
loads only when a session starts. Its [test page](https://ariamokr.github.io/layersharedsession/),
opened with the same `?room=`, lists everyone in the session with their round-trip times and
logs who came, went, renamed and waved. Its Wave and the hallway's reach each other.

## Running it

```bash
npm install     # three.js, common, the shared-session layer and Trystero (and IWER, for emulating a headset), copied into public/vendor/
npm start       # http://localhost:8088/
npm test
```

It needs Node 22 or later: the tools that drive a Quest use its built-in WebSocket.

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
  title: 'garden',                      // its repository's name, on the plaque beside the door
  subtitle: 'A walled garden at dusk.', // its page's <meta name="description">, word for word, under it
  sign: 'Garden',                       // optional: the kind of place, over the door (else the title)
  url: 'https://example.org/garden/',
  preview: 'https://example.org/garden/social.jpg', // optional; 2:1, readable cross-origin; else the title shows
  color: '#7fc4a0',                     // the doorway's glow
},
```

Doors fill the hall from the entrance, left then right, and the hall gets longer as the list
does. The plaque shrinks a long description until all of it fits, so it is the page's own, not a
shortened one; when the page's description changes, change the subtitle with it. The `url` can
be any page of a site, not only its front page: breadboard's door opens its VR view, `vr.html`.
A preview is the room seen through the doorway. A screenshot taken at eye height, looking
straight ahead, works best: its horizon is placed at eye level, a little above the middle.

A new door changes what the doors across the hall look out on, so render the door views again
(see "Rendering the door views") and commit them with it.

The `url` may have a query of its own, but not the parameters a door's link adds (common's
`LINK_PARAMS`: a test checks).

## The door contract

What a door's link tells the environment behind it, how an environment links back to the hallway
(and keeps a visitor in VR on the way), and the view from each door that the hallway publishes are
the contract between the hallway and the sites behind its doors. It is in
[AriaMoKr/common's README](https://github.com/AriaMoKr/common#readme), with the code that makes and
reads it: the hallway takes the link a door opens (`doorLink`) from common's `door.js`, and the VR
movement choice it keeps in `localStorage` (`hallway.nav`) from its `nav.js`. The doorways'
shader (`portal.js`), the fade (`fade.js`) and the gamepad reading (`gamepad.js`) are common's
too, shared with the sites behind the doors.

The hallway's own part: `public/js/link.js` measures how a visitor goes through one of its doors
(`doorPose`, the link's `dx`, `yaw` and `pitch`); `public/js/arrival.js` works out which door a
visitor came back out of (`?from=`, Back, or the referrer); and the page takes a VR session that
Quest Browser grants it (`sessiongranted`) at once, so a visitor coming back in VR stays in VR.

## Rendering the door views

For every open door the site publishes the view from it, as common's README describes
([The view from your door](https://github.com/AriaMoKr/common#the-view-from-your-door)):

```
https://ariamokr.github.io/hallway/views/views.json
https://ariamokr.github.io/hallway/views/<id>.jpg
```

The views change when the hall or its doors do. To render them again with a Quest connected over
adb, serve the site on IPv4 (see "Running it") and run the tool with the same port:

```bash
node tools/serve.mjs --host 127.0.0.1 --port 8089
node tools/door-views.mjs --port 8089
```

The tool opens the hallway in Quest Browser and reloads it there before rendering, since a tab
left open from an earlier run still shows the hall as it was then. With a desktop browser instead,
start it with `--remote-debugging-port`, open the dev server in it, and pass `--cdp <its address>`.
The tool writes `public/views/<id>.jpg` and `views.json`, to be committed with the change. It also
renders the picture a shared link to the hallway shows (see "Publishing"), `public/social.jpg`.

## Publishing

`.github/workflows/pages.yml` publishes `public/` to GitHub Pages
(https://ariamokr.github.io/hallway/, from [AriaMoKr/hallway](https://github.com/AriaMoKr/hallway))
on every push to `main`. In the repository's Settings → Pages, the source must be "GitHub
Actions". Every URL in the page is relative, so the hallway would also work at another path or at
the account's own root.

A link to the hallway shared in a chat or a post shows a picture and a summary: the `og:` and
`twitter:` tags in `public/index.html`, whose `og:url` and `og:image` are the published address
(absolute, as those tags must be). The picture, `public/social.jpg` (1280 × 640), is the hall from
near the entrance, looking a little into the first door; `tools/door-views.mjs` renders it with
the door views (`HALL_VIEW` in `public/js/door-view.js` is where it is taken from), so render them
again when the hall or its doors change. It is also this repository's social preview on GitHub
(Settings → Social preview), uploaded by hand.
