// ============================================================
//  v0id Bio-Link — public site engine
//  Loads data from Supabase, renders dynamic UI, controls
//  background media, music player and Discord presence.
// ============================================================

(function () {
  const CFG = window.APP_CONFIG || {};
  const supabase = (window.supabase && CFG.SUPABASE_URL.indexOf('PASTE_') === -1)
    ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY)
    : null;

  let DATA = {
    settings: null,
    profile: null,
    socials: [],
    projects: [],
    about: [],
  };

  // ---------- navigation ----------
  const Go = {
    to(section) {
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      const target = document.getElementById('sec-' + section);
      if (target) target.classList.add('active');
      document.querySelectorAll('[data-nav]').forEach(b =>
        b.classList.toggle('active', b.getAttribute('data-nav') === section));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
  };

  // ---------- url helpers ----------
  function mediaUrl(path) {
    if (!path) return '';
    if (/^(https?:)?\/\//.test(path)) return path;
    // repo-relative assets live next to the site -> use as-is
    if (path.startsWith('assets/')) return path;
    // uploaded media lives in Supabase storage -> build public URL
    if (CFG.SUPABASE_URL.indexOf('PASTE_') === -1) {
      return CFG.SUPABASE_URL.replace(/\/$/, '') + '/storage/v1/object/public/media/' + path.replace(/^\//, '');
    }
    return 'assets/' + path.replace(/^\//, '');
  }

  // ============================================================
  //  THEME & FONTS APPLY (from settings)
  // ============================================================
  function applyTheme(s) {
    const root = document.documentElement.style;
    const accent = s.color_accent || '#7c3aed';
    // parse rgb
    const m = accent.replace('#', '');
    const r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16);
    root.setProperty('--accent', accent);
    root.setProperty('--accent-rgb', r + ',' + g + ',' + b);
    root.setProperty('--glow', s.glow_intensity || 0.6);
    root.setProperty('--bg-color', s.color_bg || '#050308');
    root.setProperty('--font-primary', "'" + (s.font_primary || 'Space Grotesk') + "', 'Cairo', sans-serif");
    root.setProperty('--font-secondary', "'" + (s.font_secondary || 'Inter') + "', 'Cairo', sans-serif");

    // background media engine
    const layer = document.getElementById('mediaLayer');
    root.setProperty('--bg-blur', (s.bg_blur || 0) + 'px');
    root.setProperty('--bg-dim', s.bg_dim != null ? s.bg_dim : 0.5);
    root.setProperty('--bg-glow', s.bg_glow != null ? s.bg_glow : 0.4);

    let html = '';
    if (s.bg_type === 'video' && s.bg_url) {
      html = '<video autoplay muted loop playsinline><source src="' + mediaUrl(s.bg_url) + '"></video>';
    } else if (s.bg_url && (s.bg_type === 'image' || s.bg_type === 'gif' || s.bg_type === '')) {
      html = '<img src="' + mediaUrl(s.bg_url) + '" alt="">';
    }
    layer.innerHTML = html;
  }

  // ============================================================
  //  RENDER — HOME
  // ============================================================
  function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  const L = () => i18n.lang;

  function renderHome(p) {
    if (!p) return;
    document.getElementById('avatar').src = mediaUrl(p.avatar_url);
    document.getElementById('ownerBadge').textContent = p.owner_badge || 'Owner';
    document.getElementById('displayName').textContent =
      L() === 'ar' ? (p.display_name_ar || p.display_name_en) : (p.display_name_en || p.display_name_ar);

    const meta = [];
    if (L() === 'ar') {
      if (p.location_ar) meta.push(p.location_ar);
      if (p.age) meta.push(p.age);
      if (p.occupation_ar) meta.push(p.occupation_ar);
    } else {
      if (p.location_en) meta.push(p.location_en);
      if (p.age) meta.push(p.age);
      if (p.occupation_en) meta.push(p.occupation_en);
    }
    document.getElementById('metaLine').innerHTML =
      meta.map((m, i) => '<span>' + esc(m) + '</span>' + (i < meta.length - 1 ? '<span class="sep">•</span>' : '')).join('');

    const bio = L() === 'ar' ? p.bio_ar : p.bio_en;
    document.getElementById('bio').textContent = bio || '';

    // live status chip
    const chip = document.getElementById('statusChip');
    const stEl = document.getElementById('statusText');
    const status = p.status_text || '';
    if (chip && stEl) {
      if (status) { chip.style.display = 'inline-flex'; stEl.textContent = status; }
      else chip.style.display = 'none';
    }

    // goals line (small text under bio)
    const goals = L() === 'ar' ? p.goals_ar : p.goals_en;
    const hint = document.getElementById('musicHint');
    if (goals) hint.textContent = '『' + goals + '』';
  }

  // ---------- socials ----------
  function renderSocials(list) {
    const el = document.getElementById('socials');
    if (!el) return;
    el.innerHTML = '';
    const visible = (list || []).filter(s => s && s.visible).sort((a, b) => a.sort_order - b.sort_order);
    visible.forEach(s => {
      const a = document.createElement('a');
      a.className = 'soc';
      a.title = s.label || s.platform;
      a.href = s.url || '#';
      a.target = '_blank'; a.rel = 'noopener';
      const c = s.color || '#7c3aed';
      a.setAttribute('style', '--sc:' + c + ';--sc-rgb:' + hexRgb(c));
      a.innerHTML = window.platformIcon(s.platform, s.icon);
      el.appendChild(a);
    });
  }

  // ---------- projects ----------
  function renderProjects(list) {
    const grid = document.getElementById('projectsGrid');
    if (!grid) return;
    grid.innerHTML = '';
    const visible = (list || []).filter(p => p && p.visible).sort((a, b) => a.sort_order - b.sort_order);
    visible.forEach(p => {
      const title = L() === 'ar' ? (p.title_ar || p.title_en) : (p.title_en || p.title_ar);
      const desc = L() === 'ar' ? (p.desc_ar || p.desc_en) : (p.desc_en || p.desc_ar);
      const details = L() === 'ar' ? (p.details_ar || p.details_en) : (p.details_en || p.details_ar);
      const tags = (p.tags || '').split(',').map(t => t.trim()).filter(Boolean);
      const tagC = String(p.tag_colors || '').split(',').map(t => t.trim()).filter(Boolean);
      const card = document.createElement('div');
      card.className = 'project';
      const pc = p.color || '#7c3aed';
      card.setAttribute('style', '--pc:' + pc + ';--pc-rgb:' + hexRgb(pc));
      let html = '';
      if (p.media_type === 'video' && (p.video_url || p.image_url)) {
        const src = mediaUrl(p.video_url || p.image_url);
        const poster = p.image_url ? ' poster="' + mediaUrl(p.image_url) + '"' : '';
        html += '<video class="pimg" src="' + src + '" autoplay muted loop playsinline' + poster + '></video>';
      } else if (p.image_url) {
        html += '<img class="pimg" src="' + mediaUrl(p.image_url) + '" alt="">';
      }
      html += '<div class="pt"><h3>' + esc(title) + '</h3>';
      html += '<p class="desc">' + esc(desc) + '</p>';
      if (tags.length) {
        html += '<div class="ptags">' + tags.map((t, i) => {
          const c = tagC[i] || pc;
          return '<span class="ptag" style="--tcr:' + hexRgb(c) + '">' + esc(t) + '</span>';
        }).join('') + '</div>';
      }
      html += '</div><div class="pfoot">';
      if (details || desc) html += '<button class="plink" onclick="openProjModal(' + visible.indexOf(p) + ')">' + (L() === 'ar' ? 'تفاصيل' : 'Details') + ' ↗</button>';
      if (p.download_url) html += '<a class="plink" href="' + esc(p.download_url) + '" target="_blank" rel="noopener">Download ↗</a>';
      if (p.github_url) html += '<a class="plink" href="' + esc(p.github_url) + '" target="_blank" rel="noopener">GitHub ↗</a>';
      if (p.external_url) html += '<a class="plink" href="' + esc(p.external_url) + '" target="_blank" rel="noopener">Live ↗</a>';
      html += '</div>';
      card.innerHTML = html;
      grid.appendChild(card);
    });

    // per-project image height (style applied to last rendered element — each card carries its own)
    visible.forEach(p => {
      const idx = grid.querySelector('.project:nth-child(' + (visible.indexOf(p) + 1) + ') .pimg');
      if (idx && parseInt(p.img_h)) idx.style.height = parseInt(p.img_h) + 'px';
    });

    window._projData = visible;
  }

  // ---------- about ----------
  function renderAbout(profile, sections) {
    const narr = document.getElementById('aboutNarrative');
    const grid = document.getElementById('aboutGrid');
    if (!narr || !grid || !profile) return;
    // about hero image
    const hero = document.getElementById('aboutHero');
    const aImg = document.getElementById('aboutImg');
    if (hero && aImg) {
      if (profile.about_img_url) {
        hero.style.display = 'block';
        aImg.src = mediaUrl(profile.about_img_url);
        aImg.onerror = () => { hero.style.display = 'none'; };
        const w = parseInt(profile.about_img_w) || 0;
        const h = parseInt(profile.about_img_h) || 0;
        aImg.style.width = w ? (w + 'px') : '';
        aImg.style.height = h ? (h + 'px') : '';
        aImg.style.objectFit = profile.about_img_fit || 'cover';
        const align = profile.about_img_align || 'center';
        if (align === 'center') { aImg.style.marginLeft = 'auto'; aImg.style.marginRight = 'auto'; }
        else if (align === 'left') { aImg.style.marginLeft = '0'; aImg.style.marginRight = 'auto'; }
        else { aImg.style.marginLeft = 'auto'; aImg.style.marginRight = '0'; }
      } else hero.style.display = 'none';
    }
    const journey = L() === 'ar' ? profile.journey_ar : profile.journey_en;
    narr.innerHTML = journey ? '<p>' + esc(journey) + '</p>' : '';
    grid.innerHTML = '';
    (sections || []).filter(s => s && s.visible).sort((a, b) => a.sort_order - b.sort_order).forEach(s => {
      const title = L() === 'ar' ? (s.title_ar || s.title_en) : (s.title_en || s.title_ar);
      const body = L() === 'ar' ? (s.body_ar || s.body_en) : (s.body_en || s.body_ar);
      const card = document.createElement('div');
      card.className = 'about-card';
      card.innerHTML = '<h3><span>' + esc(title) + '</span></h3><p>' + esc(body) + '</p>';
      grid.appendChild(card);
    });
  }

  // ---------- project preview modal ----------
  window.openProjModal = function (i) {
    const list = window._projData || [];
    const p = list[i];
    if (!p) return;
    const title = L() === 'ar' ? (p.title_ar || p.title_en) : (p.title_en || p.title_ar);
    const desc = L() === 'ar' ? (p.desc_ar || p.desc_en) : (p.desc_en || p.desc_ar);
    const details = L() === 'ar' ? (p.details_ar || p.details_en) : (p.details_en || p.details_ar);
    const tags = (p.tags || '').split(',').map(t => t.trim()).filter(Boolean);
    const tagC = String(p.tag_colors || '').split(',').map(t => t.trim()).filter(Boolean);
    const pc = p.color || '#7c3aed';
    let media = '';
    if (p.media_type === 'video' && (p.video_url || p.image_url)) {
      media = '<video src="' + mediaUrl(p.video_url || p.image_url) + '" controls autoplay loop playsinline></video>';
    } else if (p.image_url) {
      media = '<img src="' + mediaUrl(p.image_url) + '" alt="">';
    }
    const links = [];
    if (p.download_url) links.push('<a class="plink" href="' + esc(p.download_url) + '" target="_blank" rel="noopener">Download ↗</a>');
    if (p.github_url) links.push('<a class="plink" href="' + esc(p.github_url) + '" target="_blank" rel="noopener">GitHub ↗</a>');
    if (p.external_url) links.push('<a class="plink" href="' + esc(p.external_url) + '" target="_blank" rel="noopener">Live ↗</a>');
    document.getElementById('pmMedia').innerHTML = media;
    document.getElementById('pmTitle').textContent = title;
    document.getElementById('pmDesc').textContent = details || desc || '';
    document.getElementById('pmTags').innerHTML = tags.map((t, i2) => {
      const c = tagC[i2] || pc;
      return '<span class="ptag" style="--tcr:' + hexRgb(c) + '">' + esc(t) + '</span>';
    }).join('');
    document.getElementById('pmLinks').innerHTML = links.join('');
    document.getElementById('projModal').style.display = 'flex';
  };
  window.closeProjModal = function () { document.getElementById('projModal').style.display = 'none'; };
  window.exitPreview = function () {
    localStorage.removeItem('v0id_preview');
    document.getElementById('previewBanner').style.display = 'none';
    location.reload();
  };

// ============================================================
  //  MUSIC — single floating glass volume widget
  //  (playlist queue + trim segments + one compact fixed control)
  // ============================================================
  let audio = null;
  let playlist = [];
  let plIndex = -1;        // -1 => playing main track from settings only
  let trimStart = 0;
  let trimEnd = 0;         // 0 => play the whole track

  const aw = {
    root: document.getElementById('audioWidget'),
    btn: document.getElementById('awToggle'),
    eq: document.getElementById('awEq'),
    mute: document.getElementById('awMute'),
    vol: document.getElementById('awVol'),
  };

  function hexRgb(hex) {
    const m = (hex || '').replace('#', '');
    if (m.length === 3) return parseInt(m[0] + m[0], 16) + ',' + parseInt(m[1] + m[1], 16) + ',' + parseInt(m[2] + m[2], 16);
    if (m.length === 6) return parseInt(m.slice(0, 2), 16) + ',' + parseInt(m.slice(2, 4), 16) + ',' + parseInt(m.slice(4, 6), 16);
    return '124,58,237';
  }

  function showWidget(show) { if (aw.root) aw.root.style.display = show ? 'flex' : 'none'; }

  function setAWTrack(t) { if (aw.root) aw.root.title = t || 'v0id Music'; }

  function setPlayIcon(playing) {
    if (aw.btn) aw.btn.innerHTML = playing
      ? '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    if (aw.eq) aw.eq.classList.toggle('playing', playing);
    if (aw.root) aw.root.classList.toggle('is-playing', playing);
  }

  function syncVol() {
    if (aw.vol && audio) aw.vol.value = audio.volume;
    updateMuteIcon();
  }

  function updateMuteIcon() {
    if (!aw.mute) return;
    const muted = !audio || audio.muted || audio.volume === 0;
    aw.mute.classList.toggle('muted', muted);
    aw.mute.innerHTML = muted
      ? '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3z"/><path d="M16 8l6 8M22 8l-6 8"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zM16.5 12a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z"/></svg>';
  }

  function bindWidget() {
    if (!aw.root) return;
    if (aw.btn) aw.btn.addEventListener('click', () => {
      if (audio) { if (audio.paused) audio.play().catch(() => {}); else audio.pause(); }
    });
    if (aw.root) aw.root.addEventListener('click', (e) => {
      if (e.target === aw.root || e.target.closest('.aw-eq')) aw.root.classList.toggle('open');
    });
    if (aw.mute) aw.mute.addEventListener('click', () => {
      if (!audio) return;
      audio.muted = !audio.muted;
      updateMuteIcon();
    });
    if (aw.vol) aw.vol.addEventListener('input', () => {
      if (audio) { audio.volume = parseFloat(aw.vol.value); if (audio.volume > 0) audio.muted = false; updateMuteIcon(); }
    });
  }

  function loadTrack(index, s) {
    const t = playlist[index];
    if (!t) return;
    plIndex = index;
    trimStart = parseFloat(t.start) || parseFloat(s.music_start) || 0;
    trimEnd = parseFloat(t.end) || parseFloat(s.music_end) || 0;
    if (audio) { audio.pause(); audio = null; }
    audio = new Audio(mediaUrl(t.url));
    audio.volume = s.music_volume != null ? s.music_volume : 0.5;
    setAWTrack(t.title || s.music_title || 'v0id Music');
    syncVol();
    audio.addEventListener('timeupdate', () => {
      if (trimEnd > 0 && audio.currentTime >= trimEnd) { if (playlist.length) next(); else { audio.pause(); audio.currentTime = trimStart || 0; setPlayIcon(false); } }
    });
    audio.addEventListener('loadedmetadata', () => {
      if (trimStart > 0 && audio.duration && trimStart < audio.duration) audio.currentTime = trimStart;
    });
    audio.addEventListener('ended', () => { if (playlist.length) next(); else { audio.currentTime = trimStart || 0; audio.pause(); setPlayIcon(false); } });
    audio.addEventListener('play', () => setPlayIcon(true));
    audio.addEventListener('pause', () => setPlayIcon(false));
    audio.play().catch(() => {});
  }

  function next() { if (playlist.length && plIndex >= 0) loadTrack((plIndex + 1) % playlist.length, DATA.settings); }
  function prev() { if (playlist.length && plIndex >= 0) loadTrack((plIndex - 1 + playlist.length) % playlist.length, DATA.settings); }

  function initMusic(s) {
    if (!s) return;
    const pl = (DATA.playlist || []).filter(t => t && t.visible && t.url);
    if (pl.length) {
      playlist = pl;
      showWidget(true);
      bindWidget();
      loadTrack(0, DATA.settings);
      return;
    }
    if (!s.music_url) return;
    showWidget(true);
    bindWidget();
    playlist = [];
    plIndex = -1;
    trimStart = parseFloat(s.music_start) || 0;
    trimEnd = parseFloat(s.music_end) || 0;
    audio = new Audio(mediaUrl(s.music_url));
    audio.volume = s.music_volume != null ? s.music_volume : 0.5;
    setAWTrack(s.music_title || 'v0id Music');
    syncVol();
    audio.addEventListener('timeupdate', () => {
      if (trimEnd > 0 && audio.currentTime >= trimEnd) { audio.pause(); audio.currentTime = trimStart || 0; setPlayIcon(false); }
    });
    audio.addEventListener('loadedmetadata', () => {
      if (trimStart > 0 && audio.duration && trimStart < audio.duration) audio.currentTime = trimStart;
    });
    audio.addEventListener('ended', () => { audio.currentTime = trimStart || 0; audio.pause(); setPlayIcon(false); });
    audio.addEventListener('play', () => setPlayIcon(true));
    audio.addEventListener('pause', () => setPlayIcon(false));
  }
  // ============================================================
  //  DISCORD — Lanyard Rich Presence
  // ============================================================
  function initDiscord(userId) {
    if (!userId) return;
    const present = document.getElementById('presence');
    const statLabel = document.getElementById('presenceText');
    present.style.display = 'inline-flex';
    fetch(CFG.LANYARD_API + userId).then(r => r.json()).then(j => {
      if (!j.success || !j.data) return;
      const d = j.data;
      present.className = 'presence ' + (d.discord_status || 'offline');
      const act = (d.activities || []).find(a => a.type === 0 || a.type === 4);
      if (act) {
        let txt = act.name || '';
        if (act.details) txt += ' — ' + act.details;
        if (act.state) txt += ' (' + act.state + ')';
        statLabel.textContent = txt;
        const stEl = document.getElementById('statusText');
        const chip = document.getElementById('statusChip');
        if (stEl && chip) { let s = act.state || act.details || act.name; if (s) { chip.style.display = 'inline-flex'; stEl.textContent = s; } }
      } else {
        statLabel.textContent = (d.discord_status === 'online' || d.discord_status === 'idle' || d.discord_status === 'dnd')
          ? 'Online'
          : i18n.t('offline');
      }
    }).catch(() => {});
  }

  // ============================================================
  //  LIVE VIEW COUNTER
  // ============================================================
  async function initViewCounter() {
    const el = document.getElementById('viewCounter');
    if (!el) return;
    let views = null;
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('increment_views');
        if (!error && typeof data === 'number') views = data;
      } catch (e) {}
    }
    if (views == null) {
      try { views = parseInt(localStorage.getItem('v0id_views') || '0', 10) + 1; } catch (e) { views = 1; }
      try { localStorage.setItem('v0id_views', String(views)); } catch (e) {}
    }
    const c = document.getElementById('vcCount');
    if (c) c.textContent = Number(views || 0).toLocaleString();
    const lb = document.getElementById('vcLabel');
    if (lb) lb.textContent = i18n.lang === 'ar' ? 'زيارة' : 'views';
    el.style.display = 'inline-flex';
  }

  // ============================================================
  //  CUSTOM CURSOR GLOW TRAIL
  // ============================================================
  function initCursor(settings) {
    const enabled = settings ? settings.cursor_enabled !== false : true;
    const canvas = document.getElementById('cursorCanvas');
    if (!canvas || !enabled) return;
    const color = (settings && settings.cursor_color) ||
      (getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#7c3aed');
    const ctx = canvas.getContext('2d');
    let w, h;
    const parts = [];
    function resize() { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; }
    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('pointermove', (e) => {
      for (let i = 0; i < 3; i++) {
        parts.push({
          x: e.clientX + (Math.random() - 0.5) * 6,
          y: e.clientY + (Math.random() - 0.5) * 6,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          life: 1,
        });
      }
    });
    (function loop() {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        p.x += p.vx; p.y += p.vy; p.life -= 0.02;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0, p.life) * 5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = Math.max(0, p.life) * 0.5;
        ctx.shadowColor = color; ctx.shadowBlur = 14;
        ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      for (let i = parts.length - 1; i >= 0; i--) { if (parts[i].life <= 0) parts.splice(i, 1); }
      requestAnimationFrame(loop);
    })();
  }

  // ============================================================
  //  MICRO CLICK SOUNDS
  // ============================================================
  let sfxOn = true;
  function initSfx(settings) {
    sfxOn = settings ? settings.sound_fx !== false : true;
    let ac = null;
    function blip(freq, dur, vol) {
      try {
        if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ac.createOscillator(), g = ac.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        g.gain.value = vol;
        osc.connect(g); g.connect(ac.destination);
        osc.start();
        g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + (dur || 0.08));
        osc.stop(ac.currentTime + (dur || 0.08));
      } catch (e) {}
    }
    document.addEventListener('pointerover', (e) => {
      if (!sfxOn) return;
      if (e.target && e.target.closest && e.target.closest('.soc, .nav-links button, .lang-btn, a, button')) blip(1500, 0.03, 0.018);
    });
    document.addEventListener('pointerdown', (e) => {
      if (!sfxOn) return;
      if (e.target && e.target.closest && e.target.closest('.soc, .nav-links button, .lang-btn, a, button')) blip(950, 0.05, 0.028);
    });
    window.toggleSfx = function () { sfxOn = !sfxOn; try { blip(sfxOn ? 1300 : 600, 0.06, 0.04); } catch (e) {} return sfxOn; };
  }

  // ============================================================
  //  LOAD DATA
  // ============================================================
  async function loadAll() {
    if (!supabase) {
      const D = window.DEMO_DATA;
      if (!D) {
        document.getElementById('footerNote').textContent = '⚠ Supabase not configured — open js/config.js and add your keys.';
        return;
      }
      // offline preview: use demo data (mirror of schema.sql seed)
      DATA.settings = D.settings;
      DATA.profile = D.profile;
      DATA.socials = D.socials;
      DATA.projects = D.projects;
      DATA.about = D.about;
      DATA.playlist = D.playlist || [];
      let PREVIEW = null;
      try { PREVIEW = JSON.parse(localStorage.getItem('v0id_preview') || 'null'); } catch (e) {}
      if (PREVIEW && PREVIEW.settings) DATA.settings = Object.assign({}, D.settings, PREVIEW.settings);
      if (PREVIEW && PREVIEW.profile) DATA.profile = Object.assign({}, D.profile, PREVIEW.profile);
      if (PREVIEW && Array.isArray(PREVIEW.projects)) DATA.projects = PREVIEW.projects;
      applyTheme(DATA.settings);
      renderHome(DATA.profile);
      renderSocials(DATA.socials);
      renderProjects(DATA.projects);
      renderAbout(DATA.profile, DATA.about);
      initMusic(DATA.settings);
      initDiscord(DATA.settings.discord_user_id);
      initViewCounter();
      initCursor(DATA.settings);
      initSfx(DATA.settings);
      document.getElementById('footerNote').textContent = 'معاينة تجريبية — اربط Supabase من js/config.js للوضع الحي';
      return;
    }
    try {
      const [s, p, soc, proj, ab] = await Promise.all([
        supabase.from('settings').select('*').eq('id', 1).single(),
        supabase.from('profile').select('*').eq('id', 1).single(),
        supabase.from('socials').select('*').order('sort_order'),
        supabase.from('projects').select('*').order('sort_order'),
        supabase.from('about_sections').select('*').order('sort_order'),
      ]);
      DATA.settings = s.data || s; // .single() returns data directly or {data,...}
      DATA.profile = p.data;
      DATA.socials = soc.data || [];
      DATA.projects = proj.data || [];
      DATA.about = ab.data || [];
      DATA.playlist = [];
      try {
        const { data: pl } = await supabase.from('music_tracks').select('*').order('sort_order');
        DATA.playlist = (pl || []).map(t => ({ url: t.url, title: t.title, cover: t.cover, start: t.start_sec, end: t.end_sec, visible: t.visible }));
      } catch (e) { /* table not migrated yet — ignore */ }

      // live preview (unsaved admin form edits)
      let PREVIEW = null;
      try { PREVIEW = JSON.parse(localStorage.getItem('v0id_preview') || 'null'); } catch (e) {}
      if (PREVIEW && PREVIEW.settings) { DATA.settings = Object.assign({}, DATA.settings, PREVIEW.settings); }
      if (PREVIEW && PREVIEW.profile) { DATA.profile = Object.assign({}, DATA.profile, PREVIEW.profile); }
      if (PREVIEW && Array.isArray(PREVIEW.projects)) { DATA.projects = PREVIEW.projects; }
      if (PREVIEW && PREVIEW.profile) {
        const b = document.getElementById('previewBanner');
        if (b) b.style.display = 'flex';
      }

      applyTheme(DATA.settings);
      renderHome(DATA.profile);
      renderSocials(DATA.socials);
      renderProjects(DATA.projects);
      renderAbout(DATA.profile, DATA.about);
      initMusic(DATA.settings);
      initDiscord(DATA.settings.discord_user_id);
      initViewCounter();
      initCursor(supabase ? DATA.settings : null);
      initSfx(DATA.settings);
    } catch (e) {
      document.getElementById('footerNote').textContent = '⚠ Error loading data: ' + e.message;
    }
  }

  // ---------- dynamic labels per language ----------
  function refreshTexts() {
    // nav buttons have flags NOT i18n keys; set manually
    const nav = {
      home: i18n.t('nav_home'),
      projects: i18n.t('nav_projects'),
      about: i18n.t('nav_about'),
    };
    document.querySelectorAll('[data-nav]').forEach(b => {
      b.textContent = nav[b.getAttribute('data-nav')];
    });
    const pt = document.getElementById('projectsTitle');
    const at = document.getElementById('aboutTitle');
    if (pt) pt.textContent = i18n.t('nav_projects');
    if (at) at.textContent = i18n.t('nav_about');
    if (DATA.profile) renderHome(DATA.profile);
    renderSocials(DATA.socials);
    renderProjects(DATA.projects);
    renderAbout(DATA.profile, DATA.about);
  }

  // ---------- boot ----------
  i18n.init();
  i18n.onLangChange(() => refreshTexts());
  refreshTexts();

  document.querySelectorAll('[data-nav]').forEach(b => {
    b.addEventListener('click', () => Go.to(b.getAttribute('data-nav')));
  });
  document.querySelector('.lang-btn').addEventListener('click', () => {
    i18n.setLang(i18n.lang === 'ar' ? 'en' : 'ar');
  });

  window.Go = Go; // brand click
  loadAll();
})();
