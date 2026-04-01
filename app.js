// CodedCare vNext: multi-module + voice + optional auto-translate + scoring engine
// + NEW: TTS Voice Picker for better accents/voices per language.

const LS = {
  uiLang: "cc_ui_lang",
  moduleId: "cc_module_id",
  answers: "cc_answers",
  tts: "cc_tts",
  mic: "cc_mic",
  speechLang: "cc_speech_lang",
  autoTranslate: "cc_auto_translate",
  translateEndpoint: "cc_translate_endpoint",
  ttsVoiceURI: "cc_tts_voice_uri"
};

let uiLang = localStorage.getItem(LS.uiLang) || "en";
let ttsEnabled = JSON.parse(localStorage.getItem(LS.tts) || "false");
let micEnabled = JSON.parse(localStorage.getItem(LS.mic) || "false");
let speechLang = localStorage.getItem(LS.speechLang) || "en-US";
let autoTranslate = JSON.parse(localStorage.getItem(LS.autoTranslate) || "false");
let translateEndpoint = localStorage.getItem(LS.translateEndpoint) || "";
let ttsVoiceURI = localStorage.getItem(LS.ttsVoiceURI) || "";

let modules = [];
let protocol = null;

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
   UI strings (translated)
   ======================= */
const UI = {
  en: {
    module: "Module",
    language: "Language",
    settings: "Settings",
    reset: "Reset",
    back: "Back",
    next: "Next",
    repeat: "Repeat",
    summary: "Summary",
    copy: "Copy",
    download: "Download .txt",
    close: "Close",
    save: "Save",
    safetyTitle: "Safety note:",
    safetyBody:
      "This tool is for training/decision-support. It does not diagnose or replace clinical judgment. Do not enter identifying patient information.",
    footer: "Offline after first load. Voice recognition depends on browser support.",

    speechLang: "Speech input language (what YOU speak)",
    autoTranslate: "Auto-translate speech into UI language (online only)",
    endpoint: "Translation endpoint (optional)",
    endpointHint:
      "If endpoint is blank, auto-translate is disabled. Public translation servers may be unreliable and are not for sensitive info.",

    ttsVoice: "Read-aloud voice (TTS)",
    ttsVoiceHint: "Voices depend on the device. Pick one that sounds natural for the selected UI language.",
    testVoice: "Test voice",

    ttsOn: "Read Aloud: On",
    ttsOff: "Read Aloud: Off",
    micOn: "Voice Input: On",
    micOff: "Voice Input: Off"
  },
  es: {
    module: "Módulo",
    language: "Idioma",
    settings: "Ajustes",
    reset: "Reiniciar",
    back: "Atrás",
    next: "Siguiente",
    repeat: "Repetir",
    summary: "Resumen",
    copy: "Copiar",
    download: "Descargar .txt",
    close: "Cerrar",
    save: "Guardar",
    safetyTitle: "Nota de seguridad:",
    safetyBody:
      "Esta herramienta es para entrenamiento/apoyo a decisiones. No diagnostica ni reemplaza el juicio clínico. No ingreses información identificable del paciente.",
    footer: "Sin conexión después de la primera carga. El reconocimiento de voz depende del navegador.",

    speechLang: "Idioma de entrada de voz (lo que TÚ hablas)",
    autoTranslate: "Auto-traducir voz al idioma de la interfaz (solo en línea)",
    endpoint: "Endpoint de traducción (opcional)",
    endpointHint:
      "Si está vacío, la auto-traducción se desactiva. Servidores públicos pueden ser poco confiables y no son para info sensible.",

    ttsVoice: "Voz de lectura (TTS)",
    ttsVoiceHint: "Las voces dependen del dispositivo. Elige una que suene natural para el idioma de la interfaz.",
    testVoice: "Probar voz",

    ttsOn: "Leer: Activado",
    ttsOff: "Leer: Desactivado",
    micOn: "Voz: Activada",
    micOff: "Voz: Desactivada"
  },
  fr: {
    module: "Module",
    language: "Langue",
    settings: "Paramètres",
    reset: "Réinitialiser",
    back: "Retour",
    next: "Suivant",
    repeat: "Répéter",
    summary: "Résumé",
    copy: "Copier",
    download: "Télécharger .txt",
    close: "Fermer",
    save: "Enregistrer",
    safetyTitle: "Note de sécurité :",
    safetyBody:
      "Outil d’aide à la décision/formation. Ne pose pas de diagnostic et ne remplace pas le jugement clinique. Ne pas saisir d’informations identifiantes.",
    footer: "Hors ligne après le premier chargement. La reconnaissance vocale dépend du navigateur.",

    speechLang: "Langue de saisie vocale (ce que VOUS dites)",
    autoTranslate: "Traduire automatiquement vers la langue UI (en ligne uniquement)",
    endpoint: "Endpoint de traduction (optionnel)",
    endpointHint:
      "Si vide, la traduction auto est désactivée. Les services publics peuvent être instables et ne conviennent pas aux infos sensibles.",

    ttsVoice: "Voix de lecture (TTS)",
    ttsVoiceHint: "Les voix dépendent de l’appareil. Choisissez une voix naturelle pour la langue UI.",
    testVoice: "Tester la voix",

    ttsOn: "Lecture : Activée",
    ttsOff: "Lecture : Désactivée",
    micOn: "Voix : Activée",
    micOff: "Voix : Désactivée"
  },
  hi: {
    module: "मॉड्यूल",
    language: "भाषा",
    settings: "सेटिंग्स",
    reset: "रीसेट",
    back: "वापस",
    next: "आगे",
    repeat: "दोहराएँ",
    summary: "सारांश",
    copy: "कॉपी",
    download: "डाउनलोड .txt",
    close: "बंद करें",
    save: "सेव",
    safetyTitle: "सुरक्षा नोट:",
    safetyBody:
      "यह टूल प्रशिक्षण/निर्णय‑सहायता के लिए है। यह निदान नहीं करता और क्लिनिकल निर्णय का विकल्प नहीं है। पहचान योग्य जानकारी न डालें।",
    footer: "पहली बार लोड होने के बाद ऑफ़लाइन। वॉइस रिकग्निशन ब्राउज़र पर निर्भर है।",

    speechLang: "स्पीच इनपुट भाषा (आप क्या बोलते हैं)",
    autoTranslate: "स्पीच को UI भाषा में ऑटो‑ट्रांसलेट (केवल ऑनलाइन)",
    endpoint: "ट्रांसलेशन एंडपॉइंट (वैकल्पिक)",
    endpointHint:
      "अगर खाली है तो ऑटो‑ट्रांसलेट बंद रहेगा। पब्लिक सर्वर भरोसेमंद नहीं हो सकते और संवेदनशील जानकारी के लिए नहीं हैं।",

    ttsVoice: "रीड‑अलाउड आवाज़ (TTS)",
    ttsVoiceHint: "आवाज़ें डिवाइस पर निर्भर हैं। UI भाषा के लिए प्राकृतिक आवाज़ चुनें।",
    testVoice: "वॉइस टेस्ट",

    ttsOn: "पढ़ें: चालू",
    ttsOff: "पढ़ें: बंद",
    micOn: "वॉइस: चालू",
    micOff: "वॉइस: बंद"
  },
  sw: {
    module: "Moduli",
    language: "Lugha",
    settings: "Mipangilio",
    reset: "Weka upya",
    back: "Rudi",
    next: "Endelea",
    repeat: "Rudia",
    summary: "Muhtasari",
    copy: "Nakili",
    download: "Pakua .txt",
    close: "Funga",
    save: "Hifadhi",
    safetyTitle: "Tahadhari ya usalama:",
    safetyBody:
      "Chombo hiki ni cha mafunzo/msaada wa maamuzi. Hakitoi utambuzi na hakibadilishi uamuzi wa kliniki. Usiingize taarifa zinazomtambulisha mgonjwa.",
    footer: "Hufanya kazi bila mtandao baada ya kupakia mara ya kwanza. Utambuzi wa sauti hutegemea kivinjari.",

    speechLang: "Lugha ya sauti (unachoongea)",
    autoTranslate: "Tafsiri sauti kwenda lugha ya UI (mtandaoni tu)",
    endpoint: "Anwani ya kutafsiri (si lazima)",
    endpointHint:
      "Ikiwa tupu, tafsiri ya moja kwa moja itazimwa. Huduma za umma zinaweza kutokua thabiti na si kwa taarifa nyeti.",

    ttsVoice: "Sauti ya kusoma (TTS)",
    ttsVoiceHint: "Sauti hutegemea kifaa. Chagua sauti inayofaa kwa lugha ya UI.",
    testVoice: "Jaribu sauti",

    ttsOn: "Sauti: Washa",
    ttsOff: "Sauti: Zima",
    micOn: "Sauti‑ingizo: Washa",
    micOff: "Sauti‑ingizo: Zima"
  },
  ar: {
    module: "الوحدة",
    language: "اللغة",
    settings: "الإعدادات",
    reset: "إعادة ضبط",
    back: "رجوع",
    next: "التالي",
    repeat: "إعادة",
    summary: "الملخص",
    copy: "نسخ",
    download: "تنزيل .txt",
    close: "إغلاق",
    save: "حفظ",
    safetyTitle: "ملاحظة أمان:",
    safetyBody:
      "هذه الأداة للتدريب/دعم القرار. لا تُشخّص ولا تستبدل الحكم السريري. لا تُدخل معلومات تعريفية عن المريض.",
    footer: "تعمل دون إنترنت بعد أول تحميل. التعرف على الصوت يعتمد على المتصفح.",

    speechLang: "لغة الإدخال الصوتي (ما تتحدث به)",
    autoTranslate: "ترجمة الكلام تلقائياً إلى لغة الواجهة (عبر الإنترنت فقط)",
    endpoint: "عنوان خدمة الترجمة (اختياري)",
    endpointHint:
      "إذا كان فارغاً فسيتم تعطيل الترجمة التلقائية. الخدمات العامة قد تكون غير مستقرة وغير مناسبة للمعلومات الحساسة.",

    ttsVoice: "صوت القراءة (TTS)",
    ttsVoiceHint: "الأصوات تعتمد على الجهاز. اختر صوتاً مناسباً للغة الواجهة.",
    testVoice: "اختبار الصوت",

    ttsOn: "القراءة: تشغيل",
    ttsOff: "القراءة: إيقاف",
    micOn: "الصوت: تشغيل",
    micOff: "الصوت: إيقاف"
  }
};

