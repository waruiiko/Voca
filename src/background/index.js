// 后台 Service Worker：翻译 + 复习提醒

// ── 复习提醒（每小时检查一次）──────────────────────────────────────
function setupAlarms() {
  chrome.alarms.get("reviewCheck", (existing) => {
    if (!existing) chrome.alarms.create("reviewCheck", { periodInMinutes: 60 });
  });
  chrome.alarms.get("desktopSync", (existing) => {
    if (!existing) chrome.alarms.create("desktopSync", { periodInMinutes: 1 });
  });
}
chrome.runtime.onInstalled.addListener(setupAlarms);
chrome.runtime.onStartup.addListener(setupAlarms);
setupAlarms();

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "reviewCheck") checkAndNotify();
  if (alarm.name === "desktopSync") syncFromDesktop();
});

// ── 桌面应用生词本同步（每分钟执行：先推送队列，再拉取合并）──────────
async function syncFromDesktop() {
  // 先推送本地队列到桌面端
  try {
    const qr = await new Promise(r => chrome.storage.local.get('_desktopQueue', r));
    const queue = qr._desktopQueue || [];
    if (queue.length > 0) {
      await chrome.storage.local.remove('_desktopQueue');
      for (const item of queue) {
        try {
          if (item.action === 'push') {
            const ctrl = new AbortController();
            setTimeout(() => ctrl.abort(), 3000);
            await fetch('http://127.0.0.1:27149/words', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ word: item.word, translation: item.translation, timestamp: item.timestamp, reviewCount: item.reviewCount }),
              signal: ctrl.signal,
            });
          } else if (item.action === 'delete') {
            const ctrl = new AbortController();
            setTimeout(() => ctrl.abort(), 3000);
            await fetch(`http://127.0.0.1:27149/words/${encodeURIComponent(item.key)}`, { method: 'DELETE', signal: ctrl.signal });
          }
        } catch {}
      }
    }
  } catch {}

  // 再从桌面端拉取最新单词本，合并到本地
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch('http://127.0.0.1:27149/words', { signal: ctrl.signal });
    if (!res.ok) return;
    const desktopWords = await res.json();
    if (!desktopWords || typeof desktopWords !== 'object') return;
    const stored = await new Promise(r => chrome.storage.local.get(['savedWords', '_lastDesktopKeys'], r));
    const local = stored.savedWords || {};
    const prevKeys = new Set(stored._lastDesktopKeys || []);
    const currentKeys = new Set(Object.keys(desktopWords));
    let changed = false;
    // 新增：桌面端有但本地没有的词
    for (const [key, word] of Object.entries(desktopWords)) {
      if (!local[key]) { local[key] = word; changed = true; }
    }
    // 删除：上次在桌面端、现在消失了的词（即桌面端已删除）
    for (const key of prevKeys) {
      if (!currentKeys.has(key) && local[key]) { delete local[key]; changed = true; }
    }
    if (changed) await chrome.storage.local.set({ savedWords: local });
    await chrome.storage.local.set({ _lastDesktopKeys: [...currentKeys] });
  } catch {}
}
syncFromDesktop();

async function checkAndNotify() {
  const hour = new Date().getHours();
  if (hour < 8 || hour >= 21) return; // 仅在 8:00–21:00 推送

  const data = await new Promise((r) =>
    chrome.storage.local.get(["settings", "savedWords"], r)
  );
  const cfg = data.settings || {};
  if (cfg.notificationsEnabled === false) return;

  // 今天已经推送过了就跳过
  const today = new Date().toDateString();
  if (cfg.lastNotifyDay === today) return;

  const words = data.savedWords || {};
  const now = Date.now();
  const dueCount = Object.values(words).filter(
    (w) => !w.mastered && (!w.nextReview || w.nextReview <= now)
  ).length;
  if (dueCount === 0) return;

  chrome.notifications.create("reviewReminder", {
    type: "basic",
    iconUrl: "icon-48.png",
    title: "英语助手 📖",
    message: `今天有 ${dueCount} 个单词待复习，保持学习节奏！`,
    priority: 1,
  });

  // 记录今日已推送
  chrome.storage.local.set({ settings: { ...cfg, lastNotifyDay: today } });
}

