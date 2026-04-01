// CodedCare Offline Protocol Navigator (vanilla JS)
// Data policy: no network calls besides loading local files.
// Answers stored locally on the device (localStorage).

let protocol = null;
let lang = localStorage.getItem("cc_lang") || "en";

let ttsEnabled = JSON.parse(localStorage.getItem("cc_tts") || "false");
let micEnabled = JSON.parse(localStorage.getItem("cc_mic") || "false");

// Speech recognition object (if supported)
let recognition = null;

// Small helper
const $ = (id) => document.getElementById(id);

const state = {
  history: [],
  currentQ: null,
  answers: JSON.parse(localStorage.getItem("cc_answers") || "{}")
};

function t(obj) {
  if (!obj) return "";
  if (typeof obj === "string") return obj;
  return obj[lang] || obj["en"] || "";
}

function saveState() {
  localStorage.setItem("cc_answers", JSON.stringify(state.answers));
  localStorage.setItem("cc_lang", lang);
  localStorage.setItem("cc_tts", JSON.stringify(ttsEnabled));
  localStorage.setItem("cc_mic", JSON.stringify(micEnabled));
}

async function loadProtocol() {
  const res = await fetch("protocol.json");
  protocol = await res.json();
}

function setStatus(text) {
  $("status").textContent = text;
}

/* ======================
   Text-to-Speech (TTS)
   ====================== */
function speak(text) {
  if (!ttsEnabled) return;
  if (!("speechSynthesis" in window)) return;

  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = (lang === "es") ? "es-ES" : "en-US";
    u.rate = 1.0;
    u.pitch = 1.0;
    window.speechSynthesis.speak(u);
  } catch (e) {
    // ignore
  }
}

/* ==========================
   Speech Recognition (Mic)
   ========================== */
function setupRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;

  const r = new SR();
  r.lang = (lang === "es") ? "es-ES" : "en-US";
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

function startListening(currentQid) {
  if (!micEnabled) return;

  if (!recognition) recognition = setupRecognition();
  if (!recognition) {
    alert("Speech recognition is not supported in this browser.");
    micEnabled = false;
    saveState();
    $("micBtn").textContent = "Voice Select: Off";
    return;
  }

  // Update language each time
  recognition.lang = (lang === "es") ? "es-ES" : "en-US";

  const q = protocol.questions[currentQid];
  if (!q) return;

  // Stop any previous recognition session cleanly
  try { recognition.abort(); } catch (e) {}

  recognition.onresult = (event) => {
    const spokenRaw = event.results?.[0]?.[0]?.transcript || "";
    const spoken = normalize(spokenRaw);

    // Global commands
    if (spoken.includes("next") || spoken.includes("siguiente")) return goNext();
    if (spoken.includes("back") || spoken.includes("atrás") || spoken.includes("atras")) return goBack();

    const yesWords = ["yes", "yeah", "yep", "si", "sí"];
    const noWords  = ["no", "nope"];

    let matched = null;

    // If protocol uses yes/no values, map those quickly
    if (yesWords.some(w => spoken === w || spoken.includes(w))) {
      matched = q.options.find(o => String(o.value).toLowerCase() === "yes");
    }
    if (!matched && noWords.some(w => spoken === w || spoken.includes(w))) {
      matched = q.options.find(o => String(o.value).toLowerCase() === "no");
    }

    // Option number: "1", "2", "option 1", "one" (basic)
    if (!matched) {
      const digit = spoken.match(/(\d+)/);
      if (digit) {
        const idx = parseInt(digit[1], 10) - 1;
        if (q.options[idx]) matched = q.options[idx];
      }
    }

    // Match exact label
    if (!matched) {
      matched = q.options.find(o => normalize(t(o.label)) === spoken);
    }

    if (matched) {
      state.answers[currentQid] = matched.value;
      saveState();
      renderQuestion(currentQid);
      $("nextBtn").disabled = false;
      speak((lang === "es") ? "Seleccionado. Di siguiente para continuar." : "Selected. Say next to continue.");
    } else {
      speak((lang === "es")
        ? "No entendí. Di opción uno, opción dos, sí o no."
        : "Sorry, I did not catch that. Say option one, option two, yes, or no.");
    }
  };

  recognition.onerror = () => {
    // If mic permission blocked, user can toggle off
  };

  recognition.onend = () => {
    // We do not auto-restart continuously to avoid being annoying.
    // User can tap the mic toggle again if needed.
  };

  try {
    recognition.start();
  } catch (e) {
    // Some browsers throw if started too quickly
  }
}

/* ======================
   Render / Flow
   ====================== */
