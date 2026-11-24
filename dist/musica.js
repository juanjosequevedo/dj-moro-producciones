(() => {
  'use strict';

  const toggle = document.querySelector('#music-toggle');
  const labelEl = toggle?.querySelector('.music-label');
  const statusEl = document.querySelector('#music-status');
  const fallbackAudio = document.querySelector('#site-music');
  if (!toggle || !fallbackAudio) return;

  const AUDIO_URL = fallbackAudio.getAttribute('src') || 'assets/dj-moro-loop.mp3';
  const MASTER_VOL = 0.55;

  let isPlaying = false;
  let userMuted = false;
  let waitingForGesture = false;

  // Web Audio seamless DJ crossfade engine
  let audioCtx = null;
  let masterGain = null;
  let decodedBuffer = null;
  let trimStart = 0;
  let trimEnd = 0;
  let xfadeDuration = 1.6;
  let loopTimer = null;
  let activeSources = new Set();
  let useFallback = false;

  // Dual-audio fallback for file:// protocol where fetch() may fail
  let deckA = fallbackAudio;
  let deckB = null;
  let activeDeck = 0;
  let fallbackRaf = 0;
  let fallbackCrossfading = false;

  function setUI(playing, waiting = false) {
    isPlaying = playing;
    waitingForGesture = waiting;
    toggle.classList.toggle('is-playing', playing);
    toggle.classList.toggle('is-waiting', !playing && waiting);
    toggle.setAttribute('aria-pressed', String(playing));
    toggle.setAttribute('aria-label', playing ? 'Quitar música de fondo' : 'Activar música de fondo');
    if (labelEl) {
      labelEl.textContent = playing ? 'Quitar música' : 'Activar música';
    }
  }

  function detectTrimBounds(buffer) {
    const channels = buffer.numberOfChannels;
    const len = buffer.length;
    const threshold = 0.008;
    let first = 0;
    let last = len - 1;

    outerStart: for (let i = 0; i < len; i += 64) {
      for (let ch = 0; ch < channels; ch++) {
        if (Math.abs(buffer.getChannelData(ch)[i]) > threshold) {
          first = Math.max(0, i - 64);
          break outerStart;
        }
      }
    }

    outerEnd: for (let i = len - 1; i > first; i -= 64) {
      for (let ch = 0; ch < channels; ch++) {
        if (Math.abs(buffer.getChannelData(ch)[i]) > threshold) {
          last = Math.min(len - 1, i + 64);
          break outerEnd;
        }
      }
    }

    const startSec = first / buffer.sampleRate;
    const endSec = last / buffer.sampleRate;
    const dur = endSec - startSec;
    if (dur < 1.5) {
      return { start: 0, end: buffer.duration };
    }
    return { start: startSec, end: endSec };
  }

  function createFadeCurve(steps, fadeIn) {
    const curve = new Float32Array(steps);
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      // Equal-power sine/cosine curve for smooth DJ crossfade with constant loudness
      curve[i] = fadeIn ? Math.sin(t * Math.PI * 0.5) : Math.cos(t * Math.PI * 0.5);
    }
    return curve;
  }

  const fadeInCurve = createFadeCurve(64, true);
  const fadeOutCurve = createFadeCurve(64, false);

  async function ensureWebAudio() {
    if (useFallback) return false;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      useFallback = true;
      return false;
    }
    if (!audioCtx) {
      audioCtx = new AC();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0;
      masterGain.connect(audioCtx.destination);
    }
    if (!decodedBuffer) {
      try {
        const response = await fetch(AUDIO_URL);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const arrayBuf = await response.arrayBuffer();
        decodedBuffer = await audioCtx.decodeAudioData(arrayBuf);
        const bounds = detectTrimBounds(decodedBuffer);
        trimStart = bounds.start;
        trimEnd = bounds.end;
        const cleanDuration = trimEnd - trimStart;
        xfadeDuration = Math.max(0.6, Math.min(2.2, cleanDuration * 0.24));
      } catch {
        useFallback = true;
        return false;
      }
    }
    return true;
  }

  function stopWebAudioSources() {
    clearTimeout(loopTimer);
    loopTimer = null;
    for (const src of activeSources) {
      try { src.stop(); } catch {}
      try { src.disconnect(); } catch {}
    }
    activeSources.clear();
  }

  function scheduleLoopCycle(startAt, isFirst = false) {
    if (!audioCtx || !decodedBuffer || !isPlaying) return;

    const cleanDuration = trimEnd - trimStart;
    const step = Math.max(0.5, cleanDuration - xfadeDuration);

    const src = audioCtx.createBufferSource();
    src.buffer = decodedBuffer;

    const deckGain = audioCtx.createGain();
    src.connect(deckGain);
    deckGain.connect(masterGain);

    // Smooth entry: gentle 0.5s intro on very first play, full equal-power crossfade on every loop
    const inDur = isFirst ? Math.min(0.6, xfadeDuration) : xfadeDuration;
    deckGain.gain.setValueAtTime(0.0001, startAt);
    deckGain.gain.setValueCurveAtTime(fadeInCurve, startAt, inDur);

    // Smooth equal-power fade-out right as the next deck fades in
    const fadeOutStart = startAt + step;
    deckGain.gain.setValueCurveAtTime(fadeOutCurve, fadeOutStart, xfadeDuration);

    src.start(startAt, trimStart, cleanDuration + 0.05);
    activeSources.add(src);
    src.onended = () => {
      activeSources.delete(src);
      try { src.disconnect(); deckGain.disconnect(); } catch {}
    };

    const nextStart = startAt + step;
    const delayMs = Math.max(50, (nextStart - audioCtx.currentTime - 0.35) * 1000);
    loopTimer = setTimeout(() => {
      if (isPlaying) scheduleLoopCycle(nextStart, false);
    }, delayMs);
  }

  // Fallback dual-audio crossfade (used only on file:// where fetch is blocked)
  function startFallbackLoop() {
    if (!deckB) {
      deckB = new Audio(AUDIO_URL);
      deckB.preload = 'auto';
    }
    const decks = [deckA, deckB];
    decks.forEach(d => { d.loop = false; d.volume = 0; });
    activeDeck = 0;
    fallbackCrossfading = false;

    const current = decks[0];
    current.currentTime = 0;
    return current.play().then(() => {
      const fadeInStart = performance.now();
      const tick = () => {
        if (!isPlaying) return;
        const curr = decks[activeDeck];
        const next = decks[1 - activeDeck];
        const elapsed = (performance.now() - fadeInStart) / 1000;
        if (!fallbackCrossfading) {
          curr.volume = Math.min(MASTER_VOL, elapsed * MASTER_VOL * 1.4);
          if (curr.duration && curr.currentTime >= curr.duration - 1.8) {
            fallbackCrossfading = true;
            next.currentTime = 0;
            next.volume = 0;
            next.play().catch(() => {});
          }
        } else {
          const remaining = Math.max(0, (curr.duration || 0) - curr.currentTime);
          const ratio = Math.min(1, Math.max(0, 1 - remaining / 1.8));
          curr.volume = Math.max(0, (1 - ratio) * MASTER_VOL);
          next.volume = Math.min(MASTER_VOL, ratio * MASTER_VOL);
          if (remaining <= 0.06 || curr.ended) {
            curr.pause();
            curr.currentTime = 0;
            activeDeck = 1 - activeDeck;
            fallbackCrossfading = false;
          }
        }
        fallbackRaf = requestAnimationFrame(tick);
      };
      fallbackRaf = requestAnimationFrame(tick);
    });
  }

  function stopFallbackLoop() {
    cancelAnimationFrame(fallbackRaf);
    [deckA, deckB].forEach(d => {
      if (!d) return;
      try { d.pause(); d.currentTime = 0; d.volume = 0; } catch {}
    });
  }

  async function startMusic(fromAutoplay = false) {
    if (isPlaying) return true;
    const ready = await ensureWebAudio();

    if (ready && audioCtx) {
      try {
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }
        if (audioCtx.state !== 'running') {
          throw new Error('AutoplayBlocked');
        }
        stopWebAudioSources();
        const now = audioCtx.currentTime + 0.04;
        masterGain.gain.cancelScheduledValues(now);
        masterGain.gain.setValueAtTime(0.0001, now);
        masterGain.gain.linearRampToValueAtTime(MASTER_VOL, now + 0.65);

        setUI(true, false);
        scheduleLoopCycle(now, true);
        if (statusEl) statusEl.textContent = 'Música activada.';
        return true;
      } catch {
        setUI(false, fromAutoplay);
        return false;
      }
    }

    // Fallback path
    try {
      setUI(true, false);
      await startFallbackLoop();
      if (statusEl) statusEl.textContent = 'Música activada.';
      return true;
    } catch {
      setUI(false, fromAutoplay);
      return false;
    }
  }

  function stopMusic() {
    if (!isPlaying) return;
    setUI(false, false);
    if (statusEl) statusEl.textContent = 'Música pausada.';

    if (!useFallback && audioCtx && masterGain) {
      const now = audioCtx.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setValueAtTime(masterGain.gain.value, now);
      masterGain.gain.linearRampToValueAtTime(0.0001, now + 0.32);
      setTimeout(() => {
        if (!isPlaying) stopWebAudioSources();
      }, 360);
    } else {
      stopFallbackLoop();
    }
  }

  // Unlock music seamlessly on the very first interaction anywhere on the page
  function bindFirstGestureUnlock() {
    const unlock = async (event) => {
      if (userMuted || isPlaying) {
        cleanup();
        return;
      }
      // Don't race with a direct click on the music toggle button itself
      if (event.target && toggle.contains(event.target)) return;
      const started = await startMusic(false);
      if (started) cleanup();
    };
    const cleanup = () => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      window.removeEventListener('touchstart', unlock, true);
    };
    window.addEventListener('pointerdown', unlock, { capture: true, passive: true });
    window.addEventListener('keydown', unlock, { capture: true, passive: true });
    window.addEventListener('touchstart', unlock, { capture: true, passive: true });
  }

  toggle.addEventListener('click', async () => {
    if (isPlaying) {
      userMuted = true;
      stopMusic();
    } else {
      userMuted = false;
      const ok = await startMusic(false);
      if (!ok && statusEl) {
        statusEl.textContent = 'No se pudo reproducir la música. Inténtalo de nuevo.';
      }
    }
  });

  // Attempt immediate autoplay on entry; if blocked by browser policy, unlock on first gesture
  (async () => {
    const started = await startMusic(true);
    if (!started && !userMuted) {
      setUI(false, true);
      bindFirstGestureUnlock();
    }
  })();
})();