chrome.notifications.onClicked.addListener((id) => {
  if (id === "reviewReminder") {
    chrome.action.openPopup().catch(() => {});
    chrome.notifications.clear(id);
  }
});

// ── 消息处理 ───────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "PING") {
    sendResponse({ ok: true });
    return;
  }

  if (message.type === "TRANSLATE") {
    handleTranslate(message.text, message.targetLang || "zh-CN", true)
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === "TRANSLATE_SIMPLE") {
    handleTranslate(message.text, message.targetLang || "zh-CN", false)
      .then((text) => sendResponse({ success: true, text }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === "CLAUDE_QUIZ") {
    handleClaudeQuiz(message.word, message.translation, message.context)
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === "PROCESS_DESKTOP_QUEUE") {
    processDesktopQueue()
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.type === "DESKTOP_PUSH") {
    const { word, translation, timestamp, reviewCount } = message;
    fetch('http://127.0.0.1:27149/words', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word, translation, timestamp: timestamp || Date.now(), reviewCount: reviewCount || 0 }),
    })
      .then(r => sendResponse({ ok: r.ok, status: r.status }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.type === "DESKTOP_DELETE") {
    const { key } = message;
    fetch(`http://127.0.0.1:27149/words/${encodeURIComponent(key)}`, { method: 'DELETE' })
      .then(r => sendResponse({ ok: r.ok, status: r.status }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});

async function processDesktopQueue() {
  const r = await new Promise(resolve => chrome.storage.local.get('_desktopQueue', resolve));
  const queue = r._desktopQueue || [];
  if (!queue.length) return;
  await chrome.storage.local.remove('_desktopQueue');
  for (const item of queue) {
    try {
      if (item.action === 'push') {
        await fetch('http://127.0.0.1:27149/words', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ word: item.word, translation: item.translation, timestamp: item.timestamp, reviewCount: item.reviewCount }),
        });
      } else if (item.action === 'delete') {
        await fetch(`http://127.0.0.1:27149/words/${encodeURIComponent(item.key)}`, { method: 'DELETE' });
      }
    } catch {}
  }
}

async function getApiSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get("settings", (r) => {
      resolve({
        api: r.settings?.translationApi || "google",
        deeplKey: r.settings?.deeplApiKey || "",
        langblyKey: r.settings?.langblyApiKey || "",
        libreUrl: r.settings?.libreUrl || "http://localhost:5000",
      });
    });
  });
}

async function handleTranslate(text, targetLang, withDefinitions) {
  const { api, deeplKey, langblyKey, libreUrl } = await getApiSettings();

  if (api === "deepl" && deeplKey) {
    const translated = await translateDeepL(text, targetLang, deeplKey);
    return withDefinitions ? { mainTranslation: translated, definitions: [] } : translated;
  }

  if (api === "langbly" && langblyKey) {
    const translated = await translateLangbly(text, targetLang, langblyKey);
    return withDefinitions ? { mainTranslation: translated, definitions: [] } : translated;
  }

  if (api === "libre") {
    const translated = await translateLibre(text, targetLang, libreUrl);
    return withDefinitions ? { mainTranslation: translated, definitions: [] } : translated;
  }

  if (api === "mymemory") {
    const translated = await translateMyMemory(text, targetLang);
    return withDefinitions ? { mainTranslation: translated, definitions: [] } : translated;
  }

  // 默认 Google Translate（统一走 translateGoogle GET 路径，简单翻译只取 mainTranslation）
  if (withDefinitions) return translateGoogle(text, targetLang);
  const result = await translateGoogle(text, targetLang);
  return result.mainTranslation;
}

// ---------- Google Translate ----------

