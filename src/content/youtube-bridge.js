// ============================================================
// 英语助手 - YouTube 桥接脚本（MAIN world，可访问页面 JS 变量）
// ============================================================

function getVideoId() {
  return new URLSearchParams(window.location.search).get("v");
}

// 从 ytcfg 读取 InnerTube API Key（YouTube 全局配置对象）
function getInnertubeKey() {
  try {
    return (
      (typeof ytcfg !== "undefined" && ytcfg.get?.("INNERTUBE_API_KEY")) ||
      window.yt?.config_?.INNERTUBE_API_KEY ||
      ""
    );
  } catch {
    return "";
  }
}

function sendTracks() {
  const response = window.ytInitialPlayerResponse;
  if (!response) return false;

  const tracks =
    response.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];

  const videoId = response.videoDetails?.videoId || getVideoId() || "";

  const payload = {
    videoId,
    innertubeKey: getInnertubeKey(),
    tracks: tracks.map((t) => ({
      url: t.baseUrl,
      lang: t.languageCode || "",
      name: t.name?.simpleText || "",
    })),
  };

  document.documentElement.dataset.ehYtData = JSON.stringify(payload);
  document.dispatchEvent(new CustomEvent("__eh_yt_data__", { detail: payload }));
  return tracks.length > 0;
}

function startPolling() {
  delete document.documentElement.dataset.ehYtData;

  let attempts = 0;
  function poll() {
    if (sendTracks()) return;
    if (++attempts < 20) setTimeout(poll, 500);
    else {
      // 超时：至少把 innertubeKey 传过去，让 youtube.js 可以走 InnerTube 方案
      document.dispatchEvent(new CustomEvent("__eh_yt_data__", {
        detail: { videoId: getVideoId() || "", innertubeKey: getInnertubeKey(), tracks: [] },
      }));
    }
  }
  poll();
}

startPolling();
document.addEventListener("yt-navigate-finish", startPolling);
