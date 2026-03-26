// ============================================================
// 英语助手 - 内容脚本
// 功能：选中英文单词 → 弹出翻译气泡 → 一键收藏
//       页面单词高亮（已保存 + 难词）
// ============================================================

import { isDifficultWord, TIER1, TIER2, TIER3 } from "../shared/wordFrequency.js";
import { WORD_BOOKS } from "../shared/wordBooks.js";

// ---------- 注入样式 ----------
const styleEl = document.createElement("style");
styleEl.textContent = `
  #eh-tooltip {
    position: fixed;
    z-index: 2147483647;
    background: #ffffff;
    border-radius: 12px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.18), 0 1px 6px rgba(0,0,0,0.08);
    padding: 14px 16px 12px;
    min-width: 200px;
    max-width: 300px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: #1a1a1a;
    animation: eh-fadein 0.15s ease;
    pointer-events: all;
  }
  @keyframes eh-fadein {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  #eh-tooltip .eh-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 6px;
  }
  #eh-tooltip .eh-word {
    font-size: 18px;
    font-weight: 700;
    color: #1a1a1a;
    word-break: break-all;
  }
  #eh-tooltip .eh-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
    margin-left: 8px;
  }
  #eh-tooltip .eh-btn {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    background: rgba(255,255,255,0.15);
    color: #e8820c;
    transition: background 0.15s;
    padding: 0;
  }
  #eh-tooltip .eh-btn:hover { background: rgba(232,130,12,0.15); }
  #eh-tooltip .eh-btn.eh-saved { color: #e8820c; }
  #eh-tooltip .eh-translate-btn { font-size: 12px; font-weight: 700; border: 1px solid rgba(232,130,12,0.4); letter-spacing: 0; }
  #eh-tooltip .eh-translate-btn:disabled { opacity: 0.5; cursor: default; }
  #eh-tooltip .eh-book-btn { font-size: 14px; }
  #eh-tooltip .eh-book-btn.eh-in-pool { color: #4a90d9; }
  #eh-tooltip .eh-book-btn.eh-in-pool:hover { background: rgba(74,144,217,0.15); }
  #eh-tooltip .eh-book-btn:not(.eh-in-pool) { color: #ccc; cursor: default; }
  #eh-tooltip .eh-book-btn:not(.eh-in-pool):hover { background: transparent; }
  #eh-tooltip .eh-phonetic { font-size: 13px; color: #888; font-family: Georgia, "Times New Roman", serif; margin: 2px 0 4px; }
  #eh-tooltip .eh-translation {
    font-size: 15px;
    color: #333;
    font-weight: 500;
    margin-bottom: 4px;
  }
  #eh-tooltip .eh-definitions {
    margin-top: 6px;
    border-top: 1px solid #f0f0f0;
    padding-top: 6px;
  }
  #eh-tooltip .eh-def-item { margin-bottom: 3px; }
  #eh-tooltip .eh-pos {
    font-size: 11px;
    color: #888;
    background: #f5f5f5;
    padding: 1px 5px;
    border-radius: 3px;
    margin-right: 4px;
    font-style: italic;
  }
  #eh-tooltip .eh-terms { font-size: 13px; color: #555; }
  #eh-tooltip .eh-loading { color: #888; font-size: 13px; }
  #eh-tooltip .eh-error { color: #e74c3c; font-size: 13px; }

  /* 已收藏单词高亮 */
  mark.eh-hl-saved {
    background: transparent;
    border-bottom: 2px solid #e8820c;
    padding-bottom: 1px;
    cursor: pointer;
    border-radius: 0;
    color: inherit;
  }
  mark.eh-hl-saved:hover { background: rgba(232,130,12,0.18); }

  /* 难词高亮 */
  mark.eh-hl-difficult {
    background: rgba(232,130,12,0.22);
    border-radius: 3px;
    padding: 0 2px;
    cursor: pointer;
    color: inherit;
  }
  mark.eh-hl-difficult:hover { background: rgba(232,130,12,0.38); }

  /* 词书高亮（蓝色下划线，与收藏词橙色区分） */
  mark.eh-hl-wordbook {
    background: transparent;
    border-bottom: 2px solid #4a90d9;
    padding-bottom: 1px;
    cursor: pointer;
    border-radius: 0;
    color: inherit;
  }
  mark.eh-hl-wordbook:hover { background: rgba(74,144,217,0.15); }

  /* 句子翻译：悬浮图标 */
  #eh-sel-icon {
    position: absolute; z-index: 2147483647;
    animation: eh-pop-in 0.12s ease;
  }
  @keyframes eh-pop-in {
    from { transform: scale(0.7); opacity: 0; }
    to   { transform: scale(1);   opacity: 1; }
  }
  #eh-sel-icon .eh-sel-icon-btn {
    width: 32px; height: 32px;
    background: #1a1a2e;
    border: 1.5px solid rgba(232,130,12,0.5);
    border-radius: 50%;
    cursor: pointer;
    color: #e8820c; font-weight: 800; font-size: 12px;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    box-shadow: 0 2px 12px rgba(0,0,0,0.4);
    display: flex; align-items: center; justify-content: center;
    transition: transform 0.15s, box-shadow 0.15s;
  }
  #eh-sel-icon .eh-sel-icon-btn:hover {
    transform: scale(1.12);
    box-shadow: 0 4px 16px rgba(232,130,12,0.35);
  }

  /* 句子翻译：结果面板 */
  #eh-sel-panel {
    position: absolute; z-index: 2147483647;
    background: #1e1e2e;
    border-radius: 12px;
    padding: 12px 14px 10px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.35);
    max-width: 380px; min-width: 180px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    animation: eh-pop-in 0.15s ease;
  }
  .eh-sel-original {
    font-size: 11px; color: #555;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    margin-bottom: 7px; padding-bottom: 7px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  .eh-sel-translation { font-size: 14px; color: #f0f0f0; line-height: 1.65; }
  .eh-sel-loading { color: #888; font-style: italic; }
  .eh-sel-actions {
    display: flex; justify-content: flex-end;
    margin-top: 8px; gap: 6px;
  }
  .eh-sel-copy-btn, .eh-sel-close-btn, .eh-sel-retry-btn {
    background: rgba(255,255,255,0.07);
    border: none; color: #aaa; cursor: pointer;
    font-size: 12px; padding: 3px 9px; border-radius: 6px;
    font-family: inherit; transition: background 0.15s;
  }
  .eh-sel-copy-btn:hover, .eh-sel-close-btn:hover, .eh-sel-retry-btn:hover {
    background: rgba(255,255,255,0.15); color: #fff;
  }
  .eh-sel-retry-btn { color: #e8820c; }
  /* 翻译面板中生词高亮 */
  .eh-sel-hl-saved {
    color: #e8820c; font-weight: 700; border-bottom: 1px solid rgba(232,130,12,0.5);
  }
  /* 编辑模态框 */
  #eh-edit-overlay {
    position: fixed; inset: 0; z-index: 2147483646;
    background: rgba(0,0,0,0.45); display: flex;
    align-items: center; justify-content: center;
  }
  #eh-edit-dialog {
    background: #1e1e2e; border-radius: 14px;
    box-shadow: 0 8px 40px rgba(0,0,0,0.5);
    width: 560px; max-width: calc(100vw - 32px);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    overflow: hidden; animation: eh-pop-in 0.15s ease;
  }
  #eh-edit-dialog .eh-ed-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  #eh-edit-dialog .eh-ed-title {
    font-size: 14px; font-weight: 600; color: #e0e0e0;
  }
  #eh-edit-dialog .eh-ed-close {
    background: none; border: none; color: #888; font-size: 18px;
    cursor: pointer; padding: 2px 6px; border-radius: 6px; line-height: 1;
    transition: background 0.15s;
  }
  #eh-edit-dialog .eh-ed-close:hover { background: rgba(255,255,255,0.1); color: #fff; }
  #eh-edit-dialog .eh-ed-lang-row {
    padding: 10px 16px 0; display: flex; align-items: center; gap: 8px;
  }
  #eh-edit-dialog .eh-ed-lang-label { font-size: 12px; color: #888; }
  #eh-edit-dialog .eh-ed-lang-sel {
    background: #2a2a3e; border: 1px solid rgba(255,255,255,0.15);
    color: #e0e0e0; font-size: 13px; padding: 4px 10px; border-radius: 8px;
    cursor: pointer; outline: none; font-family: inherit;
    color-scheme: dark;
  }
  #eh-edit-dialog .eh-ed-lang-sel:focus { border-color: rgba(99,179,237,0.6); }
  #eh-edit-dialog .eh-ed-lang-sel option {
    background: #2a2a3e; color: #e0e0e0;
  }
  #eh-edit-dialog .eh-ed-body {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 0; padding: 10px 16px 12px;
  }
  #eh-edit-dialog .eh-ed-source-wrap, #eh-edit-dialog .eh-ed-result-wrap {
    display: flex; flex-direction: column; gap: 4px;
  }
  #eh-edit-dialog .eh-ed-source-wrap { padding-right: 10px; border-right: 1px solid rgba(255,255,255,0.08); }
  #eh-edit-dialog .eh-ed-result-wrap { padding-left: 10px; }
  #eh-edit-dialog .eh-ed-col-label { font-size: 11px; color: #666; margin-bottom: 2px; }
  #eh-edit-dialog textarea.eh-ed-source {
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px; color: #e0e0e0; font-size: 14px; line-height: 1.6;
    padding: 10px; resize: none; height: 120px; font-family: inherit;
    outline: none; transition: border-color 0.15s;
  }
  #eh-edit-dialog textarea.eh-ed-source:focus { border-color: rgba(99,179,237,0.5); }
  #eh-edit-dialog .eh-ed-result {
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px; color: #f0f0f0; font-size: 14px; line-height: 1.6;
    padding: 10px; min-height: 120px; white-space: pre-wrap; word-break: break-word;
  }
  #eh-edit-dialog .eh-ed-result.eh-ed-loading { color: #666; font-style: italic; }
  #eh-edit-dialog .eh-ed-footer {
    display: flex; justify-content: flex-end; gap: 8px;
    padding: 10px 16px 14px; border-top: 1px solid rgba(255,255,255,0.06);
  }
  #eh-edit-dialog .eh-ed-btn {
    background: rgba(255,255,255,0.08); border: none; color: #ccc;
    font-size: 13px; padding: 6px 14px; border-radius: 8px;
    cursor: pointer; font-family: inherit; transition: background 0.15s;
  }
  #eh-edit-dialog .eh-ed-btn:hover { background: rgba(255,255,255,0.15); color: #fff; }
  #eh-edit-dialog .eh-ed-btn-primary {
    background: #3b82f6; color: #fff;
  }
  #eh-edit-dialog .eh-ed-btn-primary:hover { background: #2563eb; }
`;
document.head.appendChild(styleEl);

