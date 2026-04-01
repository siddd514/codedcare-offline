// CodedCare vNext: multi-module + voice + optional auto-translate + scoring engine
// NOTE: Speech recognition availability depends on browser/device.
// Auto-translate requires an online translation endpoint (optional).

/* =======================
   Storage + Settings
   ======================= */
const LS = {
  uiLang: "cc_ui_lang",
  moduleId: "cc_module_id",
  answers: "cc_answers",
  tts: "cc_tts",
  mic: "cc_mic",
  speechLang: "cc_speech_lang",
  autoTranslate: "cc_auto_translate",
  translateEndpoint: "cc_translate_endpoint"
};

let uiLang = localStorage.getItem(LS.uiLang) || "en";
let ttsEnabled = JSON.parse(localStorage.getItem(LS.tts) || "false");
let micEnabled = JSON.parse(localStorage.getItem(LS.mic) || "false");
let speechLang = localStorage.getItem(LS.speechLang) || "en-US";
let autoTranslate = JSON.parse(localStorage.getItem(LS.autoTranslate) || "false");
let translateEndpoint = localStorage.getItem(LS.translateEndpoint) || "";

let modules = [];
let protocol = null;

/* =======================
   State
   ======================= */
const state = {
  history: [],
  currentQ: null,
  answers: JSON.parse(localStorage.getItem(LS.answers) || "{}"),
  lastSpoken: "",
  score: null,
  outcomeId: null
};

const $ = (id) => document.getElementById(id);

/* =======================
   i18n helper
   ======================= */
function t(obj) {
  if (!obj) return "";
  if (typeof obj === "string") return obj;
  return obj[uiLang] || obj["en"] || "";
}

/* =======================
   Save
   ======================= */
function saveAll() {
  localStorage.setItem(LS.uiLang, uiLang);
  localStorage.setItem(LS.tts, JSON.stringify(ttsEnabled));
  localStorage.setItem(LS.mic, JSON.stringify(micEnabled));
  localStorage.setItem(LS.speechLang, speechLang);
  localStorage.setItem(LS.autoTranslate, JSON.stringify(autoTranslate));
  localStorage.setItem(LS.translateEndpoint, translateEndpoint);
  localStorage.setItem(LS.answers, JSON.stringify(state.answers));
}

/* =======================
   Fetch modules/protocol
   ======================= */
async function loadModules() {
  const res = await fetch("modules.json");
  modules = await res.json();
}

async function loadProtocolByModuleId(moduleId) {
  const m = modules.find(x => x.id === moduleId) || modules[0];
  if (!m) throw new Error("No modules found");
  localStorage.setItem(LS.moduleId, m.id);

  const res = await fetch(m.file);
  protocol = await res.json();

  $("status").textContent = t(protocol.title);
}

/* =======================
   Service Worker
   ======================= */
function initPWA() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js");
  }
}

/* =======================
   TTS
   ======================= */
function speak(text) {
  state.lastSpoken = text;

  if (!ttsEnabled) return;
  if (!("speechSynthesis" in window)) return;

  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = uiLang === "es" ? "es-ES" : "en-US";
    u.rate = 1.0;
    window.speechSynthesis.speak(u);
  } catch {}
}

/* =======================
   Speech recognition
   ======================= */
let recognition = null;

function setupRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;

  const r = new SR();
  r.interimResults = false;
  r.maxAlternatives = 1;
  return r;
}

function normalize(str) {
  return (str || "")
    .toLowerCase()
    .trim()
    .replace(/[.,!?]/g, "");
}

// For translation APIs we typically need ISO 639-1 codes
function isoLangFromBCP47(bcp47) {
  const s = (bcp47 || "").toLowerCase();
  if (s.startsWith("en")) return "en";
  if (s.startsWith("es")) return "es";
  if (s.startsWith("fr")) return "fr";
  if (s.startsWith("hi")) return "hi";
  if (s.startsWith("sw")) return "sw";
  if (s.startsWith("ar")) return "ar";
  return "en";
}

async function translateText(text, sourceBCP47, targetUiLang) {
  if (!autoTranslate) return text;
  if (!translateEndpoint) return text;
  if (!navigator.onLine) return text;

  try {
    const source = isoLangFromBCP47(sourceBCP47);
    const target = targetUiLang; // uiLang is "en" or "es" here

    const res = await fetch(translateEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        source,
        target,
        format: "text"
      })
    });

    if (!res.ok) return text;
    const data = await res.json();
    return data.translatedText || text;
  } catch {
    return text;
  }
}

