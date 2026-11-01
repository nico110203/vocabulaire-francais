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

// Textes de l'interface dans les trois langues
const I18N = {
  fr: {
    title: "Vocabulaire",
    subtitle: "Unités 0 à 2 · français · English · 中文",
    tabTable: "Tableau",
    tabCards: "Flashcards",
    theme: "Thème",
    allThemes: (n) => `Tous les thèmes (${n} mots)`,
    search: "Rechercher un mot…",
    colFr: "Français", colEn: "English", colZh: "中文",
    unit: "Unité",
    empty: "Aucun mot trouvé.",
    direction: "Sens",
    dirFr: "Français → English + 中文",
    dirOther: "English + 中文 → Français",
    shuffle: "Mélanger",
    flipHint: "Touchez pour retourner",
    again: "À revoir",
    known: "Je sais ✓",
    noCards: "Aucun mot pour ce filtre.",
    done: (k, n) => `Terminé ! ${k} / ${n} mots connus.`,
    redoMissed: "Revoir les mots ratés",
    restart: "Tout recommencer",
    keys: "Clavier : espace = retourner · ← → = naviguer",
  },
  en: {
    title: "Vocabulary",
    subtitle: "Units 0 to 2 · français · English · 中文",
    tabTable: "Table",
    tabCards: "Flashcards",
    theme: "Topic",
    allThemes: (n) => `All topics (${n} words)`,
    search: "Search a word…",
    colFr: "Français", colEn: "English", colZh: "中文",
    unit: "Unit",
    empty: "No word found.",
    direction: "Direction",
    dirFr: "Français → English + 中文",
    dirOther: "English + 中文 → Français",
    shuffle: "Shuffle",
    flipHint: "Tap to flip",
    again: "Review again",
    known: "I know it ✓",
    noCards: "No word for this filter.",
    done: (k, n) => `Done! ${k} / ${n} words known.`,
    redoMissed: "Review missed words",
    restart: "Start over",
    keys: "Keyboard: space = flip · ← → = navigate",
  },
  zh: {
    title: "單字表",
    subtitle: "第 0 至 2 單元 · français · English · 中文",
    tabTable: "表格",
    tabCards: "單字卡",
    theme: "主題",
    allThemes: (n) => `所有主題（${n} 個單字）`,
    search: "搜尋單字…",
    colFr: "法文", colEn: "英文", colZh: "中文",
    unit: "單元",
    empty: "找不到單字。",
    direction: "方向",
    dirFr: "法文 → 英文 + 中文",
    dirOther: "英文 + 中文 → 法文",
    shuffle: "洗牌",
    flipHint: "點一下翻面",
    again: "再複習",
    known: "我會了 ✓",
    noCards: "此篩選沒有單字。",
    done: (k, n) => `完成！認識 ${k} / ${n} 個單字。`,
    redoMissed: "複習答錯的單字",
    restart: "重新開始",
    keys: "鍵盤：空白鍵 = 翻面 · ← → = 切換",
  },
};

const UNIT_NAMES = {
  fr: ["Bienvenue !", "Je suis…", "Près de moi"],
  en: ["Welcome!", "I am…", "Close to me"],
  zh: ["歡迎！", "我是……", "在我身邊"],
};

const THEME_NAMES = {
  "Les pronoms": ["Pronouns", "代名詞"],
  "Les nombres de 0 à 31": ["Numbers 0 to 31", "數字 0 至 31"],
  "Les jours de la semaine": ["Days of the week", "星期"],
  "Les mois de l'année": ["Months of the year", "月份"],
  "Les loisirs (1)": ["Hobbies (1)", "休閒活動（1）"],
  "Les nombres de 32 à 69": ["Numbers 32 to 69", "數字 32 至 69"],
  "Les pays et les nationalités": ["Countries and nationalities", "國家與國籍"],
  "L'identité": ["Identity", "身分"],
  "Les coordonnées": ["Contact details", "聯絡方式"],
  "Les nombres de 70 à 100": ["Numbers 70 to 100", "數字 70 至 100"],
  "Les lieux": ["Places", "地點"],
  "La musique": ["Music", "音樂"],
  "Le cinéma": ["Cinema", "電影"],
  "Le sport": ["Sport", "運動"],
  "La famille": ["Family", "家庭"],
  "La situation familiale": ["Marital status", "婚姻狀況"],
  "Les professions": ["Jobs", "職業"],
};

function defaultLang() {
  const nav = (navigator.language || "").toLowerCase();
  if (nav.startsWith("zh")) return "zh";
  if (nav.startsWith("fr")) return "fr";
  return "en";
}

const state = {
  lang: store.get("lang", defaultLang()),
  mode: store.get("mode", "table"),
  units: new Set(store.get("units", [0, 1, 2])),
  theme: "all",
  query: "",
  direction: store.get("direction", "fr"),
  deck: [],
  pos: 0,
  missed: new Set(),
  knownCount: 0,
};
if (!I18N[state.lang]) state.lang = "fr";
if (!["fr", "other"].includes(state.direction)) state.direction = "fr";

