// Références
const bloc2   = document.getElementById('interaction-content');
const input   = document.getElementById('code-input');
const feed    = document.getElementById('feedback-line');
const choices = document.getElementById('choices');

const ACCESS_CODE = 'XR5MT';
let nsfw = false;
let loggedIn = false;
let lastChoices = [];

// === Log en colonne continue (sans encadrement) ===
// CHANGE: écrase l'affichage (pas d'historique)
function say(line){
  bloc2.textContent = line; // écrase l'affichage précédent
  bloc2.scrollTop = bloc2.scrollHeight;
}

// === Bloc 3 : helpers (liste numérotée) ===
function showChoices(show){ choices.style.display = show ? 'block' : 'none'; }

function setChoices(list){
  lastChoices = list.slice();
  choices.innerHTML = '';
  const ol = document.createElement('ol');
  list.forEach((item)=> {
    const li = document.createElement('li');
    li.textContent = String(item.label).replace(/^\d+\)\s*/, '');
    li.addEventListener('click', item.onClick);
    ol.appendChild(li);
  });
  choices.appendChild(ol);
}

// Raccourcis clavier 1..9
// CHANGE: supporte AZERTY/QWERTY (Digit1..9) + Numpad (Numpad1..9)
document.addEventListener('keydown', (e)=>{
  if(!loggedIn) return;

  // ne pas interférer si un champ éditable a le focus
  if (e.target && (e.target.tagName === 'INPUT' || e.target.isContentEditable)) return;

  let idx = -1;

  // Ligne du haut (au-dessus des lettres) — indépendant de la disposition clavier
  if (e.code && /^Digit[1-9]$/.test(e.code)) {
    idx = parseInt(e.code.replace('Digit',''), 10) - 1;
  }
  // Pavé numérique (NumLock ON)
  else if (e.code && /^Numpad[1-9]$/.test(e.code)) {
    idx = parseInt(e.code.replace('Numpad',''), 10) - 1;
  }

  if (idx >= 0 && lastChoices[idx]) {
    e.preventDefault();
    lastChoices[idx].onClick();
  }
});

// Menu principal
function menu(){
  setChoices([
    { label:'Ask about prints',    onClick: ()=>{ say('Fixer: Prints? Proof, fake, who cares.'); menu(); } },
    { label:'Trade a rumor',       onClick: ()=>{ say('Fixer: Rumor—The NCR president snores louder than ghouls.'); menu(); } },
    { label:'Request a discount',  onClick: ()=>{ say('Fixer: One-time code: '+genCode()+'. Don’t waste it.'); menu(); } },
    { label:'Stupid question',     onClick: ()=>{ say('Fixer: Congratulations. You wasted my time.'); menu(); } },
    { label:`Toggle NSFW (${nsfw?'ON':'OFF'})`, onClick: ()=>{ nsfw=!nsfw; say('Fixer: NSFW mode: '+(nsfw?'ON':'OFF')); menu(); } },
    { label:'Disconnect',          onClick: bye }
  ]);
}

function genCode(n=5){
  const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let o=''; while(o.length<n) o += a[Math.floor(Math.random()*a.length)];
  return o;
}

// Login (Enter)
input.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter'){
    const val = (input.value || '').toUpperCase().trim();
    if(val === ACCESS_CODE){
      feed.textContent = '';
      say('Fixer: Connection established. Wastelash online.');
      const to = document.getElementById('terminal-output'); if(to) to.style.display='none';
      document.querySelector('.input-line').style.display = 'none';
      loggedIn = true;
      showChoices(true);
      menu();
    } else {
      feed.textContent = 'ACCESS DENIED.';
    }
  }
});

// Déconnexion
function bye(){
  say('Fixer: Smart choice. Disconnecting.');
  loggedIn = false;
  showChoices(false);
  const to = document.getElementById('terminal-output'); if(to) to.style.display='';
  document.querySelector('.input-line').style.display = 'flex';
  input.value=''; input.disabled=false; input.focus();
}

// Init
showChoices(false);
