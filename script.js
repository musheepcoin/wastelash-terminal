// === DOM refs ===
const bloc2       = document.getElementById('interaction-content'); // DISPLAY (Block 2, no history)
const choices     = document.getElementById('choices');
const inputLine   = document.querySelector('.input-line');          // shown only on locked nodes
const codeInput   = document.getElementById('code-input');          // terminal-like input (no white bg)
const terminalOut = document.getElementById('terminal-output');     // unused (kept for layout)
const feedback    = document.getElementById('feedback-line');       // unused

// Stacks (+ legacy connect gate)
const stackTerm   = document.getElementById('terminal-stack');
const stackTrade  = document.getElementById('trade-stack');
const connectGate = document.getElementById('connect-gate'); // peut ne pas exister
const btnConnect  = document.getElementById('btn-connect');  // idem

// === Boot: toujours une vidéo ===
const BOOT_VIDEO_SRC = 'RENO5.mp4';

// === State ===
let conversation   = {};
let currentNode    = null;
let lastChoices    = [];
let unlocks        = { discount: false, nsfw: false };
let requestContext = null; // "discount" | "nsfw" | null
let isConnected    = false; // passe à true après "Connect to the Outpost"

// === Helpers (Bloc 2) ===
function say(line){
  bloc2.textContent = line;
  bloc2.scrollTop = bloc2.scrollHeight;
}
function sayAppend(line){
  bloc2.textContent = bloc2.textContent ? (bloc2.textContent + "\n" + line) : line;
  bloc2.scrollTop = bloc2.scrollHeight;
}
function clearLog(){ bloc2.textContent = ""; }

// Choix
function showChoices(show){ choices.style.display = show ? 'block' : 'none'; }
function setChoices(list){
  lastChoices = list.slice();
  choices.innerHTML = '';
  const ol = document.createElement('ol');
  list.forEach((item, idx)=> {
    const li = document.createElement('li');
    const clean = String(item.label).replace(/^\s*\d+\)\s*/, '');
    li.textContent = `${idx+1}. ${clean}`;
    li.addEventListener('click', item.onClick);
    ol.appendChild(li);
  });
  choices.appendChild(ol);
  showChoices(list.length > 0);
  choices.scrollTop = 0;
}

// === Fixer screen controls (Bloc 1 : image/vidéo) ===
function getVisualElems(){
  return {
    wrap:  document.getElementById('confession-screen'),
    img:   document.getElementById('fixer-visual-img'),
    video: document.getElementById('fixer-visual-video'),
    vsrc:  document.getElementById('fixer-video-source')
  };
}

function hideFixerScreen(){
  const { wrap, video, img } = getVisualElems();
  if (video){
    try { video.pause(); } catch(e){}
    video.currentTime = 0;
    video.hidden = true;
  }
  if (img){
    img.hidden = true;
    img.removeAttribute('src');
  }
  if (wrap){
    wrap.hidden = true;
    wrap.style.display = 'none';
  }
}

// Affiche une image (utilisable pendant la conversation)
function showImage(src){
  const { wrap, img, video } = getVisualElems();
  if (!wrap || !img || !video) return;

  try { video.pause(); } catch(e){}
  video.hidden = true;

  img.src = src;
  img.hidden = false;

  wrap.hidden = false;
  wrap.style.display = 'block';
}

// Affiche une vidéo (boot ou plus tard)
function showVideo(src){
  const { wrap, img, video, vsrc } = getVisualElems();
  if (!wrap || !img || !video || !vsrc) return;

  img.hidden = true;

  if (src && vsrc.src !== src) vsrc.src = src;
  video.load();
  video.hidden = false;

  wrap.hidden = false;
  wrap.style.display = 'block';

  // Autoplay (muted => OK mobile)
  video.muted = true;
  video.play().catch(()=>{
    video.addEventListener('canplay', ()=> video.play().catch(()=>{}), { once:true });
  });
}

// ✅ PRIMER: capture le geste utilisateur (autoplay mobile)
function primeFixerVideo(){
  const { video } = getVisualElems();
  if (!video) return;
  video.muted = true;
  video.play().then(()=> { video.pause(); video.currentTime = 0; }).catch(()=>{});
}

