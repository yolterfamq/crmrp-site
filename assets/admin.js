'use strict';
/*
 * Админка сайта CRM RP. Сайт лежит на GitHub Pages, поэтому админка сохраняет изменения
 * прямо в репозиторий сайта через GitHub API. Через 1–2 минуты GitHub Pages обновляет сайт,
 * а лаунчер подтягивает новости и ссылки сам.
 */
(() => {
  const REPO = 'yolterfamq/crmrp-site';
  const BRANCH = 'main';
  const SITE = 'https://yolterfamq.github.io/crmrp-site/';
  const FILES = {
    config: 'assets/site.config.js',
    news: 'launcher/news.json',
    notif: 'launcher/notifications.json',
    launcher: 'launcher/launcher.json',
  };
  const TITLES = { shop: 'Пополнение', texts: 'Тексты главной', links: 'Ссылки и серверы', news: 'Новости лаунчера', notif: 'Уведомления и ссылки лаунчера' };

  const $ = (s, r = document) => r.querySelector(s);
  let token = '';
  // на своём сервере (crmrp.dpdns.org) — вход логином и паролем, ключ GitHub хранит сервер.
  // на github.io — по-старому, ключом GitHub.
  const PROXY = location.protocol === 'https:' && !/github\.io$/i.test(location.hostname);
  const loaded = {};      // path -> { text, sha }
  const D = {};           // данные для редактирования
  const pendingImg = {};  // path -> { b64, url }
  let tab = 'shop';
  let dirty = false;

  /* ---------- GitHub ---------- */
  async function gh(path, opts = {}) {
    const r = await fetch(PROXY ? `/admin-api/gh${path}` : `https://api.github.com${path}`, {
      ...opts,
      headers: PROXY
        ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) }
        : { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', ...(opts.headers || {}) },
    });
    if (!r.ok) {
      let msg = `GitHub ответил ${r.status}`;
      if (PROXY) {
        let j = {}; try { j = await r.clone().json(); } catch { /* не json */ }
        if (r.status === 401) msg = 'Нужно войти заново';
        else if (j.error) msg = j.error;
        if (r.status === 401 || j.error) { const e = new Error(msg); e.status = r.status; throw e; }
      }
      if (r.status === 401) msg = 'Ключ не подходит или устарел';
      if (r.status === 403 || r.status === 404) msg = 'У ключа нет доступа к репозиторию crmrp-site (проверь права Contents: Read and write)';
      if (r.status === 409) msg = 'Файл на сайте только что изменился. Обнови страницу и повтори.';
      const e = new Error(msg); e.status = r.status; throw e;
    }
    return r.status === 204 ? null : r.json();
  }
  const b64ToText = (b) => new TextDecoder().decode(Uint8Array.from(atob(b.replace(/\n/g, '')), (c) => c.charCodeAt(0)));
  const textToB64 = (t) => { const bytes = new TextEncoder().encode(t); let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };

  async function getFile(path) {
    try {
      const j = await gh(`/repos/${REPO}/contents/${encodeURI(path)}?ref=${BRANCH}&t=${Date.now()}`);
      loaded[path] = { text: b64ToText(j.content), sha: j.sha };
    } catch (e) {
      if (e.status !== 404) throw e;
      loaded[path] = { text: '', sha: null };
    }
    return loaded[path].text;
  }
  async function putFile(path, b64, message) {
    const body = { message, content: b64, branch: BRANCH };
    if (loaded[path] && loaded[path].sha) body.sha = loaded[path].sha;
    const j = await gh(`/repos/${REPO}/contents/${encodeURI(path)}`, { method: 'PUT', body: JSON.stringify(body) });
    loaded[path] = { ...(loaded[path] || {}), sha: j.content.sha };
  }

  /* ---------- вход ---------- */
  function store() { try { return localStorage; } catch { return null; } }
  const KEY = PROXY ? 'crm.admin.session' : 'crm.admin.token';
  async function login(t, remember) {
    token = t.trim();
    await gh(`/repos/${REPO}`);
    if (remember && store()) store().setItem(KEY, token); else if (store()) store().removeItem(KEY);
    $('#login').hidden = true;
    $('#app').hidden = false;
    await loadAll();
  }
  $('#go').onclick = async () => {
    $('#login-err').textContent = '';
    $('#go').disabled = true;
    try {
      if (PROXY) {
        const r = await fetch('/admin-api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ login: $('#alogin').value, password: $('#apass').value }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.token) throw new Error(j.error || `Сервер ответил ${r.status}`);
        await login(j.token, $('#remember').checked);
      } else await login($('#tok').value, $('#remember').checked);
    } catch (e) { $('#login-err').textContent = e.message; } finally { $('#go').disabled = false; }
  };
  for (const id of ['#tok', '#alogin', '#apass']) $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#go').click(); });
  if (PROXY) { $('#pw-login').hidden = false; $('#tok-login').hidden = true; }
  $('#logout').onclick = () => {
    if (dirty && !confirm('Есть несохранённые изменения. Выйти?')) return;
    if (PROXY && token) fetch('/admin-api/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    store() && store().removeItem(KEY); location.reload();
  };

  async function loadAll() {
    $('#view').textContent = 'Загружаю...';
    const cfgText = await getFile(FILES.config);
    const body = cfgText.replace(/^[\s\S]*?window\.CRM_SITE\s*=\s*/, '').replace(/;\s*$/, '');
    D.config = new Function(`return (${body});`)();
    D.config.texts = D.config.texts || {};
    D.config.shop = D.config.shop || [];
    D.config.servers = D.config.servers || [];
    D.news = JSON.parse((await getFile(FILES.news)) || '[]');
    D.notif = JSON.parse((await getFile(FILES.notif)) || '[]');
    D.launcher = JSON.parse((await getFile(FILES.launcher)) || '{"links":{},"notice":""}');
    D.launcher.links = D.launcher.links || {};
    setDirty(false);
    render();
  }

  /* ---------- сохранение ---------- */
  function setDirty(v) { dirty = v; $('#dirty').hidden = !v; }
  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  function configText() {
    return '/*\n * Настройки сайта CRM RP. Удобнее менять через админку: ' + SITE + 'admin.html\n */\n' +
      'window.CRM_SITE = ' + JSON.stringify(D.config, null, 2) + ';\n';
  }
  $('#save').onclick = async () => {
    const btn = $('#save');
    btn.disabled = true;
    btn.textContent = 'Сохраняю...';
    try {
      let n = 0;
      for (const [path, img] of Object.entries(pendingImg)) {
        await putFile(path, img.b64, `Админка: картинка ${path}`);
        delete pendingImg[path];
        n++;
      }
      const out = {
        [FILES.config]: configText(),
        [FILES.news]: JSON.stringify(D.news, null, 2) + '\n',
        [FILES.notif]: JSON.stringify(D.notif, null, 2) + '\n',
        [FILES.launcher]: JSON.stringify(D.launcher, null, 2) + '\n',
      };
      for (const [path, text] of Object.entries(out)) {
        if (loaded[path] && loaded[path].text === text) continue;
        await putFile(path, textToB64(text), `Админка: ${path}`);
        loaded[path].text = text;
        n++;
      }
      setDirty(false);
      toast(n ? 'Сохранено. Сайт и лаунчер обновятся через 1–2 минуты.' : 'Нечего сохранять — всё уже на сайте.');
    } catch (e) {
      toast(e.message, true);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Сохранить на сайт';
    }
  };

  function toast(text, bad) {
    const t = $('#toast');
    t.textContent = text;
    t.classList.toggle('bad', !!bad);
    t.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove('show'), 4500);
  }

  /* ---------- картинки ---------- */
  function pickImage(maxW, folder, done) {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = async () => {
      const f = inp.files[0];
      if (!f) return;
      const bmp = await createImageBitmap(f);
      const k = Math.min(1, maxW / bmp.width);
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * k);
      c.height = Math.round(bmp.height * k);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const url = c.toDataURL('image/webp', 0.85);
      const name = `${Date.now().toString(36)}-${(f.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30) || 'img')}.webp`;
      const path = `${folder}/${name}`;
      pendingImg[path] = { b64: url.split(',')[1], url };
      done(path, url);
      setDirty(true);
    };
    inp.click();
  }
  // как показать картинку в админке: свежая (ещё не на сайте) — из памяти
  function imgSrc(v) {
    if (!v) return '';
    for (const [p, img] of Object.entries(pendingImg)) if (v.endsWith(p)) return img.url;
    return v;
  }

  /* ---------- маленький конструктор интерфейса ---------- */
  function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else if (v !== false && v != null) el.setAttribute(k, v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
    return el;
  }
  function field(label, obj, key, { type = 'text', area = false, ph = '', wide = false } = {}) {
    const inp = area ? h('textarea', { rows: 3, placeholder: ph }) : h('input', { type, placeholder: ph });
    inp.value = obj[key] ?? '';
    inp.addEventListener('input', () => { obj[key] = type === 'number' ? Number(inp.value) || 0 : inp.value; setDirty(true); });
    return h('label', { class: 'fld' + (wide ? ' wide' : '') }, h('span', {}, label), inp);
  }
  function moveBtns(list, i, rerender) {
    const mv = (d) => { const j = i + d; if (j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j], list[i]]; setDirty(true); rerender(); };
    return h('div', { class: 'mv' },
      h('button', { type: 'button', title: 'Выше', onclick: () => mv(-1) }, '↑'),
      h('button', { type: 'button', title: 'Ниже', onclick: () => mv(1) }, '↓'),
      h('button', { type: 'button', class: 'del', title: 'Удалить', onclick: () => { if (confirm('Удалить?')) { list.splice(i, 1); setDirty(true); rerender(); } } }, '✕'));
  }

  /* ---------- вкладки ---------- */
  document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab;
    document.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('on', x === b));
    render();
  }));

  function render() {
    $('#title').textContent = TITLES[tab];
    const v = $('#view');
    v.textContent = '';
    ({ shop: renderShop, texts: renderTexts, links: renderLinks, news: renderNews, notif: renderNotif })[tab](v);
  }

  function renderShop(v) {
    const C = D.config;
    v.append(h('p', { class: 'hint' }, 'Карточки на странице «Пополнение». Цена 0 = «Цена скоро». Картинка заменяет значок.'),
      h('div', { class: 'row' }, field('Валюта', C, 'currency', { ph: '₽' })));
    C.shop.forEach((g, gi) => {
      const grid = h('div', { class: 'items' });
      g.items = g.items || [];
      g.items.forEach((it, ii) => {
        const pic = h('div', { class: 'pic' });
        const drawPic = () => {
          pic.textContent = '';
          if (it.image) pic.append(h('img', { src: imgSrc(it.image), alt: '' }));
          else pic.append(h('span', {}, it.icon || '🛡️'));
        };
        drawPic();
        grid.append(h('div', { class: 'item' },
          h('div', { class: 'item-head' }, pic, moveBtns(g.items, ii, render)),
          h('div', { class: 'pic-btns' },
            h('button', { type: 'button', onclick: () => pickImage(800, 'assets/shop', (p) => { it.image = p; drawPic(); }) }, it.image ? 'Заменить картинку' : 'Загрузить картинку'),
            it.image ? h('button', { type: 'button', onclick: () => { delete it.image; setDirty(true); render(); } }, 'Убрать') : null),
          field('Значок (смайлик)', it, 'icon', { ph: 'например 🚗' }),
          field('Название', it, 'name'),
          field('Цена', it, 'price', { type: 'number' }),
          field('Описание', it, 'desc', { area: true })));
      });
      grid.append(h('button', { type: 'button', class: 'add-card', onclick: () => { g.items.push({ name: 'Новый товар', icon: '⭐', price: 0, desc: '' }); setDirty(true); render(); } }, '+ Добавить карточку'));
      v.append(h('section', { class: 'group' },
        h('div', { class: 'group-head' }, field('Раздел', g, 'group'), moveBtns(C.shop, gi, render)),
        grid));
    });
    v.append(h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => { C.shop.push({ group: 'Новый раздел', items: [] }); setDirty(true); render(); } }, '+ Новый раздел'));
  }

  function renderTexts(v) {
    const T = D.config.texts;
    v.append(h('p', { class: 'hint' }, 'Тексты главной страницы. Чтобы выделить жирным, оберни слова в **звёздочки**.'),
      h('div', { class: 'stack' },
        field('Подзаголовок под логотипом', T, 'heroLead', { wide: true }),
        field('Красная плашка «обязательно прочитай»', T, 'heroMust', { wide: true }),
        field('Блок про антивирус: заголовок', T, 'avTitle', { wide: true }),
        field('Блок про антивирус: текст', T, 'avText', { area: true, wide: true }),
        field('Блок про антивирус: как отключить', T, 'avHow', { area: true, wide: true })));
  }

  function renderLinks(v) {
    const C = D.config;
    v.append(h('p', { class: 'hint' }, 'Пустое поле = ссылки нет (кнопка не показывается или будет «скоро»).'),
      h('div', { class: 'grid2' },
        field('Ссылка на установщик лаунчера', C, 'download', { wide: true }),
        field('Версия лаунчера (внизу сайта)', C, 'launcherVersion'),
        field('Вес установщика', C, 'downloadSize'),
        field('Вес игры', C, 'gameSize'),
        field('Форум', C, 'forum'),
        field('Discord', C, 'discord'),
        field('ВКонтакте', C, 'vk'),
        field('Telegram', C, 'telegram'),
        field('YouTube', C, 'youtube')),
      h('h2', {}, 'Серверы'),
      h('p', { class: 'hint' }, 'IP здесь не указывается — только название и статус.'));
    C.servers.forEach((s, i) => {
      const sel = h('select', {}, ...[['open', 'Работает'], ['soon', 'Открытие скоро'], ['later', 'Позже']].map(([k, t]) => h('option', { value: k, selected: s.status === k }, t)));
      sel.onchange = () => { s.status = sel.value; setDirty(true); };
      v.append(h('div', { class: 'row line' }, field('Название', s, 'name'), h('label', { class: 'fld' }, h('span', {}, 'Статус'), sel), moveBtns(C.servers, i, render)));
    });
    v.append(h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => { C.servers.push({ name: `CRM RP #${C.servers.length + 1}`, status: 'soon' }); setDirty(true); render(); } }, '+ Сервер'));
  }

  function renderNews(v) {
    v.append(h('p', { class: 'hint' }, 'Блок «Последние обновления» в лаунчере (показываются первые три). Новые — сверху.'),
      h('button', { type: 'button', class: 'btn', onclick: () => { D.news.unshift({ tag: 'Обновление', date: new Date().toISOString().slice(0, 10), title: 'Новая новость', text: '', image: '', url: '' }); setDirty(true); render(); } }, '+ Новая новость'));
    D.news.forEach((n, i) => {
      const pic = h('div', { class: 'pic wide' });
      const drawPic = () => { pic.textContent = ''; pic.append(n.image ? h('img', { src: imgSrc(n.image), alt: '' }) : h('span', { class: 'noimg' }, 'без картинки — лаунчер нарисует город')); };
      drawPic();
      v.append(h('section', { class: 'news' },
        h('div', { class: 'item-head' }, h('b', {}, `№${i + 1}`), moveBtns(D.news, i, render)),
        h('div', { class: 'news-grid' },
          h('div', {}, pic, h('div', { class: 'pic-btns' },
            h('button', { type: 'button', onclick: () => pickImage(1200, 'launcher/img', (p) => { n.image = SITE + p; drawPic(); }) }, n.image ? 'Заменить фото' : 'Загрузить фото'),
            n.image ? h('button', { type: 'button', onclick: () => { n.image = ''; setDirty(true); render(); } }, 'Убрать') : null)),
          h('div', { class: 'stack' },
            h('div', { class: 'row' }, field('Метка', n, 'tag', { ph: 'Обновление' }), field('Дата', n, 'date', { type: 'date' })),
            field('Заголовок', n, 'title', { wide: true }),
            field('Текст', n, 'text', { area: true, wide: true }),
            field('Ссылка при клике (необязательно)', n, 'url', { wide: true })))));
    });
  }

  function renderNotif(v) {
    const L = D.launcher;
    v.append(h('h2', {}, 'Кнопки лаунчера'),
      h('div', { class: 'grid2' },
        field('Сайт', L.links, 'site'), field('Форум', L.links, 'forum'),
        field('Пополнение', L.links, 'donate'), field('«Все новости»', L.links, 'news'),
        field('Discord', L.links, 'discord'), field('ВКонтакте', L.links, 'vk'),
        field('Telegram', L.links, 'telegram'), field('YouTube', L.links, 'youtube')),
      field('Объявление вверху лаунчера (пусто = нет)', L, 'notice', { wide: true }),
      h('h2', {}, 'Уведомления (колокольчик)'),
      h('button', { type: 'button', class: 'btn', onclick: () => {
        const id = D.notif.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1;
        D.notif.unshift({ id, date: new Date().toISOString().slice(0, 10), title: 'Новое уведомление', text: '' }); setDirty(true); render();
      } }, '+ Новое уведомление'));
    D.notif.forEach((n, i) => {
      v.append(h('section', { class: 'news' },
        h('div', { class: 'item-head' }, h('b', {}, `№${n.id}`), moveBtns(D.notif, i, render)),
        h('div', { class: 'stack' },
          h('div', { class: 'row' }, field('Заголовок', n, 'title'), field('Дата', n, 'date', { type: 'date' })),
          field('Текст', n, 'text', { area: true, wide: true }))));
    });
  }

  /* ---------- старт ---------- */
  const saved = store() && store().getItem(KEY);
  if (saved) {
    login(saved, true).catch((e) => { $('#login').hidden = false; $('#login-err').textContent = e.message; });
  } else {
    $('#login').hidden = false;
  }
})();
