'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const api = window.crp;

const fmtBytes = (b) => {
  if (!b) return '0 МБ';
  const u = ['КБ', 'МБ', 'ГБ', 'ТБ'];
  let i = -1;
  do { b /= 1024; i++; } while (b >= 1024 && i < u.length - 1);
  return `${b.toFixed(b < 10 ? 2 : 1).replace('.', ',')} ${u[i]}`;
};
const fmtTime = (s) => {
  if (!s || !isFinite(s)) return '';
  s = Math.round(s);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h} ч ${m} мин` : m ? `${m} мин ${s % 60} с` : `${s} с`;
};
const pct = (d, t) => (t > 0 ? Math.min(100, (d / t) * 100) : 0);
const fmtDate = (d) => { const x = new Date(d); return isNaN(x) ? '' : `${String(x.getDate()).padStart(2, '0')}.${String(x.getMonth() + 1).padStart(2, '0')}`; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const S = {
  user: null, config: null, info: null, settings: {}, state: 'loading',
  installDir: null, installed: false, check: null, autoLimit: 2048, server: null, mainReady: false,
  ticket: null, installBase: null,
};

/* ---------- тост ---------- */
let toastTimer;
function toast(text, { error = false, action = null, ms = 4000 } = {}) {
  const t = $('#toast');
  t.className = `toast show${error ? ' error' : ''}`;
  t.textContent = text;
  if (action) { const b = document.createElement('button'); b.className = 'gh'; b.textContent = action.label; b.onclick = action.fn; t.append(b); }
  clearTimeout(toastTimer);
  if (ms) toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

/* ---------- экраны ---------- */
function screen(name) {
  document.body.className = `screen-${name}`;
  $('#splash').hidden = name !== 'splash';
  $('#auth').hidden = name !== 'auth';
}

/* ================= ВХОД / РЕГИСТРАЦИЯ ================= */
function authForm(name) {
  for (const f of $$('.form', $('#auth'))) f.hidden = f.dataset.form !== name;
  $('#auth-tabs').hidden = !(name === 'login' || name === 'register');
  // вход через соцсети показываем только на экране входа — иначе регистрация не влезает по высоте
  $('.auth .or').hidden = name !== 'login';
  $('.auth .soc').hidden = name !== 'login';
  $$('#auth-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
  $('#auth-sub').textContent = {
    login: 'Войди один раз — дальше лаунчер запомнит тебя',
    register: 'Аккаунт для лаунчера, сайта и форума',
    '2fa': 'Двухфакторная защита',
    forgot: 'Восстановление пароля',
  }[name];
  clearErrors($(`[data-form="${name}"]`));
  const first = $(`[data-form="${name}"] input`);
  if (first) setTimeout(() => first.focus(), 30);
}
const formData = (form) => Object.fromEntries($$('input', form).map((i) => [i.name, i.value.trim()]));
function clearErrors(form) {
  if (!form) return;
  $$('[data-err]', form).forEach((e) => { e.textContent = ''; });
  $$('.f', form).forEach((f) => f.classList.remove('bad'));
}
function showError(form, field, message) {
  const el = $(`[data-err="${field || '_'}"]`, form) || $('[data-err="_"]', form);
  el.textContent = message;
  const f = el.closest('.f');
  if (f) { f.classList.add('bad'); const i = $('input', f); if (i) i.focus(); }
}
async function withLoading(btn, fn) {
  btn.classList.add('loading');
  const txt = btn.textContent;
  btn.textContent = 'Подождите…';
  try { return await fn(); } finally { btn.classList.remove('loading'); btn.textContent = txt; }
}

$$('#auth-tabs button').forEach((b) => b.addEventListener('click', () => authForm(b.dataset.tab)));
$$('[data-go]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); authForm(a.dataset.go); }));

$('#f-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  clearErrors(form);
  const d = formData(form);
  const pw = $('input[name=password]', form).value;
  if (!d.login) return showError(form, 'login', 'Введи логин или почту');
  if (!pw) return showError(form, 'password', 'Введи пароль');
  const r = await withLoading($('button[type=submit]', form), () => api.call('auth:login', { login: d.login, password: pw }));
  if (r.error) return showError(form, r.field, r.error);
  if (r.twofa) { S.ticket = r.ticket; authForm('2fa'); return null; }
  return enterMain(r.user);
});

$('#f-register').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  clearErrors(form);
  const d = formData(form);
  const pw = $('input[name=password]', form).value;
  if (!/^[A-Za-z0-9_]{3,20}$/.test(d.login)) return showError(form, 'login', 'Логин: 3–20 символов, латиница, цифры и _');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) return showError(form, 'email', 'Проверь адрес почты');
  if (pw.length < 6) return showError(form, 'password', 'Пароль — минимум 6 символов');
  if (pw !== $('input[name=password2]', form).value) return showError(form, 'password2', 'Пароли не совпадают');
  const r = await withLoading($('button[type=submit]', form), () => api.call('auth:register', { login: d.login, email: d.email, password: pw }));
  if (r.error) return showError(form, r.field, r.error);
  toast('Аккаунт создан — добро пожаловать в город');
  return enterMain(r.user);
});

$('#f-2fa').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  clearErrors(form);
  const code = formData(form).code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) return showError(form, 'code', 'Введи 6 цифр');
  const r = await withLoading($('button[type=submit]', form), () => api.call('auth:2fa', { ticket: S.ticket, code }));
  if (r.error) {
    if (r.status === 401 && !r.field) { authForm('login'); return showError($('#f-login'), '_', r.error); }
    return showError(form, r.field || 'code', r.error);
  }
  return enterMain(r.user);
});

$('#f-forgot').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  clearErrors(form);
  const d = formData(form);
  if (!d.login) return showError(form, 'login', 'Введи логин или почту');
  if ($('#forgot-step2').hidden) {
    const r = await withLoading($('#forgot-btn'), () => api.call('auth:forgot', { login: d.login }));
    if (r.error) return showError(form, r.field, r.error);
    $('#forgot-step2').hidden = false;
    $('#forgot-note').textContent = 'Если такой аккаунт есть, мы отправили код на его почту. Введи код и новый пароль.';
    $('#forgot-btn').textContent = 'Сменить пароль';
    $('input[name=code]', form).focus();
    return null;
  }
  const pw = $('input[name=password]', form).value;
  if (!/^\d{6}$/.test(d.code)) return showError(form, 'code', 'Введи 6 цифр из письма');
  if (pw.length < 6) return showError(form, 'password', 'Пароль — минимум 6 символов');
  const r = await withLoading($('#forgot-btn'), () => api.call('auth:reset', { login: d.login, code: d.code, password: pw }));
  if (r.error) return showError(form, r.field, r.error);
  $('#forgot-step2').hidden = true;
  $('#forgot-btn').textContent = 'Отправить код';
  authForm('login');
  $('#f-login input[name=login]').value = d.login;
  toast('Пароль изменён — войди с новым паролем');
  return null;
});

/* ================= ГЛАВНЫЙ ЭКРАН ================= */
function setUser(user) {
  S.user = user;
  const letter = (user.login || '?')[0];
  $('#ava').textContent = letter; $('#ava2').textContent = letter;
  $('#prof-login').textContent = user.login; $('#prof-login2').textContent = user.login;
  $('#prof-id').textContent = `ID ${user.id}`;
  $('#prof-email').textContent = user.email || '';
  $('#sec-email').textContent = user.email || '';
  $('#sec-dot').hidden = !!user.twofa;
  $('#tfa-title').textContent = user.twofa ? 'Двухфакторная аутентификация включена' : 'Двухфакторная аутентификация';
  $('#tfa-btn').textContent = user.twofa ? 'Отключить' : 'Включить';
  $('#tfa-setup').hidden = true; $('#tfa-off').hidden = true;
  // тестовая сборка без аккаунта: прячем всё, что связано с аккаунтом
  const guest = !!user.guest;
  $('#prof-id').textContent = guest ? 'Тестовая сборка' : `ID ${user.id}`;
  $('#prof-email').textContent = guest ? 'Вход по аккаунту включим позже' : (user.email || '');
  $('#drop-prof [data-act="logout"]').hidden = guest;
  $('#set-tabs [data-stab="security"]').hidden = guest;
  $('#set-tabs [data-stab="social"]').hidden = guest;
}

async function enterMain(user) {
  setUser(user);
  screen('main');
  if (!S.mainReady) { S.mainReady = true; await initMain(); } else runFlow();
}

async function initMain() {
  setState('loading');
  const st = await api.call('state:get');
  S.config = st.config;
  S.installDir = st.installDir;
  S.installed = st.installed;
  S.autoLimit = st.config.autoUpdateIfSmallerThanMB || 2048;
  S.settings = await api.call('settings:get');
  $('#ver').textContent = `CRM Launcher ${st.version}`;
  $('#set-ver').textContent = `Версия ${st.version}` + (st.uiVersion ? `  •  интерфейс ${st.uiVersion}` : '');
  $('#need-space').textContent = `≈ ${st.config.installSizeGB || 18} ГБ`;
  applySettingsUI();
  const [info, news] = await Promise.all([api.call('api:launcher'), api.call('api:news')]);
  S.info = info.data;
  renderServers();
  renderNews(news.data);
  loadNotifications();
  if (S.info.notice) { $('#notice').textContent = S.info.notice; $('#notice').hidden = false; }
  refreshServer();
  setInterval(refreshServer, 15000);
  setInterval(loadNotifications, 5 * 60000);
  // новости и ссылки подтягиваются с сайта сами, перезапуск не нужен
  setInterval(async () => {
    try {
      const [i2, n2] = await Promise.all([api.call('api:launcher'), api.call('api:news')]);
      if (n2 && n2.online) renderNews(n2.data);
      if (i2 && i2.online && i2.data) S.info = { ...S.info, links: i2.data.links, notice: i2.data.notice };
    } catch { /* нет сети — оставляем как есть */ }
  }, 5 * 60000);
  runFlow();
}
// игра не установлена — ничего не качаем сами: ждём «Установить» и выбор папки
function runFlow() { if (!S.installDir || !S.installed) setState('needdir'); else runCheck({ auto: true }); }

/* ---------- кнопка и прогресс ---------- */
function setProgress(mode, done, total) {
  $('#bar').className = `bar ${mode || ''}`;
  $('#fill').style.width = `${mode ? pct(done, total) : 0}%`;
}
function setState(state, extra = {}) {
  S.state = state;
  const btn = $('#btn-play');
  const label = $('span', btn);
  const pause = $('#btn-pause');
  btn.classList.remove('secondary');
  pause.hidden = true;
  $('#p-file').textContent = '';
  $('.chk').hidden = !(!S.installed && ['needdir', 'need', 'downloading', 'paused'].includes(state));
  const size = (S.config && S.config.installSizeGB) || 18;
  let title = ''; let stats = ''; let text = 'Играть'; let disabled = false;
  switch (state) {
    case 'loading': title = 'Подготовка'; text = 'Загрузка'; disabled = true; setProgress(null); break;
    case 'needdir': title = 'Игра не установлена'; stats = `Понадобится около ${size} ГБ`; text = 'Установить'; setProgress(null); break;
    case 'checking': title = 'Проверка файлов'; text = 'Проверка'; disabled = true; pause.hidden = false; pause.textContent = 'Отменить'; setProgress('check', 0, 1); break;
    case 'need': {
      const c = S.check || { bytes: 0, files: 0 };
      title = S.installed ? 'Доступно обновление' : 'Готово к установке';
      stats = `${fmtBytes(c.bytes)} · ${c.files} файлов`;
      text = S.installed ? 'Обновить' : 'Установить';
      setProgress(null);
      break;
    }
    case 'downloading': title = S.installed ? 'Загрузка обновления' : 'Установка игры'; text = 'Загрузка'; disabled = true; pause.hidden = false; pause.textContent = 'Пауза'; break;
    case 'paused': title = 'Загрузка на паузе'; stats = 'Скачанное сохранено — продолжим с того же места'; text = 'Продолжить'; setProgress('paused', extra.done || 0, extra.total || 1); break;
    case 'ready': title = 'Игра готова'; stats = skippedNote() || 'Все файлы проверены'; setProgress('ready', 1, 1); break;
    case 'offline': title = 'Нет связи с сервером обновлений'; stats = 'Можно играть, но файлы не проверены'; setProgress(null); break;
    case 'launching': title = 'Запуск игры'; stats = 'Если Windows спросит — разреши запуск от имени администратора'; text = 'Запуск'; disabled = true; break;
    case 'running': title = 'Игра запущена'; stats = 'Лаунчер вернётся, когда закроешь игру'; text = 'В игре'; disabled = true; break;
    case 'error': title = extra.message || 'Что-то пошло не так'; stats = 'Проверь интернет и попробуй ещё раз'; text = 'Повторить'; btn.classList.add('secondary'); setProgress('error', 1, 1); break;
    default: break;
  }
  $('#p-title').textContent = title;
  $('#p-stats').textContent = stats;
  label.textContent = text;
  btn.disabled = disabled;
}
function skippedNote() {
  const sk = (S.check && S.check.skipped) || [];
  const res = sk.find((x) => x.id === 'resources');
  if (res) return res.error === 'не указан адрес сервера' ? 'Ресурсы сервера: адрес не указан' : 'Сервер не ответил — ресурсы загрузятся в игре';
  return sk.length ? 'Не удалось проверить обновления клиента' : '';
}

api.on('update:progress', (d) => {
  if (d.phase === 'check' && S.state === 'checking') {
    setProgress('check', d.done, d.total);
    $('#p-stats').textContent = `${Math.floor(pct(d.done, d.total))}%`;
    $('#p-file').textContent = d.file || '';
  }
  if (d.phase === 'download' && S.state === 'downloading') {
    S.lastDl = d;
    setProgress('download', d.done, d.total);
    const parts = [`${fmtBytes(d.done)} из ${fmtBytes(d.total)}`];
    if (d.speed > 0) parts.push(`${fmtBytes(d.speed)}/с`);
    if (d.eta) parts.push(`осталось ${fmtTime(d.eta)}`);
    $('#p-stats').textContent = parts.join(' · ');
    $('#p-file').textContent = d.file || '';
  }
});
api.on('game:state', ({ running }) => setState(running ? 'running' : 'ready'));
api.on('self-update', (u) => {
  if (u.state === 'ready') toast(`Вышла новая версия лаунчера ${u.version}`, { ms: 0, action: { label: 'Перезапустить', fn: () => api.call('self-update:install') } });
});

/* ---------- сценарии ---------- */
async function runCheck({ auto = true } = {}) {
  setState('checking');
  const r = await api.call('update:check');
  S.installed = !!r.installed;
  if (r.needDir) { setState('needdir'); return false; }
  if (r.error) {
    if (r.cancelled) { setState(S.installed ? 'ready' : 'needdir'); return false; }
    if (r.offline && S.installed) { setState('offline'); return true; }
    setState('error', { message: r.error });
    return false;
  }
  S.check = r;
  if (r.files === 0) { setState('ready'); return true; }
  setState('need');
  if (auto && (S.installed ? r.bytes < S.autoLimit * 1048576 : S.userStarted)) return runDownload();
  return false;
}
async function runDownload() {
  const fresh = !S.installed;
  setState('downloading');
  setProgress('download', 0, 1);
  const r = await api.call('update:download');
  if (r.error) {
    if (r.cancelled) { setState('paused', S.lastDl || {}); return false; }
    setState('error', { message: r.error });
    return false;
  }
  S.installed = true;
  setState('ready');
  if (fresh) {
    toast('Игра установлена');
    if (S.settings.launchAfterInstall) { await launchGame(); return false; }
  }
  return true;
}
async function play() {
  const ok = await runCheck({ auto: true }); // свежие ресурсы перед каждым входом
  if (!ok || (S.state !== 'ready' && S.state !== 'offline')) return;
  await launchGame();
}
async function launchGame() {
  setState('launching');
  try { localStorage.setItem('crm.lastServer', (S.server && S.server.name) || ''); } catch { /* нет хранилища */ }
  renderLast();
  const r = await api.call('game:play');
  if (r.error) { setState('error', { message: r.error }); return; }
  setTimeout(() => { if (S.state === 'launching') setState('ready'); }, 90000);
}

$('#btn-play').addEventListener('click', async () => {
  switch (S.state) {
    case 'needdir': openInstall(false); break;
    case 'need': await runDownload(); break;
    case 'paused': await runCheck({ auto: true }); break;
    case 'ready': case 'offline': await play(); break;
    case 'error': if (!S.installDir) setState('needdir'); else await runCheck({ auto: true }); break;
    default: break;
  }
});
$('#btn-pause').addEventListener('click', () => api.call('update:cancel'));
$('#chk-autolaunch').addEventListener('change', (e) => saveSetting('launchAfterInstall', e.target.checked));

/* ---------- выбор пути установки ---------- */
async function openInstall(changing) {
  const dlg = $('#dlg-install');
  $('#install-err').textContent = '';
  const needBytes = ((S.config && S.config.installSizeGB) || 18) * 1073741824;
  const disks = await api.call('disk:list');
  const box = $('#disks');
  box.textContent = '';
  const pick = async (base) => {
    S.installBase = base;
    $('#install-path').value = await api.call('install:preview', base);
    $$('.disk', box).forEach((d) => d.classList.toggle('on', d.dataset.root === base));
  };
  for (const d of disks) {
    const low = d.free < needBytes;
    const b = document.createElement('button');
    b.className = `disk${low ? ' low' : ''}`;
    b.dataset.root = d.root;
    b.innerHTML = `<b><svg class="i s16"><use href="#i-disk"/></svg>Диск ${d.root.slice(0, 2)}</b><div class="db"><i style="width:${pct(d.total - d.free, d.total)}%"></i></div><small>${low ? 'Мало места: ' : 'Свободно '}${fmtBytes(d.free)} из ${fmtBytes(d.total)}</small>`;
    b.onclick = () => pick(d.root);
    box.append(b);
  }
  const best = disks.filter((d) => d.free >= needBytes).sort((a, b) => b.free - a.free)[0] || disks[0];
  if (S.installDir) { S.installBase = S.installDir; $('#install-path').value = S.installDir; }
  else if (best) await pick(best.root);
  else { S.installBase = null; $('#install-path').value = ''; }
  $('#btn-install-go').textContent = changing ? 'Сохранить путь' : 'Продолжить установку';
  dlg.dataset.changing = changing ? '1' : '';
  dlg.showModal();
}
$('#btn-browse').addEventListener('click', async () => {
  const p = await api.call('disk:browse');
  if (!p) return;
  S.installBase = p;
  $('#install-path').value = await api.call('install:preview', p);
  $$('.disk').forEach((d) => d.classList.remove('on'));
});
$('#btn-install-go').addEventListener('click', async () => {
  if (!S.installBase) { $('#install-err').textContent = 'Выбери диск или папку'; return; }
  const r = await api.call('install:set', S.installBase);
  if (r.error) { $('#install-err').textContent = r.error; return; }
  const changing = !!$('#dlg-install').dataset.changing;
  $('#dlg-install').close();
  S.installDir = r.installDir;
  S.installed = r.installed;
  applySettingsUI();
  if (changing) toast('Путь сохранён. Файлы не переносятся — лаунчер проверит новую папку');
  if (changing && !S.installed) { setState('needdir'); return; }
  S.userStarted = true; // установку начал сам игрок
  runCheck({ auto: true });
});

/* ---------- серверы ---------- */
function renderServers() {
  const list = $('#server-list');
  list.textContent = '';
  const servers = S.info.servers || [];
  S.server = servers.find((s) => !s.soon) || servers[0] || null;
  for (const s of servers) {
    const b = document.createElement('button');
    b.className = `srv${s === S.server ? ' on' : ''}${s.soon ? ' soon' : ''}`;
    b.dataset.id = s.id;
    b.innerHTML = '<div class="row"><div class="emb"></div><div class="nm"><span></span><small></small></div></div>';
    $('.emb', b).textContent = s.id || '•';
    $('.nm span', b).textContent = s.name;
    $('.nm small', b).textContent = s.soon ? 'Скоро открытие' : 'Получаю данные…';
    if (!s.soon) { const bar = document.createElement('div'); bar.className = 'bar2'; bar.innerHTML = '<i></i>'; b.append(bar); }
    list.append(b);
  }
  $('#srv-title').textContent = S.server ? S.server.name : 'CRM RP';
  renderLast();
}
function renderLast() {
  let last = '';
  try { last = localStorage.getItem('crm.lastServer') || ''; } catch { /* нет */ }
  $('#last-server span').textContent = last ? `Последний: ${last}` : '';
  $('#last-server').hidden = !last;
}
async function refreshServer() {
  const s = S.server;
  if (!s) return;
  const card = $(`.srv[data-id="${s.id}"]`);
  const chip = $('#srv-online');
  const ping = $('#srv-ping');
  if (!s.host) {
    chip.className = 'chip'; chip.textContent = 'Адрес сервера не указан'; ping.hidden = true;
    if (card) $('.nm small', card).textContent = 'Адрес не указан';
    return;
  }
  const r = await api.call('server:query', s);
  if (!r) {
    chip.className = 'chip off'; chip.textContent = 'Офлайн'; ping.hidden = true;
    if (card) { $('.nm small', card).textContent = 'Сервер не отвечает'; $('.bar2 i', card).style.width = '0'; }
    $('#online-total').textContent = '0';
    return;
  }
  chip.className = 'chip live'; chip.textContent = `● ${r.online} / ${r.max}`;
  ping.hidden = false; ping.textContent = `${r.ping} мс`;
  $('#online-total').textContent = r.online;
  if (card) { $('.nm small', card).textContent = `${r.online} из ${r.max} · ${r.ping} мс`; $('.bar2 i', card).style.width = `${pct(r.online, r.max)}%`; }
}

/* ---------- новости ---------- */
function renderNews(list) {
  const box = $('#news');
  box.textContent = '';
  if (!Array.isArray(list) || !list.length) {
    const d = document.createElement('div'); d.className = 'news-empty'; d.textContent = 'Новостей пока нет'; box.append(d); return;
  }
  list.slice(0, 3).forEach((n, i) => {
    const c = document.createElement('button');
    c.className = 'card';
    if (n.url) { c.dataset.url = n.url; c.onclick = () => api.call('open:url', n.url); } else c.tabIndex = -1;
    if (n.image) { const img = document.createElement('img'); img.src = n.image; img.alt = ''; c.append(img); }
    else { const cv = document.createElement('canvas'); c.append(cv); requestAnimationFrame(() => window.drawThumb && window.drawThumb(cv, 3 + i * 8)); }
    const cap = document.createElement('div');
    cap.className = 'cap';
    if (n.tag) { const sm = document.createElement('small'); sm.textContent = n.tag; cap.append(sm); }
    cap.append(n.title || '');
    c.append(cap);
    if (n.date) { const d = document.createElement('div'); d.className = 'date'; d.textContent = fmtDate(n.date); c.append(d); }
    box.append(c);
  });
}

/* ---------- уведомления ---------- */
async function loadNotifications() {
  const r = await api.call('api:notifications');
  const list = Array.isArray(r.data) ? r.data : [];
  S.notifications = list;
  const seen = new Set(S.settings.seenNotifications || []);
  const ul = $('#notif-list');
  ul.textContent = '';
  if (!list.length) { const li = document.createElement('li'); li.textContent = 'Пока ничего нового'; ul.append(li); }
  for (const n of list) {
    const li = document.createElement('li');
    if (!seen.has(n.id)) li.className = 'new';
    const b = document.createElement('b'); b.textContent = n.title;
    const p = document.createElement('p'); p.textContent = n.text || '';
    const sm = document.createElement('small'); sm.textContent = n.date ? fmtDate(n.date) : '';
    li.append(b, p, sm);
    ul.append(li);
  }
  $('#bell-dot').hidden = !S.settings.notifications || !list.some((n) => !seen.has(n.id));
}

/* ---------- выпадающие меню ---------- */
function toggleDrop(id) {
  const d = $(id);
  const open = d.hidden;
  $$('.drop').forEach((x) => { x.hidden = true; });
  d.hidden = !open;
  if (open && id === '#drop-bell' && S.notifications) {
    saveSetting('seenNotifications', S.notifications.map((n) => n.id));
    $('#bell-dot').hidden = true;
  }
}
$('#btn-bell').addEventListener('click', (e) => { e.stopPropagation(); toggleDrop('#drop-bell'); });
$('#btn-prof').addEventListener('click', (e) => { e.stopPropagation(); toggleDrop('#drop-prof'); });
document.addEventListener('click', (e) => { if (!e.target.closest('.drop')) $$('.drop').forEach((x) => { x.hidden = true; }); });
$$('#drop-prof [data-act]').forEach((b) => b.addEventListener('click', async () => {
  $$('.drop').forEach((x) => { x.hidden = true; });
  if (b.dataset.act === 'settings') openSettings('main');
  if (b.dataset.act === 'verify') verifyFiles();
  if (b.dataset.act === 'logout') {
    if (['downloading', 'checking'].includes(S.state)) await api.call('update:cancel');
    await api.call('auth:logout');
    S.user = null;
    $$('.form', $('#auth')).forEach((f) => f.reset());
    screen('auth');
    authForm('login');
  }
}));

/* ---------- окно и ссылки ---------- */
$('#btn-min').onclick = () => api.call('win:minimize');
$('#btn-close').onclick = () => api.call('win:close');
$$('[data-link]').forEach((b) => b.addEventListener('click', () => {
  const url = S.info && S.info.links && S.info.links[b.dataset.link];
  if (url) api.call('open:url', url);
  else toast('Ссылка появится, когда запустим сайт и сообщества');
}));

/* ================= НАСТРОЙКИ ================= */
async function saveSetting(k, v) { S.settings = await api.call('settings:set', { [k]: v }); applySettingsUI(); }
function applySettingsUI() {
  $$('[data-set]').forEach((i) => { i.checked = !!S.settings[i.dataset.set]; });
  $('#chk-autolaunch').checked = !!S.settings.launchAfterInstall;
  $('#set-path').value = S.installDir || '';
  $('#set-path2').textContent = S.installDir || 'Игра ещё не установлена';
}
$$('[data-set]').forEach((i) => i.addEventListener('change', () => saveSetting(i.dataset.set, i.checked).then(loadNotifications)));

function openSettings(tab) {
  setTab(tab);
  applySettingsUI();
  api.call('preload:state').then(renderPreload);
  $('#dlg-settings').showModal();
}
function setTab(tab) {
  $$('#set-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.stab === tab));
  $$('[data-spane]').forEach((p) => { p.hidden = p.dataset.spane !== tab; });
}
$$('#set-tabs button').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.stab)));
$$('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
$('#set-path-change').onclick = () => {
  if (['checking', 'downloading', 'launching', 'running'].includes(S.state)) return toast('Дождись окончания текущей операции');
  return openInstall(true);
};
$('#set-open').onclick = () => (S.installDir ? api.call('open:folder') : toast('Игра ещё не установлена'));
$('#set-verify').onclick = () => { $('#dlg-settings').close(); verifyFiles(); };
async function verifyFiles() {
  if (!S.installDir) return toast('Сначала установи игру');
  if (['checking', 'downloading', 'launching', 'running'].includes(S.state)) return toast('Дождись окончания текущей операции');
  await api.call('update:reset-index');
  return runCheck({ auto: true });
}

/* --- безопасность --- */
$$('[data-toggle]').forEach((b) => b.addEventListener('click', () => { const f = $(`#${b.dataset.toggle}`); f.hidden = !f.hidden; }));
$('#tfa-btn').addEventListener('click', async () => {
  if (S.user.twofa) { $('#tfa-off').hidden = !$('#tfa-off').hidden; $('#tfa-off-code').focus(); return; }
  const r = await api.call('account:2fa-setup');
  if (r.error) { toast(r.error, { error: true }); return; }
  $('#tfa-secret').textContent = r.secret.replace(/(.{4})/g, '$1 ').trim();
  if (r.qr) $('#tfa-qr').src = r.qr; else $('#tfa-qr').removeAttribute('src');
  $('#tfa-err').textContent = '';
  $('#tfa-code').value = '';
  $('#tfa-setup').hidden = false;
  $('#tfa-code').focus();
});
$('#tfa-confirm').addEventListener('click', async () => {
  const r = await api.call('account:2fa-enable', { code: $('#tfa-code').value.trim() });
  if (r.error) { $('#tfa-err').textContent = r.error; return; }
  setUser(r.user);
  toast('Двухфакторная защита включена');
});
$('#tfa-off-confirm').addEventListener('click', async () => {
  const r = await api.call('account:2fa-disable', { code: $('#tfa-off-code').value.trim() });
  if (r.error) { $('#tfa-off-err').textContent = r.error; return; }
  setUser(r.user);
  toast('Двухфакторная защита отключена');
});
$('#em-save').addEventListener('click', async () => {
  const r = await api.call('account:email', { email: $('#em-new').value.trim(), password: $('#em-pw').value });
  if (r.error) { $('#em-err').textContent = r.error; return; }
  setUser(r.user);
  $('#email-form').hidden = true; $('#em-new').value = ''; $('#em-pw').value = ''; $('#em-err').textContent = '';
  toast('Почта изменена');
});
$('#pw-save').addEventListener('click', async () => {
  if ($('#pw-new').value.length < 6) { $('#pw-err').textContent = 'Пароль — минимум 6 символов'; return; }
  const r = await api.call('account:password', { old: $('#pw-old').value, password: $('#pw-new').value });
  if (r.error) { $('#pw-err').textContent = r.error; return; }
  $('#pw-form').hidden = true; $('#pw-old').value = ''; $('#pw-new').value = ''; $('#pw-err').textContent = '';
  toast('Пароль изменён. На других компьютерах нужно будет войти заново');
});