// === Code prompt visibility ===
function showCodePrompt(ph="ENTER CODE"){
  if (!inputLine || !codeInput) return;
  inputLine.style.display = 'flex';
  codeInput.disabled = false;
  codeInput.setAttribute("placeholder", ph);
  setTimeout(()=> codeInput.focus(), 0);
}
function hideCodePrompt(){
  if (!inputLine || !codeInput) return;
  inputLine.style.display = 'none';
  codeInput.disabled = true;
  codeInput.value = "";
  codeInput.removeAttribute("placeholder");
}

// === Boot sequence (vidéo au chargement) ===
const bootLines = [
  "> Establishing uplink...",
  "> Signal unstable... rerouting through wasteland node.",
  "> [OK] Connection hijacked.",
  "> Fixer online."
];
function bootSequence(){
  clearLog();
  let i = 0;
  function nextLine(){
    if (i < bootLines.length){
      sayAppend(bootLines[i]);
      i++;
      setTimeout(nextLine, 700);
    } else {
      setTimeout(()=>{
        clearLog();
        showVideo(BOOT_VIDEO_SRC);  // ← toujours une vidéo au boot
        loadConversation();
      }, 300);
    }
  }
  nextLine();
}

// === Templating ===
function applyTemplates(text){
  if (!text) return "";
  text = text.replace(/{{\s*genCode\((\d+)\)\s*}}/g, (_, n)=> genCode(parseInt(n,10) || 5));
  text = text.replace(/{{\s*(nsfw|discount)\s*}}/g, (_, key)=> String(!!unlocks[key]));
  return text;
}