// ---------- 全局状态 ----------
let tooltipEl = null;
let currentWord = "";
let currentContext = "";   // 当前选词所在句子
let savedWords = {};
let selIconEl = null;      // 句子翻译悬浮图标
let selPanelEl = null;     // 句子翻译结果面板
let currentSelText = "";   // 当前选中的句子/短语
let savedRange = null;     // 保存选区用于替换
let settings = { highlightSaved: true, highlightDifficult: false, enabledWordBooks: [], dismissedPoolWords: [], activePersonalBookId: "default" };

// 当前启用的词书单词集合（合并所有开启的 tier）
let wordBookSet = new Set();

function buildWordBookSet() {
  wordBookSet = new Set();
  const enabled = settings.enabledWordBooks || [];
  const dismissed = new Set(settings.dismissedPoolWords || []);
  const add = (w) => { if (!dismissed.has(w)) wordBookSet.add(w); };
  // 内置 CEFR 词书
  if (enabled.includes("tier1")) TIER1.forEach(add);
  if (enabled.includes("tier2")) TIER2.forEach(add);
  if (enabled.includes("tier3")) TIER3.forEach(add);
  // 扩展词书（A2/B2/C2 + 考试词书）
  for (const id of ["a2","b2","c2","cet4","cet6","ielts","toefl","gre","sat"]) {
    if (enabled.includes(id) && WORD_BOOKS[id]) WORD_BOOKS[id].forEach(add);
  }
  // 用户自定义词书
  const customBooks = settings.customWordBooks || [];
  for (const book of customBooks) {
    if (enabled.includes(book.id)) {
      book.words.forEach(w => add(w.toLowerCase()));
    }
  }
}

