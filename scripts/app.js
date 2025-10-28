// Scrollytelling Lab - Scroll Controller

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

function formatNumber(n) { return (Math.round(n * 100) / 100).toFixed(2); }

class SectionController {
  constructor(section, defaults) {
    this.section = section;
    this.sticky = section.querySelector('.sticky');
    this.video = section.querySelector('video.bg-video');
    this.overlay = section.querySelector('.overlay');

    // From dataset or defaults
    this.textSpeed = parseFloat(section.dataset.textSpeed ?? defaults.textSpeed);
    this.videoSpeed = parseFloat(section.dataset.videoSpeed ?? defaults.videoSpeed);
    this.durationHint = parseFloat(section.dataset.duration ?? 10);
    this.title = section.dataset.title ?? '';
    this.mask = section.dataset.mask ?? '';

    // Optional presentation controls
    this.align = (section.dataset.align || 'center').toLowerCase(); // left|center|right
    this.useCard = String(section.dataset.card || 'true').toLowerCase() === 'true';
    this.cardBg = section.dataset.cardBg || '';
    this.cardRadius = section.dataset.cardRadius || '';

    this.applyOverlayPresentation();

    // Card reference and default HTML (for text editing features)
    this.cardEl = this.overlay.querySelector(':scope > .card');
    this.defaultCardHtml = this.cardEl ? this.cardEl.innerHTML : '';
    this.isEditing = false;

    // Create a background <img> for still images (hidden by default)
    this.bgImg = document.createElement('img');
    this.bgImg.className = 'bg-image';
    Object.assign(this.bgImg.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      display: 'none'
    });
    // Ensure image sits beneath overlay and alongside video
    this.sticky.insertBefore(this.bgImg, this.video);

    // Load video source lazily and derive an optional numeric index from the filename (videoN.*)
    const src = section.dataset.videoSrc;
    this.videoIndex = null;
    this.currentBgType = 'video';
    this.currentBgSrc = src || '';
    if (src) {
      const m = /video(\d+)\.(mp4|webm|ogg|ogv)$/i.exec(src);
      if (m) this.videoIndex = parseInt(m[1], 10);
      const source = document.createElement('source');
      source.src = src;
      source.type = guessTypeFromSrc(src);
      this.video.appendChild(source);
      this.video.load();
    }

    // Apply saved edited content if any
    this.applySavedIfAny && this.applySavedIfAny();