function renderQuestion(qid) {
  state.currentQ = qid;
  const q = protocol.questions[qid];
  if (!q) return renderEnd();

  const answeredCount = Object.keys(state.answers).length;
  setStatus(`${t(protocol.title)} • Answered: ${answeredCount}`);

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

  const list = document.createElement("div");
  list.className = "option-list";

  const name = `q_${qid}`;
  const existing = state.answers[qid];

  q.options.forEach((opt, idx) => {
    const row = document.createElement("div");
    row.className = "option";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = name;
    input.id = `${name}_${idx}`;
    input.value = opt.value;
    if (existing === opt.value) input.checked = true;

    const label = document.createElement("label");
    label.setAttribute("for", input.id);
    label.textContent = t(opt.label);

    row.appendChild(input);
    row.appendChild(label);
    list.appendChild(row);
  });

  screen.appendChild(list);

  $("backBtn").disabled = state.history.length === 0;
  $("nextBtn").disabled = !existing;

  list.addEventListener("change", (e) => {
    if (e.target && e.target.name === name) {
      state.answers[qid] = e.target.value;
      saveState();
      $("nextBtn").disabled = false;
    }
  });

  $("summaryCard").classList.add("hidden");

  // Speak question + options
  const optText = q.options.map((o, i) => {
    const n = i + 1;
    const label = t(o.label);
    return (lang === "es") ? `Opción ${n}: ${label}` : `Option ${n}: ${label}`;
  }).join(". ");
  speak(`${t(q.text)}. ${optText}`);

  // Start listening if mic enabled (may require permission)
  startListening(qid);
}

function getNextQuestion(qid) {
  const q = protocol.questions[qid];
  const ans = state.answers[qid];
  const opt = q.options.find(o => o.value === ans);
  return opt ? opt.next : null;
}

function computeOutcome() {
  const rules = protocol.decision?.rules || [];
  for (const rule of rules) {
    const ok = rule.if.every(cond => state.answers[cond.q] === cond.equals);
    if (ok) return rule.outcome;
  }
  return protocol.decision?.defaultOutcome || "routine";
}

function renderEnd() {
  const outcomeId = computeOutcome();
  const outcome = protocol.outcomes[outcomeId];

  const screen = $("screen");
  screen.innerHTML = "";

  const badge = document.createElement("span");
  badge.className = `badge ${outcome.badge || "ok"}`;
  badge.textContent = t(outcome.label);

  const title = document.createElement("div");
  title.className = "q-title";
  title.appendChild(badge);

  const p = document.createElement("div");
  p.className = "help";
  p.style.marginTop = "10px";
  p.textContent = t(outcome.text);

  screen.appendChild(title);
  screen.appendChild(p);

  $("nextBtn").disabled = true;

  // Build summary
  const lines = [];
  lines.push(`CodedCare Summary (offline)`);
  lines.push(`Module: ${t(protocol.title)}`);
  lines.push(`Outcome: ${t(outcome.label)}`);
  lines.push(`--- Answers ---`);

  for (const [qid, val] of Object.entries(state.answers)) {
    const q = protocol.questions[qid];
    if (!q) continue;
    const opt = q.options.find(o => o.value === val);
    lines.push(`- ${t(q.text)} -> ${opt ? t(opt.label) : val}`);
  }

  lines.push(`--- Notes ---`);
  lines.push(`Training/decision-support only. Do not include identifying patient info.`);

  $("summaryText").textContent = lines.join("\n");
  $("summaryCard").classList.remove("hidden");

  speak(`${t(outcome.label)}. ${t(outcome.text)}`);
}

function goNext() {
  if (!state.currentQ) {
    state.history = [];
    return renderQuestion(protocol.start);
  }

  const next = getNextQuestion(state.currentQ);
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
  localStorage.removeItem("cc_answers");
  renderQuestion(protocol.start);
}

function copySummary() {
  const text = $("summaryText").textContent;
  navigator.clipboard.writeText(text);
}

function downloadSummary() {
  const text = $("summaryText").textContent;
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

function initPWA() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js");
  }
}

async function init() {
  $("langSelect").value = lang;

  // Buttons initial label
  $("ttsBtn").textContent = `Read Aloud: ${ttsEnabled ? "On" : "Off"}`;
  $("micBtn").textContent = `Voice Select: ${micEnabled ? "On" : "Off"}`;

  $("langSelect").addEventListener("change", (e) => {
    lang = e.target.value;
    saveState();
    // Re-render current screen in new language
    if (state.currentQ && state.currentQ !== "end") renderQuestion(state.currentQ);
    else renderQuestion(protocol.start);
  });

  $("ttsBtn").addEventListener("click", () => {
    ttsEnabled = !ttsEnabled;
    saveState();
    $("ttsBtn").textContent = `Read Aloud: ${ttsEnabled ? "On" : "Off"}`;
    if (state.currentQ && state.currentQ !== "end") {
      // Re-speak the current question
      renderQuestion(state.currentQ);
    }
  });

  $("micBtn").addEventListener("click", async () => {
    micEnabled = !micEnabled;
    saveState();
    $("micBtn").textContent = `Voice Select: ${micEnabled ? "On" : "Off"}`;

    if (micEnabled) {
      // First-time mic permission often requires a user click (this click counts)
      if (state.currentQ && state.currentQ !== "end") startListening(state.currentQ);
      else renderQuestion(protocol.start);
    } else {
      try { recognition?.abort(); } catch (e) {}
    }
  });

  $("nextBtn").addEventListener("click", goNext);
  $("backBtn").addEventListener("click", goBack);
  $("resetBtn").addEventListener("click", resetAll);
  $("copyBtn").addEventListener("click", copySummary);
  $("downloadBtn").addEventListener("click", downloadSummary);

  await loadProtocol();
  initPWA();
  renderQuestion(protocol.start);
}

init();