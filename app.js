const words = VOCAB.map(([unit, theme, fr, en, zh], id) => ({ id, unit, theme, fr, en, zh }));
const $ = (sel) => document.querySelector(sel);

const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem("vocab:" + key); return v === null ? fallback : JSON.parse(v); }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem("vocab:" + key, JSON.stringify(value)); } catch {}
  },
};

const state = {
  mode: store.get("mode", "table"),
  units: new Set(store.get("units", [0, 1, 2])),
  theme: "all",
  showZh: store.get("showZh", true),
  query: "",
  direction: store.get("direction", "en-fr"),
  deck: [],
  pos: 0,
  missed: new Set(),
  knownCount: 0,
};

// Prononciation (voix française du navigateur)
let frVoice = null;
function pickVoice() {
  const voices = speechSynthesis.getVoices();
  frVoice = voices.find((v) => v.lang === "fr-FR") || voices.find((v) => v.lang.startsWith("fr")) || null;
}
if ("speechSynthesis" in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}
function speak(text) {
  if (!("speechSynthesis" in window)) return;
  // Retire les annotations (m.), (f.) et les parenthèses de genre pour une lecture naturelle
  const clean = text.replace(/\((m|f)\.\)/g, "").replace(/\(([a-zé]+)\)/gi, "").replace(/–/g, ",");
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = "fr-FR";
  if (frVoice) u.voice = frVoice;
  u.rate = 0.85;
  speechSynthesis.speak(u);
}

function filtered() {
  const q = state.query.trim().toLowerCase();
  return words.filter((w) =>
    state.units.has(w.unit) &&
    (state.theme === "all" || w.theme === state.theme) &&
    (!q || [w.fr, w.en, w.zh].some((s) => s.toLowerCase().includes(q)))
  );
}

function themesForUnits() {
  const seen = [];
  for (const w of words) if (state.units.has(w.unit) && !seen.includes(w.theme)) seen.push(w.theme);
  return seen;
}

function renderUnits() {
  const box = $("#units");
  box.innerHTML = "";
  for (const [u, label] of Object.entries(UNITS)) {
    const b = document.createElement("button");
    b.className = "chip";
    b.textContent = label;
    b.setAttribute("aria-pressed", state.units.has(+u));
    b.onclick = () => {
      if (state.units.has(+u) && state.units.size === 1) return;
      state.units.has(+u) ? state.units.delete(+u) : state.units.add(+u);
      store.set("units", [...state.units]);
      renderUnits();
      renderThemes();
      refresh();
    };
    box.appendChild(b);
  }
}

function renderThemes() {
  const sel = $("#theme");
  const themes = themesForUnits();
  if (!themes.includes(state.theme)) state.theme = "all";
  sel.innerHTML = `<option value="all">Tous les thèmes (${words.filter((w) => state.units.has(w.unit)).length} mots)</option>` +
    themes.map((t) => `<option value="${t}">${t} (${words.filter((w) => w.theme === t).length})</option>`).join("");
  sel.value = state.theme;
}

function esc(s) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function renderTable() {
  const list = filtered();
  const out = $("#tables");
  if (!list.length) { out.innerHTML = `<p class="empty">Aucun mot trouvé.</p>`; return; }
  const groups = new Map();
  for (const w of list) {
    const key = w.unit + "|" + w.theme;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(w);
  }
  out.innerHTML = [...groups].map(([key, ws]) => {
    const [unit, theme] = key.split("|");
    return `<div class="group">
      <h2>${esc(theme)} <small>Unité ${unit}</small></h2>
      <table>
        <thead><tr><th class="sp"></th><th>Français</th><th>English</th><th class="zh">中文</th></tr></thead>
        <tbody>${ws.map((w) => `<tr>
          <td class="sp"><button class="mini" data-say="${w.id}" aria-label="Écouter ${esc(w.fr)}">🔊</button></td>
          <td class="fr">${esc(w.fr)}</td><td class="en">${esc(w.en)}</td><td class="zh">${esc(w.zh)}</td>
        </tr>`).join("")}</tbody>
      </table></div>`;
  }).join("");
}

$("#tables").addEventListener("click", (e) => {
  const b = e.target.closest("[data-say]");
  if (b) speak(words[+b.dataset.say].fr);
});

// Flashcards
const LABELS = { fr: "Français", en: "English", zh: "中文" };

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function newDeck(list, mix = true) {
  state.deck = mix ? shuffle(list) : [...list];
  state.pos = 0;
  state.missed = new Set();
  state.knownCount = 0;
  $("#done").hidden = true;
  renderCard();
}