    this.progress = 0; // 0..1 within sticky/pinned span
    this.fullPass = 0; // 0..1 from first entry to full exit
    this._lastScrubTs = 0;
  }

  setMask(mask) {
    const val = (mask || '').toString();
    if (val) {
      this.section.dataset.mask = val;
    } else {
      delete this.section.dataset.mask;
    }
  }

  applyOverlayPresentation() {
    // Alignment classes on overlay
    this.overlay.classList.remove('align-left', 'align-center', 'align-right');
    const alignClass = `align-${['left','center','right'].includes(this.align) ? this.align : 'center'}`;
    this.overlay.classList.add(alignClass);

    // Ensure there is always a single card wrapper so width/alignment stay consistent
    let card = this.overlay.querySelector(':scope > .card');
    if (!card) {
      card = document.createElement('div');
      card.className = 'card';
      // Move existing child nodes into card
      while (this.overlay.firstChild) {
        card.appendChild(this.overlay.firstChild);
      }
      this.overlay.appendChild(card);
    }
    // Apply per-section variables
    if (this.cardBg) card.style.setProperty('--card-bg', this.cardBg);
    if (this.cardRadius) card.style.setProperty('--card-radius', this.cardRadius);
    // Toggle visual surface without removing the container
    card.classList.toggle('no-surface', !this.useCard);
  }

  setAlign(align) {
    const val = String(align || '').toLowerCase();
    if (!['left','center','right'].includes(val)) return;
    this.align = val;
    this.section.dataset.align = val;
    this.applyOverlayPresentation();
  }

  setCard(useCard) {
    const val = !!useCard;
    this.useCard = val;
    this.section.dataset.card = String(val);
    // Ensure wrapper exists and just toggle surface
    this.applyOverlayPresentation();
  }

  // --- Text editing API (used by control panel) ---
  storageKey() {
    const base = (this.title || '').trim() || (this.section.id || 'section');
    return `scrolly:text:${base}`;
  }
  storageRawKey() {
    const base = (this.title || '').trim() || (this.section.id || 'section');
    return `scrolly:text:raw:${base}`;
  }
  getCardHtml() {
    // ensure we always reference the current card element
    if (!this.cardEl) this.cardEl = this.overlay.querySelector(':scope > .card');
    return this.cardEl ? this.cardEl.innerHTML : '';
  }
  setCardHtml(html) {
    if (!this.cardEl) this.cardEl = this.overlay.querySelector(':scope > .card');
    if (!this.cardEl) return;
    this.cardEl.innerHTML = html || '';
  }
  enableEditing(on) {
    this.isEditing = !!on;
  }
  saveEdits(html) {
    const content = (typeof html === 'string') ? html : this.getCardHtml();
    try { localStorage.setItem(this.storageKey(), content); } catch (_) {}
  }
  restoreDefault() {
    try { localStorage.removeItem(this.storageKey()); } catch (_) {}
    try { localStorage.removeItem(this.storageRawKey()); } catch (_) {}
    // restore from captured default; if missing, do nothing
    if (typeof this.defaultCardHtml === 'string') this.setCardHtml(this.defaultCardHtml);
  }
  applySavedIfAny() {
    try {
      const saved = localStorage.getItem(this.storageKey());
      if (saved) this.setCardHtml(saved);
    } catch (_) {}
  }

  setBackground(src, type) {
    const kind = (type || '').toLowerCase();
    if (kind === 'image') {
      // Show image, hide video
      this.currentBgType = 'image';
      this.currentBgSrc = src;
      this.bgImg.src = src;
      this.bgImg.style.display = '';
      this.video.pause();
      this.video.style.display = 'none';
    } else {
      // Default to video
      this.currentBgType = 'video';
      this.currentBgSrc = src;
      this.bgImg.style.display = 'none';
      this.setVideoSource(src);
      this.video.style.display = '';
    }
  }

  setVideoSource(src) {
    if (!src || typeof src !== 'string') return;
    // Update dataset
    this.section.dataset.videoSrc = src;
    // Try to derive numeric index (optional)
    const m = /video(\d+)\.(mp4|webm|ogg|ogv)$/i.exec(src);
    this.videoIndex = m ? parseInt(m[1], 10) : null;
    // Replace <source> and reload
    this.video.pause();
    this.video.removeAttribute('src');
    this.video.querySelectorAll('source').forEach(s => s.remove());
    const source = document.createElement('source');
    source.src = src;
    source.type = guessTypeFromSrc(src);
    this.video.appendChild(source);
    this.video.load();
  }

  setVideoIndex(n) {
    const idx = parseInt(n, 10);
    if (!Number.isFinite(idx) || idx < 1) return;
    const newSrc = `assets/videos/video${idx}.mp4`;
    // Update dataset and internal state
    this.section.dataset.videoSrc = newSrc;
    this.videoIndex = idx;
    // Replace <source> children and reload
    this.video.pause();
    this.video.removeAttribute('src');
    this.video.querySelectorAll('source').forEach(s => s.remove());
    const source = document.createElement('source');
    source.src = newSrc;
    source.type = guessTypeFromSrc(newSrc);
    this.video.appendChild(source);
    this.video.load();
  }

  computeProgress(scrollY, viewportH) {
    const start = this.section.offsetTop;
    const height = this.section.offsetHeight;
    // Pinned progress (current behavior)
    const pinnedSpan = height - viewportH;
    const rawPinned = pinnedSpan > 0 ? (scrollY - start) / pinnedSpan : 0;
    this.progress = clamp01(rawPinned);

    // Full-pass progress (starts when section bottom touches viewport bottom)
    const fullStart = start - viewportH;
    const fullSpan = height + viewportH;
    const rawFull = fullSpan > 0 ? (scrollY - fullStart) / fullSpan : 0;
    this.fullPass = clamp01(rawFull);

    return this.progress;
  }

  applyParallax(globalTextSpeed, globalVideoSpeed, scrubVideo, enableCrossfade, useFullPass) {
    const p = this.progress;
    const pTime = useFullPass ? this.fullPass : this.progress;

    // Text parallax: translateY relative to viewport
    const textRate = this.textSpeed * globalTextSpeed;
    const textTranslate = (p * -1) * textRate * 300; // px
    this.overlay.style.transform = `translate3d(0, ${textTranslate.toFixed(2)}px, 0)`;

    // Video parallax: subtle translate for depth
    const vidRate = this.videoSpeed * globalVideoSpeed;
    const videoTranslate = p * vidRate * 120; // px
    this.video.style.transform = `translate3d(0, ${videoTranslate.toFixed(2)}px, 0)`;
    this.bgImg.style.transform = `translate3d(0, ${videoTranslate.toFixed(2)}px, 0)`;

    // Optional: scroll-scrub video playback (throttled)
    if (scrubVideo && this.currentBgType === 'video' && this.video.readyState >= 1) {
      const now = performance.now();
      const throttleMs = 80; // reduce main-thread pressure
      if (now - this._lastScrubTs >= throttleMs) {
        const dur = this.video.duration && Number.isFinite(this.video.duration)
          ? this.video.duration
          : this.durationHint;
        this.video.currentTime = pTime * dur;
        this._lastScrubTs = now;
      }
    }

    // Crossfade opacity near section edges (optional)
    if (enableCrossfade) {
      // Fade in over the first 15% and fade out over the last 15% of progress.
      const fadeInStart = 0.0, fadeInEnd = 0.15;
      const fadeOutStart = 0.85, fadeOutEnd = 1.0;
      const fadeIn = smoothstep(fadeInStart, fadeInEnd, p);
      const fadeOut = 1 - smoothstep(fadeOutStart, fadeOutEnd, p);
      const opacity = Math.max(0, Math.min(1, fadeIn * fadeOut));
      const op = opacity.toFixed(3);
      this.video.style.opacity = op;
      this.bgImg.style.opacity = op;
    } else {
      // Keep fully opaque to avoid heavy full-screen opacity animation
      this.video.style.opacity = '1';
      this.bgImg.style.opacity = '1';
    }
  }
}

