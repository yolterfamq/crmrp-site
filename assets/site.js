'use strict';
(() => {
  const C = window.CRM_SITE || {};
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  // шапка темнеет при прокрутке
  const top = $('.top');
  const onScroll = () => top.classList.toggle('scrolled', window.scrollY > 20);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // кнопки «Скачать»
  if (C.download) {
    $$('[data-download]').forEach((a) => { a.href = C.download; a.setAttribute('download', ''); });
  }
  if (C.gameSize) {
    const s2 = $('[data-step2]');
    if (s2) s2.textContent = `Лаунчер создаст папку «CRM RP» и скачает туда игру (${C.gameSize.replace('≈', 'около')}). Если интернет оборвётся, загрузка продолжится с места остановки.`;
  }

  // «Играть» и «Как начать играть» ведут к инструкции, а предупреждение про антивирус мигает
  $$('[data-to-start]').forEach((a) => a.addEventListener('click', (e) => {
    const start = $('#start');
    if (!start) return;
    e.preventDefault();
    start.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    const w = $('.av-warn');
    if (w) { w.classList.remove('flash'); void w.offsetWidth; setTimeout(() => w.classList.add('flash'), 450); }
  }));

  // тексты из настроек (**слово** = жирным)
  const fmt = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  $$('[data-text]').forEach((el) => { const t = (C.texts || {})[el.dataset.text]; if (t) el.innerHTML = fmt(t); });

  // версия лаунчера в подвале
  $$('[data-version]').forEach((el) => { el.textContent = C.launcherVersion || ''; });

  // форум
  if (C.forum) {
    $$('[data-forum-link]').forEach((a) => { a.href = C.forum; });
    const ft = $('[data-forum-text]');
    if (ft) ft.textContent = 'Правила сервера, заявки во фракции, жалобы и предложения.';
    const b = $('[data-forum-btn]');
    if (b) { b.href = C.forum; b.hidden = false; }
  }

  // соцсети
  const socials = [['discord', 'Discord'], ['vk', 'ВКонтакте'], ['telegram', 'Telegram'], ['youtube', 'YouTube']];
  const ul = $('[data-socials]');
  const have = socials.filter(([k]) => C[k]);
  if (!ul) { /* на этой странице нет блока соцсетей */ } else if (have.length) {
    for (const [k, name] of have) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = C[k]; a.target = '_blank'; a.rel = 'noopener'; a.textContent = name;
      li.append(a); ul.append(li);
    }
  } else {
    const p = document.createElement('p');
    p.textContent = 'Ссылки на Discord, ВКонтакте и Telegram появятся здесь к открытию.';
    ul.replaceWith(p);
  }

  // серверы: только название и статус, без IP
  const list = $('[data-servers]') || document.createElement('ul');
  const NOTE = { open: 'Работает', soon: 'Открытие скоро', later: 'Позже' };
  for (const s of C.servers || []) {
    const st = NOTE[s.status] ? s.status : 'soon';
    const li = document.createElement('li');
    li.className = `server ${st === 'open' ? 'online' : st}`;
    li.innerHTML = '<span class="dot" aria-hidden="true"></span><div><div class="server-name"></div><div class="server-note"></div></div>';
    li.querySelector('.server-name').textContent = s.name;
    li.querySelector('.server-note').textContent = NOTE[st];
    if (st === 'open' && C.download) {
      const a = document.createElement('a');
      a.className = 'copy'; a.href = C.download; a.textContent = 'Играть';
      li.append(a);
    }
    list.append(li);
  }

  let tt = null;
  function toast(text) {
    let t = $('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
    t.textContent = text; t.classList.add('show');
    clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2200);
  }
})();