function ui(key){
  return UI[uiLang]?.[key] ?? UI.en[key] ?? key;
}

function t(obj) {
  if (!obj) return "";
  if (typeof obj === "string") return obj;
  return obj[uiLang] || obj["en"] || "";
}

function applyUiStrings(){
  document.documentElement.lang = uiLang;
  const isRTL = uiLang === "ar";
  document.documentElement.dir = isRTL ? "rtl" : "ltr";
  document.body.classList.toggle("rtl", isRTL);

  $("moduleLabel").textContent = ui("module");
  $("uiLangLabel").textContent = ui("language");

  $("settingsBtn").textContent = ui("settings");
  $("resetBtn").textContent = ui("reset");
  $("backBtn").textContent = ui("back");
  $("nextBtn").textContent = ui("next");
  $("repeatBtn").textContent = ui("repeat");

  $("summaryTitle").textContent = ui("summary");
  $("copyBtn").textContent = ui("copy");
  $("downloadBtn").textContent = ui("download");

  $("safetyTitle").textContent = ui("safetyTitle");
  $("safetyBody").textContent = ui("safetyBody");
  $("footerText").textContent = ui("footer");

  $("settingsTitle").textContent = ui("settings");
  $("closeSettingsBtn").textContent = ui("close");
  $("saveSettingsBtn").textContent = ui("save");

  $("speechLangLbl").textContent = ui("speechLang");
  // checkbox label: keep input, set the text node
  $("autoTranslateLbl").lastChild.textContent = " " + ui("autoTranslate");
  $("endpointLbl").textContent = ui("endpoint");
  $("endpointHint").textContent = ui("endpointHint");

  $("ttsVoiceLbl").textContent = ui("ttsVoice");
  $("ttsVoiceHint").textContent = ui("ttsVoiceHint");
  $("testVoiceBtn").textContent = ui("testVoice");

  $("ttsBtn").textContent = ttsEnabled ? ui("ttsOn") : ui("ttsOff");
  $("micBtn").textContent = micEnabled ? ui("micOn") : ui("micOff");
}