// ---------- 初始化 ----------
chrome.storage.local.get(["savedWords", "settings"], (result) => {
  savedWords = result.savedWords || {};
  if (result.settings) settings = { ...settings, ...result.settings };
  buildWordBookSet();
  scheduleHighlight();
});

// 监听 DOM 动态变化（SPA 页面内容懒加载时重新高亮）
const _mutationObserver = new MutationObserver((mutations) => {
  const hasNewNodes = mutations.some(m => m.addedNodes.length > 0);
  if (hasNewNodes) scheduleHighlight();
});
if (document.body) {
  _mutationObserver.observe(document.body, { childList: true, subtree: true });
} else {
  document.addEventListener("DOMContentLoaded", () => {
    _mutationObserver.observe(document.body, { childList: true, subtree: true });
  });
}

// 监听 storage 变化
chrome.storage.onChanged.addListener((changes) => {
  if (changes.savedWords) {
    savedWords = changes.savedWords.newValue || {};
    clearHighlights();
    scheduleHighlight();
  }
  if (changes.settings) {
    settings = { ...settings, ...changes.settings.newValue };
    buildWordBookSet();
    clearHighlights();
    scheduleHighlight();
  }
});

// ---------- 页面高亮 ----------
let highlightTimer = null;
function scheduleHighlight() {
  clearTimeout(highlightTimer);
  highlightTimer = setTimeout(highlightPage, 500);
}