// === Dialogue system ===
async function loadConversation(){
  try{
    const res = await fetch('conversation.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    conversation = await res.json();
    gotoNode(conversation?.start || 'root');
  }catch(err){
    say(`> ERROR: cannot load conversation.json (${err.message})`);
    showChoices(false);
  }
}

function gotoNode(nodeId){
  currentNode = conversation?.nodes?.[nodeId];
  if (!currentNode) return;
  hideCodePrompt();

  const rawSay = currentNode.say;
  let text = Array.isArray(rawSay) ? rawSay.join("\n") : (typeof rawSay === 'string' ? rawSay : "");
  text = applyTemplates(text);
  say(text);

  const enterActs = currentNode.enter_actions || currentNode.actions;
  if (Array.isArray(enterActs)){ enterActs.forEach(a => runAction(a)); }

  setChoices((currentNode.choices || []).map((c)=>({
    label: c.label,
    onClick: ()=> {
      if (c.goto === "discount_locked"){
        requestContext = "discount";
        return unlocks.discount ? gotoNode("discount_unlocked") : gotoNode("discount_locked");
      }
      if (c.goto === "nsfw_locked"){
        requestContext = "nsfw";
        return unlocks.nsfw ? gotoNode("nsfw_unlocked") : gotoNode("nsfw_locked");
      }
      requestContext = null;

      if (Array.isArray(c.actions)) c.actions.forEach(a => runAction(a));
      if (c.say){
        const s = Array.isArray(c.say) ? c.say.join("\n") : String(c.say);
        say(applyTemplates(s));
      }
      if (c.goto) gotoNode(c.goto);
    }
  })));

  if (nodeId === "discount_locked" || nodeId === "nsfw_locked"){
    showCodePrompt("ENTER CODE");
  }
}

// === Session helpers ===
function showConnectChoice(){
  // Active les raccourcis numériques dès l’écran d’arrivée
  isConnected = true;

  hideFixerScreen();          // Bloc 1 off
  clearLog();                 // Bloc 2 -> vide
  say("> Awaiting connection...");
  setChoices([
    { label: "Connect to the Outpost", onClick: () => {
        primeFixerVideo();    // primer autoplay mobile
        hideFixerScreen();
        bootSequence();       // la vidéo sera lancée en fin de boot
      }
    }
  ]);
}

// === Soft reboot (optionnel) ===
function softReboot(){
  clearLog();
  bootSequence();
}

// === Actions (depuis conversation.json) ===
function runAction(action){
  if (!action || typeof action !== 'string') return;

  if (action.startsWith("toggle:")){
    const key = action.split(":")[1];
    unlocks[key] = !unlocks[key];

  } else if (action === "system:disconnect"){
    unlocks.discount = false;
    unlocks.nsfw = false;
    say("> Disconnected.");
    hideCodePrompt();
    showChoices(false);
    setTimeout(()=> showConnectChoice(), 600);

  } else if (action.startsWith("showImage:")){
    const src = action.slice("showImage:".length).trim();
    if (src) showImage(src);

  } else if (action.startsWith("showVideo:")){
    const src = action.slice("showVideo:".length).trim();
    showVideo(src || BOOT_VIDEO_SRC);

  } else if (action === "hideVisual"){
    hideFixerScreen();
  }
}

// === Code validation ===
if (codeInput){
  codeInput.addEventListener("keydown", (e)=>{
    if (e.key !== "Enter") return;
    const cmd = codeInput.value.trim().toUpperCase();
    codeInput.value = "";
    if (!cmd) return;

    if (cmd === "XR5MT"){
      unlocks.discount = true;
      unlocks.nsfw = true;
      hideCodePrompt();

      if (requestContext === "discount"){
        requestContext = null;
        say("Fixer: Code XR5MT accepted. Discount unlocked.");
        return gotoNode("discount_unlocked");
      }
      if (requestContext === "nsfw"){
        requestContext = null;
        say("Fixer: Code XR5MT accepted. NSFW unlocked.");
        return gotoNode("nsfw_unlocked");
      }
      say("Fixer: Code XR5MT accepted. Doors are open.");
      return;
    }

    say("> " + cmd + " : ACCESS DENIED");
    showCodePrompt("TRY AGAIN");
  });
}

// === Keyboard shortcuts ===
document.addEventListener("keydown", (e)=>{
  if (!isConnected) return;

  const inputVisible = inputLine && inputLine.style.display !== 'none';
  if (inputVisible && document.activeElement === codeInput) return;
  if (!lastChoices.length) return;
  const st = document.getElementById('terminal-stack');
  if (st && st.hidden) return;

  const map = {
    Digit1:0, Digit2:1, Digit3:2, Digit4:3, Digit5:4, Digit6:5, Digit7:6, Digit8:7, Digit9:8,
    Numpad1:0, Numpad2:1, Numpad3:2, Numpad4:3, Numpad5:4, Numpad6:5, Numpad7:6, Numpad8:7, Numpad9:8
  };
  const idx = map[e.code];
  if (idx === undefined) return;
  e.preventDefault();
  if (lastChoices[idx]) lastChoices[idx].onClick();
});

// === Code generator ===
function genCode(length){
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i=0; i<length; i++){
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// === Tabs ===
let _choicesWasVisible = false;
function switchTab(target){
  if (!isConnected) return;

  const tabTerm    = document.getElementById('tab-terminal');
  const tabTrade   = document.getElementById('tab-trade');
  const st         = document.getElementById('terminal-stack');
  const tr         = document.getElementById('trade-stack');
  if (!tabTerm || !tabTrade || !st || !tr) return;

  if (target === 'trade'){
    _choicesWasVisible = choices && choices.style.display !== 'none';
    tabTrade.classList.add('active');
    tabTerm.classList.remove('active');
    st.hidden  = true;
    tr.hidden  = false;
    showChoices(false);
    hideCodePrompt();
  } else {
    tabTerm.classList.add('active');
    tabTrade.classList.remove('active');
    tr.hidden = true;
    st.hidden = false;
    if (typeof showChoices === 'function') {
      showChoices(_choicesWasVisible && lastChoices.length > 0);
    }
    const overlay = document.querySelector('.screen-overlay');
    if (overlay) overlay.style.pointerEvents = 'none';
  }
}

document.addEventListener('DOMContentLoaded', ()=>{
  const tabTerm  = document.getElementById('tab-terminal');
  const tabTrade = document.getElementById('tab-trade');
  if (tabTerm)  tabTerm.addEventListener('click',  ()=> switchTab('terminal'));
  if (tabTrade) tabTrade.addEventListener('click', ()=> switchTab('trade'));

  if (connectGate) connectGate.hidden = true;
  btnConnect?.remove();
});

// === Start ===
window.onload = () => {
  if (terminalOut) terminalOut.style.display = 'none';
  if (feedback)    feedback.style.display    = 'none';

  if (stackTerm)  stackTerm.hidden  = false;
  if (stackTrade) stackTrade.hidden = true;

  hideFixerScreen();      // visuel caché avant connexion
  showChoices(false);
  hideCodePrompt();
  showConnectChoice();    // affiche "Connect to the Outpost"
};