function showHeard(text) {
  const el = $("heard");
  if (!text) {
    el.classList.add("hidden");
    return;
  }
  el.textContent = `Heard: ${text}`;
  el.classList.remove("hidden");
}

function startListening(qid) {
  if (!micEnabled) return;

  if (!recognition) recognition = setupRecognition();
  if (!recognition) {
    alert("Speech recognition is not supported in this browser.");
    micEnabled = false;
    saveAll();
    $("micBtn").textContent = "Voice Input: Off";
    return;
  }

  recognition.lang = speechLang;

  // Stop any previous session
  try { recognition.abort(); } catch {}

  recognition.onresult = async (event) => {
    const raw = event.results?.[0]?.[0]?.transcript || "";
    const translated = await translateText(raw, speechLang, uiLang);
    showHeard(autoTranslate ? `${raw} → ${translated}` : raw);

    const spoken = normalize(autoTranslate ? translated : raw);
    handleSpoken(qid, spoken);
  };

  recognition.onerror = () => {};
  recognition.onend = () => {};

  try { recognition.start(); } catch {}
}

/* =======================
   Protocol engine helpers
   ======================= */
function getQuestion(qid) {
  return protocol?.questions?.[qid] || null;
}

function stepLabel() {
  // Not perfect for branching, but useful
  const step = state.history.length + 1;
  return `Step ${step}`;
}

function enableNextIfValid(qid) {
  const q = getQuestion(qid);
  if (!q) return;

  const ans = state.answers[qid];

  let valid = false;

  if (q.type === "single") valid = !!ans;
  else if (q.type === "multi") {
    const arr = Array.isArray(ans) ? ans : [];
    valid = (q.required === false) ? true : arr.length > 0;
  }
  else if (q.type === "number") {
    if (q.required === false && (ans === "" || ans === null || ans === undefined)) valid = true;
    else valid = typeof ans === "number" && !Number.isNaN(ans);
  }
  else if (q.type === "text") {
    if (q.required === false) valid = true;
    else valid = typeof ans === "string" && ans.trim().length > 0;
  }

  $("nextBtn").disabled = !valid;
}

function nextQidFrom(qid) {
  const q = getQuestion(qid);
  if (!q) return null;

  if (q.type === "single") {
    const ans = state.answers[qid];
    const opt = q.options.find(o => o.value === ans);
    return opt?.next || null;
  }

  // multi/number/text use q.next
  return q.next || null;
}

/* =======================
   Decision + scoring
   ======================= */
function evalCond(cond) {
  const val = state.answers[cond.q];

  if (cond.equals !== undefined) return val === cond.equals;

  if (cond.includes !== undefined) {
    if (!Array.isArray(val)) return false;
    return val.includes(cond.includes);
  }

  if (cond.gte !== undefined) return typeof val === "number" && val >= cond.gte;
  if (cond.gt !== undefined) return typeof val === "number" && val > cond.gt;
  if (cond.lte !== undefined) return typeof val === "number" && val <= cond.lte;
  if (cond.lt !== undefined) return typeof val === "number" && val < cond.lt;

  // For multi-select counts
  if (cond.countGte !== undefined) {
    const c = Array.isArray(val) ? val.length : 0;
    return c >= cond.countGte;
  }
  if (cond.countLt !== undefined) {
    const c = Array.isArray(val) ? val.length : 0;
    return c < cond.countLt;
  }

  return false;
}

function computeScoreAndOutcome() {
  if (!protocol.scoring?.enabled) return null;

  let score = 0;

  for (const rule of protocol.scoring.rules || []) {
    const ok = (rule.when || []).every(evalCond);
    if (ok) score += (rule.add || 0);
  }

  state.score = score;

  // map score to outcome
  const map = protocol.scoring.outcomeByScore || [];
  for (const b of map) {
    if (score >= b.min && score <= b.max) {
      state.outcomeId = b.outcome;
      return { score, outcomeId: b.outcome };
    }
  }

  // fallback
  state.outcomeId = map?.[0]?.outcome || null;
  return { score, outcomeId: state.outcomeId };
}

function computeRuleOutcome() {
  const rules = protocol.decision?.rules || [];
  for (const rule of rules) {
    const ok = (rule.if || []).every(evalCond);
    if (ok) return rule.outcome;
  }
  return protocol.decision?.defaultOutcome || null;
}

