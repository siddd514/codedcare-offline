// CodedCare Offline Protocol Navigator (vanilla JS)
// No network calls besides loading local files.
// Answers stored locally on the device (localStorage).

let protocol = null;
let lang = localStorage.getItem("cc_lang") || "en";

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
}

async function loadProtocol() {
  const res = await fetch("protocol.json");
  protocol = await res.json();
}

function setStatus(text) {
  $("status").textContent = text;
}

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

  $("langSelect").addEventListener("change", (e) => {
    lang = e.target.value;
    saveState();
    if (state.currentQ && state.currentQ !== "end") renderQuestion(state.currentQ);
    else renderQuestion(protocol.start);
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