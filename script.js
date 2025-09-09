/* ===========================
   NAVIGATION DES MURS
   =========================== */

// Cible uniquement les boutons de la nav (pas ceux du jukebox)
const navButtons = document.querySelectorAll('header .menu button[data-target]');
const walls = document.querySelectorAll('.wall');

// Restaure le dernier mur visité si présent
const LAST_WALL_KEY = 'cafe_last_wall';
const lastWallId = localStorage.getItem(LAST_WALL_KEY);

function showWall(id){
  walls.forEach(w => w.classList.remove('active'));
  const pane = document.getElementById(id);
  if (pane) pane.classList.add('active');

  navButtons.forEach(b => {
    const isActive = b.dataset.target === id;
    b.classList.toggle('active', isActive);
    if (isActive) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });

  localStorage.setItem(LAST_WALL_KEY, id);
}

// Bind clics
navButtons.forEach(btn => {
  btn.addEventListener('click', () => showWall(btn.dataset.target));
});

// Affiche au chargement
if (lastWallId && document.getElementById(lastWallId)) {
  showWall(lastWallId);
} else {
  const first = navButtons[0];
  if (first) showWall(first.dataset.target);
}

/* ===========================
   JUKEBOX YOUTUBE
   =========================== */

let player;

// ✅ Mets ici ton ID de playlist YouTube
const PLAYLIST_ID = 'YOUR_YT_PLAYLIST_ID';

// Sélecteurs utiles
const $ = (id) => document.getElementById(id);
const btnPlay = $('jb-play');
const btnNext = $('jb-next');
const btnPrev = $('jb-prev');
const btnMute = $('jb-mute');

// API ready callback (appelée par YouTube)
window.onYouTubeIframeAPIReady = function(){
  const target = document.getElementById('yt-jukebox');
  if (!target) return;

  player = new YT.Player('yt-jukebox', {
    height: '0',
    width:  '0',
    playerVars: {
      listType: 'playlist',
      list: PLAYLIST_ID,
      autoplay: 0,
      controls: 0,
      modestbranding: 1,
      rel: 0
    },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange,
      onError: (e) => console.warn('[Jukebox] YT error:', e.data)
    }
  });
};

function onPlayerReady(){
  // Fils events
  if (btnPlay) btnPlay.onclick = togglePlay;
  if (btnNext) btnNext.onclick = () => player && player.nextVideo();
  if (btnPrev) btnPrev.onclick = () => player && player.previousVideo();
  if (btnMute) btnMute.onclick = toggleMute;

  // Volume de départ doux
  try { player.setVolume(50); } catch {}
  // Icône initiale
  setPlayIcon(false);
  setMuteIcon(player.isMuted && player.isMuted());
}

function onPlayerStateChange(e){
  // 1 = PLAYING, 2 = PAUSED, 0 = ENDED
  setPlayIcon(e.data === YT.PlayerState.PLAYING);
  if (e.data === YT.PlayerState.ENDED) {
    // Option: passer automatiquement à la suivante (YT le fait déjà en playlist)
  }
}

function togglePlay(){
  if (!player || !player.getPlayerState) return;
  const state = player.getPlayerState();
  if (state === YT.PlayerState.PLAYING) {
    player.pauseVideo();
    setPlayIcon(false);
  } else {
    // Lecture autorisée uniquement suite à une interaction utilisateur (OK ici)
    player.playVideo();
    setPlayIcon(true);
  }
}

function toggleMute(){
  if (!player || !player.isMuted) return;
  if (player.isMuted()) {
    player.unMute();
    setMuteIcon(false);
  } else {
    player.mute();
    setMuteIcon(true);
  }
}

function setPlayIcon(isPlaying){
  if (!btnPlay) return;
  // Si tu utilises mes SVG, alterne display none/block ici.
  // Ici on swap l’emoji pour rester simple :
  btnPlay.textContent = isPlaying ? '⏸️' : '▶️';
}

function setMuteIcon(isMuted){
  if (!btnMute) return;
  btnMute.textContent = isMuted ? '🔈' : '🔇';
}

// Charger l'API YouTube une seule fois
(function loadYTAPI(){
  if (!PLAYLIST_ID || PLAYLIST_ID === 'YOUR_YT_PLAYLIST_ID') {
    console.warn('[Jukebox] Renseigne PLAYLIST_ID pour activer la musique.');
  }
  if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  }
})();

/* ===========================
   RACCOURCIS CLAVIER (option)
   =========================== */
// Espace = Play/Pause, ← = Prev, → = Next, M = Mute
window.addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toLowerCase();
  // Évite de casser la saisie dans inputs/textareas
  if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;

  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  else if (e.code === 'ArrowRight') { e.preventDefault(); btnNext?.click(); }
  else if (e.code === 'ArrowLeft') { e.preventDefault(); btnPrev?.click(); }
  else if (e.key.toLowerCase() === 'm') { e.preventDefault(); toggleMute(); }
});