const t = (key) => I18N[state.lang][key];
const themeName = (theme) =>
  state.lang === "fr" ? theme : THEME_NAMES[theme][state.lang === "en" ? 0 : 1];
const unitName = (u) => `${t("unit")} ${u} — ${UNIT_NAMES[state.lang][u]}`;

function esc(s) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function applyLang() {
  document.documentElement.lang = state.lang === "zh" ? "zh-Hant" : state.lang;
  document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => (el.placeholder = t(el.dataset.i18nPlaceholder)));
  document.querySelectorAll("[data-i18n-label]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.i18nLabel)));
  document.querySelectorAll(".lang button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.lang === state.lang));
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
  for (const u of [0, 1, 2]) {
    const b = document.createElement("button");
    b.className = "chip";
    b.textContent = unitName(u);
    b.setAttribute("aria-pressed", state.units.has(u));
    b.onclick = () => {
      if (state.units.has(u) && state.units.size === 1) return;
      state.units.has(u) ? state.units.delete(u) : state.units.add(u);
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
  const total = words.filter((w) => state.units.has(w.unit)).length;
  sel.innerHTML = `<option value="all">${esc(t("allThemes")(total))}</option>` +
    themes.map((th) => `<option value="${esc(th)}">${esc(themeName(th))} (${words.filter((w) => w.theme === th).length})</option>`).join("");
  sel.value = state.theme;
}

function renderTable() {
  const list = filtered();
  const out = $("#tables");
  if (!list.length) { out.innerHTML = `<p class="empty">${esc(t("empty"))}</p>`; return; }
  const groups = new Map();
  for (const w of list) {
    const key = w.unit + "|" + w.theme;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(w);
  }
  out.innerHTML = [...groups].map(([key, ws]) => {
    const [unit, theme] = key.split("|");
    return `<div class="group">
      <h2>${esc(themeName(theme))} <small>${esc(t("unit"))} ${unit}</small></h2>
      <table>
        <thead><tr><th>${esc(t("colFr"))}</th><th>${esc(t("colEn"))}</th><th>${esc(t("colZh"))}</th></tr></thead>
        <tbody>${ws.map((w) => `<tr>
          <td class="fr">${esc(w.fr)}</td><td class="en">${esc(w.en)}</td><td class="zh">${esc(w.zh)}</td>
        </tr>`).join("")}</tbody>
      </table></div>`;
  }).join("");
}

// Flashcards : une face en français, l'autre en anglais + chinois
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function newDeck(list) {
  state.deck = shuffle(list);
  state.pos = 0;
  state.missed = new Set();
  state.knownCount = 0;
  renderCard();
}

const faceFr = (w) => `<span class="label">${esc(t("colFr"))}</span><span class="word">${esc(w.fr)}</span>`;
const faceOther = (w) => `<span class="label">${esc(t("colEn"))} · ${esc(t("colZh"))}</span>
  <span class="word">${esc(w.en)}</span><span class="word zhword">${esc(w.zh)}</span>`;

function renderCard() {
  const card = $("#card");
  card.classList.remove("flipped");
  const total = state.deck.length;
  const finished = state.pos >= total;
  $("#done").hidden = !finished || !total;
  card.style.visibility = finished || !total ? "hidden" : "visible";
  $(".nav").style.visibility = finished || !total ? "hidden" : "visible";
  if (!total) { $("#progress").textContent = t("noCards"); return; }
  if (finished) {
    $("#progress").textContent = "";
    $("#doneText").textContent = t("done")(state.knownCount, total);
    $("#redoMissed").hidden = state.missed.size === 0;
    return;
  }
  const w = state.deck[state.pos];
  const [front, back] = state.direction === "fr" ? [faceFr, faceOther] : [faceOther, faceFr];
  $("#progress").textContent = `${state.pos + 1} / ${total} · ${themeName(w.theme)}`;
  $("#front").innerHTML = front(w) + `<span class="hint">${esc(t("flipHint"))}</span>`;
  // La face arrière est remplie après la rotation pour ne pas dévoiler la réponse
  const id = w.id;
  setTimeout(() => { if (state.deck[state.pos]?.id === id) $("#back").innerHTML = back(w); }, 200);
}

function flip() {
  if (state.pos < state.deck.length) $("#card").classList.toggle("flipped");
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

$("#card").addEventListener("click", flip);
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

function setLang(lang) {
  state.lang = lang;
  store.set("lang", lang);
  applyLang();
  renderUnits();
  renderThemes();
  // Change la langue sans remélanger le paquet en cours
  if (state.mode === "table") renderTable();
  else renderCard();
}

document.querySelectorAll(".lang button").forEach((b) => (b.onclick = () => setLang(b.dataset.lang)));
document.querySelectorAll(".tabs button").forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));
$("#theme").onchange = (e) => { state.theme = e.target.value; refresh(); };
$("#search").oninput = (e) => { state.query = e.target.value; renderTable(); };

$("#direction").value = state.direction;
applyLang();
renderUnits();
renderThemes();
setMode(state.mode);
