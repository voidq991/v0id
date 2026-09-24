// ============================================================
//  v0id Bio-Link — i18n core (instant AR/EN switching, no reload)
// ============================================================

window.i18n = (function () {
  let lang = localStorage.getItem('v0id_lang') || 'ar';
  const subscribers = [];

  // Static UI strings used across the site
  const dict = {
    ar: {
      nav_home: 'الرئيسية',
      nav_projects: 'المشاريع',
      nav_about: 'عني',
      lang_btn: 'EN',
      play: 'تشغيل الموسيقى',
      pause: 'إيقاف',
      live: 'إنضم الان',
      offline: 'غير متصل',
    },
    en: {
      nav_home: 'Home',
      nav_projects: 'Projects',
      nav_about: 'About',
      lang_btn: 'عربية',
      play: 'Play music',
      pause: 'Pause',
      live: 'Join',
      offline: 'Offline',
    },
  };

  function apply() {
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    document.body.classList.toggle('lang-ar', lang === 'ar');
    document.body.classList.toggle('lang-en', lang === 'en');
    // update anything marked [data-i18n]
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (dict[lang][key] !== undefined) el.textContent = dict[lang][key];
    });
    // update language button text
    document.querySelectorAll('[data-i18n-lang]').forEach((el) => {
      el.textContent = lang === 'ar' ? 'EN' : 'AR';
    });
  }

  function t(key) { return dict[lang][key] || key; }

  function pick(o) {
    // o = { ar: "...", en: "..." }  → returns value for current lang
    if (o == null) return '';
    if (typeof o === 'string') return o;
    return o[lang] || o.ar || o.en || '';
  }

  return {
    get lang() { return lang; },
    setLang(l) { lang = l; localStorage.setItem('v0id_lang', l); apply(); subscribers.forEach(fn => fn(l)); },
    t, pick,
    onLangChange(fn) { subscribers.push(fn); return () => {}; },
    init() { apply(); },
  };
})();