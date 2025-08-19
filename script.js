// === DOM refs ===
const bloc2     = document.getElementById('interaction-content'); // DISPLAY (Block 2)
const output    = document.getElementById('terminal-output');     // kept for layout, no text
const choices   = document.getElementById('choices');
const inputLine = document.querySelector('.input-line');          // <div class="input-line">
const codeInput = document.getElementById('code-input');          // the <input> inside

// === State ===
let conversation = {};
let currentNode  = null;
let lastChoices  = [];
let unlocks      = { discount: false, nsfw: false };
let requestContext = null; // "discount" | "nsfw" | null

// === Helpers: show only current text in Block 2 (no history) ===
function say(line){
  bloc2.textContent = line; // overwrite
  bloc2.scrollTop = bloc2.scrollHeight;
}

// === Choices UI ===
function showChoices(show){ choices.style.display = show ? 'block' : 'none'; }

function setChoices(list){
  lastChoices = list.slice();
  choices.innerHTML = '';
  const ol = document.createElement('ol');

  list.forEach((item, idx)=> {
    const li = document.createElement('li');
    const clean = String(item.label).replace(/^\s*\d+\)\s*/, '');
    li.textContent = `${idx+1}) ${clean}`;   // render numbering ourselves
    li.addEventListener('click', item.onClick);
    ol.appendChild(li);
  });

  choices.appendChild(ol);
  showChoices(list.length > 0);
  choices.scrollTop = 0; // ensure it’s pinned to the top
}


// === Boot sequence (~3s) ===
const bootLines = [
  "> Establishing uplink...",
  "> Signal unstable... rerouting through wasteland node.",
  "> [OK] Connection hijacked.",
  "> Fixer online."
];

function bootSequence(){
  let i = 0;
  function nextLine(){
    if (i < bootLines.length){
      say(bootLines[i]);
      i++;
      setTimeout(nextLine, 700);
    } else {
      loadConversation();
    }
  }
  nextLine();
}

// === Dialogue system ===
async function loadConversation(){
  const res = await fetch('conversation.json');
  conversation = await res.json();
  gotoNode('root');
}

function gotoNode(nodeId){
  currentNode = conversation.nodes[nodeId];
  if (!currentNode) return;

  // Hide input by default (only visible on locked nodes)
  hideCodePrompt();

  // Show ONLY current text in Block 2
  let text = currentNode.say ? currentNode.say.join("\n") : "";
  text = text.replace("{{genCode(5)}}", genCode(5));
  say(text);

  // Actions
  if (currentNode.actions){
    currentNode.actions.forEach(a => runAction(a));
  }

  // Choices + routing
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
      gotoNode(c.goto);
    }
  })));

  // If locked node, show code prompt
  if (nodeId === "discount_locked" || nodeId === "nsfw_locked"){
    showCodePrompt("ENTER CODE");
  }
}

// === Actions ===
function runAction(action){
  if (action.startsWith("toggle:")){
    const key = action.split(":")[1];
    unlocks[key] = !unlocks[key];
  }
  if (action === "system:disconnect"){
    say("> Disconnected.");
    showChoices(false);
  }
}

// === Code prompt visibility (safe even if inputLine is null) ===
function showCodePrompt(ph=">"){
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

// === Terminal input: unlock code when visible ===
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
        say("Fixer: Code XR5MT accepted. Discount unlocked.");
        return gotoNode("discount_unlocked");
      } else if (requestContext === "nsfw"){
        say("Fixer: Code XR5MT accepted. NSFW unlocked.");
        return gotoNode("nsfw_unlocked");
      } else {
        say("Fixer: Code XR5MT accepted. Doors are open.");
        return;
      }
    }

    // Wrong code
    say("> " + cmd + " : ACCESS DENIED");
    showCodePrompt("TRY AGAIN");
  });
}

/// === Keyboard shortcuts 1–9 ===
document.addEventListener("keydown", (e)=>{
  // If the unlock input is visible & focused, never hijack keys
  const inputVisible = inputLine && inputLine.style.display !== 'none';
  if (inputVisible && document.activeElement === codeInput) return;

  if (!lastChoices.length) return;

  const map = {
    Digit1:0, Digit2:1, Digit3:2, Digit4:3, Digit5:4, Digit6:5, Digit7:6, Digit8:7, Digit9:8,
    Numpad1:0, Numpad2:1, Numpad3:2, Numpad4:3, Numpad5:4, Numpad6:5, Numpad7:6, Numpad8:7, Numpad9:8
  };
  const idx = map[e.code];
  if (idx === undefined) return;

  // prevent stray characters from appearing anywhere
  e.preventDefault();

  if (lastChoices[idx]) lastChoices[idx].onClick();
});


// === Code generator (for discount_unlocked) ===
function genCode(length){
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i=0; i<length; i++){
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// === Start ===
window.onload = () => {
  showChoices(false);
  hideCodePrompt(); // hidden by default
  bootSequence();
};