// A 标签不跳过（允许高亮链接文字）；MARK 跳过（避免重复嵌套高亮）
const SKIP_TAGS = new Set(["SCRIPT","STYLE","NOSCRIPT","TEXTAREA","INPUT","SELECT","CODE","PRE","BUTTON","MARK"]);

function highlightPage() {
  const hasWordBook = wordBookSet.size > 0;
  if (!settings.highlightSaved && !settings.highlightDifficult && !hasWordBook) return;

  const savedKeys = new Set(Object.keys(savedWords));
  if (savedKeys.size === 0 && !settings.highlightDifficult && !hasWordBook) return;

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        if (parent.closest("#eh-tooltip")) return NodeFilter.FILTER_REJECT;
        if (parent.dataset?.ehProcessed) return NodeFilter.FILTER_REJECT;
        if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) textNodes.push(node);

  for (const textNode of textNodes) {
    processTextNode(textNode, savedKeys);
  }
}

function processTextNode(textNode, savedKeys) {
  const text = textNode.textContent;
  if (!text || !text.trim()) return;

  // 找出所有英文单词及其位置
  const wordRegex = /\b([a-zA-Z]{3,})\b/g;
  let match;
  const fragments = [];
  let lastIndex = 0;
  let hasMatch = false;

  while ((match = wordRegex.exec(text)) !== null) {
    const word = match[1];
    const wordLower = word.toLowerCase();
    let hlClass = null;

    if (settings.highlightSaved && savedKeys.has(wordLower)) {
      hlClass = "eh-hl-saved";
    } else if (wordBookSet.size > 0 && wordBookSet.has(wordLower) && !savedKeys.has(wordLower)) {
      hlClass = "eh-hl-wordbook";
    } else if (settings.highlightDifficult && isDifficultWord(word)) {
      hlClass = "eh-hl-difficult";
    }

    if (!hlClass) continue;
    hasMatch = true;

    // 前面的普通文本
    if (match.index > lastIndex) {
      fragments.push(document.createTextNode(text.slice(lastIndex, match.index)));
    }

    const mark = document.createElement("mark");
    mark.className = hlClass;
    mark.textContent = word;
    // 点击高亮词也可翻译
    mark.addEventListener("click", (e) => {
      e.stopPropagation();
      triggerTranslate(word, e.target.getBoundingClientRect());
    });
    fragments.push(mark);
    lastIndex = match.index + word.length;
  }

  if (!hasMatch) return;

  // 剩余文本
  if (lastIndex < text.length) {
    fragments.push(document.createTextNode(text.slice(lastIndex)));
  }

  // 替换文本节点
  const parent = textNode.parentElement;
  if (!parent) return;
  parent.dataset.ehProcessed = "1";
  const frag = document.createDocumentFragment();
  fragments.forEach((f) => frag.appendChild(f));
  parent.replaceChild(frag, textNode);
}

function clearHighlights() {
  document.querySelectorAll("mark.eh-hl-saved, mark.eh-hl-difficult, mark.eh-hl-wordbook").forEach((el) => {
    el.replaceWith(document.createTextNode(el.textContent));
  });
  document.querySelectorAll("[data-eh-processed]").forEach((el) => {
    delete el.dataset.ehProcessed;
  });
}