function saveAll() {
  localStorage.setItem(LS.uiLang, uiLang);
  localStorage.setItem(LS.tts, JSON.stringify(ttsEnabled));
  localStorage.setItem(LS.mic, JSON.stringify(micEnabled));
  localStorage.setItem(LS.speechLang, speechLang);
  localStorage.setItem(LS.autoTranslate, JSON.stringify(autoTranslate));
  localStorage.setItem(LS.translateEndpoint, translateEndpoint);
  localStorage.setItem(LS.ttsVoiceURI, ttsVoiceURI);
  localStorage.setItem(LS.answers, JSON.stringify(state.answers));
}

/* =======================
   Modules / Protocol
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
  state.history = [];
  state.currentQ = null;
  state.answers = {};
  localStorage.removeItem(LS.answers);
  await loadProtocolByModuleId(moduleId);
  renderQuestion(protocol.start);
}

/* =======================
   PWA / Service worker
   ======================= */
function initPWA() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js");
  }
}

/* =======================
   TTS voice picker (NEW)
   ======================= */
let ttsVoices = [];

function getVoicesAsync() {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) return resolve([]);

    const got = speechSynthesis.getVoices();
    if (got && got.length) return resolve(got);

    speechSynthesis.onvoiceschanged = () => {
      const v = speechSynthesis.getVoices();
      resolve(v || []);
    };

    setTimeout(() => resolve(speechSynthesis.getVoices() || []), 700);
  });
}