/* --- предзагрузка --- */
function renderPreload(p) {
  if (!p) return;
  const t = {
    idle: S.settings.preload ? 'Ждём следующего обновления' : '',
    nothing: 'Сейчас предзагружать нечего — новых обновлений пока нет',
    running: p.total ? `Предзагружено ${fmtBytes(p.done)} из ${fmtBytes(p.total)}` : 'Проверяю, что можно скачать заранее…',
    done: p.files ? `Готово: заранее скачано ${fmtBytes(p.bytes)}` : 'Всё нужное уже скачано',
    paused: 'Предзагрузка на паузе',
    error: `Не получилось: ${p.error || ''}`,
  }[p.state] || '';
  $('#pre-state').textContent = t;
}
api.on('preload:state', renderPreload);

/* ---------- обновление интерфейса лаунчера без перезапуска ---------- */
function uiBar() {
  let b = $('#ui-upd');
  if (!b) {
    b = document.createElement('div');
    b.id = 'ui-upd';
    b.setAttribute('role', 'status');
    b.innerHTML = '<span></span><i><b></b></i>';
    document.body.append(b);
  }
  return b;
}
api.on('ui-update', (u) => {
  const b = uiBar();
  if (u.state === 'progress') {
    b.querySelector('span').textContent = `Обновление лаунчера  ${Math.round(pct(u.done, u.total || 1))}%`;
    b.querySelector('b').style.width = `${pct(u.done, u.total || 1)}%`;
    b.classList.add('on');
  } else if (u.state === 'ready') {
    b.querySelector('span').textContent = 'Лаунчер обновлён';
    b.querySelector('b').style.width = '100%';
    b.classList.add('on');
    const tryReload = async () => {
      // не мешаем загрузке игры и запуску: обновим окно, когда освободится
      if (['downloading', 'checking', 'launching', 'running'].includes(S.state) || document.querySelector('dialog[open]')) { setTimeout(tryReload, 3000); return; }
      if (!(await api.call('ui:reload'))) setTimeout(tryReload, 3000);
    };
    setTimeout(tryReload, 1200);
  }
});

/* ================= СТАРТ ================= */
(async () => {
  screen('splash');
  const [auth] = await Promise.all([api.call('auth:state'), sleep(900)]);
  if (auth.user) {
    if (auth.offline) toast('Нет связи с сервером аккаунтов — работаем с сохранённым входом');
    enterMain(auth.user);
  } else {
    screen('auth');
    authForm('login');
    if (auth.expired) showError($('#f-login'), '_', 'Сессия истекла — войди заново');
  }
})();