async function translateGoogle(text, targetLang) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&dt=bd&q=${encodeURIComponent(text)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("翻译请求失败");
  const data = await response.json();

  const mainTranslation = data[0]?.filter(Boolean).map((item) => item[0] || "").join("") || "";
  const definitions = [];
  if (data[5]) {
    for (const entry of data[5]) {
      const pos = entry[0];
      const terms = entry[2]?.slice(0, 3).map((t) => t[0]) || [];
      if (pos && terms.length) definitions.push({ pos, terms });
    }
  }
  return { mainTranslation, definitions };
}

async function translateGoogleSimple(text, targetLang) {
  const body = new URLSearchParams({ client: "gtx", sl: "auto", tl: targetLang, dt: "t", q: text });
  const response = await fetch("https://translate.googleapis.com/translate_a/single", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  return data[0]?.filter(Boolean).map((item) => item[0] || "").join("") || "";
}

// ---------- DeepL Free API ----------

// 将通用语言码转换为各 API 所需格式
function toDeepLLang(lang) {
  if (lang === "zh-CN" || lang === "zh-TW") return "ZH";
  if (lang === "ja") return "JA";
  return lang.toUpperCase();
}
function toShortLang(lang) {
  // Langbly / LibreTranslate 用短码
  if (lang === "zh-CN" || lang === "zh-TW") return "zh";
  return lang.split("-")[0];
}

async function translateDeepL(text, targetLang, apiKey) {
  const dlLang = toDeepLLang(targetLang);
  const response = await fetch("https://api-free.deepl.com/v2/translate", {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: [text], target_lang: dlLang }),
  });
  if (!response.ok) throw new Error("DeepL 翻译失败");
  const data = await response.json();
  return data.translations?.[0]?.text || "";
}

// ---------- Langbly ----------

async function translateLangbly(text, targetLang, apiKey) {
  const lang = toShortLang(targetLang);
  const response = await fetch("https://api.langbly.com/language/translate/v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({ q: text, target: lang }),
  });
  if (!response.ok) throw new Error("Langbly 翻译失败");
  const data = await response.json();
  return data.data?.translations?.[0]?.translatedText || "";
}

// ---------- LibreTranslate（本地离线）----------

async function translateLibre(text, targetLang, baseUrl) {
  const url = baseUrl.replace(/\/$/, "") + "/translate";
  const lang = toShortLang(targetLang);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: text, source: "en", target: lang, format: "text" }),
  });
  if (!response.ok) throw new Error("LibreTranslate 请求失败");
  const data = await response.json();
  return data.translatedText || "";
}

// ---------- Claude AI Quiz ----------

async function handleClaudeQuiz(word, translation, context) {
  const data = await new Promise((r) => chrome.storage.local.get("settings", r));
  const apiKey = data.settings?.claudeApiKey || "";
  if (!apiKey) throw new Error("未配置 Claude API Key");

  const ctx = context ? ` The word appears in this sentence: "${context}"` : "";
  const prompt = `Create a short vocabulary quiz for the English word "${word}" (translation: "${translation}").${ctx}

Return ONLY valid JSON, no markdown or explanation:
{
  "fillBlank": {
    "sentence": "A natural sentence with ${word} replaced by ___",
    "answer": "${word}"
  },
  "multiChoice": {
    "question": "What does '${word}' mean?",
    "options": ["${translation}", "wrong option 1", "wrong option 2", "wrong option 3"],
    "correct": 0
  }
}`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!resp.ok) throw new Error(`Claude API 错误: ${resp.status}`);
  const result = await resp.json();
  const text = result.content?.[0]?.text || "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI 返回格式错误");
  return JSON.parse(jsonMatch[0]);
}

// ---------- MyMemory ----------

async function translateMyMemory(text, targetLang) {
  const langpair = `en|${targetLang}`;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langpair)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("MyMemory 翻译失败");
  const data = await response.json();
  return data.responseData?.translatedText || "";
}
