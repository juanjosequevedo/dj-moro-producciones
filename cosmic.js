(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const body = document.body;
  const hero = document.querySelector('.hero');
  const toggle = document.querySelector('.motion-toggle');
  const show = document.querySelector('.show-trigger');
  const status = document.querySelector('.show-status');
  const progress = document.querySelector('.scroll-progress');
  const atmosphere = document.querySelector('#atmosphere');
  const spectrum = document.querySelector('#spectrum');
  const ctx = atmosphere.getContext('2d');
  const sctx = spectrum.getContext('2d');
  let paused = reduce.matches;
  let heroVisible = true;
  let frame = 0, previous = 0, time = 0;
  let width = innerWidth, height = innerHeight, size = 300;
  let burst = [], showUntil = 0;
  let pointer = {x: .65, y: .35};
  const colors = ['#ff60ca', '#5de5ff', '#b985ff', '#ffb16b', '#ffe5a8'];
  const stars = Array.from({length: 64}, (_, i) => ({x: Math.random(), y: Math.random(), radius: .45 + Math.random() * 1.15, speed: .004 + Math.random() * .01, phase: Math.random() * 6.28, color: colors[i % colors.length]}));

  function resize() {
    width = innerWidth; height = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 1.6);
    atmosphere.width = Math.round(width * dpr); atmosphere.height = Math.round(height * dpr);
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    size = spectrum.getBoundingClientRect().width;
    spectrum.width = Math.round(size * dpr); spectrum.height = Math.round(size * dpr);
    sctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (paused) draw(0);
    updateProgress();
  }
  function draw(dt) {
    if (ctx) {
      ctx.clearRect(0, 0, width, height);
      const count = width < 700 ? 30 : stars.length;
      for (let i = 0; i < count; i++) {
        const star = stars[i];
        star.y -= dt * star.speed;
        if (star.y < -.01) star.y = 1.01;
        const px = star.x * width + (pointer.x - .5) * 9;
        const py = star.y * height + (pointer.y - .5) * 9;
        ctx.globalAlpha = .22 + (Math.sin(time * .8 + star.phase) + 1) * .18;
        ctx.fillStyle = star.color; ctx.beginPath(); ctx.arc(px, py, star.radius, 0, Math.PI * 2); ctx.fill();
      }
      for (const piece of burst) {
        piece.x += piece.vx * dt; piece.y += piece.vy * dt; piece.vy += 100 * dt; piece.life -= dt;
        ctx.globalAlpha = Math.max(0, Math.min(1, piece.life / 1.2));
        ctx.save(); ctx.translate(piece.x, piece.y); ctx.rotate(piece.spin + time * piece.rotation);
        ctx.fillStyle = piece.color; ctx.fillRect(-2, -4, 4, 8); ctx.restore();
      }
      burst = burst.filter(piece => piece.life > 0 && piece.y < height + 30);
      ctx.globalAlpha = 1;
    }
    if (!sctx || !heroVisible) return;
    sctx.clearRect(0, 0, size, size);
    const center = size / 2, radius = size * .29;
    const boost = time < showUntil ? 1.5 : 1;
    sctx.lineWidth = 1;
    for (const r of [.24, .28, .42]) {
      sctx.strokeStyle = r === .24 ? '#c685ff80' : '#bd64ee28';
      sctx.beginPath(); sctx.arc(center, center, size * r, 0, Math.PI * 2); sctx.stroke();
    }
    const bars = width < 700 ? 60 : 100;
    for (let i = 0; i < bars; i++) {
      const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
      const wave = (Math.sin(i * .31 + time * 2.5) + Math.cos(i * .19 - time * 1.7) + 2) / 4;
      const length = size * (.012 + wave * .095 * boost);
      sctx.strokeStyle = 'hsl(' + (280 + Math.sin(angle + time * .1) * 65) + ' 100% 74%)';
      sctx.lineWidth = Math.max(1.3, size / 170); sctx.lineCap = 'round';
      sctx.beginPath(); sctx.moveTo(center + Math.cos(angle) * radius, center + Math.sin(angle) * radius);
      sctx.lineTo(center + Math.cos(angle) * (radius + length), center + Math.sin(angle) * (radius + length)); sctx.stroke();
    }
    const orbitAngle = time * .15;
    sctx.fillStyle = '#a2edff'; sctx.shadowBlur = 10; sctx.shadowColor = '#55ddff';
    sctx.beginPath(); sctx.arc(center + Math.cos(orbitAngle) * size * .42, center + Math.sin(orbitAngle) * size * .42, 2.5, 0, Math.PI * 2); sctx.fill(); sctx.shadowBlur = 0;
  }
  function animate(timestamp) {
    if (paused || document.hidden) { frame = 0; return; }
    // Limit canvas work to 30fps; CSS motion stays smooth independently.
    if (timestamp - previous >= 32) {
      const dt = Math.min((timestamp - previous) / 1000, .05);
      previous = timestamp; time += dt; draw(dt);
      if (showUntil && time >= showUntil) { body.classList.remove('show-active'); showUntil = 0; }
    }
    frame = requestAnimationFrame(animate);
  }
  function start() { if (!frame && !paused && !document.hidden) { previous = performance.now(); frame = requestAnimationFrame(animate); } }
  function setPaused(value) {
    paused = value; body.classList.toggle('effects-paused', paused);
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.setAttribute('aria-label', paused ? 'Activar animaciones' : 'Pausar animaciones');
    toggle.querySelector('.motion-label').textContent = paused ? 'Activar efectos' : 'Pausar efectos';
    toggle.querySelector('.motion-icon').textContent = paused ? '▷' : 'Ⅱ';
    if (paused) {
      cancelAnimationFrame(frame); frame = 0; burst = []; showUntil = 0;
      body.classList.remove('show-active'); draw(0);
      document.querySelectorAll('.service').forEach(card => {card.style.removeProperty('--rx'); card.style.removeProperty('--ry');});
    } else start();
  }
  toggle.addEventListener('click', () => setPaused(!paused));
  reduce.addEventListener('change', () => setPaused(reduce.matches));
  document.addEventListener('visibilitychange', () => { if (document.hidden) {cancelAnimationFrame(frame); frame = 0;} else start(); });
  show.addEventListener('click', () => {
    if (paused || reduce.matches) {
      status.textContent = 'Los efectos están pausados. Puedes activarlos desde el botón de animaciones.';
      return;
    }
    showUntil = time + 5; body.classList.add('show-active');
    const pieces = width < 700 ? 45 : 90;
    burst = Array.from({length: pieces}, (_, i) => ({x: width * (i % 2 ? .15 : .85), y: height * .65, vx: (i % 2 ? 1 : -1) * (50 + Math.random() * 220), vy: -100 - Math.random() * 260, life: 2 + Math.random() * 2, spin: Math.random() * 7, rotation: Math.random() * 8 - 4, color: colors[i % colors.length]}));
    status.textContent = 'Show de luces y confeti activado.';
  });
  const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => {if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }});
  }, {threshold: .08}) : null;
  if (observer && !reduce.matches) document.querySelectorAll('.reveal').forEach(el => {el.classList.add('reveal-ready'); observer.observe(el);});
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => {heroVisible = entries[0].isIntersecting;}).observe(hero);
  function updateProgress() { const max = document.documentElement.scrollHeight - innerHeight; progress.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, scrollY / max) : 0) + ')'; }
  let scrollQueued = false;
  addEventListener('scroll', () => {if (!scrollQueued) {scrollQueued = true; requestAnimationFrame(() => {updateProgress(); scrollQueued = false;});}}, {passive: true});
  hero.addEventListener('pointermove', event => {
    if (paused || !finePointer.matches) return;
    const bounds = hero.getBoundingClientRect();
    pointer = {x: event.clientX / width, y: event.clientY / height};
    hero.style.setProperty('--mx', ((event.clientX - bounds.left) / bounds.width * 100) + '%');
    hero.style.setProperty('--my', ((event.clientY - bounds.top) / bounds.height * 100) + '%');
  }, {passive: true});
  document.querySelectorAll('.service').forEach(card => {
    card.addEventListener('pointermove', event => {
      if (paused || !finePointer.matches) return;
      const rect = card.getBoundingClientRect(), x = (event.clientX - rect.left) / rect.width, y = (event.clientY - rect.top) / rect.height;
      card.style.setProperty('--rx', ((.5 - y) * 4) + 'deg'); card.style.setProperty('--ry', ((x - .5) * 4) + 'deg');
      card.style.setProperty('--cx', (x * 100) + '%'); card.style.setProperty('--cy', (y * 100) + '%');
    }, {passive: true});
    card.addEventListener('pointerleave', () => {card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg');});
  });
  const dialog = document.querySelector('.poster-dialog');
  let lastTrigger;
  document.querySelectorAll('[data-poster]').forEach(button => button.addEventListener('click', () => {
    lastTrigger = button; dialog.querySelector('img').src = button.dataset.poster;
    dialog.querySelector('img').alt = button.dataset.title + ' de DJ Moro Producciones';
    dialog.querySelector('#poster-title').textContent = button.dataset.title;
    dialog.querySelector('.dialog-quote').href = 'https://wa.me/573173614647?text=' + encodeURIComponent('Hola DJ Moro, quiero cotizar ' + button.dataset.title + ' para mi evento.');
    dialog.showModal(); body.classList.add('modal-open');
  }));
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {const box = dialog.getBoundingClientRect(); if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) dialog.close();});
  dialog.addEventListener('close', () => {body.classList.remove('modal-open'); lastTrigger?.focus({preventScroll: true});});
  addEventListener('resize', resize, {passive: true});
  resize(); setPaused(paused); start();
})();