/* =======================
   Render
   ======================= */
function renderQuestion(qid) {
  state.currentQ = qid;

  const q = getQuestion(qid);
  if (!q) return renderEnd();

  $("summaryCard").classList.add("hidden");

  $("status").textContent = t(protocol.title);
  $("step").textContent = stepLabel();

  const screen = $("screen");
  screen.innerHTML = "";

  const title = document.createElement("div");
  title.className = "q-title";
  title.textContent = t(q.text);
  screen.appendChild(title);

  if (q.help) {
    const help = document.createElement("div");
    help.className = "help";
    help.textContent = t(q.help);
    screen.appendChild(help);
  }

  // Render by type
  if (q.type === "single" || q.type === "multi") {
    const list = document.createElement("div");
    list.className = "option-list";
    const existing = state.answers[qid];

    q.options.forEach((opt, idx) => {
      const row = document.createElement("div");
      row.className = "option";

      const input = document.createElement("input");
      input.type = q.type === "single" ? "radio" : "checkbox";
      input.name = `q_${qid}`;
      input.id = `q_${qid}_${idx}`;
      input.value = opt.value;

      if (q.type === "single") {
        if (existing === opt.value) input.checked = true;
      } else {
        const arr = Array.isArray(existing) ? existing : [];
        if (arr.includes(opt.value)) input.checked = true;
      }

      const label = document.createElement("label");
      label.setAttribute("for", input.id);
      label.textContent = t(opt.label);

      row.appendChild(input);
      row.appendChild(label);
      list.appendChild(row);
    });

    screen.appendChild(list);

    list.addEventListener("change", (e) => {
      const qObj = getQuestion(qid);
      if (!qObj) return;

      if (qObj.type === "single") {
        state.answers[qid] = e.target.value;
      } else {
        const curr = Array.isArray(state.answers[qid]) ? state.answers[qid] : [];
        if (e.target.checked) {
          state.answers[qid] = Array.from(new Set([...curr, e.target.value]));
        } else {
          state.answers[qid] = curr.filter(x => x !== e.target.value);
        }
      }
      saveAll();
      enableNextIfValid(qid);
    });
  }

  if (q.type === "number") {
    const input = document.createElement("input");
    input.type = "number";
    input.className = "textin";
    if (q.min !== undefined) input.min = String(q.min);
    if (q.max !== undefined) input.max = String(q.max);
    input.placeholder = q.unit ? `(${q.unit})` : "";
    const existing = state.answers[qid];
    if (typeof existing === "number") input.value = String(existing);

    input.addEventListener("input", () => {
      const raw = input.value;
      if (raw === "") {
        state.answers[qid] = "";
      } else {
        const num = Number(raw);
        state.answers[qid] = Number.isNaN(num) ? "" : num;
      }
      saveAll();
      enableNextIfValid(qid);
    });

    screen.appendChild(input);
  }

  if (q.type === "text") {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "textin";
    input.placeholder = t(q.placeholder) || "";
    const existing = state.answers[qid];
    if (typeof existing === "string") input.value = existing;

    input.addEventListener("input", () => {
      state.answers[qid] = input.value;
      saveAll();
      enableNextIfValid(qid);
    });

    screen.appendChild(input);
  }

  // Buttons
  $("backBtn").disabled = state.history.length === 0;
  enableNextIfValid(qid);

  // Speak question + options
  const spokenParts = [t(q.text)];
  if (q.type === "single" || q.type === "multi") {
    const opts = q.options.map((o, i) => {
      const n = i + 1;
      return uiLang === "es" ? `Opción ${n}: ${t(o.label)}` : `Option ${n}: ${t(o.label)}`;
    }).join(". ");
    spokenParts.push(opts);
  }
  speak(spokenParts.join(". "));

  startListening(qid);
}

