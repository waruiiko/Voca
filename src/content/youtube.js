// ============================================================
// 英语助手 - YouTube 双语字幕侧边栏
// ============================================================

let captions = [];
let currentIndex = -1;
let panelEl = null;
let listEl = null;
let toggleBtnEl = null;
let isPanelVisible = false;
let videoEl = null;
let translationCache = new Map();
let captionsLoaded = false;
let _txSettings = { api: "google", deeplKey: "", langblyKey: "", libreUrl: "http://localhost:5000" };

// 读取翻译设置
chrome.storage.local.get("settings", (r) => {
  _txSettings.api = r.settings?.translationApi || "google";
  _txSettings.deeplKey = r.settings?.deeplApiKey || "";
  _txSettings.langblyKey = r.settings?.langblyApiKey || "";
  _txSettings.libreUrl = r.settings?.libreUrl || "http://localhost:5000";
});
chrome.storage.onChanged.addListener((changes) => {
  if (changes.settings?.newValue) {
    _txSettings.api = changes.settings.newValue.translationApi || "google";
    _txSettings.deeplKey = changes.settings.newValue.deeplApiKey || "";
    _txSettings.langblyKey = changes.settings.newValue.langblyApiKey || "";
    _txSettings.libreUrl = changes.settings.newValue.libreUrl || "http://localhost:5000";
    translationCache.clear();
  }
});

// ---------- 工具 ----------

function getVideoId() {
  return new URLSearchParams(window.location.search).get("v");
}
function isVideoPage() {
  return window.location.pathname === "/watch" && !!getVideoId();
}
function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function waitForEl(selector, timeout = 15000) {
  return new Promise((resolve) => {
    const el = document.querySelector(selector);
    if (el) { resolve(el); return; }
    const ob = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) { ob.disconnect(); resolve(el); }
    });
    ob.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => { ob.disconnect(); resolve(null); }, timeout);
  });
}

// ---------- 方法1：解析当前页面 DOM 中的 <script> 标签 ----------
// YouTube 把 ytInitialPlayerResponse 直接写在 HTML 里的 <script> 标签中
// 内容脚本可以直接读取，不需要额外网络请求

function getTracksFromDOM() {
  for (const script of document.querySelectorAll("script:not([src])")) {
    const text = script.textContent;
    if (!text || text.length < 500) continue;
    if (!text.includes("captionTracks")) continue;
    const tracks = parseTracksFromText(text);
    if (tracks.length > 0) return tracks;
  }
  return [];
}

function parseTracksFromText(text) {
  // 找到所有出现的 captionTracks
  let pos = 0;
  const key = '"captionTracks":';
  while ((pos = text.indexOf(key, pos)) !== -1) {
    const arrStart = text.indexOf("[", pos + key.length);
    if (arrStart === -1) { pos++; continue; }

    // 配对括号找到数组结束位置
    let depth = 0, inStr = false, esc = false, end = -1;
    for (let i = arrStart; i < text.length; i++) {
      const c = text[i];
      if (esc) { esc = false; continue; }
      if (c === "\\" && inStr) { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === "[") depth++;
      else if (c === "]") { if (--depth === 0) { end = i + 1; break; } }
    }
    if (end === -1) { pos++; continue; }

    try {
      const tracks = JSON.parse(text.slice(arrStart, end));
      const valid = tracks.filter((t) => t.baseUrl);
      if (valid.length > 0) {
        return valid.map((t) => ({ url: t.baseUrl, lang: t.languageCode || "" }));
      }
    } catch {}
    pos++;
  }
  return [];
}

// ---------- 方法2：等待 bridge（MAIN world）传来数据 ----------

function waitForBridge(timeoutMs = 8000) {
  return new Promise((resolve) => {
    let done = false;

    // 先检查 dataset（bridge 可能已经存好了）
    const stored = document.documentElement.dataset.ehYtData;
    if (stored) {
      try {
        const d = JSON.parse(stored);
        // 返回完整 payload（含 innertubeKey）
        resolve(d);
        return;
      } catch {}
    }

    function finish(payload) {
      if (done) return;
      done = true;
      document.removeEventListener("__eh_yt_data__", handler);
      clearTimeout(timer);
      resolve(payload || {});
    }

    const handler = (e) => finish(e.detail || {});
    document.addEventListener("__eh_yt_data__", handler);
    const timer = setTimeout(() => finish({}), timeoutMs);
  });
}

