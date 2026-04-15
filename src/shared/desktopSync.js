// 与 Voca 桌面应用通信（http://127.0.0.1:27149）
const API = 'http://127.0.0.1:27149';

function _fetch(url, options = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2000);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

/** 将单个词推送到桌面端（仅新增，不覆盖已有） */
export async function pushWordToDesktop(word, translation, timestamp, reviewCount) {
  try {
    await _fetch(`${API}/words`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word, translation, timestamp: timestamp || Date.now(), reviewCount: reviewCount || 0 }),
    });
  } catch {}
}

/** 从桌面端删除一个词 */
export async function removeWordFromDesktop(key) {
  try {
    await _fetch(`${API}/words/${encodeURIComponent(key)}`, { method: 'DELETE' });
  } catch {}
}

/** 从桌面端拉取全部词，返回 object 或 null（桌面未运行时） */
export async function pullWordsFromDesktop() {
  try {
    const res = await _fetch(`${API}/words`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}
