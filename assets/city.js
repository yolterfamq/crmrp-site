'use strict';
/* Ночной город, как в лаунчере: фиолетовое небо, малиновое зарево, окна загораются один раз при открытии. */
(() => {
  const hero = document.querySelector('.hero');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PAL = {
    sky: ['#0a0710', '#1a1029', '#3a1d4a', '#4a1f45'],
    glow: 'rgba(224,36,94,0.22)', far: '#140e1d', near: '#100c16',
    warm: '255,170,90', cool: '200,150,255', neon: '224,36,94',
  };
  const rng = (s) => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };

  function skyline(r, W, base, o) {
    const list = [];
    let x = -20;
    while (x < W + 20) {
      const w = o.minW + r() * (o.maxW - o.minW);
      const h = (o.minH + r() * (o.maxH - o.minH)) * (r() < 0.12 ? 1.4 : 1);
      const wins = [];
      for (let y = base - h + 10; y < base - 8; y += o.win[1] + o.win[3]) {
        for (let xx = x + 6; xx < x + w - 6 - o.win[0]; xx += o.win[0] + o.win[2]) {
          if (r() < o.d) wins.push({ x: xx, y, a: 0.35 + r() * 0.6, cool: r() < 0.22, delay: r() * 1700 });
        }
      }
      list.push({ x, w, h, roof: r(), antenna: r() < 0.2, wins });
      x += w + (r() < 0.25 ? 3 + r() * 6 : 0);
    }
    return list;
  }
  function buildings(ctx, list, base, col) {
    ctx.fillStyle = col;
    for (const b of list) {
      const top = base - b.h;
      ctx.fillRect(b.x, top, b.w, b.h + 2);
      if (b.roof < 0.3) ctx.fillRect(b.x + b.w * 0.2, top - 6, b.w * 0.35, 6);
      if (b.antenna) ctx.fillRect(b.x + b.w * 0.5, top - 24, 2, 24);
    }
  }

  let animated = false;
  function render() {
    const W = hero.clientWidth;
    const H = hero.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const k = W < 700 ? 0.7 : 1; // на телефоне дома ниже
    const setup = (id) => {
      const c = document.getElementById(id);
      c.width = W * dpr; c.height = H * dpr;
      const ctx = c.getContext('2d');
      ctx.scale(dpr, dpr);
      return ctx;
    };

    const sky = setup('sky');
    const g = sky.createLinearGradient(0, 0, 0, H);
    PAL.sky.forEach((c, i) => g.addColorStop(i / (PAL.sky.length - 1), c));
    sky.fillStyle = g; sky.fillRect(0, 0, W, H);
    const gl = sky.createRadialGradient(W * 0.6, H, 10, W * 0.6, H, W * 0.6);
    gl.addColorStop(0, PAL.glow); gl.addColorStop(1, 'rgba(0,0,0,0)');
    sky.fillStyle = gl; sky.fillRect(0, 0, W, H);
    const far = skyline(rng(1337), W, H - 90 * k, { minH: 150 * k, maxH: 330 * k, minW: 36, maxW: 88, d: 0.08, win: [2, 3, 5, 7] });
    buildings(sky, far, H - 90 * k, PAL.far);
    for (const b of far) for (const w of b.wins) {
      sky.fillStyle = `rgba(${w.cool ? PAL.cool : PAL.warm},${w.a * 0.45})`;
      sky.fillRect(w.x, w.y, 2, 3);
    }

    const city = setup('city');
    const base = H - 150 * k;
    const near = skyline(rng(4242), W, base, { minH: 110 * k, maxH: 195 * k, minW: 52, maxW: 130, d: 0.16, win: [4, 6, 7, 9] });
    const sign = near.find((b) => b.x > W * 0.6 && b.w > 70) || near[near.length - 3];

    function draw(t) {
      city.clearRect(0, 0, W, H);
      buildings(city, near, base, PAL.near);
      city.fillStyle = PAL.near;
      city.fillRect(0, base, W, H - base);
      for (const b of near) for (const w of b.wins) {
        const on = Math.min(1, Math.max(0, (t - w.delay) / 180));
        if (on <= 0) continue;
        const rgb = w.cool ? PAL.cool : PAL.warm;
        city.fillStyle = `rgba(${rgb},${w.a * on})`;
        city.fillRect(w.x, w.y, 4, 6);
        const ry = base + (base - w.y) * 0.45; // отражение в мокром асфальте
        if (ry < H) { city.fillStyle = `rgba(${rgb},${w.a * on * 0.16})`; city.fillRect(w.x, ry, 4, 16); }
      }
      if (sign) {
        const on = Math.min(1, Math.max(0, (t - 1500) / 300));
        const sx = sign.x + sign.w - 16;
        const sy = base - sign.h + 20;
        city.save();
        city.shadowColor = `rgba(${PAL.neon},${on})`; city.shadowBlur = 18;
        city.fillStyle = `rgba(${PAL.neon},${0.95 * on})`; city.fillRect(sx, sy, 4, 50);
        city.restore();
        city.fillStyle = `rgba(${PAL.neon},${0.14 * on})`;
        city.fillRect(sx - 1, base + (base - sy) * 0.45 - 50, 6, 70);
      }
      // плавный переход города в фон страницы
      const fade = city.createLinearGradient(0, H - 90, 0, H);
      fade.addColorStop(0, 'rgba(16,12,22,0)'); fade.addColorStop(1, 'rgba(16,12,22,1)');
      city.fillStyle = fade; city.fillRect(0, H - 90, W, 90);
    }

    if (reduce || animated) draw(1e9);
    else {
      animated = true;
      const t0 = performance.now();
      const step = (now) => { const t = now - t0; draw(t); if (t < 2000) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }
  }

  render();
  let timer = null;
  let lastW = hero.clientWidth;
  window.addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { if (hero.clientWidth !== lastW) { lastW = hero.clientWidth; render(); } }, 150);
  });
})();
