# Cybersecurity Adventure (Prototype)

A minimal side-scrolling, point-and-click adventure playground for testing AI-generated art (still images or video) as backgrounds and interactive props.

## Run

- Open `cyber-adventure/index.html` in a browser. No build step or server required.
- Controls:
  - Arrow keys or A/D to move.
  - Toggle "Mouse Follow" in the top bar to have the character follow the cursor.
  - E to interact with the nearest hotspot when close, or click a hotspot directly.
  - Use ◀ ▶ in the top bar to switch areas.

## Features

- Side-scrolling world with camera that follows the player.
- Hotspots that highlight when the player or mouse is nearby.
- Modal detail view for inspections, pickups, and doors.
- Inventory UI with simple gating rules (e.g., door requires a keycard).
- Multi-area support with a next/previous area navigator.

## Structure

- `index.html` — UI shell: top bar, inventory, world layers, modal.
- `styles/main.css` — Visual styles for player, hotspots, modal, and background.
- `scripts/game.js` — Game loop, input, hotspots, inventory, and area loading.

## Editing Areas and Hotspots

Open `scripts/game.js` and look for the `state.areas = [...]` definition. Each area supports:

- `id` — Unique string ID.
- `name` — Display name in the top bar.
- `width` — World width in pixels.
- `background` — Any valid CSS background for the parallax layer. Examples:
  - `linear-gradient(90deg, #111,#222)`
  - `url('../assets/backgrounds/alley.jpg') center/cover no-repeat fixed`
- `hotspots` — Array of interactive objects. Each hotspot supports:
  - Common: `id`, `x`, `y`, `w`, `h`, `label`.
  - `type` — `inspect` | `pickup` | `door`.
  - Inspect: `text`.
  - Pickup: `item`, `text`.
  - Door: `requires`, `successText`, `failText`.

Coordinates (`x`,`y`) are world-space. `y` is measured from the top of the world container (72px-tall hotspots will sit so their bottom is around ground level when `y≈340` in the default scene). Adjust to taste.

## Using AI Art (backgrounds and props)

- Backgrounds per area:
  - Put images under `cyber-adventure/assets/backgrounds/` (create the folder as needed).
  - Set the area `background` to: `url('assets/backgrounds/your_bg.jpg') center/cover no-repeat`.
  - For a subtle overlay, keep the existing gradient in `styles/main.css` or add one via multiple backgrounds, e.g.: `background: linear-gradient(…) , url('…') center/cover`.
- Animated/video backgrounds:
  - Quick path: export a horizontally panning video and use it as the `background` of `.parallax` via `background: url('…') center/cover;` (GIF/WebP/MP4 poster frames). For true video playback, we can add a `<video>` layer under `.parallax`—happy to wire this next.
- Props / hotspot art:
  - Replace hotspot buttons with images by adding a `background` style to each hotspot, or extend the schema with `image: 'assets/props/keycard.png'` and render it.

## Extending Gameplay

- Player sprite: swap the `.player` div with an `<img>` or a Rive animation. We can expose direction/velocity to the animation state machine.
- Dialogue/choices: expand the modal to support multiple choice buttons and branching outcomes.
- Puzzles: add combination locks, pattern-matching, or mini terminal interfaces per hotspot type.
- Persistence: save `state.inventory` and `state.areaIndex` to `localStorage` for resume.
- Data-driven content: move `state.areas` to a JSON file and fetch it at startup.

## Notes

- Physics are intentionally simple (no jump/gravity) to prioritize narrative exploration.
- Accessibility: hotspots are buttons and can be focused; modal is a basic dialog. We can improve focus trapping and ARIA labels if desired.

## Roadmap Ideas

- Rive or sprite animations for the player, doors, and props.
- Video background layer with crossfades between sub-areas.
- SFX for pickups, doors, ambient hum.
- Mobile drag-to-walk gesture and on-screen controls.
- Simple state machine for quests.