function uiLangPrefixes() {
  if (uiLang === "en") return ["en"];
  if (uiLang === "es") return ["es"];
  if (uiLang === "fr") return ["fr"];
  if (uiLang === "hi") return ["hi"];
  if (uiLang === "sw") return ["sw"];
  if (uiLang === "ar") return ["ar"];
  return ["en"];
}

function voiceMatchesUILang(v) {
  const vlang = (v.lang || "").toLowerCase();
  return uiLangPrefixes().some(p => vlang.startsWith(p));
}

function populateVoiceDropdown() {
  const sel = $("ttsVoiceSelect");
  if (!sel) return;

  sel.innerHTML = "";

  const matching = ttsVoices.filter(voiceMatchesUILang);
  const list = matching.length ? matching : ttsVoices;

  const autoOpt = document.createElement("option");
  autoOpt.value = "";
  autoOpt.textContent = uiLang === "ar" ? "تلقائي (أفضل صوت)" : "Auto (best available)";
  sel.appendChild(autoOpt);

  for (const v of list) {
    const opt = document.createElement("option");
    opt.value = v.voiceURI;
    opt.textContent = `${v.name} — ${v.lang}`;
    sel.appendChild(opt);
  }

  sel.value = ttsVoiceURI || "";
}

function pickVoiceForUtterance() {
  if (!("speechSynthesis" in window)) return null;

  if (ttsVoiceURI) {
    const exact = ttsVoices.find(v => v.voiceURI === ttsVoiceURI);
    if (exact) return exact;
  }

  const match = ttsVoices.find(voiceMatchesUILang);
  return match || null;
}

function ttsLangCode(){
  if (uiLang === "es") return "es-ES";
  if (uiLang === "fr") return "fr-FR";
  if (uiLang === "hi") return "hi-IN";
  if (uiLang === "sw") return "sw-KE";
  if (uiLang === "ar") return "ar-SA";
  return "en-US";
}

function speak(text) {
  state.lastSpoken = text;
  if (!ttsEnabled) return;
  if (!("speechSynthesis" in window)) return;

  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = ttsLangCode();

    const chosen = pickVoiceForUtterance();
    if (chosen) u.voice = chosen;

    u.rate = 1.0;
    window.speechSynthesis.speak(u);
  } catch {}
}