function renderEnd() {
  $("step").textContent = "Complete";
  $("nextBtn").disabled = true;

  // Determine outcome
  let outcomeId = null;

  const scoreResult = computeScoreAndOutcome();
  if (scoreResult?.outcomeId) outcomeId = scoreResult.outcomeId;
  else outcomeId = computeRuleOutcome();

  const outcome = protocol.outcomes?.[outcomeId];
  if (!outcome) {
    $("screen").innerHTML = `<div class="q-title">Done</div><div class="help">No outcome configured.</div>`;
    return;
  }

  const screen = $("screen");
  screen.innerHTML = "";

  const badge = document.createElement("span");
  badge.className = `badge ${outcome.badge || "neutral"}`;
  badge.textContent = t(outcome.label);

  const title = document.createElement("div");
  title.className = "q-title";
  title.appendChild(badge);

  const p = document.createElement("div");
  p.className = "help";
  p.style.marginTop = "10px";
  p.textContent = t(outcome.text);

  screen.appendChild(title);

  if (protocol.scoring?.enabled) {
    const s = document.createElement("div");
    s.className = "help";
    s.textContent = `Score: ${state.score}`;
    screen.appendChild(s);
  }

  screen.appendChild(p);

  // Summary
  const lines = [];
  lines.push(`CodedCare Summary (offline)`);
  lines.push(`Module: ${t(protocol.title)}`);

  if (protocol.scoring?.enabled) lines.push(`Score: ${state.score}`);
  lines.push(`Outcome: ${t(outcome.label)}`);
  lines.push(`--- Answers ---`);

  for (const [qid, val] of Object.entries(state.answers)) {
    const q = getQuestion(qid);
    if (!q) continue;

    if (q.type === "single") {
      const opt = q.options.find(o => o.value === val);
      lines.push(`- ${t(q.text)} -> ${opt ? t(opt.label) : val}`);
    } else if (q.type === "multi") {
      const arr = Array.isArray(val) ? val : [];
      const labels = arr.map(v => {
        const opt = q.options.find(o => o.value === v);
        return opt ? t(opt.label) : v;
      });
      lines.push(`- ${t(q.text)} -> ${labels.join(", ") || "(none)"}`);
    } else {
      lines.push(`- ${t(q.text)} -> ${String(val)}`);
    }
  }

  lines.push(`--- Notes ---`);
  lines.push(`Training/decision-support only. Do not include identifying patient info.`);
  lines.push(`Voice + auto-translate depend on browser and connectivity.`);

  $("summaryText").textContent = lines.join("\n");
  $("summaryCard").classList.remove("hidden");

  speak(`${t(outcome.label)}. ${t(outcome.text)}`);
}

/* =======================
   Voice command handling
   ======================= */
function handleSpoken(qid, spoken) {
  const q = getQuestion(qid);
  if (!q) return;

  // Commands
  const cmdNext = ["next", "continue", "siguiente", "continuar"];
  const cmdBack = ["back", "previous", "atrás", "atras"];
  const cmdRepeat = ["repeat", "again", "repetir", "otra vez"];
  const cmdReset = ["reset", "restart", "reiniciar"];

  if (cmdNext.some(w => spoken === w || spoken.includes(w))) return goNext();
  if (cmdBack.some(w => spoken === w || spoken.includes(w))) return goBack();
  if (cmdRepeat.some(w => spoken === w || spoken.includes(w))) return speak(state.lastSpoken || "");
  if (cmdReset.some(w => spoken === w || spoken.includes(w))) return resetAll();

  // If single/multi: try map yes/no and option numbers and labels
  if (q.type === "single" || q.type === "multi") {
    // option number: "1", "2"
    const digit = spoken.match(/(\d+)/);
    if (digit) {
      const idx = parseInt(digit[1], 10) - 1;
      if (q.options[idx]) {
        applyOption(qid, q, q.options[idx].value);
        return;
      }
    }

    // yes/no shortcuts when option values are yes/no
    const yesWords = ["yes", "yeah", "yep", "si", "sí"];
    const noWords = ["no", "nope"];
    if (yesWords.some(w => spoken === w || spoken.includes(w))) {
      const opt = q.options.find(o => String(o.value).toLowerCase() === "yes");
      if (opt) return applyOption(qid, q, opt.value);
    }
    if (noWords.some(w => spoken === w || spoken.includes(w))) {
      const opt = q.options.find(o => String(o.value).toLowerCase() === "no");
      if (opt) return applyOption(qid, q, opt.value);
    }

    // label match
    const matched = q.options.find(o => normalize(t(o.label)) === spoken);
    if (matched) return applyOption(qid, q, matched.value);
  }
}

function applyOption(qid, q, value) {
  if (q.type === "single") {
    state.answers[qid] = value;
  } else {
    const curr = Array.isArray(state.answers[qid]) ? state.answers[qid] : [];
    if (curr.includes(value)) state.answers[qid] = curr.filter(x => x !== value);
    else state.answers[qid] = [...curr, value];
  }
  saveAll();
  renderQuestion(qid);
  enableNextIfValid(qid);
}

