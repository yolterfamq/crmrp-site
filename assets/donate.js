'use strict';
(() => {
  const C = window.CRM_SITE || {};
  const box = document.querySelector('[data-shop]');
  const nick = document.getElementById('nick');
  const modal = document.getElementById('buy');
  try { nick.value = localStorage.getItem('crm.nick') || ''; } catch { /* нет хранилища */ }
  nick.addEventListener('input', () => { try { localStorage.setItem('crm.nick', nick.value.trim()); } catch { /* нет хранилища */ } });

  const price = (p) => (p ? `${Number(p).toLocaleString('ru-RU')} ${C.currency || '₽'}` : 'Цена скоро');

  for (const group of C.shop || []) {
    const sec = document.createElement('section');
    sec.className = 'shop-group';
    const h = document.createElement('h2');
    h.textContent = group.group;
    const grid = document.createElement('div');
    grid.className = 'shop-grid';
    for (const it of group.items) {
      const card = document.createElement('article');
      card.className = 'product' + (it.icon ? '' : ' product-admin');
      card.innerHTML = '<div class="p-icon" aria-hidden="true"></div><h3></h3><p class="p-desc"></p><div class="p-foot"><b class="p-price"></b><button class="btn btn-small" type="button">Купить</button></div>';
      const ic = card.querySelector('.p-icon');
      if (it.image) { const img = document.createElement('img'); img.src = it.image; img.alt = ''; ic.append(img); ic.classList.add('has-img'); }
      else ic.textContent = it.icon || '🛡️';
      card.querySelector('h3').textContent = it.name;
      card.querySelector('.p-desc').textContent = it.desc || (it.icon ? '' : 'Админка на сервере CRM RP');
      card.querySelector('.p-price').textContent = price(it.price);
      card.querySelector('button').addEventListener('click', () => buy(it));
      grid.append(card);
    }
    sec.append(h, grid);
    box.append(sec);
  }

  function buy(it) {
    const n = nick.value.trim();
    if (!n) {
      nick.focus();
      nick.classList.add('need');
      setTimeout(() => nick.classList.remove('need'), 1200);
      return;
    }
    modal.querySelector('[data-buy-text]').textContent =
      `Оплата на сайте скоро появится. Сейчас покупку «${it.name}» для ника ${n} можно оформить через тех-поддержку в Discord: ` +
      'создай обращение в канале «тех-поддержка» и напиши ник и что хочешь купить.';
    const d = modal.querySelector('[data-buy-discord]');
    d.href = C.discord || '#';
    d.hidden = !C.discord;
    modal.hidden = false;
    modal.querySelector('[data-buy-close]').focus();
  }
  const close = () => { modal.hidden = true; };
  modal.querySelector('[data-buy-close]').addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
})();