// ---------- 工具函数 ----------
function isEnglishText(text) {
  return /^[a-zA-Z][a-zA-Z\s'-]{0,49}$/.test(text.trim());
}

function getSelectionRect() {
  const sel = window.getSelection();
  if (!sel.rangeCount) return null;
  return sel.getRangeAt(0).getBoundingClientRect();
}

function positionTooltip(tooltip, rect) {
  const margin = 10;
  const vpW = window.innerWidth;
  tooltip.style.left = "0px";
  tooltip.style.top = "0px";
  tooltip.style.visibility = "hidden";
  tooltip.style.display = "block";
  document.body.appendChild(tooltip);
  const tw = tooltip.offsetWidth;
  const th = tooltip.offsetHeight;
  let top = rect.top - th - margin;
  if (top < margin) top = rect.bottom + margin;
  let left = rect.left + rect.width / 2 - tw / 2;
  left = Math.max(margin, Math.min(left, vpW - tw - margin));
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
  tooltip.style.visibility = "visible";
}

// ---------- 气泡 ----------
// 从选区提取所在句子（用于保存上下文）
function extractContextSentence() {
  try {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return "";
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return "";
    const text = node.textContent || "";
    const offset = range.startOffset;
    let start = offset;
    while (start > 0 && !/[.!?\n]/.test(text[start - 1])) start--;
    while (start < offset && /\s/.test(text[start])) start++;
    let end = offset;
    while (end < text.length && !/[.!?\n]/.test(text[end])) end++;
    if (end < text.length && /[.!?]/.test(text[end])) end++;
    const sentence = text.slice(start, end).trim();
    return (sentence.length >= 10 && sentence.length <= 400) ? sentence : "";
  } catch { return ""; }
}

// TTS 朗读
function speakWord(word) {
  if (!window.speechSynthesis) return;
  speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(word);
  utt.lang = "en-US";
  speechSynthesis.speak(utt);
}

function createTooltip(word, autoTranslate = false) {
  removeTooltip();
  tooltipEl = document.createElement("div");
  tooltipEl.id = "eh-tooltip";
  const key = word.toLowerCase();
  const isSaved = !!savedWords[key];
  const isInPool = wordBookSet.has(key);
  tooltipEl.innerHTML = `
    <div class="eh-header">
      <div class="eh-word">${escapeHtml(word)}</div>
      <div class="eh-actions">
        <button class="eh-btn eh-translate-btn" title="翻译">译</button>
        <button class="eh-btn eh-tts-btn" title="朗读">🔊</button>
        <button class="eh-btn eh-book-btn ${isInPool ? "eh-in-pool" : ""}" title="${isInPool ? "从词书移除" : "不在词书中"}">◆</button>
        <button class="eh-btn eh-star-btn ${isSaved ? "eh-saved" : ""}" title="${isSaved ? "取消收藏" : "收藏单词"}">
          ${isSaved ? "★" : "☆"}
        </button>
        <button class="eh-btn eh-close-btn" title="关闭">✕</button>
      </div>
    </div>
  `;
  tooltipEl.querySelector(".eh-close-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    removeTooltip();
  });
  tooltipEl.querySelector(".eh-book-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    if (isInPool) dismissFromPool(word);
  });
  tooltipEl.querySelector(".eh-star-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    toggleSave(word);
  });
  tooltipEl.querySelector(".eh-translate-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    doTranslate(word);
  });
  tooltipEl.querySelector(".eh-tts-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    speakWord(word);
  });
  if (autoTranslate) doTranslate(word);
  return tooltipEl;
}

async function doTranslate(word) {
  if (!tooltipEl) return;
  const btn = tooltipEl.querySelector(".eh-translate-btn");
  if (btn) { btn.disabled = true; btn.textContent = "…"; }
  try {
    const [response, phonetic] = await Promise.all([
      chrome.runtime.sendMessage({ type: "TRANSLATE", text: word, targetLang: settings.targetLang || "zh-CN" }),
      fetchPhonetic(word),
    ]);
    if (!tooltipEl) return;
    if (btn) btn.remove();
    if (phonetic) {
      const wordEl = tooltipEl.querySelector(".eh-word");
      if (wordEl) wordEl.insertAdjacentHTML("afterend", `<div class="eh-phonetic">${escapeHtml(phonetic)}</div>`);
    }
    if (response.success) updateTooltipContent(response.data);
    else showError("翻译失败");
  } catch {
    if (btn) { btn.disabled = false; btn.textContent = "译"; }
    showError("无法连接翻译服务");
  }
}

async function fetchPhonetic(word) {
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data[0]?.phonetics?.find(p => p.text)?.text || data[0]?.phonetic || null;
  } catch {
    return null;
  }
}

function updateTooltipContent(result) {
  if (!tooltipEl) return;
  let html = `<div class="eh-translation">${escapeHtml(result.mainTranslation)}</div>`;
  if (result.definitions && result.definitions.length > 0) {
    html += `<div class="eh-definitions">`;
    const posMap = { noun: "n.", verb: "v.", adjective: "adj.", adverb: "adv.", conjunction: "conj.", preposition: "prep." };
    for (const def of result.definitions) {
      const posLabel = posMap[def.pos] || def.pos;
      html += `<div class="eh-def-item">
        <span class="eh-pos">${escapeHtml(posLabel)}</span>
        <span class="eh-terms">${def.terms.map(escapeHtml).join("；")}</span>
      </div>`;
    }
    html += `</div>`;
  }
  tooltipEl.insertAdjacentHTML("beforeend", html);
}

