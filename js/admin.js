// ============================================================
//  v0id Bio-Link — ADMIN DASHBOARD
//  Owner-only control panel: full CRUD for profile, socials,
//  projects, about sections, appearance, media, discord.
// ============================================================

(function () {
  const CFG = window.APP_CONFIG || {};
  const hasKeys = CFG.SUPABASE_URL && CFG.SUPABASE_URL.indexOf('PASTE_') === -1;
  if (!window.supabase || !hasKeys) {
    document.getElementById('loginErr') && (document.getElementById('loginErr').textContent =
      '⚠ Open js/config.js and paste your Supabase URL + anon key.');
    return;
  }
  const supabase = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);

  let session = supabase.auth.getSession().then ? null : null;
  let editMode = null;   // { table, id }

  // ---------- tiny utils ----------
  const $ = (id) => document.getElementById(id);
  const val = (id) => { const e = $(id); return e ? e.value : ''; };
  const lastErr = () => { const e = $('loginErr'); return e; };

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2600);
  }

  function langBtnLabel() {
    const b = document.querySelector('.lang-btn');
  }

  // ============================================================
  //  AUTH (owner)
  // ============================================================
  window.Auth = {
    mode: 'login',
    toggleMode() {
      this.mode = this.mode === 'login' ? 'signup' : 'login';
      $('loginBtn').textContent = this.mode === 'login' ? 'Login' : 'إنشاء حساب المالك';
      $('loginSub').textContent = this.mode === 'login'
        ? 'لوحة التحكم — سجّل الدخول لإدارة الموقع. أول مرة؟ اضغط ← أنشئ حساب المالك'
        : 'أنشئ حسابك (لا يُنشأ إلا مرة واحدة — هذا أنت فقط). ثم سجّل الدخول مباشرة.';
      $('loginAltLink').textContent = this.mode === 'login' ? 'أنشئ حساب المالك' : 'سجّل الدخول';
    },
    async submit() {
      const err = lastErr();
      err.textContent = '';
      const email = val('loginEmail').trim();
      const pass = val('loginPass');
      if (!email || !pass) { err.textContent = 'أدخل البريد وكلمة المرور'; return; }
      try {
        if (this.mode === 'login') {
          const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
          if (error) err.textContent = error.message;
        } else {
          const { error } = await supabase.auth.signUp({ email, password: pass });
          if (error) err.textContent = error.message;
          else { err.textContent = 'تم إنشاء الحساب! سجّل الدخول الآن.'; this.mode = 'login'; this.toggleMode(); }
        }
      } catch (e) { err.textContent = e.message; }
    },
  };

  async function loginEnter(e) { if (e.key === 'Enter') Auth.submit(); }

  // ============================================================
  //  NAVIGATION between panels
  // ============================================================
  function showPanel(name) {
    document.querySelectorAll('.panel').forEach(p => p.style.display = p.getAttribute('data-panel') === name ? 'block' : 'none');
    document.querySelectorAll('[data-panel]').forEach(b => b.classList.toggle('active', b.getAttribute('data-panel') === name));
  }

  // ============================================================
  //  SESSION STATE MACHINE
  // ============================================================
  document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session: s } } = await supabase.auth.getSession();
    setSession(s);
    $('loginBtn').addEventListener('click', () => Auth.submit());
    $('loginPass').addEventListener('keydown', loginEnter);
    $('logoutBtn').addEventListener('click', async () => {
      await supabase.auth.signOut();
      setSession(null);
    });
    document.querySelectorAll('[data-panel]').forEach(b => {
      b.addEventListener('click', () => { if (!b.classList.contains('logout')) showPanel(b.getAttribute('data-panel')); });
    });

    supabase.auth.onAuthStateChange((_e, sess) => setSession(sess));
  });

  function setSession(sess) {
    if (sess && sess.user) {
      $('loginScreen').style.display = 'none';
      $('dash').style.display = 'flex';
      verifyOwner(sess.user).then(loadAll);
    } else {
      $('loginScreen').style.display = 'flex';
      $('dash').style.display = 'none';
      editMode = null;
    }
  }

  // first login becomes THE owner; everyone else gets kicked out
  async function verifyOwner(user) {
    try {
      const { data: claimed } = await supabase.rpc('register_owner');
      const { data: ok } = await supabase.rpc('is_owner');
      if (claimed) { toast('تم تفعيل صلاحية المالك ✓'); return; }
      if (!ok) {
        toast('هذا الحساب ليس المالك.');
        await supabase.auth.signOut();
      }
    } catch (e) { toast('لا يمكن التحقق من المالك: ' + e.message); }
  }

  // ============================================================
  //  LOAD ALL
  // ============================================================
  async function loadAll() {
    try {
      await loadProfile();
      await loadSocials();
      await loadProjects();
      await loadAbout();
      await loadSettings();
      await loadPlaylist();
    } catch (e) { toast('خطأ في التحميل: ' + e.message); }
  }

  // ============================================================
  //  PROFILE
  // ============================================================
  window.Profile = {};
  async function loadProfile() {
    const { data } = await supabase.from('profile').select('*').eq('id', 1).single();
    if (!data) return;
    const p = data;
    setVal('pfAvatar', p.avatar_url);
    setVal('pfBadge', p.owner_badge);
    setVal('pfNameAr', p.display_name_ar);
    setVal('pfNameEn', p.display_name_en);
    setVal('pfLocAr', p.location_ar);
    setVal('pfLocEn', p.location_en);
    setVal('pfAge', p.age);
    setVal('pfOccAr', p.occupation_ar);
    setVal('pfOccEn', p.occupation_en);
    setVal('pfBioAr', p.bio_ar);
    setVal('pfBioEn', p.bio_en);
    setVal('pfGoalsAr', p.goals_ar);
    setVal('pfGoalsEn', p.goals_en);
    setVal('pfJourneyAr', p.journey_ar);
    setVal('pfJourneyEn', p.journey_en);
    setVal('pfSkillsAr', p.skills_ar);
    setVal('pfSkillsEn', p.skills_en);
    setVal('pfStatus', p.status_text);
    setVal('pfAboutImg', p.about_img_url);
    setVal('pfAboutW', p.about_img_w);
    setVal('pfAboutH', p.about_img_h);
    setVal('pfAboutAlign', p.about_img_align);
    setVal('pfAboutFit', p.about_img_fit);
    Avatar.preview();
    AboutImg.preview();
  }

  // live avatar preview (solves "image doesn't show in profile")
  window.Avatar = {
    preview() {
      const wrap = $('pfAvatarPrev');
      if (!wrap) return;
      const src = $('pfAvatar') ? val('pfAvatar') : '';
      wrap.innerHTML = src
        ? '<img src="' + esc(src) + '" alt="avatar" class="avatar-prev" onerror="this.style.display=\'none\'">'
        : '<span class="hint">سيظهر هنا معاينة الصورة التي ترفعها أو تلصقها.</span>';
    },
    fileChange: (() => {
      const inp = $('pfAvatarFile');
      if (!inp) return null;
      inp.addEventListener('change', () => {
        const f = inp.files && inp.files[0];
        if (!f) return;
        const rd = new FileReader();
        rd.onload = (ev) => { const w = $('pfAvatarPrev'); if (w) w.innerHTML = '<img src="' + ev.target.result + '" alt="avatar" class="avatar-prev">'; };
        rd.readAsDataURL(f);
      });
      return null;
    })(),
  };

  // live preview for the About Me image + controls
  window.AboutImg = {
    preview() {
      const wrap = $('pfAboutPrev');
      if (!wrap) return;
      const src = $('pfAboutImg') ? val('pfAboutImg') : '';
      if (!src) { wrap.innerHTML = '<span class="hint">ستظهر هنا معاينة صورة قسم "عني".</span>'; return; }
      const w = parseInt(val('pfAboutW')) || 0;
      const h = parseInt(val('pfAboutH')) || 0;
      wrap.innerHTML = '<div style="max-width:100%; display:flex; justify-content:center">' +
        '<img src="' + esc(src) + '" alt="about" style="border-radius:14px; border:1px solid rgba(255,255,255,0.15); ' +
        (w ? 'width:' + w + 'px;' : '') + (h ? 'height:' + h + 'px;' : '') +
        'object-fit:' + (val('pfAboutFit') || 'cover') + '; max-width:100%;" onerror="this.style.display=\'none\'">' +
        '</div>';
    },
    fileChange: (() => {
      const inp = $('pfAboutImgFile');
      if (!inp) return null;
      inp.addEventListener('change', () => {
        const f = inp.files && inp.files[0];
        if (!f) return;
        const rd = new FileReader();
        rd.onload = (ev) => {
          const w = parseInt(val('pfAboutW')) || 0;
          const h = parseInt(val('pfAboutH')) || 0;
          const wp = $('pfAboutPrev');
          if (wp) wp.innerHTML = '<div style="max-width:100%; display:flex; justify-content:center"><img src="' + ev.target.result + '" style="border-radius:14px; border:1px solid rgba(255,255,255,0.15); ' +
            (w ? 'width:' + w + 'px;' : '') + (h ? 'height:' + h + 'px;' : '') + 'object-fit:' + (val('pfAboutFit') || 'cover') + '; max-width:100%;"></div>';
        };
        rd.readAsDataURL(f);
      });
      return null;
    })(),
  };

  ['pfAboutW', 'pfAboutH', 'pfAboutFit'].forEach(id => {
    const e = $(id);
    if (e) e.addEventListener('input', () => AboutImg.preview());
  });

  window.Profile.save = async function () {
    const img = await uploadInput('pfAvatarFile', '/avatars/avatar_' + Date.now());
    const avatar = img || val('pfAvatar');
    const aboutImg = await uploadInput('pfAboutImgFile', '/about/about_' + Date.now());
    if (img) setVal('pfAvatar', img);
    if (aboutImg) setVal('pfAboutImg', aboutImg);
    const payload = {
      avatar_url: avatar,
      owner_badge: val('pfBadge'),
      status_text: val('pfStatus').trim(),
      display_name_ar: val('pfNameAr'),
      display_name_en: val('pfNameEn'),
      location_ar: val('pfLocAr'),
      location_en: val('pfLocEn'),
      age: val('pfAge'),
      occupation_ar: val('pfOccAr'),
      occupation_en: val('pfOccEn'),
      bio_ar: val('pfBioAr'),
      bio_en: val('pfBioEn'),
      goals_ar: val('pfGoalsAr'),
      goals_en: val('pfGoalsEn'),
      journey_ar: val('pfJourneyAr'),
      journey_en: val('pfJourneyEn'),
      skills_ar: val('pfSkillsAr'),
      skills_en: val('pfSkillsEn'),
      about_img_url: val('pfAboutImg').trim() || null,
      about_img_w: parseInt(val('pfAboutW')) || 0,
      about_img_h: parseInt(val('pfAboutH')) || 0,
      about_img_align: val('pfAboutAlign') || 'center',
      about_img_fit: val('pfAboutFit') || 'cover',
    };
    const base = Object.assign({}, payload);
    delete base.status_text; delete base.about_img_url; delete base.about_img_w;
    delete base.about_img_h; delete base.about_img_align; delete base.about_img_fit;
    const res = await updateRow('profile', payload, base);
    if (res && res.error) { toast('خطأ: ' + res.error.message); return; }
    toast('تم حفظ الملف الشخصي ✓');
  };

  // ============================================================
  //  SOCIALS
  // ============================================================
  window.Socials = {};
  async function loadSocials() {
    const { data } = await supabase.from('socials').select('*').order('sort_order');
    const box = $('scList');
    box.innerHTML = '';
    (data || []).forEach(s => {
      const row = document.createElement('div');
      row.className = 'list-item';
      row.innerHTML =
        '<div class="li-info"><div class="li-title"><span class="color-dot" style="background:' + (s.color || '#7c3aed') + '; color:' + (s.color || '#7c3aed') + '"></span>' +
        esc(s.label || s.platform) + ' <span style="color:var(--muted); font-weight:400; font-size:12px">' + esc(s.platform) + '</span></div>' +
        '<div class="li-sub">' + esc(s.url) + '</div></div>' +
        '<div class="li-actions">' +
        '<button class="btn btn-ghost btn-sm" onclick="Socials.edit(\'' + s.id + '\')">تعديل</button>' +
        '<button class="btn btn-danger btn-sm" onclick="Socials.del(\'' + s.id + '\')">حذف</button></div>';
      box.appendChild(row);
    });
  }

  window.Socials.add = async function () {
    const { error } = await supabase.from('socials').insert({
      platform: val('scPlatform'),
      label: val('scLabel'),
      url: val('scUrl'),
      color: val('scColor'),
      sort_order: parseInt(val('scSort') || '1'),
      icon: val('scIcon'),
    });
    if (error) { toast('خطأ: ' + error.message); return; }
    toast('أُضيف الرابط ✓');
    clearForm(['scLabel', 'scUrl', 'scIcon', 'scSort']);
    loadSocials();
  };

  window.Socials.edit = async function (id) {
    const { data } = await supabase.from('socials').select('*').eq('id', id).single();
    if (!data) return;
    editMode = { table: 'socials', id, row: data };
    setVal('scPlatform', data.platform);
    setVal('scLabel', data.label);
    setVal('scUrl', data.url);
    setVal('scColor', data.color);
    setVal('scSort', String(data.sort_order));
    setVal('scIcon', data.icon);
    $('scAddTitle').textContent = 'تعديل الرابط';
    const btn = document.querySelector('#scPanel .btn-primary');
    btn.textContent = 'حفظ التعديل';
    btn.onclick = () => Socials.update();
  };

  window.Socials.update = async function () {
    if (!editMode || editMode.table !== 'socials') return;
    const { error } = await supabase.from('socials').update({
      platform: val('scPlatform'),
      label: val('scLabel'),
      url: val('scUrl'),
      color: val('scColor'),
      sort_order: parseInt(val('scSort') || '1'),
      icon: val('scIcon'),
    }).eq('id', editMode.id);
    if (error) { toast('خطأ: ' + error.message); return; }
    toast('تم التعديل ✓');
    editMode = null;
    clearForm(['scLabel', 'scUrl', 'scIcon', 'scSort']);
    document.querySelector('#scPanel .btn-primary').textContent = 'إضافة الرابط';
    document.querySelector('#scPanel .btn-primary').onclick = () => Socials.add();
    loadSocials();
  };

  window.Socials.del = async function (id) {
    if (!confirm('حذف هذا الرابط؟')) return;
    const { error } = await supabase.from('socials').delete().eq('id', id);
    if (error) { toast('خطأ: ' + error.message); return; }
    toast('حُذف الرابط');
    loadSocials();
  };

  // ============================================================
  //  PROJECTS
  // ============================================================
  window.Projects = {};
  async function loadProjects() {
    const { data } = await supabase.from('projects').select('*').order('sort_order');
    const box = $('prList');
    box.innerHTML = '';
    (data || []).forEach(p => {
      const row = document.createElement('div');
      row.className = 'list-item';
      const title = p.title_ar || p.title_en || '';
      row.innerHTML =
        '<div class="li-info"><div class="li-title"><span class="color-dot" style="background:' + (p.color || '#7c3aed') + '; color:' + (p.color || '#7c3aed') + '"></span>' +
        esc(title) + '</div><div class="li-sub">' + esc(p.tags) + '</div></div>' +
        '<div class="li-actions">' +
        '<button class="btn btn-ghost btn-sm" onclick="Projects.edit(\'' + p.id + '\')">تعديل</button>' +
        '<button class="btn btn-danger btn-sm" onclick="Projects.del(\'' + p.id + '\')">حذف</button></div>';
      box.appendChild(row);
    });
  }

  window.Projects.add = async function () {
    const img = await uploadInput('prImgFile', '/projects/project_' + Date.now());
    const vid = await uploadInput('prVidFile', '/projects/project_' + Date.now());
    const { error } = await supabase.from('projects').insert({
      title_ar: val('prTitleAr'),
      title_en: val('prTitleEn'),
      desc_ar: val('prDescAr'),
      desc_en: val('prDescEn'),
      details_ar: val('prDetailsAr'),
      details_en: val('prDetailsEn'),
      tags: val('prTags'),
      tag_colors: val('prTagColors'),
      color: val('prColor'),
      media_type: val('prMediaType') || 'image',
      image_url: img || val('prImgUrl'),
      img_h: parseInt(val('prImgH')) || 0,
      video_url: vid || val('prVidUrl'),
      download_url: val('prDownload'),
      github_url: val('prGithub'),
      external_url: val('prExternal'),
      sort_order: parseInt(val('prSort') || '1'),
    });
    if (error) { toast('خطأ: ' + error.message); return; }
    toast('أُضيف المشروع ✓');
    clearForm(['prTitleAr', 'prTitleEn', 'prDescAr', 'prDescEn', 'prDetailsAr', 'prDetailsEn', 'prTags', 'prTagColors', 'prImgUrl', 'prVidUrl', 'prDownload', 'prGithub', 'prExternal', 'prSort', 'prImgH']);
    loadProjects();
  };

  window.Projects.edit = async function (id) {
    const { data } = await supabase.from('projects').select('*').eq('id', id).single();
    if (!data) return;
    editMode = { table: 'projects', id, row: data };
    setVal('prTitleAr', data.title_ar); setVal('prTitleEn', data.title_en);
    setVal('prDescAr', data.desc_ar); setVal('prDescEn', data.desc_en);
    setVal('prDetailsAr', data.details_ar); setVal('prDetailsEn', data.details_en);
    setVal('prTags', data.tags); setVal('prTagColors', data.tag_colors);
    setVal('prColor', data.color);
    setVal('prMediaType', data.media_type || 'image');
    setVal('prImgUrl', data.image_url);
    setVal('prImgH', data.img_h);
    setVal('prVidUrl', data.video_url);
    setVal('prDownload', data.download_url);
    setVal('prGithub', data.github_url);
    setVal('prExternal', data.external_url);
    setVal('prSort', String(data.sort_order));
    const btn = document.querySelector('#prPanel .btn-primary');
    btn.textContent = 'حفظ التعديل';
    btn.onclick = () => Projects.update();
  };

  window.Projects.update = async function () {
    if (!editMode || editMode.table !== 'projects') return;
    const img = await uploadInput('prImgFile', '/projects/project_' + Date.now());
    const vid = await uploadInput('prVidFile', '/projects/project_' + Date.now());
    const payload = {
      title_ar: val('prTitleAr'), title_en: val('prTitleEn'),
      desc_ar: val('prDescAr'), desc_en: val('prDescEn'),
      details_ar: val('prDetailsAr'), details_en: val('prDetailsEn'),
      tags: val('prTags'), tag_colors: val('prTagColors'), color: val('prColor'),
      media_type: val('prMediaType') || 'image',
      image_url: img || val('prImgUrl'),
      img_h: parseInt(val('prImgH')) || 0,
      video_url: vid || val('prVidUrl'),
      download_url: val('prDownload'), github_url: val('prGithub'),
      external_url: val('prExternal'),
      sort_order: parseInt(val('prSort') || '1'),
    };
    const base = Object.assign({}, payload);
    delete base.details_ar; delete base.details_en; delete base.tag_colors; delete base.img_h;
    const res = await updateRow('projects', payload, base, editMode.id);
    if (res && res.error) { toast('خطأ: ' + res.error.message); return; }
    toast('تم التعديل ✓');
    editMode = null;
    clearForm(['prTitleAr', 'prTitleEn', 'prDescAr', 'prDescEn', 'prDetailsAr', 'prDetailsEn', 'prTags', 'prTagColors', 'prImgUrl', 'prVidUrl', 'prDownload', 'prGithub', 'prExternal', 'prSort', 'prImgH']);
    const btn = document.querySelector('#prPanel .btn-primary');
    btn.textContent = 'إضافة المشروع';
    btn.onclick = () => Projects.add();
    loadProjects();
  };

  window.Projects.del = async function (id) {
    if (!confirm('حذف هذا المشروع؟')) return;
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) { toast('خطأ: ' + error.message); return; }
    toast('حُذف المشروع');
    loadProjects();
  };

  // ============================================================
  //  ABOUT SECTIONS
  // ============================================================
  window.About = {};
  async function loadAbout() {
    const { data } = await supabase.from('about_sections').select('*').order('sort_order');
    const box = $('abList');
    box.innerHTML = '';
    (data || []).forEach(s => {
      const row = document.createElement('div');
      row.className = 'list-item';
      row.innerHTML =
        '<div class="li-info"><div class="li-title">' + esc(s.title_ar || s.title_en) + '</div><div class="li-sub">' + esc((s.body_ar || '').slice(0, 80)) + '…</div></div>' +
        '<div class="li-actions">' +
        '<button class="btn btn-ghost btn-sm" onclick="About.edit(\'' + s.id + '\')">تعديل</button>' +
        '<button class="btn btn-danger btn-sm" onclick="About.del(\'' + s.id + '\')">حذف</button></div>';
      box.appendChild(row);
    });
  }

  window.About.add = async function () {
    const { error } = await supabase.from('about_sections').insert({
      title_ar: val('abTitleAr'), title_en: val('abTitleEn'),
      body_ar: val('abBodyAr'), body_en: val('abBodyEn'),
      icon: val('abIcon'), sort_order: parseInt(val('abSort') || '1'),
    });
    if (error) { toast('خطأ: ' + error.message); return; }
    toast('أُضيف القسم ✓');
    clearForm(['abTitleAr', 'abTitleEn', 'abBodyAr', 'abBodyEn', 'abIcon', 'abSort']);
    loadAbout();
  };

  window.About.edit = async function (id) {
    const { data } = await supabase.from('about_sections').select('*').eq('id', id).single();
    if (!data) return;
    editMode = { table: 'about', id };
    setVal('abTitleAr', data.title_ar); setVal('abTitleEn', data.title_en);
    setVal('abBodyAr', data.body_ar); setVal('abBodyEn', data.body_en);
    setVal('abIcon', data.icon); setVal('abSort', String(data.sort_order));
    const btn = document.querySelector('#abPanel .btn-primary');
    btn.textContent = 'حفظ التعديل';
    btn.onclick = () => About.update();
  };

  window.About.update = async function () {
    if (!editMode || editMode.table !== 'about') return;
    const { error } = await supabase.from('about_sections').update({
      title_ar: val('abTitleAr'), title_en: val('abTitleEn'),
      body_ar: val('abBodyAr'), body_en: val('abBodyEn'),
      icon: val('abIcon'), sort_order: parseInt(val('abSort') || '1'),
    }).eq('id', editMode.id);
    if (error) { toast('خطأ: ' + error.message); return; }
    toast('تم التعديل ✓');
    editMode = null;
    clearForm(['abTitleAr', 'abTitleEn', 'abBodyAr', 'abBodyEn', 'abIcon', 'abSort']);
    const btn = document.querySelector('#abPanel .btn-primary');
    btn.textContent = 'إضافة القسم';
    btn.onclick = () => About.add();
    loadAbout();
  };

  window.About.del = async function (id) {
    if (!confirm('حذف هذا القسم؟')) return;
    const { error } = await supabase.from('about_sections').delete().eq('id', id);
    if (error) { toast('خطأ: ' + error.message); return; }
    toast('حُذف القسم');
    loadAbout();
  };

  // ============================================================
  //  APPEARANCE
  // ============================================================
  window.Appearance = {};
  async function loadSettings() {
    const { data } = await supabase.from('settings').select('*').eq('id', 1).single();
    if (!data) return;
    const s = data;
    setVal('apAccent', s.color_accent); setVal('apBg', s.color_bg);
    setVal('apGlow', s.glow_intensity); setVal('apGlowV', s.glow_intensity);
    setVal('apFont1', s.font_primary); setVal('apFont2', s.font_secondary);
    setVal('mdType', s.bg_type); setVal('mdUrl', s.bg_url);
    setVal('mdBlur', s.bg_blur); setVal('mdBlurV', s.bg_blur);
    setVal('mdDim', s.bg_dim); setVal('mdDimV', s.bg_dim);
    setVal('mdGlow', s.bg_glow); setVal('mdGlowV', s.bg_glow);
    setVal('mdMusic', s.music_url);
    setVal('mdTStart', s.music_start);
    setVal('mdTEnd', s.music_end);
    setVal('mdTitle', s.music_title);
    setVal('mdCover', s.music_cover);
    setVal('mdPStyle', s.music_pstyle || 'bg');
    setVal('mdPColor', s.music_pcolor);
    setVal('mdPBlur', s.music_pblur); setVal('mdPBlurV', s.music_pblur);
    setVal('mdAuto', String(s.music_autoplay));
    setVal('mdVol', s.music_volume); setVal('mdVolV', s.music_volume);
    setVal('apCursor', String(s.cursor_enabled !== false));
    setVal('apCursorColor', s.cursor_color || '#7c3aed');
    setVal('apSfx', String(s.sound_fx !== false));
    setVal('dcId', s.discord_user_id);
  }

  window.Appearance.save = async function () {
    const payload = {
      color_accent: val('apAccent'),
      color_bg: val('apBg'),
      glow_intensity: parseFloat(val('apGlow')),
      font_primary: val('apFont1'),
      font_secondary: val('apFont2'),
      cursor_enabled: val('apCursor') === 'true',
      cursor_color: val('apCursorColor'),
      sound_fx: val('apSfx') === 'true',
    };
    const base = Object.assign({}, payload);
    delete base.cursor_enabled; delete base.cursor_color; delete base.sound_fx;
    const res = await updateRow('settings', payload, base);
    if (res && res.error) { toast('خطأ: ' + res.error.message); return; }
    toast('تم حفظ المظهر ✓');
  };

  // ============================================================
  //  MEDIA
  // ============================================================
  window.Media = {};
  window.Media.save = async function () {
    let bgUrl = val('mdUrl');
    const bgFile = $('mdFile');
    if (bgFile && bgFile.files.length) {
      bgUrl = await uploadFile(bgFile.files[0], '/backgrounds/bg_' + Date.now() + ext(bgFile.files[0].name));
    }
    let musicUrl = val('mdMusic');
    const mFile = $('mdMusicFile');
    if (mFile && mFile.files.length) {
      musicUrl = await uploadFile(mFile.files[0], '/music/track_' + Date.now() + ext(mFile.files[0].name));
    }
    let coverUrl = val('mdCover');
    const cFile = $('mdCoverFile');
    if (cFile && cFile.files.length) {
      coverUrl = await uploadFile(cFile.files[0], '/covers/cover_' + Date.now() + ext(cFile.files[0].name));
    }
    const payload = {
      bg_type: val('mdType'),
      bg_url: bgUrl,
      bg_blur: parseFloat(val('mdBlur')),
      bg_dim: parseFloat(val('mdDim')),
      bg_glow: parseFloat(val('mdGlow')),
      music_url: musicUrl,
      music_start: parseFloat(val('mdTStart')) || 0,
      music_end: parseFloat(val('mdTEnd')) || 0,
      music_title: val('mdTitle').trim(),
      music_cover: coverUrl,
      music_pstyle: val('mdPStyle'),
      music_pcolor: val('mdPColor') || null,
      music_pblur: parseFloat(val('mdPBlur')) || 10,
      music_autoplay: val('mdAuto') === 'true',
      music_volume: parseFloat(val('mdVol')),
    };
    const base = Object.assign({}, payload);
    delete base.music_start; delete base.music_end; delete base.music_title;
    delete base.music_cover; delete base.music_pstyle; delete base.music_pcolor;
    delete base.music_pblur; delete base.music_autoplay;
    const res = await updateRow('settings', payload, base);
    if (res && res.error) { toast('خطأ: ' + res.error.message); return; }
    toast('تم حفظ الوسائط ✓');
  };

  // ============================================================
  //  PLAYLIST
  // ============================================================
  window.Playlist = {};
  async function loadPlaylist() {
    let { data } = await supabase.from('music_tracks').select('*').order('sort_order');
    if (!data) data = [];
    renderPlaylist(data);
  }

  function renderPlaylist(rows) {
    const box = $('plList');
    if (!box) return;
    if (!rows.length) { box.innerHTML = '<div class="hint">لا توجد أغانٍ في القائمة بعد.</div>'; return; }
    box.innerHTML = rows.map((t, i) => (
      '<div class="pl-row">' +
        '<div class="pl-info">' +
          '<div class="pl-title">' + esc(t.title || ('Track ' + (i + 1))) + '</div>' +
          '<div class="pl-sub">' + esc(t.url) + (t.start_sec ? ' · من ' + t.start_sec + 'ث' : '') + (t.end_sec ? ' إلى ' + t.end_sec + 'ث' : '') + '</div>' +
        '</div>' +
        '<div class="pl-actions">' +
          '<button class="btn btn-sm btn-ghost" onclick="Playlist.up(' + i + ')">▲</button>' +
          '<button class="btn btn-sm btn-ghost" onclick="Playlist.down(' + i + ')">▼</button>' +
          '<button class="btn btn-sm btn-danger" onclick="Playlist.del("' + t.id + '")">حذف</button>' +
        '</div>' +
      '</div>'
    )).join('');
  }

  window.Playlist.add = async function () {
    const url = val('plUrl').trim();
    if (!url) { toast('أدخل رابط MP3 أو ارفع ملف'); return; }
    const fEl = $('plFile');
    let finalUrl = url;
    if (fEl && fEl.files.length) {
      finalUrl = await uploadFile(fEl.files[0], '/music/pl_' + Date.now() + ext(fEl.files[0].name));
    }
    const { data, error } = await supabase.from('music_tracks').insert({
      title: val('plTitle').trim(),
      url: finalUrl,
      start_sec: parseFloat(val('plStart')) || 0,
      end_sec: parseFloat(val('plEnd')) || 0,
      cover: (val('plCover') || '').trim() || null,
      visible: true,
      sort_order: 0,
    }).select();
    if (error) { toast('خطأ: ' + error.message); return; }
    toast('أُضيفت الأغنية ✓');
    clearForm(['plTitle', 'plUrl', 'plStart', 'plEnd', 'plCover']);
    if (fEl) fEl.value = '';
    loadPlaylist();
  };

  window.Playlist.del = async function (id) {
    if (!confirm('حذف هذه الأغنية من القائمة؟')) return;
    const { error } = await supabase.from('music_tracks').delete().eq('id', id);
    if (error) { toast('خطأ: ' + error.message); return; }
    toast('حذفت الأغنية');
    loadPlaylist();
  };

  async function moveRow(i, dir) {
    const { data } = await supabase.from('music_tracks').select('id, sort_order').order('sort_order');
    if (!data || data.length < 2) return;
    const j = i + dir;
    if (j < 0 || j >= data.length) return;
    const a = data[i], b = data[j];
    await supabase.from('music_tracks').update({ sort_order: b.sort_order }).eq('id', a.id);
    await supabase.from('music_tracks').update({ sort_order: a.sort_order }).eq('id', b.id);
    loadPlaylist();
  }
  window.Playlist.up = (i) => moveRow(i, -1);
  window.Playlist.down = (i) => moveRow(i, 1);

  // ============================================================
  //  DISCORD
  // ============================================================
  window.Discord = {};
  window.Discord.save = async function () {
    const { error } = await supabase.from('settings').update({ discord_user_id: val('dcId').trim() }).eq('id', 1);
    if (error) { toast('خطأ: ' + error.message); return; }
    toast('تم حفظ Discord ✓');
  };

  // ============================================================
  //  FILE UPLOAD → Supabase Storage (bucket 'media')
  // ============================================================
  function ext(name) {
    const m = /(\.[a-z0-9]+)$/i.exec(name || '');
    return m ? m[1].toLowerCase() : '';
  }

  async function uploadFile(file, path) {
    const clean = path.replace(/^\//, '');
    const { error } = await supabase.storage.from('media').upload(clean, file, { upsert: true });
    if (error) { toast('رفع: ' + error.message); return ''; }
    const pub = supabase.storage.from('media').getPublicUrl(clean);
    return pub.data.publicUrl;
  }

  async function uploadInput(inputId, basePath) {
    const el = $(inputId);
    if (!el || !el.files || !el.files.length) return '';
    const f = el.files[0];
    return await uploadFile(f, basePath + ext(f.name));
  }

  // update with graceful fallback when new columns aren't migrated yet
  async function updateRow(table, fullPayload, basePayload, rowId) {
    const { error } = await supabase.from(table).update(fullPayload).eq('id', rowId || 1);
    if (error && /column|does not exist|schema cache/i.test(error.message || '')) {
      const r2 = await supabase.from(table).update(basePayload).eq('id', rowId || 1);
      if (r2.error) toast('⚠ شغّل ملف الترحيل SQL من أجل الحقول الجديدة — ثم أعد الحفظ.');
      return r2;
    }
    return { error };
  }

  // ============================================================
  //  helpers
  // ============================================================
  function setVal(id, v) {
    const e = $(id);
    if (e) {
      e.value = (v === null || v === undefined) ? '' : v;
      // sync any inline range label
      const lab = $(id + 'V');
      if (lab && e.type === 'range') lab.textContent = e.value;
    }
  }
  function clearForm(ids) { ids.forEach(id => setVal(id, '')); }
  function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  // range value labels
  ['apGlow', 'mdBlur', 'mdDim', 'mdGlow', 'mdVol', 'mdPBlur'].forEach(id => {
    $(id) && $(id).addEventListener('input', () => { const l = $(id + 'V'); if (l) l.textContent = $(id).value; });
  });

  // auto-switch media type when a video file is chosen for a project
  $('prVidFile') && $('prVidFile').addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length) setVal('prMediaType', 'video');
  });
  $('prImgFile') && $('prImgFile').addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length) setVal('prMediaType', 'image');
  });

  // ============================================================
  //  LIVE PREVIEW — apply unsaved form edits to the site
  // ============================================================
  const _cache = { profile: null, settings: null, projects: null, socials: null, about: null };
  // hook caches into loaders
  const __loadProfile = loadProfile, __loadSettings = loadSettings, __loadProjects = loadProjects;
  loadProfile = async function () { try { const r = await __loadProfile(); _cache.profile = await supabase.from('profile').select('*').eq('id', 1).single(); return r; } catch (e) { throw e; } };
  loadSettings = async function () { try { const r = await __loadSettings(); _cache.settings = await supabase.from('settings').select('*').eq('id', 1).single(); return r; } catch (e) { throw e; } };
  loadProjects = async function () { try { const r = await __loadProjects(); const x = await supabase.from('projects').select('*').order('sort_order'); _cache.projects = x.data || []; return r; } catch (e) { throw e; } };

  window.Preview = {
    open() {
      const prof = Object.assign({}, (_cache.profile && _cache.profile.data) || {});
      // merge profile form
      const pfKeys = {
        avatar_url: 'pfAvatar', owner_badge: 'pfBadge', status_text: 'pfStatus',
        display_name_ar: 'pfNameAr', display_name_en: 'pfNameEn',
        location_ar: 'pfLocAr', location_en: 'pfLocEn', age: 'pfAge',
        occupation_ar: 'pfOccAr', occupation_en: 'pfOccEn',
        bio_ar: 'pfBioAr', bio_en: 'pfBioEn', goals_ar: 'pfGoalsAr', goals_en: 'pfGoalsEn',
        journey_ar: 'pfJourneyAr', journey_en: 'pfJourneyEn',
        skills_ar: 'pfSkillsAr', skills_en: 'pfSkillsEn',
        about_img_url: 'pfAboutImg', about_img_w: 'pfAboutW', about_img_h: 'pfAboutH',
        about_img_align: 'pfAboutAlign', about_img_fit: 'pfAboutFit',
      };
      Object.keys(pfKeys).forEach(k => { prof[k] = val(pfKeys[k]); });
      prof.about_img_w = parseInt(prof.about_img_w) || 0;
      prof.about_img_h = parseInt(prof.about_img_h) || 0;

      const sett = Object.assign({}, (_cache.settings && _cache.settings.data) || {});
      const stKeys = {
        color_accent: 'apAccent', color_bg: 'apBg', glow_intensity: 'apGlow',
        font_primary: 'apFont1', font_secondary: 'apFont2',
        cursor_enabled: 'apCursor', cursor_color: 'apCursorColor', sound_fx: 'apSfx',
        bg_type: 'mdType', bg_url: 'mdUrl', bg_blur: 'mdBlur', bg_dim: 'mdDim', bg_glow: 'mdGlow',
        music_url: 'mdMusic', music_start: 'mdTStart', music_end: 'mdTEnd',
        music_title: 'mdTitle', music_cover: 'mdCover', music_pstyle: 'mdPStyle',
        music_pcolor: 'mdPColor', music_pblur: 'mdPBlur', music_autoplay: 'mdAuto',
        music_volume: 'mdVol', discord_user_id: 'dcId',
      };
      Object.keys(stKeys).forEach(k => { sett[k] = val(stKeys[k]); });
      sett.glow_intensity = parseFloat(sett.glow_intensity) || 0.6;
      sett.bg_blur = parseFloat(sett.bg_blur) || 0;
      sett.bg_dim = parseFloat(sett.bg_dim) || 0.5;
      sett.bg_glow = parseFloat(sett.bg_glow) || 0.4;
      sett.music_pblur = parseFloat(sett.music_pblur) || 10;
      sett.music_volume = parseFloat(sett.music_volume) || 0.5;
      sett.cursor_enabled = String(sett.cursor_enabled) === 'true';
      sett.sound_fx = String(sett.sound_fx) === 'true';
      sett.music_autoplay = String(sett.music_autoplay) === 'true';

      // projects: overlay the one being edited (if any)
      let projects = (_cache.projects || []).slice();
      const title = val('prTitleAr') || val('prTitleEn');
      if (title) {
        const draft = {
          title_ar: val('prTitleAr'), title_en: val('prTitleEn'),
          desc_ar: val('prDescAr'), desc_en: val('prDescEn'),
          details_ar: val('prDetailsAr'), details_en: val('prDetailsEn'),
          tags: val('prTags'), tag_colors: val('prTagColors'), color: val('prColor'),
          media_type: val('prMediaType') || 'image',
          image_url: val('prImgUrl'), img_h: parseInt(val('prImgH')) || 0,
          video_url: val('prVidUrl'),
          download_url: val('prDownload'), github_url: val('prGithub'), external_url: val('prExternal'),
          sort_order: parseInt(val('prSort') || '1'), visible: true,
        };
        if (editMode && editMode.table === 'projects') {
          projects = projects.map(p => p.id === editMode.id ? Object.assign({}, p, draft) : p);
        } else {
          projects = projects.concat(draft);
        }
      }

      localStorage.setItem('v0id_preview', JSON.stringify({ profile: prof, settings: sett, projects, ts: Date.now() }));
      toast('فتحنا الموقع بوضع معاينة — التغييرات غير المحفوظة ظاهرة هناك فقط. ✓');
      setTimeout(() => window.open('index.html', '_blank'), 350);
    },
    clear() {
      localStorage.removeItem('v0id_preview');
      toast('تم إيقاف المعاينة.');
    },
  };

  window.goToPanel = showPanel;
})();