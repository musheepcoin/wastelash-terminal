// --- NAV DES MURS (ne cible que les boutons ayant data-target) ---
const navButtons = document.querySelectorAll('header .menu button[data-target]');
const walls = document.querySelectorAll('.wall');

navButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    navButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    walls.forEach(w => w.classList.remove('active'));
    const target = btn.dataset.target;
    const pane = document.getElementById(target);
    if (pane) pane.classList.add('active');
  });
});

// --- JUKEBOX YOUTUBE ---
let player;

// YouTube Iframe API callback
function onYouTubeIframeAPIReady(){
  // Lecteur invisible (audio only) : veille à avoir <div id="yt-jukebox"></div> dans le HTML
  player = new YT.Player('yt-jukebox', {
    height: '0',
    width: '0',
    videoId: '3jeZn50KHSs', // ID de la vidéo Ambiencecollector
    playerVars: {
      autoplay: 0,            // démarre seulement sur clic
      controls: 0,
      modestbranding: 1,
      rel: 0,
      loop: 1,                // boucle ON
      playlist: '3jeZn50KHSs' // requis par YouTube pour boucler une vidéo unique
      // si tu veux démarrer à 4449s : start: 4449
    },
    events: {
      onReady: bindControls,
      onStateChange: onStateChange
    }
  });
}

// Lier les boutons du mini-lecteur
function bindControls(){
  const $ = s => document.getElementById(s);
  const play = $('jb-play');
  const next = $('jb-next');
  const prev = $('jb-prev');
  const mute = $('jb-mute');

  if (play) play.onclick = togglePlay;
  if (next) next.onclick = () => player && player.nextVideo();      // n’aura pas d’effet sans vraie playlist
  if (prev) prev.onclick = () => player && player.previousVideo();  // idem
  if (mute) mute.onclick = toggleMute;
}

// Met à jour l’icône play/pause
function onStateChange(e){
  const playBtn = document.getElementById('jb-play');
  if (!playBtn) return;
  if (e.data === YT.PlayerState.PLAYING) playBtn.textContent = '⏸️';
  if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) playBtn.textContent = '▶️';
}

// Play / Pause (nécessite un clic utilisateur pour démarrer)
function togglePlay(){
  if (!player) return;
  const state = player.getPlayerState();
  if (state === YT.PlayerState.PLAYING) {
    player.pauseVideo();
  } else {
    player.playVideo();
  }
}

// Mute / Unmute
function toggleMute(){
  if (!player) return;
  if (player.isMuted()) player.unMute();
  else player.mute();
}

// Charger l'API YouTube une seule fois
(function(){
  if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  }
})();
