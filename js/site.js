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
    if (CFG.SUPABASE_URL.indexOf('PASTE_') === -1) {
      return CFG.SUPABASE_URL.replace(/\/$/, '') + '/storage/v1/object/public/media/' + path.replace(/^\//, '');
    }
    return path;
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
      a.setAttribute('style', '--sc:' + (s.color || '#7c3aed'));
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
      const tags = (p.tags || '').split(',').map(t => t.trim()).filter(Boolean);
      const card = document.createElement('div');
      card.className = 'project';
      card.setAttribute('style', '--pc:' + (p.color || '#7c3aed'));
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
      if (tags.length) html += '<div class="ptags">' + tags.map(t => '<span class="ptag">' + esc(t) + '</span>').join('') + '</div>';
      html += '</div><div class="pfoot">';
      if (p.download_url) html += '<a class="plink" href="' + esc(p.download_url) + '" target="_blank" rel="noopener">Download ↗</a>';
      if (p.github_url) html += '<a class="plink" href="' + esc(p.github_url) + '" target="_blank" rel="noopener">GitHub ↗</a>';
      if (p.external_url) html += '<a class="plink" href="' + esc(p.external_url) + '" target="_blank" rel="noopener">Live ↗</a>';
      html += '</div>';
      card.innerHTML = html;
      grid.appendChild(card);
    });
  }

  // ---------- about ----------
  function renderAbout(profile, sections) {
    const narr = document.getElementById('aboutNarrative');
    const grid = document.getElementById('aboutGrid');
    if (!narr || !grid || !profile) return;
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

  // ============================================================
  //  MUSIC PLAYER
  // ============================================================
  let audio = null;
  const musicUI = {
    bar: document.getElementById('musicbar'),
    toggle: document.getElementById('musicToggle'),
    seek: document.getElementById('musicSeek'),
    vol: document.getElementById('musicVol'),
    track: document.getElementById('musicTrack'),
    time: document.getElementById('musicTime'),
    dur: document.getElementById('musicDur'),
  };

  function fmt(s) { if (!isFinite(s)) return '0:00'; const m = Math.floor(s / 60); return m + ':' + String(Math.floor(s % 60)).padStart(2, '0'); }

  function initMusic(s) {
    if (!s.music_url) return;
    audio = new Audio(mediaUrl(s.music_url));
    audio.volume = s.music_volume != null ? s.music_volume : 0.5;
    musicUI.vol.value = audio.volume;
    // track name
    const n = decodeURIComponent(s.music_url.split('/').pop().split('?')[0]);
    musicUI.track.textContent = n || 'Music';
    musicUI.bar.style.display = 'block';

    audio.addEventListener('timeupdate', () => {
      musicUI.time.textContent = fmt(audio.currentTime);
      if (audio.duration) musicUI.seek.value = (audio.currentTime / audio.duration) * 100;
    });
    audio.addEventListener('loadedmetadata', () => { musicUI.dur.textContent = fmt(audio.duration); });
    audio.addEventListener('ended', () => { audio.currentTime = 0; audio.pause(); setPlayIcon(false); });

    musicUI.toggle.addEventListener('click', () => {
      if (audio.paused) { audio.play(); } else { audio.pause(); }
    });
    audio.addEventListener('play', () => setPlayIcon(true));
    audio.addEventListener('pause', () => setPlayIcon(false));

    musicUI.seek.addEventListener('input', () => {
      if (audio.duration) audio.currentTime = (musicUI.seek.value / 100) * audio.duration;
    });
    musicUI.vol.addEventListener('input', () => { audio.volume = parseFloat(musicUI.vol.value); });

    // autoplay: browsers block without gesture; try once on first interaction
    if (s.music_autoplay) {
      const tryAuto = () => { audio.play().catch(() => {}); document.removeEventListener('pointerdown', tryAuto); };
      document.addEventListener('pointerdown', tryAuto);
    }
  }

  function setPlayIcon(playing) {
    musicUI.toggle.innerHTML = playing
      ? '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
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
      } else {
        statLabel.textContent = (d.discord_status === 'online' || d.discord_status === 'idle' || d.discord_status === 'dnd')
          ? 'Online'
          : i18n.t('offline');
      }
    }).catch(() => {});
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
      applyTheme(DATA.settings);
      renderHome(DATA.profile);
      renderSocials(DATA.socials);
      renderProjects(DATA.projects);
      renderAbout(DATA.profile, DATA.about);
      initMusic(DATA.settings);
      initDiscord(DATA.settings.discord_user_id);
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
      applyTheme(DATA.settings);
      renderHome(DATA.profile);
      renderSocials(DATA.socials);
      renderProjects(DATA.projects);
      renderAbout(DATA.profile, DATA.about);
      initMusic(DATA.settings);
      initDiscord(DATA.settings.discord_user_id);
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