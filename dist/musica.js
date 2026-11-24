const siteMusic = document.querySelector('#site-music');
const musicToggle = document.querySelector('#music-toggle');
const musicStatus = document.querySelector('#music-status');

function updateMusicLabel() {
  musicToggle.textContent = siteMusic.paused ? 'Activar música' : 'Pausar música';
}

siteMusic.addEventListener('play', updateMusicLabel);
siteMusic.addEventListener('pause', updateMusicLabel);
musicToggle.addEventListener('click', async () => {
  musicStatus.textContent = '';
  if (!siteMusic.paused) {
    siteMusic.pause();
    return;
  }

  try {
    await siteMusic.play();
  } catch (error) {
    if (error.name !== 'AbortError') {
      musicStatus.textContent = 'No se pudo reproducir la música. Inténtalo de nuevo.';
    }
    updateMusicLabel();
  }
});

musicToggle.hidden = false;
