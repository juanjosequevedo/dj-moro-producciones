(() => {
  'use strict';

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const body = document.body;
  const header = document.querySelector('#top-header');
  const hero = document.querySelector('.hero');
  const toggle = document.querySelector('.motion-toggle');
  const status = document.querySelector('.show-status');
  const progress = document.querySelector('.scroll-progress');
  const atmosphere = document.querySelector('#atmosphere');
  const spectrum = document.querySelector('#spectrum');
  const ctx = atmosphere?.getContext('2d');
  const sctx = spectrum?.getContext('2d');

  let paused = reduce.matches;
  let heroVisible = true;
  let frame = 0, previous = 0, time = 0;
  let width = innerWidth, height = innerHeight, size = 320;
  let confettiPieces = [];
  let sparkParticles = [];
  let fountainUntil = 0;
  let showUntil = 0;
  let pointer = { x: 0.65, y: 0.38 };

  const palette = ['#ff4ec8', '#4aeaff', '#b97aff', '#ffad5c', '#ffe699', '#5cffb0'];
  const stars = Array.from({ length: 72 }, (_, i) => ({
    x: Math.random(),
    y: Math.random(),
    radius: 0.55 + Math.random() * 1.4,
    speed: 0.005 + Math.random() * 0.014,
    phase: Math.random() * Math.PI * 2,
    color: palette[i % palette.length]
  }));

  function resize() {
    width = innerWidth;
    height = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 1.75);
    if (atmosphere) {
      atmosphere.width = Math.round(width * dpr);
      atmosphere.height = Math.round(height * dpr);
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    if (spectrum) {
      size = Math.max(180, spectrum.getBoundingClientRect().width || 300);
      spectrum.width = Math.round(size * dpr);
      spectrum.height = Math.round(size * dpr);
      sctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    if (paused) draw(0);
    updateScrollUI();
  }

  function spawnConfetti(multiplier = 1) {
    if (paused || reduce.matches) return;
    const count = Math.round((width < 700 ? 55 : 110) * multiplier);
    for (let i = 0; i < count; i++) {
      const fromLeft = i % 2 === 0;
      confettiPieces.push({
        x: width * (fromLeft ? 0.08 : 0.92),
        y: height * (0.72 + Math.random() * 0.16),
        vx: (fromLeft ? 1 : -1) * (120 + Math.random() * 360),
        vy: -260 - Math.random() * 420,
        w: 5 + Math.random() * 5,
        h: 9 + Math.random() * 7,
        life: 2.4 + Math.random() * 2.1,
        maxLife: 4.2,
        spin: Math.random() * 6.28,
        rotation: (Math.random() - 0.5) * 11,
        wobble: Math.random() * 6.28,
        color: palette[i % palette.length]
      });
    }
  }

  function emitColdSparks(dt) {
    const emitters = width < 900 ? [0.18, 0.82] : [0.55, 0.89];
    const perFrame = width < 700 ? 4 : 8;
    for (const ex of emitters) {
      for (let i = 0; i < perFrame; i++) {
        sparkParticles.push({
          x: width * ex + (Math.random() - 0.5) * 10,
          y: height - 12,
          vx: (Math.random() - 0.5) * 95,
          vy: -320 - Math.random() * 340,
          life: 0.65 + Math.random() * 0.75,
          maxLife: 1.35,
          radius: 1.3 + Math.random() * 2.1,
          hot: Math.random() > 0.35
        });
      }
    }
  }

  function triggerFX(mode) {
    if (paused || reduce.matches) {
      if (status) status.textContent = 'Los efectos están pausados. Actívalos desde el botón superior.';
      return;
    }
    start();
    if (mode === 'confetti' || mode === 'full') {
      spawnConfetti(mode === 'full' ? 1.15 : 0.95);
    }
    if (mode === 'sparks' || mode === 'full') {
      fountainUntil = Math.max(fountainUntil, time + 3.2);
    }
    if (mode === 'lasers' || mode === 'full') {
      showUntil = Math.max(showUntil, time + 5.5);
      body.classList.add('show-active');
    }
    if (status) {
      const labels = {
        full: 'Show completo de luces, pólvora fría y confeti activado.',
        sparks: 'Quemadores de pólvora fría activados.',
        confetti: 'Cañón de confeti CO2 activado.',
        lasers: 'Modo club LED y láseres activado.'
      };
      status.textContent = labels[mode] || 'Efecto activado.';
    }
  }

  function draw(dt) {
    if (ctx) {
      ctx.clearRect(0, 0, width, height);

      // Ambient drifting particles
      const starCount = width < 700 ? 32 : stars.length;
      for (let i = 0; i < starCount; i++) {
        const star = stars[i];
        star.y -= dt * star.speed;
        if (star.y < -0.02) star.y = 1.02;
        const px = star.x * width + (pointer.x - 0.5) * 14;
        const py = star.y * height + (pointer.y - 0.5) * 14;
        ctx.globalAlpha = 0.18 + (Math.sin(time * 1.2 + star.phase) + 1) * 0.2;
        ctx.fillStyle = star.color;
        ctx.beginPath();
        ctx.arc(px, py, star.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Cold sparkler fountains (Pólvora fría)
      if (time < fountainUntil && dt > 0) {
        emitColdSparks(dt);
      }
      if (sparkParticles.length) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const sp of sparkParticles) {
          sp.x += sp.vx * dt;
          sp.y += sp.vy * dt;
          sp.vy += 470 * dt;
          sp.vx *= 0.99;
          sp.life -= dt;
          const alpha = Math.max(0, Math.min(1, sp.life / sp.maxLife));
          ctx.globalAlpha = alpha;
          // Glowing trail
          ctx.strokeStyle = sp.hot ? '#fff6d6' : '#ffab40';
          ctx.lineWidth = sp.radius;
          ctx.beginPath();
          ctx.moveTo(sp.x, sp.y);
          ctx.lineTo(sp.x - sp.vx * 0.022, sp.y - sp.vy * 0.022);
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, sp.radius * 0.7, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        sparkParticles = sparkParticles.filter(sp => sp.life > 0 && sp.y < height + 20);
      }

      // CO2 Confetti pieces
      for (const piece of confettiPieces) {
        piece.x += piece.vx * dt + Math.sin(time * 5 + piece.wobble) * 28 * dt;
        piece.y += piece.vy * dt;
        piece.vy += 240 * dt;
        piece.vx *= 0.988;
        piece.life -= dt;
        ctx.globalAlpha = Math.max(0, Math.min(1, piece.life / 1.1));
        ctx.save();
        ctx.translate(piece.x, piece.y);
        ctx.rotate(piece.spin + time * piece.rotation);
        ctx.scale(Math.cos(time * 6 + piece.wobble), 1);
        ctx.fillStyle = piece.color;
        ctx.fillRect(-piece.w / 2, -piece.h / 2, piece.w, piece.h);
        ctx.restore();
      }
      confettiPieces = confettiPieces.filter(p => p.life > 0 && p.y < height + 40);
      ctx.globalAlpha = 1;
    }

    // 124 BPM Beat-Reactive Circular Spectrum in Hero
    if (!sctx || !heroVisible) return;
    sctx.clearRect(0, 0, size, size);
    const center = size / 2;
    const beat = Math.pow((Math.sin(time * (124 / 60) * Math.PI * 2) + 1) * 0.5, 2.2);
    const boost = (time < showUntil ? 1.48 : 1) + beat * 0.16;
    const baseRadius = size * 0.285;

    // Vinyl concentric rings
    sctx.lineWidth = 1.1;
    for (const r of [0.22, 0.265, 0.43]) {
      sctx.strokeStyle = r === 0.265 ? '#ff6ad570' : '#8d64ee30';
      sctx.beginPath();
      sctx.arc(center, center, size * r * (r === 0.22 ? 1 + beat * 0.03 : 1), 0, Math.PI * 2);
      sctx.stroke();
    }

    const bars = width < 700 ? 64 : 108;
    for (let i = 0; i < bars; i++) {
      const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
      const wave = (
        Math.sin(i * 0.34 + time * 3.4) +
        Math.cos(i * 0.21 - time * 2.3) +
        Math.sin(i * 0.11 + time * 5.2) * 0.6 +
        2.6
      ) / 5.2;
      const barLen = size * (0.014 + wave * 0.105 * boost);
      const hue = (295 + Math.sin(angle * 2 + time * 0.8) * 75 + 360) % 360;
      sctx.strokeStyle = `hsl(${hue} 100% 72%)`;
      sctx.lineWidth = Math.max(1.5, size / 155);
      sctx.lineCap = 'round';
      sctx.beginPath();
      sctx.moveTo(center + Math.cos(angle) * baseRadius, center + Math.sin(angle) * baseRadius);
      sctx.lineTo(center + Math.cos(angle) * (baseRadius + barLen), center + Math.sin(angle) * (baseRadius + barLen));
      sctx.stroke();
    }

    // Orbiting dual laser satellites
    for (const dir of [1, -0.7]) {
      const orbitAngle = time * 0.45 * dir;
      sctx.fillStyle = dir > 0 ? '#5ceeff' : '#ff6ed8';
      sctx.shadowBlur = 12;
      sctx.shadowColor = sctx.fillStyle;
      sctx.beginPath();
      sctx.arc(
        center + Math.cos(orbitAngle) * size * 0.43,
        center + Math.sin(orbitAngle) * size * 0.43,
        3,
        0,
        Math.PI * 2
      );
      sctx.fill();
    }
    sctx.shadowBlur = 0;
  }

  function animate(timestamp) {
    if (paused || document.hidden) {
      frame = 0;
      return;
    }
    if (timestamp - previous >= 24) {
      const dt = Math.min((timestamp - previous) / 1000, 0.05);
      previous = timestamp;
      time += dt;
      draw(dt);
      if (showUntil && time >= showUntil) {
        body.classList.remove('show-active');
        showUntil = 0;
      }
    }
    frame = requestAnimationFrame(animate);
  }

  function start() {
    if (!frame && !paused && !document.hidden) {
      previous = performance.now();
      frame = requestAnimationFrame(animate);
    }
  }

  function setPaused(value) {
    paused = value;
    body.classList.toggle('effects-paused', paused);
    if (toggle) {
      toggle.setAttribute('aria-pressed', String(paused));
      toggle.setAttribute('aria-label', paused ? 'Activar animaciones' : 'Pausar animaciones');
      const label = toggle.querySelector('.motion-label');
      const icon = toggle.querySelector('.motion-icon');
      if (label) label.textContent = paused ? 'Activar efectos' : 'Pausar efectos';
      if (icon) icon.textContent = paused ? '▷' : 'Ⅱ';
    }
    if (paused) {
      cancelAnimationFrame(frame);
      frame = 0;
      confettiPieces = [];
      sparkParticles = [];
      fountainUntil = 0;
      showUntil = 0;
      body.classList.remove('show-active');
      draw(0);
      document.querySelectorAll('.service').forEach(card => {
        card.style.removeProperty('--rx');
        card.style.removeProperty('--ry');
      });
    } else {
      start();
    }
  }

  toggle?.addEventListener('click', () => setPaused(!paused));
  reduce.addEventListener('change', () => setPaused(reduce.matches));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
    } else {
      start();
    }
  });

  // Hero Live FX Buttons
  document.querySelectorAll('[data-fx]').forEach(btn => {
    btn.addEventListener('click', () => {
      const fx = btn.dataset.fx;
      btn.classList.add('is-firing');
      setTimeout(() => btn.classList.remove('is-firing'), 700);
      triggerFX(fx);
    });
  });

  const floatingFab = document.querySelector('.floating-contact');
  const builderSec = document.querySelector('#arma-tu-show');
  const contactSec = document.querySelector('#contacto');

  // Scroll UI (Progress + Sticky Header + Smart Floating WhatsApp)
  function updateScrollUI() {
    const max = document.documentElement.scrollHeight - innerHeight;
    if (progress) {
      progress.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
    }
    if (header) {
      header.classList.toggle('is-scrolled', scrollY > 36);
    }
    if (floatingFab) {
      const bRect = builderSec?.getBoundingClientRect();
      const cRect = contactSec?.getBoundingClientRect();
      const inBuilder = bRect && bRect.top < innerHeight * 0.75 && bRect.bottom > innerHeight * 0.25;
      const inContact = cRect && cRect.top < innerHeight * 0.85;
      floatingFab.classList.toggle('is-visible', scrollY > 300 && !inBuilder && !inContact);
    }
  }

  let scrollQueued = false;
  addEventListener('scroll', () => {
    if (!scrollQueued) {
      scrollQueued = true;
      requestAnimationFrame(() => {
        updateScrollUI();
        scrollQueued = false;
      });
    }
  }, { passive: true });

  // Intersection Observers: Reveal + Animated Stat Counters + Hero Visibility
  if ('IntersectionObserver' in window) {
    if (!reduce.matches) {
      const revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            revealObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.08 });

      document.querySelectorAll('.reveal').forEach(el => {
        el.classList.add('reveal-ready');
        revealObserver.observe(el);
      });

      const countObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          countObserver.unobserve(el);
          const target = Number(el.dataset.count || 0);
          const suffix = el.dataset.suffix || '';
          if (!target) return;
          const startAt = performance.now();
          const duration = 1200;
          const tick = now => {
            const p = Math.min(1, (now - startAt) / duration);
            const eased = 1 - Math.pow(1 - p, 3);
            el.textContent = Math.round(target * eased) + suffix;
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
      }, { threshold: 0.4 });

      document.querySelectorAll('[data-count]').forEach(el => countObserver.observe(el));
    }

    if (hero) {
      new IntersectionObserver(entries => {
        heroVisible = entries[0].isIntersecting;
      }).observe(hero);
    }
  }

  // Hero Pointer Aurora & 3D Card Tilt
  hero?.addEventListener('pointermove', event => {
    if (paused || !finePointer.matches) return;
    const bounds = hero.getBoundingClientRect();
    pointer = { x: event.clientX / width, y: event.clientY / height };
    hero.style.setProperty('--mx', ((event.clientX - bounds.left) / bounds.width * 100) + '%');
    hero.style.setProperty('--my', ((event.clientY - bounds.top) / bounds.height * 100) + '%');
  }, { passive: true });

  document.querySelectorAll('.service').forEach(card => {
    card.addEventListener('pointermove', event => {
      if (paused || !finePointer.matches) return;
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      card.style.setProperty('--rx', ((0.5 - y) * 5) + 'deg');
      card.style.setProperty('--ry', ((x - 0.5) * 5) + 'deg');
      card.style.setProperty('--cx', (x * 100) + '%');
      card.style.setProperty('--cy', (y * 100) + '%');
    }, { passive: true });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });

  // Celebration Filter Chips (#eventos)
  const filterChips = document.querySelectorAll('.event-chip');
  const eventCards = document.querySelectorAll('.event-card');
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const filter = chip.dataset.filter;
      filterChips.forEach(c => c.classList.toggle('is-active', c === chip));
      eventCards.forEach(card => {
        const match = filter === 'all' || card.dataset.category === filter;
        card.classList.toggle('is-hidden', !match);
        card.classList.toggle('is-spotlight', filter !== 'all' && match);
        if (match) card.classList.add('visible');
      });
    });
  });

  // Interactive Combo Builder (#arma-tu-show)
  const choicePills = document.querySelectorAll('[data-event-choice]');
  const addonCards = document.querySelectorAll('[data-addon]');
  const placeInput = document.querySelector('#builder-place');
  const dateInput = document.querySelector('#builder-date');
  const summaryEvent = document.querySelector('#summary-event');
  const summaryList = document.querySelector('#summary-list');
  const summaryWhatsapp = document.querySelector('#summary-whatsapp');
  const energyFill = document.querySelector('#energy-fill');
  const energyStatus = document.querySelector('#energy-status');
  const ledPreview = document.querySelector('#led-preview');

  const presets = {
    wedding: {
      event: 'Matrimonio',
      addons: ['Sonido + Luces + DJ', 'Pista de baile LED 4x4', 'Plataforma 360°', 'Pólvora fría (2 quemadores)']
    },
    quince: {
      event: 'Fiesta de 15 años',
      addons: ['Sonido + Luces + DJ', 'Pista de baile LED 4x4', 'Plataforma 360°', 'Pólvora fría (2 quemadores)', 'Cañón de confeti CO2']
    },
    baby: {
      event: 'Baby Shower / Revelación',
      addons: ['Sonido + Luces + DJ', 'Cañón de confeti CO2', 'Plataforma 360°']
    },
    party: {
      event: 'Cumpleaños / Fiesta privada',
      addons: ['Sonido + Luces + DJ', 'Pista de baile LED 4x4', 'Cañón de confeti CO2']
    },
    business: {
      event: 'Evento empresarial',
      addons: ['Sonido + Luces + DJ', 'Proyector de video', 'Plataforma 360°']
    }
  };

  function updateBuilderSummary() {
    if (!summaryList || !summaryWhatsapp) return;
    const selectedChoice = document.querySelector('[data-event-choice].is-selected')?.dataset.eventChoice || 'Evento especial';
    const selectedAddons = Array.from(addonCards)
      .filter(btn => btn.classList.contains('is-selected'))
      .map(btn => btn.dataset.addon);

    if (summaryEvent) summaryEvent.textContent = selectedChoice;

    summaryList.innerHTML = '';
    if (selectedAddons.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'Asesoría personalizada de sonido y montaje';
      summaryList.appendChild(li);
    } else {
      selectedAddons.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        summaryList.appendChild(li);
      });
    }

    // Impact Meter
    const count = selectedAddons.length;
    const pct = Math.max(18, Math.min(100, Math.round((count / addonCards.length) * 100)));
    if (energyFill) energyFill.style.width = pct + '%';
    if (energyStatus) {
      if (count <= 1) energyStatus.textContent = '🎵 BASE ESENCIAL';
      else if (count === 2) energyStatus.textContent = '✨ GRAN AMBIENTE';
      else if (count <= 4) energyStatus.textContent = '🔥 SHOW DE ALTO IMPACTO';
      else energyStatus.textContent = '🚀 PRODUCCIÓN ÉPICA TOTAL';
    }
    if (ledPreview) {
      const hasLed = selectedAddons.some(a => a.includes('LED'));
      ledPreview.style.opacity = hasLed ? '1' : '0.45';
    }

    // Build WhatsApp Message
    const place = placeInput?.value.trim();
    const date = dateInput?.value.trim();
    const lines = [
      `Hola DJ Moro, quiero cotizar mi *${selectedChoice}*.`,
      selectedAddons.length ? `Me interesa este combo: ${selectedAddons.join(', ')}.` : 'Quiero asesoría para elegir los equipos.',
      place ? `Lugar / municipio: ${place}.` : '',
      date ? `Fecha aproximada: ${date}.` : ''
    ].filter(Boolean);

    summaryWhatsapp.href = 'https://wa.me/573173614647?text=' + encodeURIComponent(lines.join(' '));
  }

  choicePills.forEach(pill => {
    pill.addEventListener('click', () => {
      choicePills.forEach(p => p.classList.toggle('is-selected', p === pill));
      updateBuilderSummary();
    });
  });

  addonCards.forEach(card => {
    card.addEventListener('click', () => {
      const willSelect = !card.classList.contains('is-selected');
      card.classList.toggle('is-selected', willSelect);
      if (willSelect && card.dataset.fxPreview) {
        if (card.dataset.addon?.includes('Pólvora')) triggerFX('sparks');
        else if (card.dataset.addon?.includes('confeti')) triggerFX('confetti');
      }
      updateBuilderSummary();
    });
  });

  placeInput?.addEventListener('input', updateBuilderSummary);
  dateInput?.addEventListener('input', updateBuilderSummary);

  document.querySelectorAll('[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = presets[btn.dataset.preset];
      if (!preset) return;
      choicePills.forEach(p => p.classList.toggle('is-selected', p.dataset.eventChoice === preset.event));
      addonCards.forEach(c => c.classList.toggle('is-selected', preset.addons.includes(c.dataset.addon)));
      updateBuilderSummary();
      document.querySelector('#arma-tu-show')?.scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth' });
      triggerFX(btn.dataset.preset === 'quince' || btn.dataset.preset === 'wedding' ? 'sparks' : 'confetti');
    });
  });

  // Poster Modal Dialog
  const dialog = document.querySelector('.poster-dialog');
  let lastTrigger;
  if (dialog) {
    document.querySelectorAll('[data-poster]').forEach(button => {
      button.addEventListener('click', () => {
        lastTrigger = button;
        const img = dialog.querySelector('img');
        const title = dialog.querySelector('#poster-title');
        const quote = dialog.querySelector('.dialog-quote');
        if (img) {
          img.src = button.dataset.poster;
          img.alt = button.dataset.title + ' de DJ Moro Producciones';
        }
        if (title) title.textContent = button.dataset.title;
        if (quote) {
          quote.href = 'https://wa.me/573173614647?text=' + encodeURIComponent('Hola DJ Moro, quiero cotizar ' + button.dataset.title + ' para mi evento.');
        }
        dialog.showModal();
        body.classList.add('modal-open');
      });
    });

    dialog.querySelector('.dialog-close')?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      const box = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) {
        dialog.close();
      }
    });
    dialog.addEventListener('close', () => {
      body.classList.remove('modal-open');
      lastTrigger?.focus({ preventScroll: true });
    });
  }

  addEventListener('resize', resize, { passive: true });
  updateBuilderSummary();
  resize();
  setPaused(paused);
  start();
})();