function guessTypeFromSrc(src) {
  const ext = src.split('.').pop().toLowerCase();
  switch (ext) {
    case 'mp4': return 'video/mp4';
    case 'webm': return 'video/webm';
    case 'ogg':
    case 'ogv': return 'video/ogg';
    default: return 'video/mp4';
  }
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function init() {
  const controls = {
    scrub: document.getElementById('scrubVideo'),
    crossfade: document.getElementById('crossfade'),
    scrubFullPass: document.getElementById('scrubFullPass'),
    maskSelect: document.getElementById('maskSelect'),
    themeSelect: document.getElementById('themeSelect'),
    bgSelect: document.getElementById('bgSelect'),
    editToggle: document.getElementById('editTextToggle'),
    textInput: document.getElementById('sectionTextInput'),
    applyTextBtn: document.getElementById('applyTextBtn'),
    saveTextBtn: document.getElementById('saveTextBtn'),
    restoreTextBtn: document.getElementById('restoreTextBtn'),
    gradient: document.getElementById('gradientOverlay'),
    // maskSelect/mediaToggle removed
  };

  // Read asset manifest for backgrounds (standalone-friendly)
  let assetList = [];
  const manifestEl = document.getElementById('assetManifest');
  if (manifestEl && manifestEl.textContent) {
    try {
      const data = JSON.parse(manifestEl.textContent);
      if (Array.isArray(data.assets)) assetList = data.assets;
    } catch (_) { /* ignore malformed manifest */ }
  }
  // Helpers for labels and type detection
  function extOf(path) { return (path.split('.').pop() || '').toLowerCase(); }
  function kindFromPath(path) {
    const e = extOf(path);
    if (/(mp4|webm|ogg|ogv)$/.test(e)) return 'video';
    if (/(jpg|jpeg|png|gif|webp|avif|bmp|svg)$/.test(e)) return 'image';
    return 'file';
  }
  function friendlyLabel(name, prefix) {
    const base = name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
    return prefix ? `(${prefix}) ${base}` : base;
  }

  // Attempt to dynamically list backgrounds from GitHub when hosted
  async function tryPopulateFromGitHub() {
    // Only attempt on http(s) and likely GitHub Pages
    if (!(location.protocol === 'http:' || location.protocol === 'https:')) return false;
    // Heuristic: user.github.io or custom domain still works if we can infer owner/repo from path
    function detectRepo() {
      const host = location.hostname.toLowerCase();
      const path = location.pathname.replace(/^\/+/, ''); // trim leading /
      // username.github.io/repo/... => owner=username, repo=first path segment
      const m = host.match(/^([a-z0-9-]+)\.github\.io$/);
      if (m) {
        const owner = m[1];
        const seg = path.split('/')[0] || '';
        if (seg) return { owner, repo: seg };
      }
      // Fallback: try to read from <meta name="github-repo" content="owner/repo">
      const meta = document.querySelector('meta[name="github-repo"]');
      if (meta && meta.content && meta.content.includes('/')) {
        const [owner, repo] = meta.content.split('/');
        return { owner, repo };
      }
      return null;
    }
    const repo = detectRepo();
    if (!repo) return false;
    const urls = [
      `https://api.github.com/repos/${repo.owner}/${repo.repo}/contents/assets/videos`,
      `https://api.github.com/repos/${repo.owner}/${repo.repo}/contents/assets/images`
    ];
    try {
      const [vidRes, imgRes] = await Promise.all(urls.map(u => fetch(u, { headers: { 'Accept': 'application/vnd.github+json' } })));
      let items = [];
      if (vidRes && vidRes.ok) items = items.concat(await vidRes.json());
      if (imgRes && imgRes.ok) items = items.concat(await imgRes.json());
      items = Array.isArray(items) ? items : [];
      const files = items.filter(it => it && it.type === 'file' && /\.(mp4|webm|ogg|ogv|jpg|jpeg|png|gif|webp|avif|bmp|svg)$/i.test(it.name));
      if (!files.length) return false;
      if (controls.bgSelect) {
        controls.bgSelect.innerHTML = '';
        files.forEach(it => {
          const type = kindFromPath(it.name);
          const opt = document.createElement('option');
          opt.value = it.path; // repo-relative
          opt.dataset.type = type;
          opt.textContent = friendlyLabel(it.name, type === 'video' ? 'Video' : type === 'image' ? 'Image' : 'File');
          controls.bgSelect.appendChild(opt);
        });
      }
      return true;
    } catch (_) { return false; }
  }

  async function populateBackgrounds() {
    const ok = await tryPopulateFromGitHub();
    if (ok) return;
    // Fallback to inline manifest
    if (controls.bgSelect) {
      controls.bgSelect.innerHTML = '';
      assetList.forEach((a) => {
        if (!a || !a.src) return;
        const opt = document.createElement('option');
        opt.value = a.src;
        const t = a.type || kindFromPath(a.src);
        opt.dataset.type = t;
        const name = a.label || a.src.split('/').pop();
        opt.textContent = friendlyLabel(name, t === 'video' ? 'Video' : t === 'image' ? 'Image' : 'File');
        controls.bgSelect.appendChild(opt);
      });
    }
  }

  const defaults = {
    // Defaults used only if a section omits data-text-speed / data-video-speed
    textSpeed: 0.4,
    videoSpeed: 0.15,
  };

  const sections = Array.from(document.querySelectorAll('section.panel'))
    .map(sec => new SectionController(sec, defaults));

  // Track active section index (closest to viewport center)
  let activeIndex = 0;

  // Populate backgrounds list (async); then reflect active
  populateBackgrounds().then(() => {
    // After population, ensure the control reflects current active section
    reflectActiveInControls();
  });

  // Initialize looping policy based on scrubbing: no loop while scrubbing; loop when not scrubbing
  sections.forEach(sc => { sc.video.loop = !controls.scrub.checked; });

  // (safety pass for media toggle removed in this revert)

  // Track visibility and manage autoplay vs scrub policy
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const sc = sections.find(s => s.section === entry.target);
      if (!sc) return;
      sc.isVisible = !!entry.isIntersecting;
      if (sc.isVisible) {
        const scrubbing = controls.scrub && controls.scrub.checked;
        if (scrubbing) {
          // Ensure native playback is stopped to avoid fighting with scrubbing
          sc.video.pause();
          // Snap immediately to the current scroll-derived frame (no throttle)
          const dur = sc.video.duration && Number.isFinite(sc.video.duration)
            ? sc.video.duration
            : sc.durationHint;
          const pTime = (controls.scrubFullPass && controls.scrubFullPass.checked) ? sc.fullPass : sc.progress;
          sc.video.currentTime = pTime * dur;
        } else {
          sc.video.play().catch(() => {/* autoplay may be blocked */});
        }
      } else {
        sc.video.pause();
      }
    });
  }, { rootMargin: '0px', threshold: 0.01 });

  sections.forEach(sc => io.observe(sc.section));

  function pickActiveIndex() {
    let bestIdx = 0;
    let bestDist = Infinity;
    const vh = window.innerHeight;
    const centerY = vh / 2;
    sections.forEach((sc, i) => {
      const rect = sc.section.getBoundingClientRect();
      const secCenter = rect.top + rect.height / 2;
      const dist = Math.abs(secCenter - centerY);
      if (dist < bestDist) { bestDist = dist; bestIdx = i; }
    });
    return bestIdx;
  }

  // Controls bindings for active section adjustments
  function reflectActiveInControls() {
    const sc = sections[activeIndex];
    if (!sc) return;
    const alignSel = document.getElementById('alignSelect');
    const cardTog = document.getElementById('cardToggle');
    if (alignSel) alignSel.value = sc.align || 'center';
    if (cardTog) cardTog.checked = !!sc.useCard;
    if (controls.maskSelect) controls.maskSelect.value = sc.section.dataset.mask || '';
    if (controls.themeSelect) controls.themeSelect.value = sc.section.dataset.theme || 'dark';
    if (controls.bgSelect) {
      const cur = sc.currentBgSrc || sc.section.dataset.videoSrc || '';
      // If current src isn’t in the list, add a temporary option for visibility
      if (cur && !Array.from(controls.bgSelect.options).some(o => o.value === cur)) {
        const extra = document.createElement('option');
        extra.value = cur;
        const t = kindFromPath(cur);
        extra.dataset.type = t;
        extra.textContent = friendlyLabel(cur.split('/').pop(), t === 'video' ? 'Video' : t === 'image' ? 'Image' : 'File');
        controls.bgSelect.appendChild(extra);
      }
      controls.bgSelect.value = cur;
    }
    // Reflect text editing controls
    if (controls.editToggle) controls.editToggle.checked = !!sc.isEditing;
    if (controls.textInput) {
      // Keep textarea enabled at all times for easier editing
      controls.textInput.disabled = false;
      // Only update the textarea if it is not focused to avoid clobbering typing
      if (document.activeElement !== controls.textInput) {
        // Prefill with saved RAW text if available; otherwise blank
        let raw = '';
        try { raw = localStorage.getItem(sc.storageRawKey()) || ''; } catch (_) { raw = ''; }
        controls.textInput.value = raw;
      }
    }
    if (controls.applyTextBtn) controls.applyTextBtn.disabled = !sc.isEditing;
    if (controls.saveTextBtn) controls.saveTextBtn.disabled = !sc.isEditing;
    if (controls.restoreTextBtn) controls.restoreTextBtn.disabled = !sc.isEditing;
  }

  const alignSel = document.getElementById('alignSelect');
  if (alignSel) {
    alignSel.addEventListener('change', () => {
      const sc = sections[activeIndex];
      if (sc) sc.setAlign(alignSel.value);
    });
  }
  const cardTog = document.getElementById('cardToggle');
  if (cardTog) {
    cardTog.addEventListener('change', () => {
      const sc = sections[activeIndex];
      if (sc) sc.setCard(cardTog.checked);
    });
  }

  if (controls.maskSelect) {
    controls.maskSelect.addEventListener('change', () => {
      const sc = sections[activeIndex];
      if (sc) sc.setMask(controls.maskSelect.value);
    });
  }

  if (controls.themeSelect) {
    controls.themeSelect.addEventListener('change', () => {
      const sc = sections[activeIndex];
      if (sc) {
        const val = controls.themeSelect.value || 'dark';
        sc.section.dataset.theme = val;
      }
    });
  }

  if (controls.bgSelect) {
    controls.bgSelect.addEventListener('change', () => {
      const sc = sections[activeIndex];
      if (!sc) return;
      const sel = controls.bgSelect.options[controls.bgSelect.selectedIndex];
      if (!sel) return;
      const val = sel.value;
      const t = (sel.dataset.type || kindFromPath(val));
      if (val) {
        sc.setBackground(val, t);
        const scrubbing = controls.scrub && controls.scrub.checked;
        if (t === 'video' && !scrubbing && sc.isVisible) {
          sc.video.play().catch(() => {/* ignore autoplay block */});
        }
      }
    });
  }

  // Text editing control bindings
  function textToHtml(input) {
    if (!input) return '';
    // Always treat input as plain text: split on blank lines to paragraphs, single newlines -> <br>
    const paras = input.split(/\r?\n\s*\r?\n/).map(s => s.trim()).filter(Boolean);
    return paras.map(p => `<p>${p.replace(/\r?\n/g, '<br>')}</p>`).join('\n');
  }
  if (controls.editToggle) {
    controls.editToggle.addEventListener('change', () => {
      const sc = sections[activeIndex];
      if (!sc) return;
      sc.enableEditing(controls.editToggle.checked);
      // Refresh textarea with current content upon toggling
      reflectActiveInControls();
    });
  }
  if (controls.applyTextBtn) {
    controls.applyTextBtn.addEventListener('click', () => {
      const sc = sections[activeIndex];
      if (!sc || !controls.textInput) return;
      const raw = controls.textInput.value;
      const html = textToHtml(raw);
      sc.setCardHtml(html);
    });
  }
  if (controls.saveTextBtn) {
    controls.saveTextBtn.addEventListener('click', () => {
      const sc = sections[activeIndex];
      if (!sc || !controls.textInput) return;
      const raw = controls.textInput.value;
      const html = textToHtml(raw);
      sc.setCardHtml(html);
      sc.saveEdits(html);
      try { localStorage.setItem(sc.storageRawKey(), raw); } catch (_) {}
    });
  }
  if (controls.restoreTextBtn) {
    controls.restoreTextBtn.addEventListener('click', () => {
      const sc = sections[activeIndex];
      if (!sc) return;
      sc.restoreDefault();
      reflectActiveInControls();
    });
  }

  // Global overlay gradient toggle -> body.has-gradient
  function applyGradientToggle() {
    if (!controls.gradient) return;
    document.body.classList.toggle('has-gradient', !!controls.gradient.checked);
  }
  if (controls.gradient) {
    applyGradientToggle();
    controls.gradient.addEventListener('change', applyGradientToggle);
  }

  // Scrub toggle: update loop and playback policy immediately for visible sections
  if (controls.scrub) {
    controls.scrub.addEventListener('change', () => {
      const scrubbing = controls.scrub.checked;
      sections.forEach(sc => {
        sc.video.loop = !scrubbing;
        if (sc.isVisible) {
          if (scrubbing) {
            sc.video.pause();
            const dur = sc.video.duration && Number.isFinite(sc.video.duration)
              ? sc.video.duration
              : sc.durationHint;
            sc.video.currentTime = sc.progress * dur;
          } else {
            sc.video.play().catch(() => {});
          }
        }
      });
    });
  }

  // (mask/media control listeners removed in this revert)

  // Scroll handler
  let ticking = false;
  function onScroll() {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        const y = window.scrollY || window.pageYOffset;
        const vh = window.innerHeight;
        // Global multipliers fixed (controls removed)
        const gsText = 1.0;
        const gsVideo = 1.0; // Video parallax enabled
        const scrub = controls.scrub.checked;
        const fullPass = controls.scrubFullPass ? controls.scrubFullPass.checked : false;
        const crossfade = controls.crossfade ? controls.crossfade.checked : true;

        sections.forEach(sc => {
          sc.computeProgress(y, vh);
          sc.applyParallax(gsText, gsVideo, scrub, crossfade, fullPass);
        });

        // Parallax sliders removed; no outputs to update

        // Update active section and reflect its state in controls
        const newActive = pickActiveIndex();
        if (newActive !== activeIndex) {
          activeIndex = newActive;
          reflectActiveInControls();
        }
        ticking = false;
      });
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  // Initial paint
  onScroll();
  // Initialize controls to current active section
  activeIndex = pickActiveIndex();
  reflectActiveInControls();
}

window.addEventListener('DOMContentLoaded', init);
