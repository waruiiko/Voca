<template>
  <div class="fc-app" @mouseup="onSelMouseUp">

    <!-- 划词翻译浮层 -->
    <div class="fc-sel-panel" v-if="selPanel.visible"
      :style="{ left: selPanel.x + 'px', top: selPanel.y + 'px' }">
      <div class="fc-sel-original">{{ selPanel.text }}</div>
      <div class="fc-sel-result" :class="{ loading: selPanel.loading }">
        {{ selPanel.loading ? '翻译中…' : (selPanel.result || '') }}
      </div>
      <div class="fc-sel-actions">
        <button class="fc-sel-btn fc-sel-tts" @click.stop="speakSel" title="朗读原文">🔊</button>
        <button class="fc-sel-btn fc-sel-save" @click.stop="saveSelWord"
          v-if="selPanel.result && !selPanel.saved" title="收藏到单词本">⭐ 收藏</button>
        <span class="fc-sel-saved-tip" v-if="selPanel.saved">✓ 已收藏</span>
        <button class="fc-sel-btn" @click.stop="copySelResult" v-if="selPanel.result">📋 复制</button>
        <button class="fc-sel-btn fc-sel-close" @click.stop="selPanel.visible = false">✕</button>
      </div>
    </div>
    <!-- 标题栏 -->
    <header class="fc-header">
      <div class="fc-logo">📖 单词复习</div>
      <div class="fc-header-controls" v-if="sessionCards.length > 0">
        <select class="fc-sort-select" v-model="sortMode" @change="reSort" title="排序方式">
          <option value="random">随机</option>
          <option value="oldest">最久未复习</option>
          <option value="newest">最新加入</option>
          <option value="hardest">最难优先</option>
        </select>
        <button class="fc-tts-toggle" :class="{ on: autoTts }" @click="autoTts = !autoTts"
          :title="autoTts ? '关闭自动朗读' : '开启自动朗读'">🔊</button>
        <button class="fc-quiz-toggle" :class="{ on: quizMode }" @click="toggleQuizMode"
          :title="quizMode ? '切换到闪卡' : '切换到测验'">🧠</button>
      </div>
      <div class="fc-progress-text" v-if="sessionCards.length > 0 && !sessionDone">
        {{ sessionIndex + 1 }} / {{ sessionCards.length }}
      </div>
    </header>

    <!-- 进度条 -->
    <div class="fc-progress-bar" v-if="sessionCards.length > 0">
      <div class="fc-progress-fill" :style="{ width: progressPercent + '%' }"></div>
    </div>

    <!-- 空状态：没有单词 -->
    <div class="fc-empty" v-if="!loading && allWords.length === 0">
      <div class="fc-empty-icon">📭</div>
      <h2>单词本是空的</h2>
      <p>先去网页上收藏一些单词吧！</p>
    </div>

    <!-- 空状态：今天全部复习完 -->
    <div class="fc-empty" v-else-if="!loading && sessionCards.length === 0">
      <div class="fc-empty-icon">🎉</div>
      <h2>今日复习完成！</h2>
      <p>共 {{ allWords.length }} 个单词，<br />下次到期：{{ nextReviewTime }}</p>
      <button class="fc-btn-primary" @click="reviewAll">重新复习全部</button>
    </div>

    <!-- 复习完成 -->
    <div class="fc-complete" v-else-if="!loading && sessionDone">
      <div class="fc-complete-icon">✅</div>
      <h2>本轮复习完成！</h2>
      <div class="fc-stats">
        <div class="fc-stat">
          <div class="fc-stat-num green">{{ knownCount }}</div>
          <div class="fc-stat-label">认识</div>
        </div>
        <div class="fc-stat">
          <div class="fc-stat-num orange">{{ vagueCount }}</div>
          <div class="fc-stat-label">模糊</div>
        </div>
        <div class="fc-stat">
          <div class="fc-stat-num red">{{ unknownCount }}</div>
          <div class="fc-stat-label">不认识</div>
        </div>
      </div>
      <button class="fc-btn-primary" @click="reviewUnknown" v-if="unknownCount + vagueCount > 0">
        再练模糊/不认识的 ({{ unknownCount + vagueCount }})
      </button>
      <button class="fc-btn-secondary" @click="reviewAll">重新开始</button>
    </div>

    <!-- 测验模式 -->
    <div class="fc-quiz-wrap" v-else-if="!loading && currentCard && quizMode">
      <div class="fc-quiz-card">
        <div class="fc-quiz-word">{{ currentCard.word }}</div>
        <div class="fc-quiz-loading" v-if="quizLoading">AI 出题中…</div>
        <div class="fc-quiz-err" v-else-if="quizError">{{ quizError }}</div>
        <template v-else-if="quizData">
          <div class="fc-quiz-tabs">
            <button class="fc-quiz-tab" :class="{ active: quizType === 'fill' }" @click="quizType = 'fill'; resetQuiz()">填空题</button>
            <button class="fc-quiz-tab" :class="{ active: quizType === 'choice' }" @click="quizType = 'choice'; resetQuiz()">选义题</button>
          </div>
          <div v-if="quizType === 'fill'" class="fc-quiz-body">
            <div class="fc-quiz-q">{{ quizData.fillBlank.sentence }}</div>
            <input v-model="quizUserAnswer" class="fc-quiz-input"
              :disabled="quizSubmitted"
              placeholder="请填入缺失的单词…"
              @keyup.enter="submitFillBlank" />
            <div class="fc-quiz-result" v-if="quizSubmitted">
              <span v-if="quizCorrect" class="fc-quiz-correct">✓ 正确！</span>
              <span v-else class="fc-quiz-wrong">✗ 正确答案：{{ quizData.fillBlank.answer }}</span>
            </div>
          </div>
          <div v-if="quizType === 'choice'" class="fc-quiz-body">
            <div class="fc-quiz-q">{{ quizData.multiChoice.question }}</div>
            <div class="fc-quiz-options">
              <button v-for="(opt, i) in shuffledOptions" :key="i"
                class="fc-quiz-option"
                :class="{
                  correct: quizSubmitted && i === shuffledCorrectIdx,
                  wrong: quizSubmitted && quizSelectedIdx === i && i !== shuffledCorrectIdx,
                  selected: quizSelectedIdx === i && !quizSubmitted
                }"
                :disabled="quizSubmitted"
                @click="selectChoice(i)">
                {{ opt }}
              </button>
            </div>
          </div>
          <div class="fc-quiz-actions">
            <button v-if="!quizSubmitted && quizType === 'fill'" class="fc-quiz-submit" @click="submitFillBlank">提交</button>
            <button v-if="quizSubmitted" class="fc-quiz-next" @click="quizNext(quizCorrect ? 2 : 0)">下一词 →</button>
          </div>
        </template>
      </div>
      <div class="fc-flip-hint">⌨️ 1=不认识  2=模糊  3=认识</div>
    </div>

    <!-- 闪卡主体：双栏布局 -->
    <div class="fc-main" v-else-if="!loading && currentCard">
      <div class="fc-layout">

        <!-- 左栏：卡片 + 按钮 -->
        <div class="fc-left-col">
          <div class="fc-card-scene" @click="flipCard">
            <div class="fc-card-inner" :class="{ flipped: isFlipped }">

              <!-- 正面 -->
              <div class="fc-card-face fc-card-front">
                <div class="fc-mem-badge" :class="memBadgeClass">{{ memLabel }}</div>
                <div class="fc-word">{{ currentCard.word }}</div>
                <div class="fc-phonetic" v-if="currentDetails?.phonetic">{{ currentDetails.phonetic }}</div>
                <div class="fc-phonetic fc-phonetic-loading" v-else-if="detailsLoading">…</div>
                <button class="fc-tts-btn" @click.stop="speakWord(currentCard.word)" title="朗读">🔊</button>
                <div class="fc-hint">点击翻转查看释义</div>
              </div>

              <!-- 背面：精简，细节移到右栏 -->
              <div class="fc-card-face fc-card-back">
                <div class="fc-word fc-word-back">{{ currentCard.word }}</div>
                <div class="fc-phonetic" v-if="currentDetails?.phonetic">{{ currentDetails.phonetic }}</div>
                <div class="fc-divider"></div>
                <div class="fc-translation">{{ currentCard.translation || "（无释义）" }}</div>
                <div class="fc-user-context" v-if="currentCard.context">
                  <span class="fc-example-label">原文</span>{{ currentCard.context }}
                </div>
                <div class="fc-review-info">
                  <span v-if="currentCard.reviewCount > 0">已复习 {{ currentCard.reviewCount }} 次</span>
                  <span v-if="currentCard.reviewCount > 0 && currentCard.lastReview"> · 上次 {{ formatLastReview(currentCard.lastReview) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="fc-buttons" v-if="isFlipped">
            <button class="fc-btn-unknown" @click="answer(0)">
              <span class="fc-btn-icon">✗</span>
              <span class="fc-btn-label">不认识</span>
              <span class="fc-btn-next">明天</span>
            </button>
            <button class="fc-btn-vague" @click="answer(1)">
              <span class="fc-btn-icon">≈</span>
              <span class="fc-btn-label">模糊</span>
              <span class="fc-btn-next">{{ formatInterval(nextIntervalVague) }}</span>
            </button>
            <button class="fc-btn-known" @click="answer(2)">
              <span class="fc-btn-icon">✓</span>
              <span class="fc-btn-label">认识</span>
              <span class="fc-btn-next">{{ formatInterval(nextIntervalKnown) }}</span>
            </button>
          </div>
          <div class="fc-flip-hint" v-else>← 点击卡片翻转 / 按空格键 →</div>
          <div class="fc-key-hint" v-if="isFlipped">⌨️ 1=不认识  2=模糊  3=认识</div>
        </div>

        <!-- 右栏：词义详情面板 -->
        <div class="fc-right-col" v-if="currentDetails || detailsLoading">
          <div class="fc-panel-loading" v-if="detailsLoading">加载词典数据…</div>
          <template v-else-if="currentDetails">

            <!-- 词义 -->
            <div class="fc-panel-section" v-for="(m, mi) in currentDetails.meanings" :key="mi">
              <div class="fc-panel-section-header">
                <span class="fc-panel-pos">{{ m.pos }}</span>
              </div>
              <ol class="fc-panel-defs">
                <li v-for="(def, di) in m.defs" :key="di" class="fc-panel-def">{{ def }}</li>
              </ol>
              <!-- 同义词 -->
              <div class="fc-panel-tags-row" v-if="m.syns.length">
                <span class="fc-panel-tag-label">同义词</span>
                <span v-for="s in m.syns" :key="s" class="fc-panel-tag syn">{{ s }}</span>
              </div>
              <!-- 反义词 -->
              <div class="fc-panel-tags-row" v-if="m.ants.length">
                <span class="fc-panel-tag-label">反义词</span>
                <span v-for="a in m.ants" :key="a" class="fc-panel-tag ant">{{ a }}</span>
              </div>
            </div>

            <!-- 例句 -->
            <div class="fc-panel-section" v-if="currentDetails.examples.length">
              <div class="fc-panel-section-header">
                <span class="fc-panel-pos">例句</span>
              </div>
              <div v-for="(ex, i) in currentDetails.examples" :key="i" class="fc-panel-example">
                <span class="fc-example-label">例{{ currentDetails.examples.length > 1 ? i + 1 : '' }}</span>{{ ex }}
              </div>
            </div>

            <!-- 复习记录 -->
            <div class="fc-panel-section fc-panel-stats">
              <div class="fc-panel-section-header">
                <span class="fc-panel-pos">学习记录</span>
              </div>
              <div class="fc-stat-grid">
                <div class="fc-stat-cell">
                  <div class="fc-stat-cell-val">{{ currentCard.reviewCount || 0 }}</div>
                  <div class="fc-stat-cell-label">复习次数</div>
                </div>
                <div class="fc-stat-cell">
                  <div class="fc-stat-cell-val">{{ currentCard.interval || 1 }}天</div>
                  <div class="fc-stat-cell-label">当前间隔</div>
                </div>
                <div class="fc-stat-cell">
                  <div class="fc-stat-cell-val">{{ ((currentCard.easeFactor || 2.5) * 100).toFixed(0) }}%</div>
                  <div class="fc-stat-cell-label">掌握系数</div>
                </div>
                <div class="fc-stat-cell">
                  <div class="fc-stat-cell-val">{{ currentCard.lastReview ? formatLastReview(currentCard.lastReview) : '未复习' }}</div>
                  <div class="fc-stat-cell-label">上次复习</div>
                </div>
              </div>
            </div>

          </template>
        </div>

      </div>
    </div>

    <!-- 加载中 -->
    <div class="fc-empty" v-if="loading">
      <p>加载中…</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";

const loading = ref(true);
const detailsLoading = ref(false);
const allWords = ref([]);
const sessionCards = ref([]);
const sessionIndex = ref(0);
const isFlipped = ref(false);
const sessionDone = ref(false);
const knownCount = ref(0);
const vagueCount = ref(0);
const unknownCount = ref(0);

// ── 排序模式 ─────────────────────────────────────────────────────
const sortMode = ref("random");

function applySort(cards) {
  if (sortMode.value === "random") {
    return cards.sort(() => Math.random() - 0.5);
  } else if (sortMode.value === "oldest") {
    return cards.sort((a, b) => (a.lastReview || 0) - (b.lastReview || 0));
  } else if (sortMode.value === "newest") {
    return cards.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  } else if (sortMode.value === "hardest") {
    return cards.sort((a, b) => (a.easeFactor || 2.5) - (b.easeFactor || 2.5));
  }
  return cards;
}

function reSort() {
  sessionCards.value = applySort([...sessionCards.value]);
  sessionIndex.value = 0;
  isFlipped.value = false;
}

// ── 自动朗读 ─────────────────────────────────────────────────────
const autoTts = ref(false);

// ── 测验模式 ─────────────────────────────────────────────────────
const quizMode = ref(false);
const quizLoading = ref(false);
const quizError = ref("");
const quizData = ref(null);
const quizType = ref("fill");
const quizUserAnswer = ref("");
const quizSubmitted = ref(false);
const quizCorrect = ref(false);
const quizSelectedIdx = ref(-1);

const shuffledOptionsData = ref({ options: [], correctIdx: 0 });
const shuffledOptions = computed(() => shuffledOptionsData.value.options);
const shuffledCorrectIdx = computed(() => shuffledOptionsData.value.correctIdx);

function buildShuffledOptions() {
  if (!quizData.value?.multiChoice) return;
  const { options, correct } = quizData.value.multiChoice;
  const paired = options.map((opt, i) => ({ opt, isCorrect: i === correct }));
  for (let i = paired.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [paired[i], paired[j]] = [paired[j], paired[i]];
  }
  shuffledOptionsData.value = {
    options: paired.map(p => p.opt),
    correctIdx: paired.findIndex(p => p.isCorrect),
  };
}

function toggleQuizMode() {
  quizMode.value = !quizMode.value;
  if (quizMode.value && currentCard.value) loadQuiz(currentCard.value);
}

async function loadQuiz(card) {
  quizLoading.value = true;
  quizError.value = "";
  quizData.value = null;
  quizUserAnswer.value = "";
  quizSubmitted.value = false;
  quizCorrect.value = false;
  quizSelectedIdx.value = -1;
  try {
    const resp = await chrome.runtime.sendMessage({
      type: "CLAUDE_QUIZ",
      word: card.word,
      translation: card.translation || "",
      context: card.context || "",
    });
    if (resp.success) {
      quizData.value = resp.data;
      buildShuffledOptions();
    } else {
      quizError.value = resp.error || "出题失败";
    }
  } catch (e) {
    quizError.value = e.message || "出题失败";
  } finally {
    quizLoading.value = false;
  }
}

function resetQuiz() {
  quizUserAnswer.value = "";
  quizSubmitted.value = false;
  quizCorrect.value = false;
  quizSelectedIdx.value = -1;
  if (quizType.value === 'choice') buildShuffledOptions();
}

function submitFillBlank() {
  if (!quizData.value || quizSubmitted.value) return;
  const answer = quizData.value.fillBlank.answer.toLowerCase().trim();
  const input = quizUserAnswer.value.toLowerCase().trim();
  quizCorrect.value = input === answer;
  quizSubmitted.value = true;
}

function selectChoice(i) {
  if (quizSubmitted.value) return;
  quizSelectedIdx.value = i;
  quizCorrect.value = i === shuffledCorrectIdx.value;
  quizSubmitted.value = true;
}

function quizNext(quality) {
  const card = currentCard.value;
  if (!card) return;
  if (quality === 2) { knownCount.value++; card._vague = false; card._unknown = false; }
  else if (quality === 1) { vagueCount.value++; card._vague = true; }
  else { unknownCount.value++; card._unknown = true; }
  sm2Update(card, quality);
  saveCard(card);
  if (sessionIndex.value < sessionCards.value.length - 1) {
    sessionIndex.value++;
    isFlipped.value = false;
    if (quizMode.value && currentCard.value) loadQuiz(currentCard.value);
  } else {
    sessionDone.value = true;
  }
}

const detailsCache = {};
const currentDetails = ref(null);

const currentCard = computed(() => sessionCards.value[sessionIndex.value] || null);
const progressPercent = computed(() =>
  sessionCards.value.length ? (sessionIndex.value / sessionCards.value.length) * 100 : 0
);

// 记忆等级
const memLabel = computed(() => {
  const rc = currentCard.value?.reviewCount || 0;
  const interval = currentCard.value?.interval || 1;
  if (rc === 0) return "🌱 新词";
  if (interval < 7) return "🌿 初记";
  if (interval < 21) return "🌳 熟悉";
  return "💎 掌握";
});
const memBadgeClass = computed(() => {
  const rc = currentCard.value?.reviewCount || 0;
  const interval = currentCard.value?.interval || 1;
  if (rc === 0) return "mem-new";
  if (interval < 7) return "mem-learning";
  if (interval < 21) return "mem-familiar";
  return "mem-mastered";
});

const nextIntervalVague = computed(() => calcNextInterval(currentCard.value, 1));
const nextIntervalKnown = computed(() => calcNextInterval(currentCard.value, 2));

function calcNextInterval(card, quality) {
  if (!card) return 1;
  let { interval = 1, easeFactor = 2.5, reviewCount = 0 } = card;
  if (quality === 0) return 1;
  if (quality === 1) return Math.max(2, Math.round(interval * 1.2));
  const ebbing = [1, 2, 4, 7, 15, 30];
  if (reviewCount < ebbing.length - 1) return ebbing[reviewCount + 1] || Math.round(interval * easeFactor);
  return Math.round(interval * easeFactor);
}

function formatInterval(days) {
  if (days <= 1) return "明天";
  if (days < 30) return `${days}天后`;
  return `${Math.round(days / 30)}个月后`;
}

const nextReviewTime = computed(() => {
  if (allWords.value.length === 0) return "";
  const times = allWords.value.map(w => w.nextReview).filter(Boolean).sort();
  if (!times.length) return "明天";
  const next = new Date(times[0]);
  const diffH = Math.round((next - Date.now()) / 3600000);
  if (diffH < 1) return "不久后";
  if (diffH < 24) return `${diffH} 小时后`;
  return `${Math.ceil(diffH / 24)} 天后`;
});

// 加载单词详情（音标 + 词义 + 例句 + 同义/反义词）
async function fetchDetails(word) {
  if (!word) return;
  const w = word.toLowerCase();
  if (detailsCache[w] !== undefined) {
    currentDetails.value = detailsCache[w];
    return;
  }
  detailsLoading.value = true;
  currentDetails.value = null;
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`);
    if (!res.ok) { detailsCache[w] = null; currentDetails.value = null; return; }
    const data = await res.json();
    const entry = data[0];
    const phonetic = entry?.phonetics?.find(p => p.text)?.text || entry?.phonetic || null;

    const examples = [];
    const meanings = [];
    for (const meaning of (entry?.meanings || [])) {
      const pos = meaning.partOfSpeech;
      const defs = (meaning.definitions || []).slice(0, 3).map(d => d.definition).filter(Boolean);
      const syns = [...new Set([
        ...(meaning.synonyms || []),
        ...(meaning.definitions || []).flatMap(d => d.synonyms || []),
      ])].slice(0, 6);
      const ants = [...new Set([
        ...(meaning.antonyms || []),
        ...(meaning.definitions || []).flatMap(d => d.antonyms || []),
      ])].slice(0, 4);
      for (const def of (meaning.definitions || [])) {
        if (def.example) examples.push(def.example);
      }
      if (defs.length) meanings.push({ pos, defs, syns, ants });
    }

    detailsCache[w] = { phonetic, examples: examples.slice(0, 3), meanings };
    currentDetails.value = detailsCache[w];
  } catch {
    detailsCache[w] = null;
    currentDetails.value = null;
  } finally {
    detailsLoading.value = false;
  }
}

watch(currentCard, (card) => {
  if (card) {
    fetchDetails(card.word);
    if (autoTts.value) speakWord(card.word);
  }
}, { immediate: true });

// 艾宾浩斯风格 SM-2
function sm2Update(card, quality) {
  if (!card.easeFactor) card.easeFactor = 2.5;
  if (!card.reviewCount) card.reviewCount = 0;
  card.reviewCount++;
  const ebbing = [1, 2, 4, 7, 15, 30];
  if (quality === 0) {
    card.interval = 1;
    card.easeFactor = Math.max(1.3, card.easeFactor - 0.2);
  } else if (quality === 1) {
    card.interval = Math.max(2, Math.round((card.interval || 1) * 1.2));
    card.easeFactor = Math.max(1.3, card.easeFactor - 0.1);
  } else {
    const rc = card.reviewCount - 1;
    if (rc < ebbing.length - 1) {
      card.interval = ebbing[rc + 1];
    } else {
      card.interval = Math.round((card.interval || 1) * card.easeFactor);
    }
    card.easeFactor = Math.max(1.3, card.easeFactor + 0.05);
  }
  card.nextReview = Date.now() + card.interval * 86400000;
  card.lastReview = Date.now();
  return card;
}

function formatLastReview(ts) {
  if (!ts) return "";
  const diff = Date.now() - ts;
  if (diff < 3600000) return "刚才";
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  return `${Math.floor(diff / 86400000)}天前`;
}

function loadWords() {
  chrome.storage.local.get("savedWords", (result) => {
    const saved = result.savedWords || {};
    allWords.value = Object.entries(saved).map(([key, val]) => ({ key, ...val }));
    initSession();
    loading.value = false;
  });
}

function initSession() {
  const now = Date.now();
  const due = allWords.value.filter(w => !w.nextReview || w.nextReview <= now);
  sessionCards.value = applySort([...due]);
  sessionIndex.value = 0;
  isFlipped.value = false;
  sessionDone.value = false;
  knownCount.value = 0;
  vagueCount.value = 0;
  unknownCount.value = 0;
}

function reviewAll() {
  sessionCards.value = applySort([...allWords.value]);
  sessionIndex.value = 0;
  isFlipped.value = false;
  sessionDone.value = false;
  knownCount.value = 0;
  vagueCount.value = 0;
  unknownCount.value = 0;
}

function reviewUnknown() {
  const bad = sessionCards.value.filter(c => c._unknown || c._vague);
  sessionCards.value = applySort([...bad]);
  sessionIndex.value = 0;
  isFlipped.value = false;
  sessionDone.value = false;
  knownCount.value = 0;
  vagueCount.value = 0;
  unknownCount.value = 0;
}

function flipCard() {
  if (!sessionDone.value) isFlipped.value = !isFlipped.value;
}

function answer(quality) {
  const card = currentCard.value;
  if (!card) return;
  if (quality === 2) { knownCount.value++; card._vague = false; card._unknown = false; }
  else if (quality === 1) { vagueCount.value++; card._vague = true; }
  else { unknownCount.value++; card._unknown = true; }
  sm2Update(card, quality);
  saveCard(card);
  if (sessionIndex.value < sessionCards.value.length - 1) {
    sessionIndex.value++;
    isFlipped.value = false;
  } else {
    sessionDone.value = true;
  }
}

function saveCard(card) {
  chrome.storage.local.get("savedWords", (result) => {
    const saved = result.savedWords || {};
    if (saved[card.key]) {
      saved[card.key] = {
        ...saved[card.key],
        interval: card.interval,
        easeFactor: card.easeFactor,
        reviewCount: card.reviewCount,
        nextReview: card.nextReview,
        lastReview: card.lastReview,
        dueCount: card.dueCount,
      };
      chrome.storage.local.set({ savedWords: saved });
    }
  });
}

function speakWord(word) {
  if (!window.speechSynthesis) return;
  speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(word);
  utt.lang = "en-US";
  speechSynthesis.speak(utt);
}

function onKeyDown(e) {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  if (sessionDone.value || !currentCard.value) return;
  if (e.code === "Space") {
    e.preventDefault();
    flipCard();
  } else if (e.code === "Digit1" && isFlipped.value) {
    answer(0);
  } else if (e.code === "Digit2" && isFlipped.value) {
    answer(1);
  } else if (e.code === "Digit3" && isFlipped.value) {
    answer(2);
  }
}

// ── 划词翻译 ─────────────────────────────────────────────────────
const selPanel = ref({ visible: false, text: "", result: "", loading: false, saved: false, x: 0, y: 0 });

async function onSelMouseUp(e) {
  // 点击浮层内部时不触发
  if (e.target.closest(".fc-sel-panel")) return;

  await new Promise(r => setTimeout(r, 10)); // 等选区稳定
  const sel = window.getSelection();
  const text = sel?.toString().trim();
  if (!text || text.length < 2) {
    selPanel.value.visible = false;
    return;
  }

  const range = sel.getRangeAt(0).getBoundingClientRect();
  const x = Math.min(range.left + window.scrollX, window.innerWidth - 300);
  const y = range.bottom + window.scrollY + 8;

  selPanel.value = { visible: true, text, result: "", loading: true, saved: false, x, y };

  try {
    const tl = "zh-CN";
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const translated = data[0]?.filter(Boolean).map(i => i[0] || "").join("") || "";
    selPanel.value.result = translated;
  } catch (err) {
    selPanel.value.result = "翻译失败：" + err.message;
  } finally {
    selPanel.value.loading = false;
  }
}

function copySelResult() {
  navigator.clipboard.writeText(selPanel.value.result).catch(() => {});
}

function speakSel() {
  if (!window.speechSynthesis || !selPanel.value.text) return;
  speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(selPanel.value.text);
  utt.lang = "en-US";
  speechSynthesis.speak(utt);
}

function saveSelWord() {
  const word = selPanel.value.text.trim().toLowerCase();
  const translation = selPanel.value.result;
  if (!word || !translation) return;
  chrome.storage.local.get("savedWords", (result) => {
    const saved = result.savedWords || {};
    if (!saved[word]) {
      saved[word] = { word, translation, timestamp: Date.now(), reviewCount: 0 };
      chrome.storage.local.set({ savedWords: saved });
      // 同步更新 allWords
      allWords.value.push({ key: word, ...saved[word] });
    }
    selPanel.value.saved = true;
  });
}

onMounted(() => {
  loadWords();
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("mousedown", (e) => {
    if (!e.target.closest(".fc-sel-panel")) selPanel.value.visible = false;
  });
});
onUnmounted(() => {
  document.removeEventListener("keydown", onKeyDown);
});
</script>

<style>
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #1a1a1a;
}

.fc-app {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 0 40px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* 标题栏 */
.fc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 28px 12px;
  color: white;
  gap: 10px;
}
.fc-logo { font-size: 18px; font-weight: 700; flex-shrink: 0; }
.fc-progress-text { font-size: 14px; opacity: 0.85; flex-shrink: 0; }

.fc-header-controls { display: flex; align-items: center; gap: 6px; flex: 1; justify-content: center; }

.fc-sort-select {
  background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25);
  color: white; border-radius: 8px; padding: 4px 8px; font-size: 12px;
  cursor: pointer; outline: none;
}
.fc-sort-select option { background: #333; color: white; }

.fc-tts-toggle, .fc-quiz-toggle {
  background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.2);
  border-radius: 8px; padding: 4px 8px; font-size: 14px; cursor: pointer;
  transition: background 0.15s; color: rgba(255,255,255,0.7);
}
.fc-tts-toggle:hover, .fc-quiz-toggle:hover { background: rgba(255,255,255,0.22); }
.fc-tts-toggle.on, .fc-quiz-toggle.on {
  background: rgba(232,130,12,0.5); border-color: rgba(232,130,12,0.7); color: white;
}

/* 进度条 */
.fc-progress-bar {
  height: 4px; background: rgba(255,255,255,0.25);
  margin: 0 28px; border-radius: 2px; overflow: hidden;
}
.fc-progress-fill {
  height: 100%; background: #fff; border-radius: 2px; transition: width 0.3s ease;
}

/* 双栏主体 */
.fc-main {
  flex: 1;
  padding: 28px 28px 0;
}
.fc-layout {
  display: flex;
  gap: 28px;
  align-items: flex-start;
}

/* 左栏 */
.fc-left-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  flex-shrink: 0;
  width: 420px;
}

/* 右栏 */
.fc-right-col {
  flex: 1;
  min-width: 0;
  background: rgba(15, 12, 30, 0.55);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 20px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 0;
  max-height: calc(100vh - 140px);
  overflow-y: auto;
}
.fc-right-col::-webkit-scrollbar { width: 4px; }
.fc-right-col::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }

.fc-panel-loading { color: rgba(255,255,255,0.45); font-size: 13px; text-align: center; padding: 20px 0; }

.fc-panel-section {
  padding: 14px 0;
  border-bottom: 1px solid rgba(255,255,255,0.07);
}
.fc-panel-section:last-child { border-bottom: none; }

.fc-panel-section-header { margin-bottom: 8px; }
.fc-panel-pos {
  display: inline-block;
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 1px; color: rgba(255,255,255,0.38);
  border-bottom: 1.5px solid rgba(255,255,255,0.15);
  padding-bottom: 2px;
}

.fc-panel-defs {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 0;
}
.fc-panel-def {
  font-size: 13.5px;
  color: rgba(255,255,255,0.88);
  line-height: 1.65;
  padding-left: 14px;
  position: relative;
}
.fc-panel-def::before {
  content: "•";
  position: absolute;
  left: 2px;
  color: rgba(255,255,255,0.28);
}

.fc-panel-tags-row {
  display: flex; flex-wrap: wrap; align-items: center;
  gap: 5px; margin-top: 9px;
}
.fc-panel-tag-label {
  font-size: 10px; font-weight: 700;
  color: rgba(255,255,255,0.35); text-transform: uppercase;
  letter-spacing: 0.5px; margin-right: 2px;
}
.fc-panel-tag {
  font-size: 12px; padding: 2px 9px; border-radius: 20px;
  cursor: default;
}
.fc-panel-tag.syn {
  background: rgba(74,144,217,0.18); color: #a8d0f5;
  border: 1px solid rgba(74,144,217,0.28);
}
.fc-panel-tag.ant {
  background: rgba(231,76,60,0.15); color: #f5a8a0;
  border: 1px solid rgba(231,76,60,0.22);
}

.fc-panel-example {
  font-size: 13px; color: rgba(255,255,255,0.78);
  line-height: 1.7; font-style: italic;
  padding: 7px 11px; border-left: 2px solid rgba(232,130,12,0.6);
  margin-bottom: 6px; background: rgba(255,255,255,0.04); border-radius: 0 7px 7px 0;
}
.fc-panel-example:last-child { margin-bottom: 0; }

.fc-stat-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.fc-stat-cell {
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px; padding: 10px 12px; text-align: center;
}
.fc-stat-cell-val { font-size: 18px; font-weight: 700; color: rgba(255,255,255,0.92); }
.fc-stat-cell-label { font-size: 11px; color: rgba(255,255,255,0.38); margin-top: 2px; }

/* 卡片 */
.fc-card-scene {
  width: 100%;
  height: 300px;
  perspective: 1200px;
  cursor: pointer;
}
.fc-card-inner {
  position: relative;
  width: 100%; height: 100%;
  transform-style: preserve-3d;
  transition: transform 0.45s cubic-bezier(0.4, 0, 0.2, 1);
}
.fc-card-inner.flipped { transform: rotateY(180deg); }

.fc-card-face {
  position: absolute; inset: 0;
  backface-visibility: hidden;
  background: #ffffff; border-radius: 20px;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 28px 32px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
  gap: 6px;
  overflow: hidden;
}
.fc-card-back {
  transform: rotateY(180deg);
  justify-content: center;
}

/* 记忆等级徽章 */
.fc-mem-badge {
  font-size: 12px; font-weight: 600;
  padding: 3px 10px; border-radius: 20px;
  margin-bottom: 8px; align-self: center;
}
.mem-new      { background: #e8f5e9; color: #388e3c; }
.mem-learning { background: #f1f8e9; color: #558b2f; }
.mem-familiar { background: #e3f2fd; color: #1565c0; }
.mem-mastered { background: #fce4ec; color: #c62828; }

.fc-word {
  font-size: 38px; font-weight: 800;
  color: #1a1a1a; text-align: center; word-break: break-word;
}
.fc-word-back { font-size: 26px; margin-bottom: 2px; }

.fc-phonetic {
  font-size: 15px; color: #888;
  font-family: Georgia, "Times New Roman", serif; letter-spacing: 0.5px;
}
.fc-phonetic-loading { opacity: 0.4; }

.fc-hint { font-size: 13px; color: #bbb; margin-top: 6px; }
.fc-tts-btn {
  background: none; border: none; font-size: 18px; cursor: pointer;
  opacity: 0.5; transition: opacity 0.15s; padding: 2px 6px; border-radius: 6px;
}
.fc-tts-btn:hover { opacity: 1; background: rgba(0,0,0,0.06); }

.fc-divider {
  width: 40px; height: 2px; background: #e0e0e0;
  margin: 8px 0; border-radius: 1px; align-self: center;
}
.fc-translation {
  font-size: 26px; font-weight: 600;
  color: #4a90d9; text-align: center;
}

.fc-user-context {
  font-size: 12px; color: #555; text-align: left; line-height: 1.6;
  margin-top: 6px; padding: 6px 10px; background: #f0f4ff; border-radius: 8px;
  border-left: 3px solid #4a90d9; align-self: stretch;
  max-height: 60px; overflow: hidden;
}
.fc-example-label {
  display: inline-block; font-size: 10px; font-weight: 700;
  color: #e8820c; background: rgba(232,130,12,0.12);
  padding: 1px 5px; border-radius: 4px; margin-right: 6px;
  vertical-align: middle; font-style: normal;
}
.fc-review-info {
  font-size: 11px; color: #bbb; margin-top: 4px; text-align: center;
}

/* 操作按钮 */
.fc-buttons {
  display: flex; gap: 10px; width: 100%;
}
.fc-btn-unknown, .fc-btn-vague, .fc-btn-known {
  flex: 1; padding: 12px 8px; border: none; border-radius: 14px;
  font-weight: 700; cursor: pointer;
  transition: transform 0.15s, opacity 0.15s;
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
}
.fc-btn-unknown:active, .fc-btn-vague:active, .fc-btn-known:active { transform: scale(0.97); }
.fc-btn-unknown { background: #fff; color: #e74c3c; }
.fc-btn-vague   { background: #fff; color: #e8820c; }
.fc-btn-known   { background: #fff; color: #27ae60; }

.fc-btn-icon  { font-size: 18px; line-height: 1; }
.fc-btn-label { font-size: 14px; font-weight: 700; }
.fc-btn-next  { font-size: 11px; opacity: 0.65; font-weight: 400; }

.fc-flip-hint { color: rgba(255,255,255,0.6); font-size: 13px; }
.fc-key-hint  { color: rgba(255,255,255,0.45); font-size: 11px; margin-top: -12px; }

/* 测验模式 */
.fc-quiz-wrap {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  padding: 16px 24px 32px; gap: 16px;
}
.fc-quiz-card {
  width: 100%; max-width: 480px; background: #ffffff; border-radius: 20px;
  padding: 24px 28px; box-shadow: 0 8px 32px rgba(0,0,0,0.18);
  display: flex; flex-direction: column; gap: 14px;
}
.fc-quiz-word { font-size: 28px; font-weight: 800; color: #1a1a1a; text-align: center; }
.fc-quiz-loading { text-align: center; color: #999; font-size: 14px; padding: 20px 0; }
.fc-quiz-err { text-align: center; color: #e74c3c; font-size: 13px; }
.fc-quiz-tabs { display: flex; gap: 6px; }
.fc-quiz-tab {
  flex: 1; padding: 6px; border: 1.5px solid #e0e0e0; border-radius: 8px;
  background: transparent; color: #888; font-size: 13px; cursor: pointer; transition: all 0.15s;
}
.fc-quiz-tab.active { border-color: #4a90d9; background: #e8f2fb; color: #4a90d9; font-weight: 600; }
.fc-quiz-body { display: flex; flex-direction: column; gap: 10px; }
.fc-quiz-q { font-size: 15px; color: #333; line-height: 1.7; font-weight: 500; }
.fc-quiz-input {
  padding: 10px 14px; border: 1.5px solid #e0e0e0; border-radius: 10px;
  font-size: 14px; outline: none; transition: border-color 0.15s;
}
.fc-quiz-input:focus { border-color: #4a90d9; }
.fc-quiz-input:disabled { background: #f5f5f5; }
.fc-quiz-result { font-size: 14px; font-weight: 600; text-align: center; padding: 4px 0; }
.fc-quiz-correct { color: #27ae60; }
.fc-quiz-wrong   { color: #e74c3c; }
.fc-quiz-options { display: flex; flex-direction: column; gap: 8px; }
.fc-quiz-option {
  padding: 10px 14px; border: 1.5px solid #e0e0e0; border-radius: 10px;
  background: #fff; text-align: left; font-size: 13px; cursor: pointer;
  transition: all 0.15s; color: #333;
}
.fc-quiz-option:hover:not(:disabled) { border-color: #4a90d9; background: #f0f6ff; }
.fc-quiz-option.selected { border-color: #4a90d9; background: #e8f2fb; }
.fc-quiz-option.correct  { border-color: #27ae60; background: #e8f5e9; color: #27ae60; font-weight: 600; }
.fc-quiz-option.wrong    { border-color: #e74c3c; background: #fef5f5; color: #e74c3c; }
.fc-quiz-option:disabled { cursor: default; }
.fc-quiz-actions { display: flex; justify-content: center; gap: 10px; margin-top: 4px; }
.fc-quiz-submit {
  padding: 10px 28px; background: #4a90d9; color: white; border: none;
  border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.15s;
}
.fc-quiz-submit:hover { background: #357abd; }
.fc-quiz-next {
  padding: 10px 28px; background: #e8820c; color: white; border: none;
  border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.15s;
}
.fc-quiz-next:hover { background: #c96e08; }

/* 完成 / 空状态 */
.fc-empty, .fc-complete {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 40px 24px; text-align: center; color: white; gap: 12px;
}
.fc-empty-icon, .fc-complete-icon { font-size: 60px; }
.fc-empty h2, .fc-complete h2 { font-size: 24px; font-weight: 700; }
.fc-empty p,  .fc-complete p  { font-size: 15px; opacity: 0.8; line-height: 1.7; }

.fc-stats {
  display: flex; gap: 20px; background: rgba(255,255,255,0.15);
  border-radius: 16px; padding: 18px 28px; margin: 8px 0;
}
.fc-stat { text-align: center; }
.fc-stat-num { font-size: 30px; font-weight: 800; }
.fc-stat-num.green  { color: #7fff9a; }
.fc-stat-num.orange { color: #ffc97a; }
.fc-stat-num.red    { color: #ff9a9a; }
.fc-stat-label { font-size: 12px; opacity: 0.75; margin-top: 2px; }

.fc-btn-primary {
  padding: 14px 32px; background: white; color: #764ba2; border: none;
  border-radius: 12px; font-size: 16px; font-weight: 700;
  cursor: pointer; transition: opacity 0.15s; margin-top: 8px;
}
.fc-btn-primary:hover { opacity: 0.9; }
.fc-btn-secondary {
  padding: 12px 24px; background: rgba(255,255,255,0.2); color: white;
  border: 2px solid rgba(255,255,255,0.5); border-radius: 12px;
  font-size: 15px; font-weight: 600; cursor: pointer; transition: background 0.15s;
}
.fc-btn-secondary:hover { background: rgba(255,255,255,0.3); }

@keyframes eh-pop-in {
  from { opacity: 0; transform: translateY(6px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

/* 划词翻译浮层 */
.fc-sel-panel {
  position: absolute;
  z-index: 9999;
  background: rgba(15, 12, 30, 0.92);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 12px;
  padding: 10px 13px 8px;
  min-width: 180px;
  max-width: 300px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.4);
  animation: eh-pop-in 0.15s ease;
  pointer-events: all;
}
.fc-sel-original {
  font-size: 11px; color: rgba(255,255,255,0.4);
  margin-bottom: 5px; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
}
.fc-sel-result {
  font-size: 14px; color: rgba(255,255,255,0.92);
  line-height: 1.55; margin-bottom: 7px;
}
.fc-sel-result.loading { color: rgba(255,255,255,0.4); font-style: italic; }
.fc-sel-actions {
  display: flex; justify-content: flex-end; gap: 5px;
}
.fc-sel-btn {
  background: rgba(255,255,255,0.08); border: none;
  color: rgba(255,255,255,0.6); font-size: 11px;
  padding: 3px 8px; border-radius: 6px; cursor: pointer;
  font-family: inherit; transition: background 0.15s;
}
.fc-sel-btn:hover { background: rgba(255,255,255,0.16); color: #fff; }
.fc-sel-close { color: rgba(255,255,255,0.35); }
.fc-sel-tts { font-size: 13px; }
.fc-sel-save { color: #ffd066; }
.fc-sel-save:hover { background: rgba(255,208,102,0.15); color: #ffd066; }
.fc-sel-saved-tip { font-size: 11px; color: #7fff9a; align-self: center; }
</style>