// ---------- 方法3：InnerTube API（最可靠，参考 baoyu-youtube-transcript）----------
// 直接调用 YouTube 内部播放器 API，用 ANDROID 客户端身份绕过限制
// 因为内容脚本本身就运行在 youtube.com，无跨域问题

async function fetchTracksViaInnertube(videoId, apiKey) {
  try {
    const url = apiKey
      ? `https://www.youtube.com/youtubei/v1/player?key=${encodeURIComponent(apiKey)}`
      : "https://www.youtube.com/youtubei/v1/player";

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        context: { client: { clientName: "ANDROID", clientVersion: "20.10.38" } },
        videoId,
      }),
    });

    if (!res.ok) return [];
    const data = await res.json();
    const tracks =
      data.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    return tracks.map((t) => ({
      url: t.baseUrl,
      lang: t.languageCode || "",
      name: t.name?.simpleText || "",
    }));
  } catch (e) {
    console.log("[EH] InnerTube 异常:", e);
    return [];
  }
}

// ---------- 加载字幕（三步降级策略）----------

async function loadCaptions() {
  // 软超时：12 秒后显示重新加载按钮
  const softTimer = setTimeout(() => {
    if (!captionsLoaded) showPanelError("加载超时，请点击重新加载");
  }, 12000);

  try {
    const videoId = getVideoId();

    // 步骤1：解析当前页面 DOM 中的 script 标签（最快，适合直接 URL 打开）
    const domTracks = getTracksFromDOM();
    const domTrack = domTracks.find((t) => t.lang.startsWith("en")) || domTracks[0];
    if (domTrack?.url) {
      if (await fetchAndApply(domTrack.url)) return true;
    }

    // 步骤2：等待 bridge（MAIN world 读取 ytInitialPlayerResponse）
    const bridgePayload = await waitForBridge(3000);
    const bridgeTracks = bridgePayload.tracks || [];
    const innertubeKey = bridgePayload.innertubeKey || "";

    const bridgeTrack = bridgeTracks.find((t) => t.lang?.startsWith("en")) || bridgeTracks[0];
    if (bridgeTrack?.url) {
      if (await fetchAndApply(bridgeTrack.url)) return true;
    }

    // 步骤3：InnerTube API 直接请求（最可靠，适用于 SPA 导航后 ytInitialPlayerResponse 为空的情况）
    if (videoId) {
      const itTracks = await fetchTracksViaInnertube(videoId, innertubeKey);
      const itTrack = itTracks.find((t) => t.lang?.startsWith("en")) || itTracks[0];
      if (itTrack?.url) {
        if (await fetchAndApply(itTrack.url)) return true;
      }
    }

    showPanelError("未找到字幕轨道\n（此视频可能无英文 CC 字幕）");
    return false;
  } finally {
    clearTimeout(softTimer);
  }
}

async function fetchAndApply(rawUrl) {
  try {
    // 直接使用原始 URL，不强制追加 fmt=json3（URL 内部参数可能已决定格式）
    const res = await fetch(rawUrl, { credentials: "include" });
    if (!res.ok) return false;
    const text = await res.text();
    if (!text || !text.trim()) return false;

    let parsed = [];

    if (text.trimStart().startsWith("{")) {
      // JSON3 格式
      const data = JSON.parse(text);
      parsed = (data.events || [])
        .filter((e) => e.segs)
        .map((e) => ({
          startMs: e.tStartMs,
          endMs: e.tStartMs + (e.dDurationMs || 4000),
          text: e.segs.map((s) => s.utf8 || "").join("").replace(/\n/g, " ").trim(),
          translation: null,
        }))
        .filter((e) => e.text);
    } else if (text.includes("<timedtext") || text.includes("<transcript")) {
      // XML 格式（timedtext API 默认返回此格式）
      const xml = new DOMParser().parseFromString(text, "text/xml");
      parsed = Array.from(xml.querySelectorAll("p")).map((p) => {
        const startMs = parseInt(p.getAttribute("t") || "0");
        const dur = parseInt(p.getAttribute("d") || "4000");
        return {
          startMs,
          endMs: startMs + dur,
          text: p.textContent.replace(/\n/g, " ").trim(),
          translation: null,
        };
      }).filter((e) => e.text);
    }

    if (parsed.length === 0) return false;

    captions = parsed;
    captionsLoaded = true;
    renderItems();
    updatePanelCount();
    // 逐条翻译，每条间隔 150ms，避免触发 Google Translate 限速
    (async () => {
      for (let i = 0; i < Math.min(10, captions.length); i++) {
        translateCaption(i);
        await new Promise((r) => setTimeout(r, 150));
      }
    })();
    return true;
  } catch {
    return false;
  }
}