function renderCard() {
  const card = $("#card");
  card.classList.remove("flipped");
  const total = state.deck.length;
  const finished = state.pos >= total;
  $("#done").hidden = !finished;
  card.style.visibility = finished || !total ? "hidden" : "visible";
  $(".nav").style.visibility = finished || !total ? "hidden" : "visible";
  if (!total) { $("#progress").textContent = "Aucun mot pour ce filtre."; return; }
  if (finished) {
    $("#progress").textContent = "";
    $("#doneText").textContent = `Terminé ! ${state.knownCount} / ${total} mots connus.`;
    $("#redoMissed").hidden = state.missed.size === 0;
    return;
  }
  const w = state.deck[state.pos];
  const [from, to] = state.direction.split("-");
  $("#progress").textContent = `${state.pos + 1} / ${total} · ${w.theme}`;
  // Le contenu de la face arrière est posé après la rotation pour ne pas dévoiler la réponse
  $("#frontLabel").textContent = LABELS[from];
  $("#frontWord").textContent = w[from];
  setTimeout(() => {
    $("#backLabel").textContent = LABELS[to];
    $("#backWord").textContent = w[to];
    const others = ["fr", "en", "zh"].filter((k) => k !== from && k !== to && (k !== "zh" || state.showZh));
    $("#backExtra").textContent = others.map((k) => w[k]).join(" · ");
  }, 200);
}

function flip() {
  if (state.pos >= state.deck.length) return;
  const card = $("#card");
  card.classList.toggle("flipped");
  const w = state.deck[state.pos];
  if (card.classList.contains("flipped") && state.direction.endsWith("fr")) speak(w.fr);
}

function go(delta) {
  state.pos = Math.max(0, Math.min(state.deck.length, state.pos + delta));
  renderCard();
}

function mark(known) {
  if (state.pos >= state.deck.length) return;
  const w = state.deck[state.pos];
  if (known) { state.knownCount++; state.missed.delete(w); }
  else state.missed.add(w);
  go(1);
}

$("#card").addEventListener("click", (e) => { if (!e.target.closest("#cardSpeak")) flip(); });
$("#cardSpeak").addEventListener("click", () => speak(state.deck[state.pos].fr));
$("#prev").onclick = () => go(-1);
$("#next").onclick = () => go(1);
$("#known").onclick = () => mark(true);
$("#again").onclick = () => mark(false);
$("#shuffle").onclick = () => newDeck(filtered());
$("#restart").onclick = () => newDeck(filtered());
$("#redoMissed").onclick = () => newDeck([...state.missed]);
$("#direction").onchange = (e) => {
  state.direction = e.target.value;
  store.set("direction", state.direction);
  renderCard();
};

// Glisser gauche/droite sur mobile
let touchX = null;
$("#card").addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
$("#card").addEventListener("touchend", (e) => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  touchX = null;
  if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
});

document.addEventListener("keydown", (e) => {
  if (state.mode !== "cards" || e.target.matches("input, select")) return;
  if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); }
  else if (e.key === "ArrowRight") go(1);
  else if (e.key === "ArrowLeft") go(-1);
});

// Général
function setMode(mode) {
  state.mode = mode;
  store.set("mode", mode);
  document.querySelectorAll(".tabs button").forEach((b) => b.setAttribute("aria-selected", b.dataset.mode === mode));
  $("#tableView").hidden = mode !== "table";
  $("#cardsView").hidden = mode !== "cards";
  refresh();
}

function refresh() {
  if (state.mode === "table") renderTable();
  else newDeck(filtered());
}

document.querySelectorAll(".tabs button").forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));
$("#theme").onchange = (e) => { state.theme = e.target.value; refresh(); };
$("#search").oninput = (e) => { state.query = e.target.value; renderTable(); };
$("#showZh").onchange = (e) => {
  state.showZh = e.target.checked;
  store.set("showZh", state.showZh);
  document.body.classList.toggle("no-zh", !state.showZh);
  const zhOpt = $('#direction option[value="zh-fr"]');
  zhOpt.hidden = !state.showZh;
  if (!state.showZh && state.direction === "zh-fr") { state.direction = "en-fr"; $("#direction").value = "en-fr"; }
  if (state.mode === "cards") renderCard();
};

$("#showZh").checked = state.showZh;
document.body.classList.toggle("no-zh", !state.showZh);
$('#direction option[value="zh-fr"]').hidden = !state.showZh;
$("#direction").value = state.direction;
renderUnits();
renderThemes();
setMode(state.mode);