function showError(msg) {
  if (!tooltipEl) return;
  tooltipEl.insertAdjacentHTML("beforeend", `<div class="eh-error">${escapeHtml(msg)}</div>`);
}

// ---------- 收藏 ----------
function toggleSave(word) {
  const key = word.toLowerCase();
  const starBtn = tooltipEl?.querySelector(".eh-star-btn");
  const isSaved = !!savedWords[key];

  if (isSaved) {
    // 取消收藏：从生词本删除
    chrome.storage.local.get("savedWords", (result) => {
      const words = result.savedWords || {};
      delete words[key];
      chrome.storage.local.set({ savedWords: words }, () => {
        savedWords = words;
        clearHighlights();
        scheduleHighlight();
      });
      if (starBtn) { starBtn.textContent = "☆"; starBtn.classList.remove("eh-saved"); starBtn.title = "收藏单词"; }
    });
  } else {
    // 收藏：加入生词本
    chrome.storage.local.get("savedWords", (result) => {
      const words = result.savedWords || {};
      words[key] = {
        word,
        translation: tooltipEl?.querySelector(".eh-translation")?.textContent || "",
        context: currentContext,
        timestamp: Date.now(),
        bookId: settings.activePersonalBookId || "default",
      };
      chrome.storage.local.set({ savedWords: words }, () => {
        savedWords = words;
        clearHighlights();
        scheduleHighlight();
      });
      if (starBtn) { starBtn.textContent = "★"; starBtn.classList.add("eh-saved"); starBtn.title = "取消收藏"; }
    });
  }
}

// ---------- 从词书移除 ----------
function dismissFromPool(word) {
  const key = word.toLowerCase();
  const bookBtn = tooltipEl?.querySelector(".eh-book-btn");
  chrome.storage.local.get("settings", (result) => {
    const sets = result.settings || {};
    let dismissed = Array.isArray(sets.dismissedPoolWords) ? [...sets.dismissedPoolWords] : [];
    if (!dismissed.includes(key)) dismissed.push(key);
    const newSettings = { ...sets, dismissedPoolWords: dismissed };
    chrome.storage.local.set({ settings: newSettings }, () => {
      settings = { ...settings, ...newSettings };
      buildWordBookSet();
      clearHighlights();
      scheduleHighlight();
    });
    if (bookBtn) { bookBtn.classList.remove("eh-in-pool"); bookBtn.title = "不在词书中"; }
  });
}

function removeTooltip() {
  if (tooltipEl) { tooltipEl.remove(); tooltipEl = null; }
}

// ---------- 句子/短语翻译 ----------
function removeSelUI() {
  selIconEl?.remove();  selIconEl  = null;
  selPanelEl?.remove(); selPanelEl = null;
}

function showSelIcon(rect) {
  removeSelUI();
  selIconEl = document.createElement("div");
  selIconEl.id = "eh-sel-icon";
  selIconEl.innerHTML = `<button class="eh-sel-icon-btn" title="翻译已选文本">译</button>`;

  // 放在选区右下角
  const x = Math.min(rect.right + window.scrollX - 14,
                     document.documentElement.scrollWidth - 50);
  const y = rect.bottom + window.scrollY + 6;
  selIconEl.style.cssText = `left:${x}px;top:${y}px`;

  selIconEl.querySelector(".eh-sel-icon-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    doTranslateSel(rect);
  });
  document.body.appendChild(selIconEl);
}