// ---------- 翻译 ----------

async function translateCaption(index) {
  if (index < 0 || index >= captions.length) return;
  const cap = captions[index];
  if (cap.translation !== null) return;

  const cached = translationCache.get(cap.text);
  if (cached !== undefined) { cap.translation = cached; updateZhEl(index); return; }

  cap.translation = "";
  try {
    cap.translation = await fetchTranslation(cap.text);
    translationCache.set(cap.text, cap.translation);
  } catch { cap.translation = "—"; }
  updateZhEl(index);
}

async function fetchTranslation(text) {
  const { api, deeplKey, langblyKey, libreUrl } = _txSettings;

  if (api === "libre") {
    const url = (libreUrl || "http://localhost:5000").replace(/\/$/, "") + "/translate";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: text, source: "en", target: "zh", format: "text" }),
    });
    if (!res.ok) return "—";
    const data = await res.json();
    return data.translatedText || "—";
  }

  if (api === "langbly" && langblyKey) {
    const res = await fetch("https://api.langbly.com/language/translate/v2", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": langblyKey },
      body: JSON.stringify({ q: text, target: "zh" }),
    });
    if (!res.ok) return "—";
    const data = await res.json();
    return data.data?.translations?.[0]?.translatedText || "—";
  }

  if (api === "deepl" && deeplKey) {
    // DeepL: 直接从 content script 调用（已在 host_permissions 中）
    const res = await fetch("https://api-free.deepl.com/v2/translate", {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${deeplKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: [text], target_lang: "ZH" }),
    });
    if (!res.ok) return "—";
    const data = await res.json();
    return data.translations?.[0]?.text || "—";
  }

  if (api === "mymemory") {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh-CN`;
    const res = await fetch(url);
    if (!res.ok) return "—";
    const data = await res.json();
    return data.responseData?.translatedText || "—";
  }

  // 默认 Google Translate
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) return "—";
  const data = await res.json();
  return data[0]?.map((item) => item[0]).join("") || "—";
}

function preTranslate(center) {
  (async () => {
    for (let i = Math.max(0, center - 1); i < Math.min(captions.length, center + 8); i++) {
      if (captions[i].translation === null) {
        translateCaption(i);
        await new Promise((r) => setTimeout(r, 150));
      }
    }
  })();
}

function updateZhEl(index) {
  const el = listEl?.querySelector(`.eh-sz[data-i="${index}"]`);
  if (el) el.textContent = captions[index].translation || "—";
}

// ---------- 面板 ----------

function createPanel() {
  if (panelEl) return;
  injectStyles();
  panelEl = document.createElement("div");
  panelEl.id = "eh-yt-panel";
  panelEl.innerHTML = `
    <div class="eh-ph">
      <span class="eh-ph-title">📖 双语字幕</span>
      <div class="eh-ph-right">
        <span class="eh-ph-count" id="eh-ph-count"></span>
        <button class="eh-ph-close">✕</button>
      </div>
    </div>
    <div class="eh-pl" id="eh-pl">
      <div class="eh-pl-loading">字幕加载中…</div>
    </div>
  `;
  document.body.appendChild(panelEl);
  listEl = document.getElementById("eh-pl");
  panelEl.querySelector(".eh-ph-close").addEventListener("click", hidePanel);
}

function renderItems() {
  if (!listEl) return;
  const frag = document.createDocumentFragment();
  captions.forEach((cap, i) => {
    const div = document.createElement("div");
    div.className = "eh-si";
    div.dataset.index = i;
    div.innerHTML = `
      <span class="eh-st">${formatTime(cap.startMs)}</span>
      <div class="eh-sc">
        <div class="eh-se">${escapeHtml(cap.text)}</div>
        <div class="eh-sz" data-i="${i}"><span style="color:#444">…</span></div>
      </div>
    `;
    div.addEventListener("click", () => { if (videoEl) videoEl.currentTime = cap.startMs / 1000; });
    frag.appendChild(div);
  });
  listEl.innerHTML = "";
  listEl.appendChild(frag);
}

function updatePanelCount() {
  const el = document.getElementById("eh-ph-count");
  if (el) el.textContent = `${captions.length} 条`;
}

function showPanelError(msg) {
  if (!listEl) return;
  listEl.innerHTML = `
    <div class="eh-pl-error">
      <div class="eh-pl-error-msg">${escapeHtml(msg)}</div>
      <button class="eh-reload-btn">🔄 重新加载</button>
    </div>
  `;
  listEl.querySelector(".eh-reload-btn").addEventListener("click", () => {
    captions = []; captionsLoaded = false; currentIndex = -1;
    listEl.innerHTML = `<div class="eh-pl-loading">重新加载中…</div>`;
    loadCaptions().then(() => { if (captionsLoaded) onTimeUpdate(); });
  });
}

// ---------- 高亮 / 时间同步 ----------

function highlightCurrent(index) {
  if (!listEl) return;
  listEl.querySelector(".eh-si.current")?.classList.remove("current");
  currentIndex = index;
  if (index < 0) return;
  const item = listEl.querySelector(`.eh-si[data-index="${index}"]`);
  if (!item) return;
  item.classList.add("current");
  item.scrollIntoView({ behavior: "smooth", block: "center" });
  preTranslate(index);
}

function onTimeUpdate() {
  if (!isPanelVisible || !videoEl || !captionsLoaded) return;
  const nowMs = videoEl.currentTime * 1000;
  let lo = 0, hi = captions.length - 1, found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const c = captions[mid];
    if (nowMs >= c.startMs && nowMs < c.endMs) { found = mid; break; }
    else if (nowMs < c.startMs) hi = mid - 1;
    else lo = mid + 1;
  }
  if (found !== currentIndex) highlightCurrent(found);
}

// ---------- 切换面板 ----------

function positionPanel() {
  if (!panelEl) return;
  // 对齐到 YouTube 右侧推荐列（#secondary），盖住视频列表
  const sec = document.querySelector("#secondary");
  if (sec) {
    const r = sec.getBoundingClientRect();
    panelEl.style.left   = r.left + "px";
    panelEl.style.top    = r.top + "px";
    panelEl.style.width  = r.width + "px";
    panelEl.style.height = (window.innerHeight - r.top - 8) + "px";
  } else {
    // 回退：紧贴右侧
    panelEl.style.right  = "16px";
    panelEl.style.top    = "60px";
    panelEl.style.width  = "380px";
    panelEl.style.height = "calc(100vh - 80px)";
  }
}

function showPanel() {
  createPanel();
  positionPanel();
  isPanelVisible = true;
  panelEl.style.display = "flex";
  if (toggleBtnEl) toggleBtnEl.classList.add("active");
  if (!captionsLoaded) {
    loadCaptions().then(() => { if (captionsLoaded) { currentIndex = -1; onTimeUpdate(); } });
  } else { currentIndex = -1; onTimeUpdate(); }
}

function hidePanel() {
  isPanelVisible = false;
  if (panelEl) panelEl.style.display = "none";
  if (toggleBtnEl) toggleBtnEl.classList.remove("active");
}

function togglePanel() { if (isPanelVisible) hidePanel(); else showPanel(); }

// ---------- 按钮 ----------

function injectToggleButton() {
  if (document.getElementById("eh-yt-toggle")) return;
  toggleBtnEl = document.createElement("button");
  toggleBtnEl.id = "eh-yt-toggle";
  toggleBtnEl.title = "双语字幕（英语助手）";
  toggleBtnEl.innerHTML = `<svg viewBox="0 0 24 24" fill="white" width="20" height="20"><path d="M4 6h16v2H4zm0 5h10v2H4zm0 5h16v2H4z"/></svg>`;
  toggleBtnEl.addEventListener("click", togglePanel);
  document.body.appendChild(toggleBtnEl);

  const rc = document.querySelector(".ytp-right-controls");
  if (rc && !rc.querySelector(".eh-yt-ctrl-btn")) {
    const btn = document.createElement("button");
    btn.className = "ytp-button eh-yt-ctrl-btn";
    btn.title = "双语字幕（英语助手）";
    btn.innerHTML = `<svg viewBox="0 0 36 36" fill="white" width="36" height="36"><path d="M8 12h20v2.5H8zm0 5.5h14v2.5H8zm0 5.5h20v2.5H8z"/></svg>`;
    btn.addEventListener("click", togglePanel);
    rc.insertBefore(btn, rc.firstChild);
  }
}

// ---------- 样式 ----------

function injectStyles() {
  if (document.getElementById("eh-yt-style")) return;
  const s = document.createElement("style");
  s.id = "eh-yt-style";
  s.textContent = `
    #eh-yt-panel { position:fixed;background:#1a1a2e;border-radius:8px;z-index:9999;display:none;flex-direction:column;box-shadow:0 4px 32px rgba(0,0,0,.55);overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    .eh-ph { display:flex;align-items:center;justify-content:space-between;padding:11px 14px;background:#16213e;border-bottom:1px solid rgba(255,255,255,.08);flex-shrink:0; }
    .eh-ph-title { color:#fff;font-size:13px;font-weight:600; }
    .eh-ph-right { display:flex;align-items:center;gap:8px; }
    .eh-ph-count { color:#666;font-size:11px; }
    .eh-ph-close { background:transparent;border:none;color:#666;cursor:pointer;font-size:14px;padding:2px 5px;border-radius:4px; }
    .eh-ph-close:hover { background:rgba(255,255,255,.1);color:#fff; }
    .eh-pl { flex:1;overflow-y:auto;padding:6px 4px; }
    .eh-pl::-webkit-scrollbar { width:3px; }
    .eh-pl::-webkit-scrollbar-thumb { background:rgba(255,255,255,.12);border-radius:2px; }
    .eh-pl-loading { color:#555;font-size:13px;text-align:center;padding:40px 20px; }
    .eh-pl-error { font-size:13px;text-align:center;padding:40px 16px; }
    .eh-pl-error-msg { color:#e07070;line-height:1.6;margin-bottom:16px;white-space:pre-line; }
    .eh-reload-btn { padding:8px 20px;background:#e8820c;border:none;border-radius:8px;color:white;font-size:13px;cursor:pointer;transition:background .15s; }
    .eh-reload-btn:hover { background:#c06a00; }
    .eh-si { display:flex;gap:8px;padding:7px 10px;border-radius:6px;cursor:pointer;transition:background .12s;border-left:3px solid transparent; }
    .eh-si:hover { background:rgba(255,255,255,.05); }
    .eh-si.current { background:rgba(232,130,12,.15);border-left-color:#e8820c; }
    .eh-st { font-size:11px;color:#555;min-width:34px;padding-top:2px;flex-shrink:0;font-variant-numeric:tabular-nums; }
    .eh-si.current .eh-st { color:#e8820c; }
    .eh-sc { flex:1;min-width:0; }
    .eh-se { font-size:13px;color:#ccc;line-height:1.5;margin-bottom:3px; }
    .eh-si.current .eh-se { color:#fff; }
    .eh-sz { font-size:12px;color:#e8820c;line-height:1.4; }
    #eh-yt-toggle { position:fixed;right:20px;bottom:80px;width:40px;height:40px;border-radius:50%;background:#e8820c;border:none;cursor:pointer;z-index:9999;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 12px rgba(232,130,12,.5);transition:transform .15s,background .15s; }
    #eh-yt-toggle:hover { transform:scale(1.08); }
    #eh-yt-toggle.active { background:#b86500; }
    .eh-yt-ctrl-btn { width:36px!important;height:36px!important;padding:0!important;opacity:.85;display:inline-flex!important;align-items:center;justify-content:center; }
    .eh-yt-ctrl-btn:hover { opacity:1; }
  `;
  document.head.appendChild(s);
}

// ---------- 初始化 / 清理 ----------

function onResize() { if (isPanelVisible) positionPanel(); }

async function setup() {
  if (!isVideoPage()) return;
  injectStyles();
  videoEl = await waitForEl("video");
  if (videoEl) videoEl.addEventListener("timeupdate", onTimeUpdate);
  injectToggleButton();
  waitForEl(".ytp-right-controls").then(() => injectToggleButton());
  window.addEventListener("resize", onResize);
}

function cleanup() {
  panelEl?.remove(); panelEl = null; listEl = null;
  document.getElementById("eh-yt-toggle")?.remove(); toggleBtnEl = null;
  document.querySelector(".eh-yt-ctrl-btn")?.remove();
  videoEl?.removeEventListener("timeupdate", onTimeUpdate); videoEl = null;
  window.removeEventListener("resize", onResize);
  captions = []; currentIndex = -1; isPanelVisible = false; captionsLoaded = false;
}

document.addEventListener("yt-navigate-finish", () => {
  cleanup();
  if (isVideoPage()) setTimeout(setup, 500);
});

if (isVideoPage()) {
  if (document.readyState === "complete") setTimeout(setup, 500);
  else window.addEventListener("load", () => setTimeout(setup, 500));
}
