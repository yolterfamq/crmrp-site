'use strict';
/* Ночной город D2: фиолетовое небо, малиновое зарево, мокрый асфальт с отражениями окон. */
(() => {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PAL = {
    sky: ['#0a0710', '#1a1029', '#3a1d4a', '#4a1f45'],
    glow: 'rgba(224,36,94,0.22)',
    far: '#140e1d', near: '#09060d',
    warm: '255,170,90', cool: '200,150,255', neon: '224,36,94',
  };
  const rng = (s) => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const setup = (id) => {
    const c = document.getElementById(id);
    c.width = W * dpr; c.height = H * dpr;
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    return ctx;
  };

  function skyline(r, base, o) {
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
  function drawBuildings(ctx, list, base, col) {
    ctx.fillStyle = col;
    for (const b of list) {
      const top = base - b.h;
      ctx.fillRect(b.x, top, b.w, b.h + 2);
      if (b.roof < 0.3) ctx.fillRect(b.x + b.w * 0.2, top - 6, b.w * 0.35, 6);
      if (b.antenna) ctx.fillRect(b.x + b.w * 0.5, top - 24, 2, 24);
    }
  }

  /* небо и дальний план */
  const sky = setup('sky');
  const g = sky.createLinearGradient(0, 0, 0, H);
  PAL.sky.forEach((c, i) => g.addColorStop(i / (PAL.sky.length - 1), c));
  sky.fillStyle = g; sky.fillRect(0, 0, W, H);
  const gl = sky.createRadialGradient(W * 0.6, H, 10, W * 0.6, H, W * 0.6);
  gl.addColorStop(0, PAL.glow); gl.addColorStop(1, 'rgba(0,0,0,0)');
  sky.fillStyle = gl; sky.fillRect(0, 0, W, H);
  const far = skyline(rng(1337), H - 90, { minH: 150, maxH: 330, minW: 36, maxW: 88, d: 0.08, win: [2, 3, 5, 7] });
  drawBuildings(sky, far, H - 90, PAL.far);
  for (const b of far) for (const w of b.wins) {
    sky.fillStyle = w.cool ? `rgba(${PAL.cool},${w.a * 0.45})` : `rgba(${PAL.warm},${w.a * 0.45})`;
    sky.fillRect(w.x, w.y, 2, 3);
  }

  /* ближний план + мокрый асфальт */
  const city = setup('city');
  const base = H - 150;
  const near = skyline(rng(4242), base, { minH: 110, maxH: 195, minW: 52, maxW: 130, d: 0.16, win: [4, 6, 7, 9] });
  const sign = near.find((b) => b.x > W * 0.6 && b.w > 70) || near[near.length - 3];

  function draw(t) {
    city.clearRect(0, 0, W, H);
    drawBuildings(city, near, base, PAL.near);
    city.fillStyle = PAL.near;
    city.fillRect(0, base, W, H - base);
    for (const b of near) for (const w of b.wins) {
      const k = reduce ? 1 : Math.min(1, Math.max(0, (t - w.delay) / 180));
      if (k <= 0) continue;
      const rgb = w.cool ? PAL.cool : PAL.warm;
      city.fillStyle = `rgba(${rgb},${w.a * k})`;
      city.fillRect(w.x, w.y, 4, 6);
      const ry = base + (base - w.y) * 0.45; // отражение в лужах
      if (ry < H) { city.fillStyle = `rgba(${rgb},${w.a * k * 0.16})`; city.fillRect(w.x, ry, 4, 16); }
    }
    if (sign) {
      const k = reduce ? 1 : Math.min(1, Math.max(0, (t - 1500) / 300));
      const sx = sign.x + sign.w - 16;
      const sy = base - sign.h + 20;
      city.save();
      city.shadowColor = `rgba(${PAL.neon},${k})`; city.shadowBlur = 18;
      city.fillStyle = `rgba(${PAL.neon},${0.95 * k})`; city.fillRect(sx, sy, 4, 50);
      city.restore();
      city.fillStyle = `rgba(${PAL.neon},${0.14 * k})`;
      city.fillRect(sx - 1, base + (base - sy) * 0.45 - 50, 6, 70);
    }
  }
  if (reduce) draw(0);
  else {
    const t0 = performance.now();
    const step = (now) => { const t = now - t0; draw(t); if (t < 2000) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  /* миниатюры новостей без картинки */
  window.drawThumb = (canvas, seed) => {
    const w = canvas.offsetWidth || 300;
    const h = canvas.offsetHeight || 120;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const c = canvas.getContext('2d');
    c.scale(dpr, dpr);
    const r = rng(seed);
    const gg = c.createLinearGradient(0, 0, 0, h);
    gg.addColorStop(0, PAL.sky[0]); gg.addColorStop(1, PAL.sky[3]);
    c.fillStyle = gg; c.fillRect(0, 0, w, h);
    for (const [col, maxH, minW, maxW, d, by] of [[PAL.far, 0.6, 14, 40, 0.12, h - 10], [PAL.near, 0.4, 20, 50, 0.18, h]]) {
      let x = -5;
      while (x < w + 5) {
        const bw = minW + r() * (maxW - minW);
        const bh = h * (0.15 + r() * maxH);
        c.fillStyle = col; c.fillRect(x, by - bh, bw, bh);
        for (let y = by - bh + 5; y < by - 4; y += 6) for (let xx = x + 3; xx < x + bw - 4; xx += 5) {
          if (r() < d) { c.fillStyle = r() < 0.2 ? `rgba(${PAL.cool},.7)` : `rgba(${PAL.warm},.8)`; c.fillRect(xx, y, 2, 3); }
        }
        x += bw + (r() < 0.2 ? 3 : 0);
      }
    }
  };
})();