// 将原句中的已保存单词高亮
function highlightSavedInText(text) {
  const savedKeys = Object.keys(savedWords);
  if (savedKeys.length === 0) return escapeHtml(text);
  // 按词长降序，避免短词覆盖长词
  const sortedKeys = savedKeys.sort((a, b) => b.length - a.length);
  const pattern = new RegExp(
    `\\b(${sortedKeys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
    "gi"
  );
  return escapeHtml(text).replace(pattern, (m) =>
    `<span class="eh-sel-hl-saved">${m}</span>`
  );
}

async function doTranslateSel(rect) {
  const text = currentSelText;
  if (!text) return;
  selIconEl?.remove(); selIconEl = null;

  // 保存当前选区，供"替换"功能使用
  try {
    const sel = window.getSelection();
    savedRange = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
  } catch (_) { savedRange = null; }

  const displayText = text.length > 90 ? text.slice(0, 90) + "…" : text;
  const highlightedText = highlightSavedInText(displayText);

  // 创建结果面板（先显示加载中）
  selPanelEl = document.createElement("div");
  selPanelEl.id = "eh-sel-panel";
  selPanelEl.innerHTML = `
    <div class="eh-sel-original">${highlightedText}</div>
    <div class="eh-sel-translation eh-sel-loading">翻译中…</div>
    <div class="eh-sel-actions">
      <button class="eh-sel-close-btn">✕ 关闭</button>
    </div>
  `;

  const pw = 380;
  const x = Math.max(window.scrollX + 8,
    Math.min(rect.left + window.scrollX, window.scrollX + window.innerWidth - pw - 8));
  const y = rect.bottom + window.scrollY + 8;
  selPanelEl.style.cssText = `left:${x}px;top:${y}px`;

  selPanelEl.querySelector(".eh-sel-close-btn").addEventListener("click", (e) => {
    e.stopPropagation(); removeSelUI();
  });
  document.body.appendChild(selPanelEl);

  await runTranslation(text);
}

// 直接在 content script 里调 Google Translate（绕过 service worker）
async function translateDirect(text) {
  const tl = settings.targetLang || "zh-CN";
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  return data[0]?.filter(Boolean).map((item) => item[0] || "").join("") || "";
}

async function runTranslation(text) {
  if (!selPanelEl) return;
  const tEl = selPanelEl.querySelector(".eh-sel-translation");
  if (!tEl) return;
  tEl.className = "eh-sel-translation eh-sel-loading";
  tEl.textContent = "翻译中…";
  tEl.style.color = "";
  selPanelEl.querySelectorAll(".eh-sel-copy-btn, .eh-sel-retry-btn").forEach(b => b.remove());

  try {
    const translated = await translateDirect(text);
    if (!selPanelEl) return;
    tEl.classList.remove("eh-sel-loading");
    tEl.textContent = translated;
    const actions = selPanelEl.querySelector(".eh-sel-actions");

    const editBtn = document.createElement("button");
    editBtn.className = "eh-sel-copy-btn";
    editBtn.textContent = "✏ 编辑";
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openEditModal(text, translated);
    });

    const copyBtn = document.createElement("button");
    copyBtn.className = "eh-sel-copy-btn";
    copyBtn.textContent = "📋 复制";
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(translated).catch(() => {});
      copyBtn.textContent = "✓ 已复制";
      setTimeout(() => { copyBtn.textContent = "📋 复制"; }, 1500);
    });

    actions.prepend(editBtn);
    actions.prepend(copyBtn);
  } catch (err) {
    if (!selPanelEl) return;
    tEl.classList.remove("eh-sel-loading");
    showTranslateError(tEl, text, err.message);
  }
}

function showTranslateError(tEl, text, detail) {
  tEl.classList.remove("eh-sel-loading");
  tEl.textContent = "翻译失败" + (detail ? `：${detail}` : "");
  tEl.style.color = "#e74c3c";
  const actions = selPanelEl.querySelector(".eh-sel-actions");
  if (actions && !actions.querySelector(".eh-sel-retry-btn")) {
    const retryBtn = document.createElement("button");
    retryBtn.className = "eh-sel-retry-btn";
    retryBtn.textContent = "↻ 重试";
    retryBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      runTranslation(text);
    });
    actions.prepend(retryBtn);
  }
}

const LANG_OPTIONS = [
  { code: "zh-CN", label: "中文（简体）" },
  { code: "zh-TW", label: "中文（繁體）" },
  { code: "ja",    label: "日本語" },
  { code: "ko",    label: "한국어" },
  { code: "en",    label: "English" },
  { code: "fr",    label: "Français" },
  { code: "de",    label: "Deutsch" },
  { code: "es",    label: "Español" },
  { code: "pt",    label: "Português" },
  { code: "ru",    label: "Русский" },
  { code: "ar",    label: "العربية" },
];

function openEditModal(sourceText, initTranslation) {
  document.getElementById("eh-edit-overlay")?.remove();

  const currentLang = settings.targetLang || "zh-CN";
  const langOpts = LANG_OPTIONS.map(l =>
    `<option value="${l.code}"${l.code === currentLang ? " selected" : ""}>${l.label}</option>`
  ).join("");

  const overlay = document.createElement("div");
  overlay.id = "eh-edit-overlay";
  overlay.innerHTML = `
    <div id="eh-edit-dialog">
      <div class="eh-ed-header">
        <span class="eh-ed-title">文A 翻译</span>
        <button class="eh-ed-close">✕</button>
      </div>
      <div class="eh-ed-lang-row">
        <span class="eh-ed-lang-label">目标语言：</span>
        <select class="eh-ed-lang-sel">${langOpts}</select>
      </div>
      <div class="eh-ed-body">
        <div class="eh-ed-source-wrap">
          <div class="eh-ed-col-label">原文</div>
          <textarea class="eh-ed-source" spellcheck="false">${escapeHtml(sourceText)}</textarea>
        </div>
        <div class="eh-ed-result-wrap">
          <div class="eh-ed-col-label">译文</div>
          <div class="eh-ed-result">${escapeHtml(initTranslation)}</div>
        </div>
      </div>
      <div class="eh-ed-footer">
        <button class="eh-ed-btn eh-ed-copy-btn">📋 复制</button>
        <button class="eh-ed-btn eh-ed-btn-primary eh-ed-replace-btn">替换</button>
      </div>
    </div>
  `;

  const dialog = overlay.querySelector("#eh-edit-dialog");
  const sourceTA = overlay.querySelector(".eh-ed-source");
  const resultDiv = overlay.querySelector(".eh-ed-result");
  const langSel = overlay.querySelector(".eh-ed-lang-sel");
  const copyBtn = overlay.querySelector(".eh-ed-copy-btn");
  const replaceBtn = overlay.querySelector(".eh-ed-replace-btn");

  let latestTranslation = initTranslation;
  let translateTimer = null;

  async function retranslate() {
    const txt = sourceTA.value.trim();
    if (!txt) { resultDiv.textContent = ""; return; }
    resultDiv.textContent = "翻译中…";
    resultDiv.className = "eh-ed-result eh-ed-loading";
    try {
      const tl = langSel.value;
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${tl}&dt=t&q=${encodeURIComponent(txt)}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      latestTranslation = data[0]?.filter(Boolean).map(i => i[0] || "").join("") || "";
      resultDiv.textContent = latestTranslation;
      resultDiv.className = "eh-ed-result";
    } catch (e) {
      resultDiv.textContent = "翻译失败：" + e.message;
      resultDiv.className = "eh-ed-result";
    }
  }

  sourceTA.addEventListener("input", () => {
    clearTimeout(translateTimer);
    translateTimer = setTimeout(retranslate, 600);
  });
  langSel.addEventListener("change", retranslate);

  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(latestTranslation).catch(() => {});
    copyBtn.textContent = "✓ 已复制";
    setTimeout(() => { copyBtn.textContent = "📋 复制"; }, 1500);
  });

  replaceBtn.addEventListener("click", () => {
    if (savedRange && latestTranslation) {
      try {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedRange);
        document.execCommand("insertText", false, latestTranslation);
      } catch (_) {
        navigator.clipboard.writeText(latestTranslation).catch(() => {});
        replaceBtn.textContent = "已复制";
        setTimeout(() => { replaceBtn.textContent = "替换"; }, 1500);
        return;
      }
    } else {
      navigator.clipboard.writeText(latestTranslation).catch(() => {});
    }
    overlay.remove();
  });

  overlay.querySelector(".eh-ed-close").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  dialog.addEventListener("click", (e) => e.stopPropagation());

  document.body.appendChild(overlay);
  sourceTA.focus();
  sourceTA.setSelectionRange(sourceTA.value.length, sourceTA.value.length);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ---------- 翻译触发（供高亮词点击使用，自动翻译） ----------
function triggerTranslate(word, rect) {
  currentWord = word;
  const tooltip = createTooltip(word, true);
  positionTooltip(tooltip, rect);
}

// ---------- 主逻辑：鼠标选中 ----------
document.addEventListener("mouseup", (e) => {
  if (tooltipEl?.contains(e.target)) return;
  if (selIconEl?.contains(e.target) || selPanelEl?.contains(e.target)) return;

  const selection = window.getSelection();
  const text = selection?.toString().trim();
  if (!text) { removeTooltip(); removeSelUI(); return; }

  const rect = getSelectionRect();
  if (!rect || rect.width === 0) return;

  // 多词/句子 → 显示翻译图标
  if (text.includes(" ")) {
    removeTooltip();
    currentSelText = text;
    showSelIcon(rect);
    return;
  }

  // 单词 → 原有气泡逻辑
  removeSelUI();
  if (!isEnglishText(text)) { removeTooltip(); return; }
  currentWord = text;
  currentContext = extractContextSentence();
  const tooltip = createTooltip(text, false);
  positionTooltip(tooltip, rect);
});

document.addEventListener("mousedown", (e) => {
  if (tooltipEl && !tooltipEl.contains(e.target)) removeTooltip();
  if (!selIconEl?.contains(e.target) && !selPanelEl?.contains(e.target)) removeSelUI();
});