/* =======================
   Speech recognition + translation
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
  return (str || "").toLowerCase().trim().replace(/[.,!?]/g, "");
}

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
    const target = targetUiLang;

    const res = await fetch(translateEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: text, source, target, format: "text" })
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
  if (!text) { el.classList.add("hidden"); return; }
  el.textContent = (uiLang === "ar") ? `تم السماع: ${text}` : `Heard: ${text}`;
  el.classList.remove("hidden");
}

function startListening(qid) {
  if (!micEnabled) return;

  if (!recognition) recognition = setupRecognition();
  if (!recognition) {
    alert("Speech recognition is not supported in this browser.");
    micEnabled = false;
    saveAll();
    applyUiStrings();
    return;
  }

  recognition.lang = speechLang;

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
   Protocol engine
   ======================= */
function getQuestion(qid) {
  return protocol?.questions?.[qid] || null;
}

function stepLabel() {
  return `Step ${state.history.length + 1}`;
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
  } else if (q.type === "number") {
    if (q.required === false && (ans === "" || ans === null || ans === undefined)) valid = true;
    else valid = typeof ans === "number" && !Number.isNaN(ans);
  } else if (q.type === "text") {
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
  return q.next || null;
}

function evalCond(cond) {
  const val = state.answers[cond.q];

  if (cond.equals !== undefined) return val === cond.equals;
  if (cond.includes !== undefined) return Array.isArray(val) && val.includes(cond.includes);

  if (cond.gte !== undefined) return typeof val === "number" && val >= cond.gte;
  if (cond.lt !== undefined) return typeof val === "number" && val < cond.lt;

  if (cond.countGte !== undefined) return (Array.isArray(val) ? val.length : 0) >= cond.countGte;
  if (cond.countLt !== undefined) return (Array.isArray(val) ? val.length : 0) < cond.countLt;

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

  const map = protocol.scoring.outcomeByScore || [];
  for (const b of map) {
    if (score >= b.min && score <= b.max) {
      state.outcomeId = b.outcome;
      return { score, outcomeId: b.outcome };
    }
  }
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
        if (e.target.checked) state.answers[qid] = Array.from(new Set([...curr, e.target.value]));
        else state.answers[qid] = curr.filter(x => x !== e.target.value);
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
    const existing = state.answers[qid];
    if (typeof existing === "number") input.value = String(existing);

    input.addEventListener("input", () => {
      const raw = input.value;
      state.answers[qid] = raw === "" ? "" : Number(raw);
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

  $("backBtn").disabled = state.history.length === 0;
  enableNextIfValid(qid);

  // Speak question
  const spokenParts = [t(q.text)];
  if (q.type === "single" || q.type === "multi") {
    const opts = q.options.map((o, i) => `${i + 1}: ${t(o.label)}`).join(". ");
    spokenParts.push(opts);
  }
  speak(spokenParts.join(". "));

  startListening(qid);
}

function renderEnd() {
  $("step").textContent = "Complete";
  $("nextBtn").disabled = true;

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

  $("summaryText").textContent = lines.join("\n");
  $("summaryCard").classList.remove("hidden");

  speak(`${t(outcome.label)}. ${t(outcome.text)}`);
}

/* =======================
   Voice commands
   ======================= */
function handleSpoken(qid, spoken) {
  const q = getQuestion(qid);
  if (!q) return;

  const cmdNext = ["next", "continue", "siguiente", "suivant", "आगे", "endelea", "التالي"];
  const cmdBack = ["back", "previous", "atrás", "retour", "वापस", "rudi", "رجوع"];
  const cmdRepeat = ["repeat", "again", "repetir", "répéter", "दोहराएँ", "rudia", "إعادة"];
  const cmdReset = ["reset", "restart", "reiniciar", "réinitialiser", "रीसेट", "weka upya", "إعادة ضبط"];

  if (cmdNext.some(w => spoken.includes(normalize(w)))) return goNext();
  if (cmdBack.some(w => spoken.includes(normalize(w)))) return goBack();
  if (cmdRepeat.some(w => spoken.includes(normalize(w)))) return speak(state.lastSpoken || "");
  if (cmdReset.some(w => spoken.includes(normalize(w)))) return resetAll();

  if (q.type === "single" || q.type === "multi") {
    const digit = spoken.match(/(\d+)/);
    if (digit) {
      const idx = parseInt(digit[1], 10) - 1;
      if (q.options[idx]) return applyOption(qid, q, q.options[idx].value);
    }

    const matched = q.options.find(o => normalize(t(o.label)) === spoken);
    if (matched) return applyOption(qid, q, matched.value);
  }
}

function applyOption(qid, q, value) {
  if (q.type === "single") state.answers[qid] = value;
  else {
    const curr = Array.isArray(state.answers[qid]) ? state.answers[qid] : [];
    state.answers[qid] = curr.includes(value) ? curr.filter(x => x !== value) : [...curr, value];
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
   Settings modal
   ======================= */
function openSettings() {
  $("speechLangSelect").value = speechLang;
  $("autoTranslateToggle").checked = autoTranslate;
  $("translateEndpointInput").value = translateEndpoint;

  // Ensure voice list present + dropdown populated
  populateVoiceDropdown();

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
async function init() {
  $("uiLangSelect").value = uiLang;

  await loadModules();
  populateModulesDropdown();

  const moduleId = $("moduleSelect").value;
  await loadProtocolByModuleId(moduleId);

  initPWA();

  // Load voices once at startup
  ttsVoices = await getVoicesAsync();

  applyUiStrings();

  // Events
  $("moduleSelect").addEventListener("change", async (e) => {
    await switchModule(e.target.value);
  });

  $("uiLangSelect").addEventListener("change", async (e) => {
    uiLang = e.target.value;
    saveAll();

    // Refresh voices (some devices load voices lazily)
    ttsVoices = await getVoicesAsync();

    applyUiStrings();
    populateModulesDropdown();
    populateVoiceDropdown();

    renderQuestion(state.currentQ && state.currentQ !== "end" ? state.currentQ : protocol.start);
  });

  $("ttsBtn").addEventListener("click", async () => {
    ttsEnabled = !ttsEnabled;
    saveAll();

    // Refresh voices if just enabled
    if (ttsEnabled) ttsVoices = await getVoicesAsync();

    applyUiStrings();
    if (state.currentQ && state.currentQ !== "end") renderQuestion(state.currentQ);
  });

  $("micBtn").addEventListener("click", () => {
    micEnabled = !micEnabled;
    saveAll();
    applyUiStrings();
    if (micEnabled && state.currentQ && state.currentQ !== "end") startListening(state.currentQ);
    else { try { recognition?.abort(); } catch {} }
  });

  $("settingsBtn").addEventListener("click", openSettings);
  $("closeSettingsBtn").addEventListener("click", closeSettings);
  $("saveSettingsBtn").addEventListener("click", saveSettings);

  // NEW: voice picker events
  $("ttsVoiceSelect").addEventListener("change", (e) => {
    ttsVoiceURI = e.target.value;
    saveAll();
  });

  $("testVoiceBtn").addEventListener("click", async () => {
    // ensure voices are available
    ttsVoices = await getVoicesAsync();
    populateVoiceDropdown();

    const samples = {
      en: "Hello. This is a voice test.",
      es: "Hola. Esta es una prueba de voz.",
      fr: "Bonjour. Ceci est un test de voix.",
      hi: "नमस्ते। यह वॉइस टेस्ट है।",
      sw: "Habari. Huu ni mtihani wa sauti.",
      ar: "مرحباً. هذا اختبار للصوت."
    };
    speak(samples[uiLang] || samples.en);
  });

  $("resetBtn").addEventListener("click", resetAll);
  $("nextBtn").addEventListener("click", goNext);
  $("backBtn").addEventListener("click", goBack);
  $("repeatBtn").addEventListener("click", () => speak(state.lastSpoken || ""));

  $("copyBtn").addEventListener("click", copySummary);
  $("downloadBtn").addEventListener("click", downloadSummary);

  renderQuestion(protocol.start);
}

init();