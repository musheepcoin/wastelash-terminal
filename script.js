// =========================
// Wastelash - Script moteur
// Lit conversation.json et rend les nœuds dynamiquement
// =========================

// Références DOM
const bloc2   = document.getElementById('interaction-content');
const input   = document.getElementById('code-input');
const feed    = document.getElementById('feedback-line');
const choices = document.getElementById('choices');

// Accès
const ACCESS_CODE = 'XR5MT';
let loggedIn = false;

// État UI
let lastChoices = [];

// État narration (chargé depuis conversation.json)
let ARB = null;   // arborescence (JSON)
let NODE = null;  // node courant
let VARS = {};    // variables globales (ex: nsfw, reputation, etc.)

// =========================
// Affichage console (Bloc 2)
// =========================
function say(line){
  // écrase (pas d'historique)
  bloc2.textContent = String(line ?? '');
  bloc2.scrollTop = bloc2.scrollHeight;
}

// Helpers UI
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

// =========================
// Raccourcis clavier 1..9
// (ligne du haut Digit1..9 + numpad Numpad1..9)
// =========================
document.addEventListener('keydown', (e)=>{
  if(!loggedIn) return;

  // ignorer si focus sur un champ éditable
  if (e.target && (e.target.tagName === 'INPUT' || e.target.isContentEditable)) return;

  let idx = -1;
  if (e.code && /^Digit[1-9]$/.test(e.code)) {
    idx = parseInt(e.code.replace('Digit',''), 10) - 1;
  } else if (e.code && /^Numpad[1-9]$/.test(e.code)) {
    idx = parseInt(e.code.replace('Numpad',''), 10) - 1;
  }

  if (idx >= 0 && lastChoices[idx]) {
    e.preventDefault();
    lastChoices[idx].onClick();
  }
});

// =========================
// Génériques & helpers
// =========================
function genCode(n=5){
  const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let o=''; while(o.length<n) o += a[Math.floor(Math.random()*a.length)];
  return o;
}

// Templating très simple: {{var}} et {{genCode(n)}}
function template(str) {
  return String(str)
    .replace(/\{\{\s*([a-zA-Z_][\w]*)\s*\}\}/g, (_, k) => (VARS[k] !== undefined ? VARS[k] : ''))
    .replace(/\{\{\s*genCode\((\d+)\)\s*\}\}/g, (_, n) => genCode(parseInt(n,10)||5));
}

// Affiche les lignes d'un nœud
function renderSay(lines=[]) {
  const text = (Array.isArray(lines) ? lines : [lines]).map(template).join('\n');
  say(text);
}

// Conditions "safe": nsfw == true, karma >= 2, etc.
function evalCond(cond="") {
  try {
    // Remplace les variables par VARS["x"]
    const expr = String(cond).replace(/\b([a-zA-Z_]\w*)\b/g, (m)=>{
      return (m in VARS) ? `VARS["${m}"]` : m;
    });
    // eslint-disable-next-line no-new-func
    return !!Function('VARS', `return (${expr});`)(VARS);
  } catch {
    return false;
  }
}

// Actions: toggle:x | set:x=val | system:disconnect
function applyActions(list=[]) {
  for (const act of list) {
    if (typeof act !== 'string') continue;

    if (act.startsWith('toggle:')) {
      const k = act.split(':')[1];
      VARS[k] = !VARS[k];
    }
    else if (act.startsWith('set:')) {
      const [, kv] = act.split(':');
      const [k, vRaw] = kv.split('=');
      const vTrim = (vRaw ?? '').trim();
      if (vTrim === 'true') VARS[k] = true;
      else if (vTrim === 'false') VARS[k] = false;
      else if (!isNaN(Number(vTrim)) && vTrim !== '') VARS[k] = Number(vTrim);
      else VARS[k] = vTrim;
    }
    else if (act === 'system:disconnect') {
      bye();
      return 'DISCONNECT';
    }
  }
  return 'OK';
}

// Navigation
function gotoNode(id) {
  const n = ARB?.nodes?.[id];
  if (!n) { say(`Fixer: bad node "${id}"`); setChoices([]); return; }

  NODE = n;
  renderSay(NODE.say || '');

  const items = [];
  (NODE.choices || []).forEach((c) => {
    if (c.if && !evalCond(c.if)) return; // masque si condition fausse
    items.push({
      label: c.label || '...',
      onClick: () => {
        // éventuel "say" du choix avant navigation
        if (c.say) renderSay(c.say);

        // exécuter actions
        const status = applyActions(c.actions || []);
        if (status === 'DISCONNECT') return;

        // navigation
        if (c.goto) gotoNode(c.goto);
        else setChoices([]); // pas de destination = fin / attente
      }
    });
  });
  setChoices(items);
}

// =========================
// Chargement du JSON
// =========================
async function loadConversation() {
  try {
    const res = await fetch('conversation.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    ARB = await res.json();
    VARS = { ...(ARB.vars || {}) };
    const start = ARB.start || 'root';
    gotoNode(start);
  } catch (err) {
    console.error('Failed to load conversation.json:', err);
    say('Fixer: conversation offline. Try again later.');
    setChoices([]);
  }
}

// =========================
// Login & Déconnexion
// =========================
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

      // >>> lance l’arborescence depuis le JSON
      loadConversation();

    } else {
      feed.textContent = 'ACCESS DENIED.';
    }
  }
});

function bye(){
  say('Fixer: Smart choice. Disconnecting.');
  loggedIn = false;
  showChoices(false);
  const to = document.getElementById('terminal-output'); if(to) to.style.display='';
  document.querySelector('.input-line').style.display = 'flex';
  input.value=''; input.disabled=false; input.focus();

  // reset état narration
  ARB = null; NODE = null; VARS = {};
}

// Init UI
showChoices(false);
