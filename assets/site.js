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
  if (C.downloadSize || C.gameSize) {
    const s1 = $('[data-step1]');
    if (s1 && C.downloadSize) s1.textContent = `Установщик весит ${C.downloadSize.replace('≈', 'около')}. GTA и MTA отдельно ставить не нужно.`;
    const s2 = $('[data-step2]');
    if (s2 && C.gameSize) s2.textContent = `Лаунчер создаст папку «CRM RP» и скачает туда игру (${C.gameSize.replace('≈', 'около')}). Если интернет оборвётся, загрузка продолжится с места остановки.`;
  }

  // форум
  if (C.forum) {
    $$('[data-forum-link]').forEach((a) => { a.href = C.forum; });
    $('[data-forum-text]').textContent = 'Правила сервера, заявки во фракции, жалобы и предложения.';
    const b = $('[data-forum-btn]');
    b.href = C.forum; b.hidden = false;
  }

  // соцсети
  const socials = [['discord', 'Discord'], ['vk', 'ВКонтакте'], ['telegram', 'Telegram'], ['youtube', 'YouTube']];
  const ul = $('[data-socials]');
  const have = socials.filter(([k]) => C[k]);
  if (have.length) {
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
  const list = $('[data-servers]');
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
