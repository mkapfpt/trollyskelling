// Cybersecurity Adventure Prototype - Game Script
(() => {
  const qs = (sel, el = document) => el.querySelector(sel);
  const qsa = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // DOM
  const root = qs('#gameRoot');
  const world = qs('#world');
  const parallax = qs('#parallax');
  const hotspotsLayer = qs('#hotspots');
  const playerEl = qs('#player');
  const invEl = qs('#inventory');
  const areaNameEl = qs('#areaName');
  const btnAreaPrev = qs('#btnAreaPrev');
  const btnAreaNext = qs('#btnAreaNext');
  const mouseFollowToggle = qs('#mouseFollow');

  // Modal
  const modal = qs('#modal');
  const modalTitle = qs('#modalTitle');
  const modalBody = qs('#modalBody');
  const modalClose = qs('#modalClose');
  const modalActionPrimary = qs('#modalActionPrimary');
  const modalActionSecondary = qs('#modalActionSecondary');

  // Game state
  const state = {
    areaIndex: 0,
    areas: [],
    inventory: new Set(),
    keys: { left: false, right: false },
    mouse: { x: 0, y: 0, inside: false },
    // Player in world coordinates
    player: { x: 120, y: 0, w: 44, h: 72, speed: 300, vx: 0 },
    // Camera
    camera: { x: 0 },
    // Hotspot proximity radius
    nearRadius: 120,
    lastTime: performance.now(),
  };

  // Demo areas and hotspots
  // Types: "pickup" => adds item, "door" => requires item to pass
  state.areas = [
    {
      id: 'alley',
      name: 'Back Alley',
      width: 2400,
      background: 'linear-gradient(90deg,#0d131a,#0b0e12 35%,#0d1218 65%,#0b0e12)',
      hotspots: [
        { id: 'poster', x: 420, y: 340, w: 72, h: 72, label: 'Wanted Poster', type: 'inspect', text: 'A poster about a data breach. The QR code looks suspicious.' },
        { id: 'keycard', x: 820, y: 340, w: 72, h: 72, label: 'Keycard', type: 'pickup', item: 'Keycard', text: 'An RFID keycard lies on the ground. It might open something nearby.' },
        { id: 'door', x: 1500, y: 320, w: 84, h: 100, label: 'Server Room Door', type: 'door', requires: 'Keycard', successText: 'Door unlocks with a soft beep. You step inside.', failText: 'The door is locked. A keycard reader blinks red.' },
      ],
    },
    {
      id: 'server',
      name: 'Server Room',
      width: 2600,
      background: 'linear-gradient(90deg,#0b0e12,#0d141c 40%,#0b0e12 70%,#0d141c)',
      hotspots: [
        { id: 'terminal', x: 600, y: 330, w: 92, h: 80, label: 'Admin Terminal', type: 'inspect', text: 'Locked terminal. Password hint: social engineering? Try exploring.' },
        { id: 'usb', x: 1100, y: 350, w: 72, h: 72, label: 'USB Drive', type: 'pickup', item: 'USB', text: 'A suspicious USB drive. Plugging unknown USB is risky. But it could contain clues.' },
        { id: 'airgap', x: 1900, y: 330, w: 92, h: 80, label: 'Air-Gapped Rack', type: 'inspect', text: 'No external connectivity. Physical access only.' },
      ],
    },
  ];

  function setupArea(index, entryX) {
    const area = state.areas[index];
    if (!area) return;
    state.areaIndex = index;
    areaNameEl.textContent = area.name;

    // World sizing and background
    world.style.width = `${area.width}px`;
    parallax.style.background = area.background;

    // Reset hotspots layer
    hotspotsLayer.innerHTML = '';
    for (const h of area.hotspots) {
      const el = document.createElement('button');
      el.className = 'hotspot';
      el.style.left = `${h.x - (h.w || 72) / 2}px`;
      el.style.top = `${h.y - (h.h || 72)}px`;
      el.style.width = `${h.w || 72}px`;
      el.style.height = `${h.h || 72}px`;
      el.dataset.id = h.id;
      el.dataset.type = h.type;
      if (h.requires) el.classList.add('locked');
      el.innerHTML = `<span class="label">${h.label}</span><span class="hint">Click or press E</span>`;
      el.addEventListener('click', () => tryInteract(h));
      hotspotsLayer.appendChild(el);
    }

    // Position player
    state.player.x = entryX ?? 120;
    updatePlayerAndCamera(0);
    renderInventory();
  }

  function renderInventory() {
    // 8 slots
    const items = Array.from(state.inventory);
    invEl.innerHTML = '';
    for (let i = 0; i < 8; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot' + (items[i] ? ' filled' : '');
      slot.textContent = items[i] || '';
      invEl.appendChild(slot);
    }
  }

  function tryInteract(h) {
    const type = h.type;
    if (type === 'pickup') {
      openModal({
        title: h.label,
        body: `<p>${h.text || 'You pick it up.'}</p><p>Add to inventory?</p>`,
        primary: 'Take',
        onPrimary: () => {
          state.inventory.add(h.item);
          renderInventory();
          // Remove hotspot
          const btn = qs(`.hotspot[data-id="${h.id}"]`);
          if (btn) btn.remove();
          closeModal();
        },
      });
      return;
    }
    if (type === 'door') {
      const ok = h.requires ? state.inventory.has(h.requires) : true;
      if (ok) {
        openModal({
          title: h.label,
          body: `<p>${h.successText || 'The door opens.'}</p>`,
          primary: 'Enter',
          onPrimary: () => {
            // Move to next area if exists, else stay
            const nextIndex = Math.min(state.areaIndex + 1, state.areas.length - 1);
            if (nextIndex !== state.areaIndex) {
              setupArea(nextIndex, 100);
            }
            closeModal();
          },
        });
      } else {
        openModal({
          title: h.label,
          body: `<p>${h.failText || 'It is locked.'}</p><p>Requires: <strong>${h.requires}</strong></p>`,
          primary: 'OK',
          onPrimary: () => closeModal(),
        });
      }
      return;
    }
    // inspect or default
    openModal({
      title: h.label,
      body: `<p>${h.text || 'You take a closer look.'}</p>`,
      primary: 'Close',
      onPrimary: () => closeModal(),
    });
  }

  function metersToPx(m) { return m; }

  // Input
  window.addEventListener('keydown', (e) => {
    if (modalOpen()) return; // ignore game input when modal is open
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { state.keys.left = true; e.preventDefault(); }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { state.keys.right = true; e.preventDefault(); }
    if (e.code === 'KeyE') {
      // Interact with nearest hotspot if near
      const h = nearestHotspot();
      if (h && isNearHotspot(h)) tryInteract(h);
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') state.keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') state.keys.right = false;
  });

  root.addEventListener('mouseenter', () => { state.mouse.inside = true; });
  root.addEventListener('mouseleave', () => { state.mouse.inside = false; });
  root.addEventListener('mousemove', (e) => {
    const rect = root.getBoundingClientRect();
    state.mouse.x = e.clientX - rect.left + state.camera.x;
    state.mouse.y = e.clientY - rect.top;
  });

  // Modal helpers
  function modalOpen() { return !modal.classList.contains('hidden'); }
  function openModal({ title, body, primary = 'OK', onPrimary = null }) {
    modalTitle.textContent = title || '';
    modalBody.innerHTML = body || '';
    modalActionPrimary.textContent = primary;
    modalActionPrimary.onclick = () => onPrimary && onPrimary();
    modalActionSecondary.onclick = closeModal;
    modalClose.onclick = closeModal;
    modal.classList.remove('hidden');
  }
  function closeModal() {
    modal.classList.add('hidden');
    modalActionPrimary.onclick = null;
    modalActionSecondary.onclick = null;
    modalClose.onclick = null;
  }

  // Area switching buttons
  btnAreaPrev.addEventListener('click', () => {
    const idx = Math.max(0, state.areaIndex - 1);
    if (idx !== state.areaIndex) setupArea(idx, state.areas[idx].width - 200);
  });
  btnAreaNext.addEventListener('click', () => {
    const idx = Math.min(state.areas.length - 1, state.areaIndex + 1);
    if (idx !== state.areaIndex) setupArea(idx, 120);
  });

  // Core update loop
  function update(dt) {
    const area = state.areas[state.areaIndex];
    const p = state.player;

    // Determine desired velocity
    let targetVx = 0;
    if (mouseFollowToggle.checked && state.mouse.inside) {
      // Follow mouse x
      const dx = state.mouse.x - p.x;
      const direction = Math.sign(dx);
      const min = 12; // deadzone
      if (Math.abs(dx) > min) targetVx = direction * p.speed;
    } else {
      if (state.keys.left) targetVx -= p.speed;
      if (state.keys.right) targetVx += p.speed;
    }

    // Smooth acceleration
    const accel = 2000; // px/s^2
    if (p.vx < targetVx) {
      p.vx = Math.min(targetVx, p.vx + accel * dt);
    } else if (p.vx > targetVx) {
      p.vx = Math.max(targetVx, p.vx - accel * dt);
    }

    // Integrate
    p.x += p.vx * dt;
    // Clamp to world
    p.x = clamp(p.x, 24, area.width - 24);

    updatePlayerAndCamera(dt);

    // Update hotspots proximity classes
    updateHotspotsProximity();
  }

  function updatePlayerAndCamera(dt) {
    const viewW = root.clientWidth;
    const area = state.areas[state.areaIndex];
    const p = state.player;

    // Camera tries to keep player around center with soft bounds
    const centerTarget = clamp(p.x - viewW / 2, 0, Math.max(0, area.width - viewW));
    const lerp = (a, b, t) => a + (b - a) * t;
    state.camera.x = lerp(state.camera.x, centerTarget, 0.15);

    // Apply transforms
    world.style.transform = `translate3d(${-state.camera.x.toFixed(2)}px, 0, 0)`;
    // Place player within world (left relative to camera)
    const left = p.x - state.camera.x - p.w / 2;
    playerEl.style.left = `${left}px`;
    playerEl.style.bottom = `24px`;
  }

  function dist2(ax, ay, bx, by) {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  }

  function isNearHotspot(h) {
    const p = state.player;
    const px = p.x; // center X in world
    const py = root.clientHeight - 24 - p.h / 2; // approx center Y in viewport space
    const hx = h.x;
    const hy = h.y - (h.h || 72) / 2;

    const nearPlayer = dist2(px, py, hx, hy) <= state.nearRadius * state.nearRadius;
    let nearMouse = false;
    if (state.mouse.inside) {
      nearMouse = dist2(state.mouse.x, state.mouse.y, hx, hy) <= state.nearRadius * state.nearRadius;
    }
    return nearPlayer || nearMouse;
  }

  function nearestHotspot() {
    const area = state.areas[state.areaIndex];
    let best = null;
    let bestD2 = Infinity;
    const p = state.player;
    for (const h of area.hotspots) {
      const hx = h.x;
      const hy = h.y - (h.h || 72) / 2;
      const d2 = dist2(p.x, root.clientHeight - 24 - p.h / 2, hx, hy);
      if (d2 < bestD2) { bestD2 = d2; best = h; }
    }
    return best;
  }

  function updateHotspotsProximity() {
    const area = state.areas[state.areaIndex];
    for (const h of area.hotspots) {
      const el = qs(`.hotspot[data-id="${h.id}"]`);
      if (!el) continue;
      const near = isNearHotspot(h);
      el.classList.toggle('near', near);
      // Lock status updates based on inventory
      if (h.requires) {
        const ok = state.inventory.has(h.requires);
        el.classList.toggle('locked', !ok);
      }
    }
  }

  function tick() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - state.lastTime) / 1000);
    state.lastTime = now;

    if (!modalOpen()) update(dt);
    requestAnimationFrame(tick);
  }

  // Initialize
  setupArea(0, 120);
  requestAnimationFrame(tick);
})();