/* =======================
   Navigation
   ======================= */
function goNext() {
  if (!state.currentQ) return renderQuestion(protocol.start);

  const next = nextQidFrom(state.currentQ);
  state.history.push(state.currentQ);

  if (!next || next === "end") {
    state.currentQ = "end";
    return renderEnd();
  }
  return renderQuestion(next);
}

function goBack() {
  const prev = state.history.pop();
  if (!prev) return;
  renderQuestion(prev);
}

function resetAll() {
  if (!confirm("Reset answers on this device?")) return;
  state.history = [];
  state.currentQ = null;
  state.answers = {};
  localStorage.removeItem(LS.answers);
  showHeard("");
  renderQuestion(protocol.start);
}

function copySummary() {
  navigator.clipboard.writeText($("summaryText").textContent || "");
}

function downloadSummary() {
  const text = $("summaryText").textContent || "";
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "codedcare-summary.txt";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* =======================
   UI: Settings modal
   ======================= */
function openSettings() {
  $("speechLangSelect").value = speechLang;
  $("autoTranslateToggle").checked = autoTranslate;
  $("translateEndpointInput").value = translateEndpoint;

  $("modalOverlay").classList.remove("hidden");
}

function closeSettings() {
  $("modalOverlay").classList.add("hidden");
}

function saveSettings() {
  speechLang = $("speechLangSelect").value;
  autoTranslate = $("autoTranslateToggle").checked;
  translateEndpoint = $("translateEndpointInput").value.trim();
  saveAll();
  closeSettings();
}

/* =======================
   Init
   ======================= */
function populateModulesDropdown() {
  const sel = $("moduleSelect");
  sel.innerHTML = "";
  for (const m of modules) {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = t(m.title);
    sel.appendChild(opt);
  }

  const saved = localStorage.getItem(LS.moduleId) || modules[0]?.id;
  sel.value = saved || modules[0]?.id;
}

async function switchModule(moduleId) {
  // Clear per-module state to avoid mixing answers across tools
  state.history = [];
  state.currentQ = null;
  state.answers = {};
  localStorage.removeItem(LS.answers);

  await loadProtocolByModuleId(moduleId);
  renderQuestion(protocol.start);
}

async function init() {
  $("uiLangSelect").value = uiLang;
  $("ttsBtn").textContent = `Read Aloud: ${ttsEnabled ? "On" : "Off"}`;
  $("micBtn").textContent = `Voice Input: ${micEnabled ? "On" : "Off"}`;

  await loadModules();
  populateModulesDropdown();

  // Load initial protocol
  const moduleId = $("moduleSelect").value;
  await loadProtocolByModuleId(moduleId);

  initPWA();

  // Event listeners
  $("moduleSelect").addEventListener("change", async (e) => {
    await switchModule(e.target.value);
  });

  $("uiLangSelect").addEventListener("change", async (e) => {
    uiLang = e.target.value;
    saveAll();
    populateModulesDropdown(); // module titles change language
    renderQuestion(state.currentQ && state.currentQ !== "end" ? state.currentQ : protocol.start);
  });

  $("ttsBtn").addEventListener("click", () => {
    ttsEnabled = !ttsEnabled;
    saveAll();
    $("ttsBtn").textContent = `Read Aloud: ${ttsEnabled ? "On" : "Off"}`;
    if (state.currentQ && state.currentQ !== "end") renderQuestion(state.currentQ);
  });

  $("micBtn").addEventListener("click", () => {
    micEnabled = !micEnabled;
    saveAll();
    $("micBtn").textContent = `Voice Input: ${micEnabled ? "On" : "Off"}`;
    if (micEnabled && state.currentQ && state.currentQ !== "end") startListening(state.currentQ);
    else {
      try { recognition?.abort(); } catch {}
    }
  });

  $("settingsBtn").addEventListener("click", openSettings);
  $("closeSettingsBtn").addEventListener("click", closeSettings);
  $("saveSettingsBtn").addEventListener("click", saveSettings);

  $("resetBtn").addEventListener("click", resetAll);
  $("nextBtn").addEventListener("click", goNext);
  $("backBtn").addEventListener("click", goBack);
  $("repeatBtn").addEventListener("click", () => speak(state.lastSpoken || ""));

  $("copyBtn").addEventListener("click", copySummary);
  $("downloadBtn").addEventListener("click", downloadSummary);

  // Start
  renderQuestion(protocol.start);
}

init();