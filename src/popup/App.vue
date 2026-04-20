<template>
  <div class="container" :class="{ 'is-dark': settings.darkMode }">

    <!-- 标题栏 -->
    <header class="header" :class="{ 'header-dark': settings.darkMode }">
      <!-- 词汇详情页标题 -->
      <template v-if="wordDetailWord">
        <button class="s-back-btn detail-back-btn" @click="closeWordDetail">‹</button>
        <span class="detail-header-word">{{ wordDetailWord.word }}</span>
        <span style="width:32px"></span>
      </template>
      <!-- 设置子页面：显示返回按钮 -->
      <template v-else-if="tab === 'settings' && settingsPage !== 'main'">
        <button class="s-back-btn" @click="settingsPage = settingsPage === 'wordbook-detail' ? 'wordbooks' : 'main'">‹</button>
        <span class="s-page-title">{{ subPageTitle }}</span>
        <span style="width:32px"></span>
      </template>
      <!-- 正常标题 -->
      <template v-else>
        <div class="logo">
          <span class="logo-icon">📖</span>
          <span class="logo-text">英语助手</span>
        </div>
        <div class="tabs">
          <button class="tab" :class="{ active: tab === 'words' }" @click="tab = 'words'">单词本</button>
          <button class="tab" :class="{ active: tab === 'stats' }" @click="tab = 'stats'">📊</button>
          <button class="tab" :class="{ active: tab === 'settings' }" @click="tab = 'settings'">设置</button>
        </div>
        <button class="dark-toggle-btn" @click="toggleDarkMode" :title="settings.darkMode ? '切换到浅色模式' : '切换到深色模式'">{{ settings.darkMode ? '☀️' : '🌙' }}</button>
      </template>
    </header>

    <!-- ===== 词汇详情页 ===== -->
    <template v-if="wordDetailWord">
      <div class="detail-body">
        <div class="detail-top">
          <div class="detail-word-title">
            {{ wordDetailWord.word }}
            <button class="detail-tts-btn" @click="speakWord(wordDetailWord.word)" title="朗读">🔊</button>
          </div>
          <button class="detail-master-btn" :class="{ mastered: wordDetailWord.mastered }"
            @click="toggleMastered(wordDetailWord.key)" :title="wordDetailWord.mastered ? '标记为未掌握' : '标记为已掌握'">
            {{ wordDetailWord.mastered ? '✓ 已掌握' : '○ 未掌握' }}
          </button>
        </div>
        <!-- 原文例句 -->
        <div class="detail-user-context" v-if="wordDetailWord.context">
          <span class="detail-context-label">原文</span>{{ wordDetailWord.context }}
        </div>

        <div v-if="detailLoading" class="detail-loading">加载中…</div>
        <template v-else-if="detailData">
          <div class="detail-phonetic" v-if="detailData.phonetic">{{ detailData.phonetic }}</div>
          <div class="detail-translation">{{ wordDetailWord.translation || '（无翻译）' }}</div>
          <div v-for="(group, idx) in detailData.meanings" :key="idx" class="detail-meaning">
            <div class="detail-pos">{{ group.partOfSpeech }}</div>
            <div v-for="(def, di) in group.definitions.slice(0, 3)" :key="di" class="detail-def">
              <div class="detail-def-text">{{ def.definition }}</div>
              <div class="detail-example" v-if="def.example">"{{ def.example }}"</div>
            </div>
          </div>
          <div class="detail-synonyms" v-if="detailData.synonyms && detailData.synonyms.length">
            <span class="detail-syn-label">近义词：</span>
            <span v-for="s in detailData.synonyms.slice(0,6)" :key="s" class="detail-syn-tag">{{ s }}</span>
          </div>
        </template>
        <div v-else class="detail-no-data">
          <div class="detail-translation">{{ wordDetailWord.translation || '（无翻译）' }}</div>
          <div style="color:#bbb;font-size:12px;margin-top:8px">暂无英文释义</div>
        </div>

        <div class="detail-meta">
          收藏于 {{ formatDate(wordDetailWord.timestamp) }}
          <span v-if="wordDetailWord.reviewCount > 0"> · 已复习 {{ wordDetailWord.reviewCount }} 次</span>
        </div>
      </div>
    </template>

    <!-- ===== 单词本 ===== -->
    <template v-else-if="tab === 'words'">
      <div class="action-bar">
        <button class="action-btn review-btn" @click="openReview">
          <span>🃏</span> 开始复习
          <span class="due-badge" v-if="dueCount > 0">{{ dueCount }}</span>
        </button>
        <div class="export-wrap">
          <button class="action-btn export-btn" @click="toggleExport">
            <span>📤</span> 导出
          </button>
          <div class="export-dropdown" v-if="showExport">
            <button @click="exportCSV">📊 导出为 CSV</button>
            <button @click="exportAnki">🗂️ 导出到 Anki</button>
          </div>
        </div>
      </div>

      <!-- 词类切换 -->
      <div class="word-type-bar">
        <button class="wt-btn" :class="{ active: wordType === 'mine' }" @click="wordType = 'mine'">
          我的收藏 <span class="wt-count">{{ wordList.length }}</span>
        </button>
        <button class="wt-btn" :class="{ active: wordType === 'pool' }" @click="wordType = 'pool'">
          词书词汇 <span class="wt-count">{{ wordBookWordCount }}</span>
        </button>
      </div>

      <!-- 我的收藏 -->
      <template v-if="wordType === 'mine'">
        <!-- 生词本切换栏（下拉模式） -->
        <div class="pbook-bar">
          <div class="pbook-selector-wrap">
            <button class="pbook-trigger" @click.stop="showPBookDropdown = !showPBookDropdown">
              <span class="pbook-trigger-icon">📓</span>
              <span class="pbook-trigger-name">{{ currentPersonalBook.name }}</span>
              <span class="pbook-trigger-count">{{ bookWordCount(settings.activePersonalBookId || 'default') }}</span>
              <span class="pbook-trigger-arrow">{{ showPBookDropdown ? '▲' : '▼' }}</span>
            </button>
            <div class="pbook-dropdown" v-if="showPBookDropdown">
              <div v-for="book in personalBooks" :key="book.id"
                class="pbook-drop-item"
                :class="{ active: (settings.activePersonalBookId || 'default') === book.id }"
                @click.stop="setActiveBook(book.id); showPBookDropdown = false">
                <span class="pbook-drop-radio">{{ (settings.activePersonalBookId || 'default') === book.id ? '●' : '○' }}</span>
                <span class="pbook-drop-name">{{ book.name }}</span>
                <span class="pbook-drop-count">{{ bookWordCount(book.id) }} 词</span>
                <button v-if="book.id !== 'default'" class="pbook-drop-del"
                  @click.stop="deletePersonalBook(book.id)" title="删除">✕</button>
              </div>
            </div>
          </div>
          <button class="pbook-new-btn" @click.stop="showNewPBookForm = !showNewPBookForm; showPBookDropdown = false" title="新建生词本">＋</button>
        </div>
        <div class="new-pbook-form" v-if="showNewPBookForm">
          <input v-model="newPBookName" class="search-input" placeholder="新建生词本名称…"
            @keyup.enter="createPersonalBook" style="margin:0" />
          <button class="nb-confirm-btn" @click="createPersonalBook">创建</button>
          <button class="nb-cancel-btn" @click="showNewPBookForm=false;newPBookName=''">取消</button>
        </div>

        <!-- 掌握状态分栏 -->
        <div class="mastered-tabs" v-if="wordList.length > 0">
          <button class="mt-btn" :class="{ active: masteredTab === 'unmastered' }"
            @click="masteredTab = 'unmastered'">
            未掌握 <span class="wt-count">{{ unmasteredCount }}</span>
          </button>
          <button class="mt-btn" :class="{ active: masteredTab === 'mastered' }"
            @click="masteredTab = 'mastered'">
            已掌握 <span class="wt-count">{{ masteredCount }}</span>
          </button>
        </div>

        <div class="search-wrap" v-if="wordList.length > 0">
          <input v-model="searchQuery" class="search-input" placeholder="搜索单词…" type="text" />
        </div>
        <main class="word-list" v-if="displayedWords.length > 0">
          <div v-for="item in displayedWords" :key="item.key" class="word-card">
            <div class="word-info" @click="openWordDetail(item)" style="cursor:pointer;flex:1;min-width:0">
              <div class="word-row">
                <span class="word-original">{{ item.word }}</span>
                <span class="review-tag" v-if="item.reviewCount > 0">复习 {{ item.reviewCount }}次</span>
                <span class="expiry-badge" v-if="isDueSoon(item)">⏰ 明日到期</span>
                <span class="mastered-badge" v-if="item.mastered">✓</span>
              </div>
              <div class="word-translation">{{ item.translation || "（无翻译）" }}</div>
              <div class="word-context-snippet" v-if="item.context">{{ item.context }}</div>
              <div class="word-date">{{ formatDate(item.timestamp) }}</div>
            </div>
            <div class="word-actions">
              <button class="master-btn" :class="{ mastered: item.mastered }"
                @click="toggleMastered(item.key)"
                :title="item.mastered ? '取消掌握' : '标记为已掌握'">
                {{ item.mastered ? '✓' : '○' }}
              </button>
              <button class="delete-btn" @click="deleteWord(item.key)" title="删除">✕</button>
            </div>
          </div>
        </main>
        <div class="empty" v-else-if="wordList.length > 0 && (searchQuery || masteredTab)">
          <p>没有找到匹配的单词</p>
        </div>
        <div class="empty" v-else>
          <div class="empty-icon">🔍</div>
          <p class="empty-title">单词本是空的</p>
          <p class="empty-desc">在网页上选中英文单词，<br />点击 ☆ 即可收藏</p>
        </div>
        <footer class="footer" v-if="wordList.length > 0">
          <button class="clear-btn" @click="confirmClear">清空全部</button>
        </footer>
      </template>

      <!-- 词书词汇 -->
      <template v-if="wordType === 'pool'">

        <!-- 分批添加栏 -->
        <div class="add-words-bar" v-if="activeWordBooksCount > 0">
          <div class="add-words-stats">
            <span class="add-words-total">共 {{ wordBookWordCount }} 词</span>
            <span class="add-words-unsaved">{{ unsavedPoolWords.length }} 词待学习</span>
          </div>
          <button class="add-words-btn" @click="showAddWordsPanel = !showAddWordsPanel"
            :disabled="unsavedPoolWords.length === 0">
            {{ unsavedPoolWords.length === 0 ? '已全部学习 ✓' : '+ 添加新词' }}
          </button>
        </div>

        <!-- 添加面板 -->
        <div class="add-words-panel" v-if="showAddWordsPanel && unsavedPoolWords.length > 0">
          <div class="add-panel-label">每次添加数量：</div>
          <div class="add-count-row">
            <button v-for="n in addCountOptions" :key="n"
              class="add-count-btn" :class="{ active: addWordsCount === n }"
              @click="addWordsCount = n">{{ n }}</button>
          </div>
          <div class="add-panel-hint">
            将随机取 {{ Math.min(addWordsCount, unsavedPoolWords.length) }} 词，加入「{{ currentPersonalBook.name }}」
          </div>
          <div class="add-panel-actions">
            <button class="add-confirm-btn" @click="addWordsFromPool">
              确认添加 {{ Math.min(addWordsCount, unsavedPoolWords.length) }} 词
            </button>
            <button class="add-cancel-btn" @click="showAddWordsPanel = false">取消</button>
          </div>
        </div>

        <div class="search-wrap">
          <input v-model="wbPoolSearch" class="search-input" placeholder="搜索词书单词…" type="text" />
        </div>
        <div class="pool-info" v-if="activeWordBooksCount === 0">
          <div class="empty-icon">📚</div>
          <p class="empty-title">未开启任何词书</p>
          <p class="empty-desc">前往 设置 → 词书管理 开启词书</p>
        </div>
        <main class="word-list" v-else-if="filteredPoolWords.length > 0">
          <div v-for="word in filteredPoolWords" :key="word.w" class="word-card word-card-pool">
            <div class="word-info">
              <div class="word-row">
                <span class="word-original">{{ word.w }}</span>
                <span class="pool-tag" :style="{ background: word.color + '22', color: word.color }">{{ word.level }}</span>
                <span class="review-tag" style="background:#fff3e0;color:#e8820c" v-if="savedWordsSet.has(word.w)">已收藏</span>
              </div>
            </div>
            <button class="delete-btn" @click="dismissWord(word.w)" title="从词池移除（已会了）">✕</button>
          </div>
        </main>
        <div class="empty" v-else>
          <p>没有找到 "{{ wbPoolSearch }}"</p>
        </div>
      </template>
    </template>

    <!-- ===== 统计 ===== -->
    <template v-else-if="tab === 'stats'">
      <div class="stats-body">

        <!-- 总览数字 -->
        <div class="stats-overview">
          <div class="stats-ov-card">
            <div class="stats-ov-num">{{ statsTotal }}</div>
            <div class="stats-ov-label">总词汇</div>
          </div>
          <div class="stats-ov-card">
            <div class="stats-ov-num">{{ statsMastered }}</div>
            <div class="stats-ov-label">已掌握</div>
          </div>
          <div class="stats-ov-card">
            <div class="stats-ov-num">{{ statsMasteredPct }}%</div>
            <div class="stats-ov-label">掌握率</div>
          </div>
          <div class="stats-ov-card stats-ov-streak">
            <div class="stats-ov-num">{{ statsStreak }}</div>
            <div class="stats-ov-label">🔥 连续天</div>
          </div>
        </div>

        <!-- 进度条 -->
        <div class="stats-progress-wrap">
          <div class="stats-progress-label">
            <span>学习进度</span>
            <span>{{ statsMastered }} / {{ statsTotal }}</span>
          </div>
          <div class="stats-progress-bar">
            <div class="stats-progress-fill" :style="{ width: statsMasteredPct + '%' }"></div>
          </div>
        </div>

        <!-- 近7天图表 -->
        <div class="stats-chart-section">
          <div class="stats-chart-title">近 7 天</div>
          <div class="stats-legend">
            <span class="stats-legend-dot" style="background:#4a90d9"></span>新增
            <span class="stats-legend-dot" style="background:#e8820c;margin-left:12px"></span>复习
          </div>
          <div class="stats-chart">
            <div v-for="day in statsSevenDays" :key="day.label" class="stats-bar-col">
              <div class="stats-bars-wrap">
                <div class="stats-bar-new"
                  :style="{ height: statsBarH(day.added) + 'px' }"
                  :title="`新增 ${day.added}`"></div>
                <div class="stats-bar-review"
                  :style="{ height: statsBarH(day.reviewed) + 'px' }"
                  :title="`复习 ${day.reviewed}`"></div>
              </div>
              <div class="stats-bar-num" v-if="day.added || day.reviewed">
                {{ day.added || day.reviewed }}
              </div>
              <div class="stats-bar-label">{{ day.label }}</div>
            </div>
          </div>
        </div>

        <!-- 各生词本词汇量 -->
        <div class="stats-books-section" v-if="personalBooks.length > 0">
          <div class="stats-chart-title">各生词本</div>
          <div v-for="book in personalBooks" :key="book.id" class="stats-book-row">
            <span class="stats-book-name">{{ book.name }}</span>
            <div class="stats-book-bar-wrap">
              <div class="stats-book-bar"
                :style="{ width: statsTotal ? (bookWordCount(book.id) / statsTotal * 100) + '%' : '0%' }"></div>
            </div>
            <span class="stats-book-count">{{ bookWordCount(book.id) }}</span>
          </div>
        </div>

      </div>
    </template>

    <!-- ===== 设置 ===== -->
    <template v-if="tab === 'settings' && !wordDetailWord">
      <div class="s-body">

        <!-- 主页 -->
        <template v-if="settingsPage === 'main'">

          <div class="s-section">
            <div class="s-section-title">基础设置</div>
            <div class="s-row" @click="settingsPage = 'wordbooks'">
              <span class="s-icon">📚</span>
              <span class="s-label">词书管理</span>
              <span class="s-meta">{{ activeWordBooksCount }} 本开启</span>
              <span class="s-arrow">›</span>
            </div>
            <div class="s-row" @click="openReview">
              <span class="s-icon">🃏</span>
              <span class="s-label">开始复习</span>
              <span class="s-meta" v-if="dueCount > 0" style="color:#e8820c">{{ dueCount }} 个待复习</span>
              <span class="s-arrow">›</span>
            </div>
          </div>

          <div class="s-section">
            <div class="s-section-title">语言设置</div>
            <div class="s-row" @click="settingsPage = 'language'">
              <span class="s-icon">🌐</span>
              <span class="s-label">翻译结果</span>
              <span class="s-meta">{{ currentLanguageName }}</span>
              <span class="s-arrow">›</span>
            </div>
            <div class="s-row" @click="settingsPage = 'api'">
              <span class="s-icon">🔀</span>
              <span class="s-label">翻译 API</span>
              <span class="s-meta">{{ apiDisplayName }}</span>
              <span class="s-arrow">›</span>
            </div>
          </div>

          <div class="s-section">
            <div class="s-section-title">浏览设置</div>
            <div class="s-row" @click="settingsPage = 'highlight'">
              <span class="s-icon">✨</span>
              <span class="s-label">高亮与注解</span>
              <span class="s-arrow">›</span>
            </div>
            <div class="s-row" @click="settingsPage = 'subtitle'">
              <span class="s-icon">🎬</span>
              <span class="s-label">视频字幕</span>
              <span class="s-arrow">›</span>
            </div>
          </div>

          <!-- 复习提醒 -->
          <div class="s-section">
            <div class="s-section-title">复习提醒</div>
            <div class="s-row s-row-toggle" @click="toggleSetting('notificationsEnabled')">
              <span class="s-icon">🔔</span>
              <div class="s-label-group">
                <span class="s-label">每日到期提醒</span>
                <span class="s-desc">有单词到期时在 8:00–21:00 间推送一次通知</span>
              </div>
              <div class="s-toggle" :class="{ on: settings.notificationsEnabled }">
                <div class="s-toggle-thumb"></div>
              </div>
            </div>
          </div>

          <!-- 数据管理 -->
          <div class="s-section">
            <div class="s-section-title">数据管理</div>
            <div class="s-row s-row-toggle" @click="toggleSetting('cloudSync')">
              <span class="s-icon">☁️</span>
              <div class="s-label-group">
                <span class="s-label">云同步设置</span>
                <span class="s-desc">通过浏览器账号同步设置（不含单词数据）</span>
              </div>
              <div class="s-toggle" :class="{ on: settings.cloudSync }">
                <div class="s-toggle-thumb"></div>
              </div>
            </div>
            <div class="s-row" @click="syncToDesktop">
              <span class="s-icon">🖥️</span>
              <div class="s-label-group">
                <span class="s-label">同步到桌面端</span>
                <span class="s-desc" :style="syncStatus.error ? 'color:#e05' : syncStatus.ok ? 'color:#2a9' : ''">{{ syncStatus.msg }}</span>
              </div>
              <span v-if="syncStatus.loading" class="s-meta">同步中…</span>
              <span v-else class="s-arrow">›</span>
            </div>
            <div class="s-row" @click="exportAllData">
              <span class="s-icon">💾</span>
              <div class="s-label-group">
                <span class="s-label">导出全部备份</span>
                <span class="s-desc">将所有单词和设置保存为 JSON 文件</span>
              </div>
              <span class="s-arrow">›</span>
            </div>
            <div class="s-row" @click="importDataRef.click()">
              <span class="s-icon">📂</span>
              <div class="s-label-group">
                <span class="s-label">恢复备份</span>
                <span class="s-desc">从 JSON 文件恢复（将覆盖当前数据）</span>
              </div>
              <span class="s-arrow">›</span>
            </div>
            <input ref="importDataRef" type="file" accept=".json"
              style="display:none" @change="importAllData" />
          </div>

          <div class="s-section">
            <div class="s-section-title">更多</div>
            <div class="s-row" @click="exportCSVFromSettings">
              <span class="s-icon">📊</span>
              <span class="s-label">导出为 CSV</span>
              <span class="s-arrow">›</span>
            </div>
            <div class="s-row" @click="exportAnkiFromSettings">
              <span class="s-icon">🗂️</span>
              <span class="s-label">导出到 Anki</span>
              <span class="s-arrow">›</span>
            </div>
            <div class="s-row s-row-static">
              <span class="s-icon">ℹ️</span>
              <span class="s-label">版本</span>
              <span class="s-meta">v1.0.4</span>
            </div>
          </div>

        </template>

        <!-- 翻译语言子页面 -->
        <template v-if="settingsPage === 'language'">
          <div class="s-section">
            <div class="s-section-title">选择目标语言</div>
            <div v-for="lang in LANGUAGES" :key="lang.code"
              class="s-row s-row-radio"
              @click="settings.targetLang = lang.code; saveSettings()">
              <span class="s-icon">{{ lang.code === 'zh-CN' ? '🇨🇳' : lang.code === 'zh-TW' ? '🇹🇼' : '🇯🇵' }}</span>
              <span class="s-label">{{ lang.name }}</span>
              <span class="s-radio">{{ (settings.targetLang || 'zh-CN') === lang.code ? '●' : '○' }}</span>
            </div>
          </div>
        </template>

        <!-- 翻译 API 子页面 -->
        <template v-if="settingsPage === 'api'">
          <div class="s-toast" v-if="saveStatus">{{ saveStatus }}</div>
          <div class="s-section">
            <div class="s-section-title">选择翻译服务</div>
            <div v-for="opt in apiOptions" :key="opt.value"
              class="s-row s-row-radio"
              :class="{ 's-row-selected': settings.translationApi === opt.value }"
              @click="selectApi(opt.value)">
              <span class="s-radio" :class="{ active: settings.translationApi === opt.value }"></span>
              <div class="s-label-group">
                <span class="s-label">{{ opt.name }} <span class="s-badge" :class="opt.badgeClass" v-if="opt.badge">{{ opt.badge }}</span></span>
                <span class="s-desc">{{ opt.desc }}</span>
              </div>
            </div>
          </div>

          <!-- DeepL Key -->
          <div class="s-section" v-if="settings.translationApi === 'deepl'">
            <div class="s-section-title">DeepL API Key</div>
            <div class="s-key-wrap">
              <div class="s-key-row">
                <input v-model="settings.deeplApiKey" class="s-key-input"
                  :type="showKey ? 'text' : 'password'"
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx"
                  @blur="saveSettings" />
                <button class="s-eye-btn" @click="showKey = !showKey">{{ showKey ? '🙈' : '👁️' }}</button>
              </div>
              <div class="s-key-hint">前往 <span class="s-link" @click="openDeepL">deepl.com/pro-api</span> 免费注册获取</div>
            </div>
          </div>

          <!-- Langbly Key -->
          <div class="s-section" v-if="settings.translationApi === 'langbly'">
            <div class="s-section-title">Langbly API Key</div>
            <div class="s-key-wrap">
              <div class="s-key-row">
                <input v-model="settings.langblyApiKey" class="s-key-input"
                  :type="showKey ? 'text' : 'password'"
                  placeholder="your-langbly-api-key"
                  @blur="saveSettings" />
                <button class="s-eye-btn" @click="showKey = !showKey">{{ showKey ? '🙈' : '👁️' }}</button>
              </div>
              <div class="s-key-hint">前往 <span class="s-link" @click="openLangbly">langbly.com/signup</span> 免费注册获取</div>
            </div>
          </div>

          <!-- Claude API Key（AI 出题功能） -->
          <div class="s-section">
            <div class="s-section-title">AI 出题 (Claude API)</div>
            <div class="s-key-wrap">
              <div class="s-key-row">
                <input v-model="settings.claudeApiKey" class="s-key-input"
                  :type="showClaudeKey ? 'text' : 'password'"
                  placeholder="sk-ant-api03-…"
                  @blur="saveSettings" />
                <button class="s-eye-btn" @click="showClaudeKey = !showClaudeKey">{{ showClaudeKey ? '🙈' : '👁️' }}</button>
              </div>
              <div class="s-key-hint">前往 <span class="s-link" @click="openAnthropic">console.anthropic.com</span> 获取 API Key，用于闪卡测验模式出题</div>
            </div>
          </div>

          <!-- LibreTranslate URL -->
          <div class="s-section" v-if="settings.translationApi === 'libre'">
            <div class="s-section-title">服务地址</div>
            <div class="s-key-wrap">
              <div class="s-key-row">
                <input v-model="settings.libreUrl" class="s-key-input" type="text"
                  placeholder="http://localhost:5000" @blur="saveSettings"
                  style="font-family:monospace" />
              </div>
              <div class="s-key-hint">Docker 启动命令：</div>
              <div class="s-code">docker run -p 5000:5000 libretranslate/libretranslate --load-only en,zh</div>
            </div>
          </div>
        </template>

        <!-- 高亮设置子页面 -->
        <template v-if="settingsPage === 'highlight'">
          <div class="s-section">
            <div class="s-section-title">高亮设置</div>
            <div class="s-row s-row-toggle" @click="toggleSetting('highlightSaved')">
              <span class="s-icon">⭐</span>
              <div class="s-label-group">
                <span class="s-label">高亮已收藏单词</span>
                <span class="s-desc">在网页上用橙色下划线标注已保存的单词</span>
              </div>
              <div class="s-toggle" :class="{ on: settings.highlightSaved }">
                <div class="s-toggle-thumb"></div>
              </div>
            </div>
            <div class="s-row s-row-toggle" @click="toggleSetting('highlightDifficult')">
              <span class="s-icon">🔥</span>
              <div class="s-label-group">
                <span class="s-label">高亮难词</span>
                <span class="s-desc">对不常见单词添加橙色背景高亮</span>
              </div>
              <div class="s-toggle" :class="{ on: settings.highlightDifficult }">
                <div class="s-toggle-thumb"></div>
              </div>
            </div>
          </div>
        </template>

        <!-- 词书管理子页面 -->
        <template v-if="settingsPage === 'wordbooks'">

          <div class="s-section">
            <div class="s-section-title">我的生词本</div>
            <div v-for="book in personalBooks" :key="book.id"
              class="s-row s-row-static">
              <span class="s-icon">{{ book.id === 'default' ? '📋' : '📓' }}</span>
              <span class="s-label">{{ book.name }}</span>
              <span class="s-badge" style="background:#e8820c22;color:#e8820c;font-size:10px;padding:1px 6px;border-radius:8px;flex-shrink:0"
                v-if="(settings.activePersonalBookId || 'default') === book.id">当前</span>
              <span class="s-meta">{{ bookWordCount(book.id) }} 词</span>
              <button v-if="book.id !== 'default'" class="s-icon-btn s-delete-book"
                @click.stop="deletePersonalBook(book.id)" title="删除此生词本">✕</button>
            </div>
          </div>

          <div class="s-section">
            <div class="s-section-title">CEFR 等级词书</div>
            <div v-for="book in cefrBooks" :key="book.id"
              class="s-row"
              @click="openWordBook(book.id)">
              <div class="s-wb-badge" :style="{ background: book.color }">{{ book.level }}</div>
              <div class="s-label-group">
                <span class="s-label">{{ book.name }}</span>
                <span class="s-desc">{{ book.count }} 个词 · {{ book.desc }}</span>
              </div>
              <button class="s-toggle-btn" :class="{ on: isWordBookEnabled(book.id) }"
                @click.stop.prevent="toggleWordBook(book.id)">
                <div class="s-toggle-thumb"></div>
              </button>
            </div>
          </div>

          <div class="s-section">
            <div class="s-section-title">考试词书</div>
            <div v-for="book in examBooks" :key="book.id"
              class="s-row"
              @click="openWordBook(book.id)">
              <div class="s-wb-badge" :style="{ background: book.color }">{{ book.level }}</div>
              <div class="s-label-group">
                <span class="s-label">{{ book.name }}</span>
                <span class="s-desc">{{ book.count }} 个词 · {{ book.desc }}</span>
              </div>
              <button class="s-toggle-btn" :class="{ on: isWordBookEnabled(book.id) }"
                @click.stop.prevent="toggleWordBook(book.id)">
                <div class="s-toggle-thumb"></div>
              </button>
            </div>
          </div>

          <!-- 自定义词书 -->
          <div class="s-section" v-if="customWordBooks.length > 0">
            <div class="s-section-title">我的词书</div>
            <div v-for="book in customWordBooks" :key="book.id"
              class="s-row"
              @click="openCustomWordBook(book.id)">
              <div class="s-wb-badge" style="background:#607d8b">自</div>
              <div class="s-label-group">
                <span class="s-label">{{ book.name }}</span>
                <span class="s-desc">{{ book.words.length }} 个词</span>
              </div>
              <button class="s-icon-btn s-delete-book" title="删除"
                @click.stop.prevent="deleteCustomBook(book.id)">✕</button>
              <button class="s-toggle-btn" :class="{ on: isWordBookEnabled(book.id) }"
                @click.stop.prevent="toggleWordBook(book.id)">
                <div class="s-toggle-thumb"></div>
              </button>
            </div>
          </div>

          <!-- 导入词书 -->
          <div class="s-section">
            <div class="s-section-title">导入词书</div>
            <div class="s-row" @click="triggerImport">
              <span class="s-icon">📥</span>
              <div class="s-label-group">
                <span class="s-label">从文件导入</span>
                <span class="s-desc">支持 .txt（每行一词）或 .csv（第一列）</span>
              </div>
              <span class="s-arrow">›</span>
            </div>
            <input ref="importFileRef" type="file" accept=".txt,.csv" style="display:none" @change="handleImportFile" />
            <div class="s-row" @click="showPasteImport = !showPasteImport">
              <span class="s-icon">📝</span>
              <div class="s-label-group">
                <span class="s-label">粘贴词表导入</span>
                <span class="s-desc">直接粘贴文字，每行一词或逗号分隔</span>
              </div>
              <span class="s-arrow">{{ showPasteImport ? '▼' : '›' }}</span>
            </div>
            <div v-if="showPasteImport" class="paste-import-panel">
              <input v-model="pasteImportName" class="search-input"
                placeholder="词书名称（可选）" style="margin-bottom:8px" />
              <textarea v-model="pasteImportText" class="paste-import-area"
                placeholder="每行一个单词，或逗号分隔&#10;例：abandon, ability, aboard, abstract…"></textarea>
              <div class="paste-import-info">
                识别到 <b>{{ parsedPasteWords.length }}</b> 个英文单词
              </div>
              <div class="paste-import-actions">
                <button class="nb-confirm-btn" @click="doImportPaste"
                  :disabled="parsedPasteWords.length === 0">
                  导入 {{ parsedPasteWords.length }} 词
                </button>
                <button class="nb-cancel-btn" @click="showPasteImport=false;pasteImportText='';pasteImportName=''">取消</button>
              </div>
            </div>
          </div>

        </template>

        <!-- 词书详情子页面（内置） -->
        <template v-if="settingsPage === 'wordbook-detail'">
          <div class="s-section">
            <div class="s-section-title">
              {{ currentBookMeta?.name }} —
              共 {{ currentWordList.length }} 个词
            </div>
            <!-- 开关 + 搜索 -->
            <div class="s-row s-row-static" style="padding: 8px 14px; gap:8px;">
              <span class="s-label" style="font-size:12px;">加入学习词池</span>
              <div class="s-toggle" style="margin-left:auto"
                :class="{ on: isWordBookEnabled(currentWordBookId) }"
                @click="toggleWordBook(currentWordBookId)">
                <div class="s-toggle-thumb"></div>
              </div>
            </div>
            <div style="padding: 6px 14px 10px;">
              <input v-model="wbSearchQuery" class="s-key-input" type="text"
                placeholder="搜索单词…" style="width:100%; font-family:inherit;" />
            </div>
          </div>
          <div class="s-section">
            <div class="wb-word-list">
              <div v-for="word in currentWordList" :key="word" class="wb-word-row">
                <span class="wb-word">{{ word }}</span>
                <span class="wb-saved" v-if="savedWordsSet.has(word)">✓</span>
              </div>
              <div v-if="currentWordList.length === 0" class="wb-empty">没有找到匹配的词</div>
            </div>
          </div>
        </template>

        <!-- 视频字幕子页面 -->
        <template v-if="settingsPage === 'subtitle'">
          <div class="s-section">
            <div class="s-section-title">字幕显示</div>
            <div class="s-row s-row-toggle" @click="toggleSetting('subtitleAutoShow')">
              <span class="s-icon">▶️</span>
              <div class="s-label-group">
                <span class="s-label">自动展开字幕面板</span>
                <span class="s-desc">打开 YouTube 视频时自动显示双语字幕</span>
              </div>
              <div class="s-toggle" :class="{ on: settings.subtitleAutoShow }">
                <div class="s-toggle-thumb"></div>
              </div>
            </div>
          </div>
          <div class="s-section">
            <div class="s-section-title">字幕语言优先级</div>
            <div class="s-row s-row-static">
              <span class="s-icon">🇺🇸</span>
              <span class="s-label">英语（en）</span>
              <span class="s-meta" style="color:#e8820c">优先</span>
            </div>
            <div class="s-row s-row-static">
              <span class="s-icon">🤖</span>
              <span class="s-label">自动生成字幕</span>
              <span class="s-meta">次选</span>
            </div>
          </div>
        </template>

      </div>
    </template>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, toRaw } from "vue";
import { TIER1, TIER2, TIER3 } from "../shared/wordFrequency.js";
import { WORD_BOOKS } from "../shared/wordBooks.js";
import { pullWordsFromDesktop, removeWordFromDesktop } from "../shared/desktopSync.js";

const tab = ref("words");
const settingsPage = ref("main");
const syncStatus = ref({ loading: false, ok: false, error: false, msg: '将插件生词本推送到桌面应用' });
const currentWordBookId = ref("");
const wbSearchQuery = ref("");
const wordList = ref([]);
const searchQuery = ref("");
const showExport = ref(false);
const showKey = ref(false);
const showClaudeKey = ref(false);
const importFileRef = ref(null);
const wordType = ref("mine");
const wbPoolSearch = ref("");
const saveStatus = ref("");

// ── 新功能状态 ──────────────────────────────────────────────────────
const masteredTab = ref("unmastered"); // 'unmastered' | 'mastered'
const wordDetailWord = ref(null);      // null 或 word item 对象
const detailData = ref(null);          // 从字典 API 获取的数据
const detailLoading = ref(false);
// 个人生词本新建 & 下拉
const showNewPBookForm = ref(false)
// 分批添加新词
const showAddWordsPanel = ref(false)
const addWordsCount = ref(20)
const addCountOptions = [10, 20, 30, 50, 100];
const newPBookName = ref("");
const showPBookDropdown = ref(false);

// 粘贴导入
const showPasteImport = ref(false);
const pasteImportText = ref("");
const pasteImportName = ref("");

// 数据备份恢复
const importDataRef = ref(null);

// 支持的目标语言列表（新增语言在此追加即可）
const LANGUAGES = [
  { code: 'zh-CN', name: '中文（简体）' },
  { code: 'zh-TW', name: '中文（繁体）' },
  { code: 'ja',    name: '日语' },
];

const settings = ref({
  highlightSaved: true,
  highlightDifficult: false,
  subtitleAutoShow: false,
  enabledWordBooks: [],
  translationApi: "google",
  targetLang: "zh-CN",
  deeplApiKey: "",
  langblyApiKey: "",
  libreUrl: "http://localhost:5000",
  claudeApiKey: "",
  customWordBooks: [],
  dismissedPoolWords: [],
  // 个人生词本列表（0号为默认）
  personalBooks: [{ id: "default", name: "我的生词本" }],
  activePersonalBookId: "default",
  darkMode: false,
  notificationsEnabled: true,
  cloudSync: false,
});

const apiOptions = [
  { value: "google",   name: "Google Translate", badge: "默认",     badgeClass: "badge-default", desc: "免费 · 无需配置 · 即开即用" },
  { value: "deepl",    name: "DeepL Free",        badge: "质量最佳", badgeClass: "badge-best",    desc: "免费 500k 字/月 · 需要 API Key" },
  { value: "langbly",  name: "Langbly",           badge: "500k/月", badgeClass: "badge-free",    desc: "免费 · 无需信用卡 · 需要 API Key" },
  { value: "libre",    name: "LibreTranslate",    badge: "离线",     badgeClass: "badge-offline", desc: "完全离线 · 无限制 · 需本地运行服务" },
  { value: "mymemory", name: "MyMemory",          badge: null,       badgeClass: "",              desc: "免费 · 无需注册 · 每天 500 词限制" },
];

const apiDisplayName = computed(() => apiOptions.find(o => o.value === settings.value.translationApi)?.name || "Google Translate");

// ── 词书定义 ────────────────────────────────────────────────────────
const cefrBooks = [
  { id: 'tier1', level: 'A1', name: '入门词汇',  count: TIER1.size,           desc: '最常用基础词汇', color: '#4caf50' },
  { id: 'a2',    level: 'A2', name: '初级词汇',  count: WORD_BOOKS.a2.size,   desc: '日常生活常用词', color: '#8bc34a' },
  { id: 'tier2', level: 'B1', name: '中级词汇',  count: TIER2.size,           desc: '进阶工作学习词汇', color: '#2196f3' },
  { id: 'b2',    level: 'B2', name: '中高级词汇',count: WORD_BOOKS.b2.size,   desc: '复杂话题表达', color: '#03a9f4' },
  { id: 'tier3', level: 'C1', name: '高级词汇',  count: TIER3.size,           desc: '学术专业词汇', color: '#9c27b0' },
  { id: 'c2',    level: 'C2', name: '精通词汇',  count: WORD_BOOKS.c2.size,   desc: '高阶稀有词汇', color: '#673ab7' },
];

const examBooks = [
  { id: 'cet4',  level: 'CET4',  name: '四级词汇',  count: WORD_BOOKS.cet4.size,  desc: '大学英语四级', color: '#ff9800' },
  { id: 'cet6',  level: 'CET6',  name: '六级词汇',  count: WORD_BOOKS.cet6.size,  desc: '大学英语六级', color: '#ff5722' },
  { id: 'ielts', level: 'IELTS', name: '雅思词汇',  count: WORD_BOOKS.ielts.size, desc: 'IELTS 学术词汇', color: '#009688' },
  { id: 'toefl', level: 'TOEFL', name: '托福词汇',  count: WORD_BOOKS.toefl.size, desc: 'TOEFL 核心词汇', color: '#00bcd4' },
  { id: 'gre',   level: 'GRE',   name: 'GRE 词汇',  count: WORD_BOOKS.gre.size,   desc: 'GRE 高频词汇', color: '#f44336' },
  { id: 'sat',   level: 'SAT',   name: 'SAT 词汇',  count: WORD_BOOKS.sat.size,   desc: 'SAT 常考词汇', color: '#795548' },
];

const allBuiltinBooks = [...cefrBooks, ...examBooks];

// 所有内置词书 ID → 词集 映射
const bookWordSetMap = {
  tier1: TIER1,
  tier2: TIER2,
  tier3: TIER3,
  ...Object.fromEntries(Object.entries(WORD_BOOKS)),
};

const customWordBooks = computed(() => {
  const v = settings.value.customWordBooks;
  return Array.isArray(v) ? v : [];
});

const currentBookMeta = computed(() => {
  const id = currentWordBookId.value;
  return allBuiltinBooks.find(b => b.id === id) ||
    customWordBooks.value.find(b => b.id === id) || null;
});

const subPageTitle = computed(() => {
  if (settingsPage.value === 'api') return '翻译 API';
  if (settingsPage.value === 'language') return '翻译语言';
  if (settingsPage.value === 'highlight') return '高亮与注解';
  if (settingsPage.value === 'subtitle') return '视频字幕';
  if (settingsPage.value === 'wordbooks') return '词书管理';
  if (settingsPage.value === 'wordbook-detail') return currentBookMeta.value?.name || '';
  return '';
});

const currentLanguageName = computed(() =>
  LANGUAGES.find(l => l.code === (settings.value.targetLang || 'zh-CN'))?.name || '中文（简体）'
);

// ── 统计 ──────────────────────────────────────────────────────────
const statsTotal    = computed(() => wordList.value.length);
const statsMastered = computed(() => wordList.value.filter(w => w.mastered).length);
const statsMasteredPct = computed(() =>
  statsTotal.value ? Math.round(statsMastered.value / statsTotal.value * 100) : 0
);
const statsStreak = computed(() => {
  const dates = new Set();
  for (const w of wordList.value) {
    if (w.lastReview) {
      const d = new Date(w.lastReview);
      dates.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
  }
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    if (dates.has(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)) streak++;
    else break;
  }
  return streak;
});
const statsSevenDays = computed(() => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() - (6 - i));
    return { label: `${d.getMonth()+1}/${d.getDate()}`, added: 0, reviewed: 0 };
  });
  for (const w of wordList.value) {
    if (w.timestamp) {
      const diff = Math.floor((today - new Date(w.timestamp).setHours(0,0,0,0)) / 86400000);
      if (diff >= 0 && diff < 7) days[6 - diff].added++;
    }
    if (w.lastReview) {
      const diff = Math.floor((today - new Date(new Date(w.lastReview).setHours(0,0,0,0))) / 86400000);
      if (diff >= 0 && diff < 7) days[6 - diff].reviewed++;
    }
  }
  return days;
});
const statsMaxBar = computed(() =>
  Math.max(1, ...statsSevenDays.value.map(d => Math.max(d.added, d.reviewed)))
);
function statsBarH(n) { return Math.round((n / statsMaxBar.value) * 64); }

// ── 粘贴导入 ─────────────────────────────────────────────────────
const parsedPasteWords = computed(() => {
  const text = pasteImportText.value;
  if (!text.trim()) return [];
  const words = text.split(/[\s,，、\n\r]+/)
    .map(w => w.replace(/[^a-zA-Z'-]/g, '').toLowerCase())
    .filter(w => w.length >= 2 && /^[a-z]/.test(w));
  return [...new Set(words)];
});

function doImportPaste() {
  const words = parsedPasteWords.value;
  if (words.length === 0) return;
  const id   = "custom_" + Date.now();
  const name = pasteImportName.value.trim() ||
    `导入词书 ${new Date().toLocaleDateString('zh-CN')}`;
  const newBook = { id, name, words };
  settings.value.customWordBooks = [...(settings.value.customWordBooks || []), newBook];
  if (!settings.value.enabledWordBooks.includes(id)) {
    settings.value.enabledWordBooks = [...settings.value.enabledWordBooks, id];
  }
  saveSettings();
  pasteImportText.value = '';
  pasteImportName.value = '';
  showPasteImport.value = false;
}

// ── 同步到桌面端 ───────────────────────────────────────────────────
async function syncToDesktop() {
  if (syncStatus.value.loading) return;
  syncStatus.value = { loading: true, ok: false, error: false, msg: '同步中…' };
  try {
    const r = await new Promise(resolve => chrome.storage.local.get('savedWords', resolve));
    const words = r.savedWords || {};
    const entries = Object.values(words);
    if (entries.length === 0) {
      syncStatus.value = { loading: false, ok: true, error: false, msg: '生词本为空，无需同步' };
      setTimeout(() => { syncStatus.value.msg = '将插件生词本推送到桌面应用'; syncStatus.value.ok = false; }, 3000);
      return;
    }
    let success = 0, fail = 0;
    for (const entry of entries) {
      try {
        const res = await fetch('http://127.0.0.1:27149/words', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ word: entry.word, translation: entry.translation, timestamp: entry.timestamp, reviewCount: entry.reviewCount || 0 }),
        });
        if (res.ok) success++; else fail++;
      } catch { fail++; }
    }
    if (fail === 0) {
      syncStatus.value = { loading: false, ok: true, error: false, msg: `已推送 ${success} 个单词` };
    } else {
      syncStatus.value = { loading: false, ok: false, error: true, msg: `${success} 个成功，${fail} 个失败（桌面端未运行？）` };
    }
    setTimeout(() => { syncStatus.value = { loading: false, ok: false, error: false, msg: '将插件生词本推送到桌面应用' }; }, 4000);
  } catch (e) {
    syncStatus.value = { loading: false, ok: false, error: true, msg: '同步失败，请确认桌面端已运行' };
    setTimeout(() => { syncStatus.value = { loading: false, ok: false, error: false, msg: '将插件生词本推送到桌面应用' }; }, 4000);
  }
}

// ── 数据备份与恢复 ────────────────────────────────────────────────
function exportAllData() {
  chrome.storage.local.get(null, (data) => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const date = new Date().toLocaleDateString("zh-CN").replace(/\//g, "-");
    a.download = `英语助手备份_${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

function importAllData(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!data.savedWords && !data.settings) {
        alert("无效的备份文件，请确认是英语助手导出的 JSON");
        return;
      }
      const wordCount = Object.keys(data.savedWords || {}).length;
      if (!confirm(`确认恢复备份？\n包含 ${wordCount} 个单词\n\n⚠️ 这将覆盖当前所有数据，操作不可撤销。`)) return;
      chrome.storage.local.clear(() => {
        chrome.storage.local.set(data, () => {
          loadWords();
          if (data.settings) settings.value = { ...settings.value, ...data.settings };
          saveStatus.value = `✓ 恢复成功，共 ${wordCount} 个单词`;
          setTimeout(() => { saveStatus.value = ""; }, 3000);
        });
      });
    } catch {
      alert("文件读取失败，请确认是正确的 JSON 备份文件");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
}

// TTS 朗读
function speakWord(word) {
  if (!window.speechSynthesis) return;
  speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(word);
  utt.lang = "en-US";
  speechSynthesis.speak(utt);
}

const currentWordList = computed(() => {
  const id = currentWordBookId.value;
  const q = wbSearchQuery.value.trim().toLowerCase();
  let words;
  if (bookWordSetMap[id]) {
    words = [...bookWordSetMap[id]].sort();
  } else {
    const custom = customWordBooks.value.find(b => b.id === id);
    words = custom ? [...custom.words].sort() : [];
  }
  return q ? words.filter(w => w.toLowerCase().includes(q)) : words;
});

function openWordBook(id) {
  currentWordBookId.value = id;
  wbSearchQuery.value = "";
  settingsPage.value = 'wordbook-detail';
}

function openCustomWordBook(id) {
  currentWordBookId.value = id;
  wbSearchQuery.value = "";
  settingsPage.value = 'wordbook-detail';
}

// 已收藏单词的 key Set，用于词书详情页显示 ✓
const savedWordsSet = computed(() => new Set(wordList.value.map(w => w.key)));

const enabledBooks = computed(() => {
  const v = settings.value.enabledWordBooks;
  return Array.isArray(v) ? v : [];
});

const activeWordBooksCount = computed(() => enabledBooks.value.length);

// 词书词汇词池（合并所有开启的词书，排除已删除的词）
const wordBookPool = computed(() => {
  const enabled = enabledBooks.value;
  const dismissed = new Set(settings.value.dismissedPoolWords || []);
  const pool = [];
  // 内置词书
  for (const book of allBuiltinBooks) {
    if (enabled.includes(book.id) && bookWordSetMap[book.id]) {
      for (const w of bookWordSetMap[book.id]) {
        if (!dismissed.has(w)) pool.push({ w, level: book.level, color: book.color });
      }
    }
  }
  // 自定义词书
  for (const book of customWordBooks.value) {
    if (enabled.includes(book.id)) {
      for (const w of book.words) {
        if (!dismissed.has(w)) pool.push({ w, level: '自', color: '#607d8b' });
      }
    }
  }
  pool.sort((a, b) => a.w.localeCompare(b.w));
  return pool;
});

const wordBookWordCount = computed(() => wordBookPool.value.length);

const filteredPoolWords = computed(() => {
  const q = wbPoolSearch.value.trim().toLowerCase();
  if (!q) return wordBookPool.value;
  return wordBookPool.value.filter(item => item.w.includes(q));
});

function isWordBookEnabled(id) {
  return enabledBooks.value.includes(id);
}

function toggleWordBook(id) {
  const list = [...enabledBooks.value];
  const idx = list.indexOf(id);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(id);
  settings.value.enabledWordBooks = list;
  saveSettings();
}

// ── 掌握状态 ────────────────────────────────────────────────────────
const masteredCount = computed(() => filteredWords.value.filter(w => w.mastered).length);
const unmasteredCount = computed(() => filteredWords.value.filter(w => !w.mastered).length);

const filteredWords = computed(() => {
  const bid = settings.value.activePersonalBookId || "default";
  const q = searchQuery.value.trim().toLowerCase();
  // 先按生词本过滤
  let list = wordList.value.filter(w => (w.bookId || "default") === bid);
  if (!q) return list;
  return list.filter(w => w.word.toLowerCase().includes(q) || (w.translation || "").includes(q));
});

const displayedWords = computed(() => {
  const all = filteredWords.value;
  if (masteredTab.value === 'mastered') return all.filter(w => w.mastered);
  return all.filter(w => !w.mastered);
});

function toggleMastered(key) {
  chrome.storage.local.get("savedWords", (result) => {
    const words = result.savedWords || {};
    if (words[key]) words[key].mastered = !words[key].mastered;
    chrome.storage.local.set({ savedWords: words }, () => {
      loadWords();
      // 同步更新 wordDetailWord 引用中的 mastered 状态
      if (wordDetailWord.value?.key === key) {
        wordDetailWord.value = { ...wordDetailWord.value, mastered: words[key]?.mastered };
      }
    });
  });
}

// ── 词汇详情页 ──────────────────────────────────────────────────────
function openWordDetail(item) {
  wordDetailWord.value = { ...item };
  detailData.value = null;
  fetchWordDetail(item.word);
  // 若无翻译，自动获取
  if (!item.translation) autoFetchTranslation(item);
}

async function autoFetchTranslation(item) {
  const tl = settings.value.targetLang || 'zh-CN';
  try {
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(item.word)}`
    );
    const data = await res.json();
    const translation = data[0]?.map(seg => seg[0]).join('').trim();
    if (!translation) return;
    if (wordDetailWord.value?.key === item.key) {
      wordDetailWord.value = { ...wordDetailWord.value, translation };
    }
    chrome.storage.local.get('savedWords', (result) => {
      const words = result.savedWords || {};
      if (words[item.key]) {
        words[item.key].translation = translation;
        chrome.storage.local.set({ savedWords: words }, loadWords);
      }
    });
  } catch { /* 翻译失败静默处理 */ }
}

function closeWordDetail() {
  wordDetailWord.value = null;
  detailData.value = null;
}

async function fetchWordDetail(word) {
  detailLoading.value = true;
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`
    );
    if (!res.ok) { detailData.value = null; return; }
    const data = await res.json();
    const entry = data[0];
    if (!entry) { detailData.value = null; return; }
    // 收集同义词
    const synonyms = [];
    for (const m of entry.meanings || []) {
      for (const d of m.definitions || []) {
        if (d.synonyms) synonyms.push(...d.synonyms);
      }
      if (m.synonyms) synonyms.push(...m.synonyms);
    }
    detailData.value = {
      phonetic: entry.phonetics?.find(p => p.text)?.text || entry.phonetic || null,
      meanings: (entry.meanings || []).map(m => ({
        partOfSpeech: m.partOfSpeech,
        definitions: (m.definitions || []).map(d => ({
          definition: d.definition,
          example: d.example || null,
        })),
      })),
      synonyms: [...new Set(synonyms)].slice(0, 10),
    };
  } catch {
    detailData.value = null;
  } finally {
    detailLoading.value = false;
  }
}

// ── 个人生词本管理 ──────────────────────────────────────────────────
const personalBooks = computed(() => {
  const v = settings.value.personalBooks;
  return Array.isArray(v) && v.length > 0
    ? v
    : [{ id: "default", name: "我的生词本" }];
});

const currentPersonalBook = computed(() => {
  const bid = settings.value.activePersonalBookId || "default";
  return personalBooks.value.find(b => b.id === bid) || personalBooks.value[0];
});

// 统计某本生词本的词数
function bookWordCount(id) {
  return wordList.value.filter(w => (w.bookId || "default") === id).length;
}

// 切换当前生效的生词本（同时切换视图）
function setActiveBook(id) {
  settings.value.activePersonalBookId = id;
  masteredTab.value = "unmastered";
  searchQuery.value = "";
  saveSettings();
}

// 新建个人生词本
function createPersonalBook() {
  const name = newPBookName.value.trim();
  if (!name) return;
  const id = "pbook_" + Date.now();
  const current = personalBooks.value;
  settings.value.personalBooks = [...current, { id, name }];
  settings.value.activePersonalBookId = id; // 自动切换到新建的本
  saveSettings();
  newPBookName.value = "";
  showNewPBookForm.value = false;
}

// 删除个人生词本（同时删除其中的单词）
function deletePersonalBook(id) {
  if (id === "default") return;
  if (!confirm("确定删除这本生词本？其中所有单词也会被删除。")) return;
  chrome.storage.local.get("savedWords", (result) => {
    const words = result.savedWords || {};
    for (const key of Object.keys(words)) {
      if ((words[key].bookId || "default") === id) delete words[key];
    }
    chrome.storage.local.set({ savedWords: words }, loadWords);
  });
  settings.value.personalBooks = personalBooks.value.filter(b => b.id !== id);
  if ((settings.value.activePersonalBookId || "default") === id) {
    settings.value.activePersonalBookId = "default";
  }
  saveSettings();
}

// ── 词书导入 ────────────────────────────────────────────────────────
function triggerImport() {
  importFileRef.value?.click();
}

function handleImportFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  e.target.value = "";
  const reader = new FileReader();
  reader.onload = (ev) => {
    const text = ev.target.result || "";
    let words = [];
    if (file.name.endsWith(".csv")) {
      words = text.split("\n")
        .map(line => line.split(",")[0].replace(/^"|"$/g, "").trim().toLowerCase())
        .filter(w => /^[a-zA-Z]{2,}$/.test(w));
    } else {
      words = text.split("\n")
        .map(line => line.trim().toLowerCase())
        .filter(w => /^[a-zA-Z]{2,}$/.test(w));
    }
    words = [...new Set(words)];
    if (words.length === 0) { alert("未找到有效单词，请检查文件格式。"); return; }
    const id = "custom_" + Date.now();
    const name = file.name.replace(/\.[^.]+$/, "");
    const newBook = { id, name, words };
    settings.value.customWordBooks = [...customWordBooks.value, newBook];
    saveSettings();
    alert(`已导入 "${name}"，共 ${words.length} 个词。`);
  };
  reader.readAsText(file, "utf-8");
}

function deleteCustomBook(id) {
  if (!confirm("确定要删除这本词书吗？")) return;
  settings.value.customWordBooks = customWordBooks.value.filter(b => b.id !== id);
  settings.value.enabledWordBooks = enabledBooks.value.filter(e => e !== id);
  saveSettings();
}

function loadWords() {
  chrome.storage.local.get("savedWords", (result) => {
    const saved = result.savedWords || {};
    wordList.value = Object.entries(saved)
      .map(([key, val]) => ({ key, ...val }))
      .sort((a, b) => b.timestamp - a.timestamp);
  });
}

const dueCount = computed(() => {
  const now = Date.now();
  return wordList.value.filter((w) => !w.mastered && (!w.nextReview || w.nextReview <= now)).length;
});

// 词书中尚未加入生词本的词
const unsavedPoolWords = computed(() => {
  const saved = savedWordsSet.value;
  return wordBookPool.value.filter(item => !saved.has(item.w.toLowerCase()));
});

// 从词书分批添加新词到当前生词本（随机顺序），添加后自动翻译
function addWordsFromPool() {
  const count = addWordsCount.value;
  const pool = [...unsavedPoolWords.value];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const toAdd = pool.slice(0, count);
  if (toAdd.length === 0) return;
  chrome.storage.local.get('savedWords', (result) => {
    const words = result.savedWords || {};
    const bid = settings.value.activePersonalBookId || 'default';
    const now = Date.now();
    for (const item of toAdd) {
      const key = item.w.toLowerCase();
      if (!words[key]) {
        words[key] = { word: item.w, translation: '', timestamp: now, bookId: bid };
      }
    }
    chrome.storage.local.set({ savedWords: words }, () => {
      loadWords();
      autoTranslateWords(toAdd);
    });
  });
  showAddWordsPanel.value = false;
  wordType.value = 'mine';
}

// 批量自动翻译（Google Translate，单次请求，静默更新）
async function autoTranslateWords(items) {
  const wordStrings = items.map(item => item.w);
  try {
    const tl = settings.value.targetLang || 'zh-CN';
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${tl}&dt=t&q=${encodeURIComponent(wordStrings.join('\n'))}`
    );
    const data = await res.json();
    const fullText = data[0].map(seg => seg[0]).join('');
    const translationList = fullText.split('\n');
    chrome.storage.local.get('savedWords', (result) => {
      const saved = result.savedWords || {};
      let updated = false;
      wordStrings.forEach((w, i) => {
        const key = w.toLowerCase();
        const t = translationList[i]?.trim();
        if (saved[key] && t) { saved[key].translation = t; updated = true; }
      });
      if (updated) chrome.storage.local.set({ savedWords: saved }, loadWords);
    });
  } catch {
    // 翻译失败，单词已保存，翻译留空
  }
}

function dismissWord(word) {
  const dismissed = [...(settings.value.dismissedPoolWords || [])];
  if (!dismissed.includes(word)) {
    dismissed.push(word);
    settings.value.dismissedPoolWords = dismissed;
    saveSettings();
  }
}

function deleteWord(key) {
  chrome.storage.local.get("savedWords", (result) => {
    const saved = result.savedWords || {};
    delete saved[key];
    chrome.storage.local.set({ savedWords: saved }, loadWords);
  });
  removeWordFromDesktop(key);
}

function confirmClear() {
  if (confirm(`确定要删除全部 ${wordList.value.length} 个单词吗？`)) {
    chrome.storage.local.set({ savedWords: {} }, loadWords);
  }
}

function openReview() {
  chrome.tabs.create({ url: chrome.runtime.getURL("src/flashcard/index.html") });
}

function toggleExport() {
  if (wordList.value.length === 0) { alert("单词本是空的！"); return; }
  showExport.value = !showExport.value;
}

function exportCSV() {
  showExport.value = false;
  _doExportCSV();
}

function exportAnki() {
  showExport.value = false;
  _doExportAnki();
}

function exportCSVFromSettings() {
  if (wordList.value.length === 0) { alert("单词本是空的！"); return; }
  _doExportCSV();
}

function exportAnkiFromSettings() {
  if (wordList.value.length === 0) { alert("单词本是空的！"); return; }
  _doExportAnki();
}

function _doExportCSV() {
  const header = "Word,Translation,Date\n";
  const rows = wordList.value.map((w) => {
    const date = new Date(w.timestamp).toISOString().slice(0, 10);
    const trans = (w.translation || "").replace(/"/g, '""');
    return `"${w.word}","${trans}","${date}"`;
  });
  downloadFile(header + rows.join("\n"), "英语单词本.csv", "text/csv;charset=utf-8");
}

function _doExportAnki() {
  const header = "#separator:tab\n#html:false\n";
  const rows = wordList.value.map((w) => `${w.word}\t${w.translation || ""}`);
  downloadFile(header + rows.join("\n"), "英语单词本_Anki.txt", "text/plain;charset=utf-8");
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob(["\uFEFF" + content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename, saveAs: false }, () => URL.revokeObjectURL(url));
}

function toggleDarkMode() {
  settings.value.darkMode = !settings.value.darkMode;
  saveSettings();
}

function toggleSetting(key) {
  settings.value[key] = !settings.value[key];
  saveSettings();
}

function selectApi(value) {
  settings.value.translationApi = value;
  saveSettings();
  const name = apiOptions.find(o => o.value === value)?.name || value;
  saveStatus.value = `已切换至 ${name}`;
  setTimeout(() => { saveStatus.value = ""; }, 2500);
}

function saveSettings() {
  const raw = JSON.parse(JSON.stringify(toRaw(settings.value)));
  chrome.storage.local.set({ settings: raw });
  if (raw.cloudSync) {
    // 排除敏感 key 和大体积字段，避免超过 sync 100KB 限制
    const { deeplApiKey, langblyApiKey, claudeApiKey, dismissedPoolWords, customWordBooks, ...syncable } = raw;
    chrome.storage.sync.set({ settings: syncable }).catch(() => {});
  }
}

function openDeepL() {
  chrome.tabs.create({ url: "https://www.deepl.com/pro-api" });
}

function openLangbly() {
  chrome.tabs.create({ url: "https://langbly.com/signup" });
}

function openAnthropic() {
  chrome.tabs.create({ url: "https://console.anthropic.com" });
}

// 单词即将到期（明天内）
function isDueSoon(item) {
  if (item.mastered || !item.nextReview) return false;
  const now = Date.now();
  return item.nextReview > now && item.nextReview <= now + 86400000;
}

function formatDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// onChanged 只监听 savedWords 变化；settings 由本地管理，不从 storage 回读
chrome.storage.onChanged.addListener((changes) => {
  if (changes.savedWords) loadWords();
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".export-wrap")) showExport.value = false;
  if (!e.target.closest(".pbook-selector-wrap")) showPBookDropdown.value = false;
});

onMounted(async () => {
  chrome.storage.local.get(["savedWords", "settings"], async (result) => {
    let saved = result.savedWords || {};
    if (result.settings) {
      settings.value = { ...settings.value, ...result.settings };
    }
    // 云同步：若已启用，从 sync 拉取最新设置并合并
    if (settings.value.cloudSync) {
      chrome.storage.sync.get("settings", (syncResult) => {
        if (syncResult.settings) {
          settings.value = { ...settings.value, ...syncResult.settings };
        }
      });
    }
    // 从桌面应用合并生词本（仅添加桌面有但本地没有的词）
    const desktopWords = await pullWordsFromDesktop();
    if (desktopWords) {
      let changed = false;
      for (const [key, word] of Object.entries(desktopWords)) {
        if (!saved[key]) { saved[key] = word; changed = true; }
      }
      if (changed) chrome.storage.local.set({ savedWords: saved });
    }
    wordList.value = Object.entries(saved)
      .map(([key, val]) => ({ key, ...val }))
      .sort((a, b) => b.timestamp - a.timestamp);
  });
});
</script>

<style>
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  width: 320px;
  min-height: 400px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #f7f8fa;
  color: #1a1a1a;
}

.container { display: flex; flex-direction: column; min-height: 400px; }
.container.is-dark { background: #141414; min-height: 400px; }

/* ── 标题栏 ── */
.header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; background: #fff; border-bottom: 1px solid #eee;
}
.header-dark { background: #1e1e1e; border-bottom-color: #2e2e2e; }

.logo { display: flex; align-items: center; gap: 8px; }
.logo-icon { font-size: 18px; }
.logo-text { font-size: 15px; font-weight: 700; }
.header-dark .logo-text { color: #f0f0f0; }

.tabs { display: flex; gap: 2px; background: #f0f0f0; border-radius: 8px; padding: 2px; }
.header-dark .tabs { background: #2a2a2a; }
.tab { padding: 5px 12px; border: none; border-radius: 6px; background: transparent; font-size: 12px; color: #888; cursor: pointer; transition: all .15s; }
.tab.active { background: #fff; color: #1a1a1a; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
.header-dark .tab.active { background: #e8820c; color: #fff; }

/* 深色模式切换按钮 */
.dark-toggle-btn { background: none; border: none; font-size: 16px; cursor: pointer; padding: 2px 4px; border-radius: 6px; line-height: 1; transition: background .15s; flex-shrink: 0; }
.dark-toggle-btn:hover { background: rgba(128,128,128,.15); }

/* 子页面标题栏 */
.s-back-btn { background: none; border: none; color: #e8820c; font-size: 26px; cursor: pointer; line-height: 1; padding: 0 4px; }
.s-page-title { font-size: 15px; font-weight: 600; color: #f0f0f0; }
.container:not(.is-dark) .s-page-title { color: #1a1a1a; }

/* 详情页标题栏 */
.detail-back-btn { color: #e8820c !important; }
.detail-header-word { font-size: 16px; font-weight: 700; color: #1a1a1a; }
.is-dark .detail-header-word { color: #f0f0f0; }

/* ── 单词本（浅色） ── */
.action-bar { display: flex; gap: 8px; padding: 10px 12px 6px; background: #fff; border-bottom: 1px solid #eee; }
.action-btn { flex: 1; padding: 8px 10px; border: 1px solid #e0e0e0; border-radius: 8px; background: #fff; font-size: 13px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; transition: background .15s; position: relative; }
.action-btn:hover { background: #f5f5f5; }
.review-btn { color: #764ba2; border-color: #d4b8f0; }
.export-btn { color: #2d7dd2; border-color: #b3d4f5; }
.due-badge { position: absolute; top: -6px; right: -6px; background: #e74c3c; color: white; font-size: 11px; font-weight: 700; min-width: 18px; height: 18px; border-radius: 9px; display: flex; align-items: center; justify-content: center; padding: 0 4px; }
.export-wrap { flex: 1; position: relative; }
.export-dropdown { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,.12); z-index: 100; overflow: hidden; }
.export-dropdown button { width: 100%; padding: 10px 14px; border: none; background: transparent; text-align: left; font-size: 13px; cursor: pointer; transition: background .15s; }
.export-dropdown button:hover { background: #f5f5f5; }
.export-dropdown button + button { border-top: 1px solid #f0f0f0; }
.search-wrap { padding: 10px 12px 4px; background: #f7f8fa; }
.search-input { width: 100%; padding: 7px 12px; border: 1px solid #e0e0e0; border-radius: 8px; font-size: 13px; background: #fff; outline: none; transition: border-color .2s; }
.search-input:focus { border-color: #4a90d9; }
.word-list { flex: 1; overflow-y: auto; padding: 8px 12px; max-height: 300px; }
.word-card { display: flex; align-items: center; justify-content: space-between; background: #fff; border-radius: 10px; padding: 10px 12px; margin-bottom: 6px; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
.word-info { flex: 1; min-width: 0; }
.word-row { display: flex; align-items: center; gap: 6px; }
.word-original { font-size: 15px; font-weight: 600; }
.review-tag { font-size: 10px; background: #f0e6ff; color: #764ba2; padding: 1px 6px; border-radius: 10px; }
.word-translation { font-size: 13px; color: #555; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.word-date { font-size: 11px; color: #bbb; margin-top: 3px; }
.word-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; margin-left: 8px; }
.delete-btn { width: 26px; height: 26px; border: none; border-radius: 6px; background: transparent; color: #ccc; cursor: pointer; font-size: 13px; display: flex; align-items: center; justify-content: center; transition: background .15s, color .15s; }
.delete-btn:hover { background: #fee; color: #e74c3c; }
.empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 20px; text-align: center; color: #999; }
.empty-icon { font-size: 36px; margin-bottom: 12px; }
.empty-title { font-size: 15px; font-weight: 600; color: #555; margin-bottom: 6px; }
.empty-desc { font-size: 13px; line-height: 1.7; }
.footer { padding: 10px 12px; background: #fff; border-top: 1px solid #eee; }
.clear-btn { width: 100%; padding: 8px; border: 1px solid #e0e0e0; border-radius: 8px; background: #fff; color: #e74c3c; font-size: 13px; cursor: pointer; transition: background .15s; }
.clear-btn:hover { background: #fee; }

/* ── 掌握状态分栏 ── */
.mastered-tabs { display: flex; background: #f0f4ff; border-bottom: 1px solid #e8ecf8; }
.mt-btn { flex: 1; padding: 6px 10px; border: none; background: transparent; font-size: 12px; color: #888; cursor: pointer; border-bottom: 2px solid transparent; transition: all .15s; }
.mt-btn.active { color: #4a90d9; border-bottom-color: #4a90d9; font-weight: 600; }
.mt-btn.active .wt-count { background: rgba(74,144,217,0.15); color: #4a90d9; }

/* 掌握按钮 */
.master-btn { width: 26px; height: 26px; border: 1.5px solid #ddd; border-radius: 6px; background: transparent; color: #bbb; cursor: pointer; font-size: 13px; display: flex; align-items: center; justify-content: center; transition: all .15s; }
.master-btn:hover { border-color: #4a90d9; color: #4a90d9; }
.master-btn.mastered { border-color: #4caf50; background: #e8f5e9; color: #4caf50; }
.mastered-badge { font-size: 10px; background: #e8f5e9; color: #4caf50; padding: 1px 5px; border-radius: 10px; font-weight: 700; }
.expiry-badge { font-size: 10px; background: #fff3e0; color: #e65100; padding: 1px 6px; border-radius: 10px; font-weight: 600; }
.is-dark .expiry-badge { background: #3a1800; color: #ffa040; }

/* ── 词汇详情页 ── */
.detail-body { padding: 16px 16px 20px; overflow-y: auto; max-height: 480px; }
.detail-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 10px; }
.detail-word-title { font-size: 28px; font-weight: 700; color: #1a1a1a; }
.detail-master-btn { padding: 5px 10px; border-radius: 8px; border: 1.5px solid #ddd; background: #fff; font-size: 12px; color: #888; cursor: pointer; flex-shrink: 0; margin-left: 10px; transition: all .15s; }
.detail-master-btn:hover { border-color: #4caf50; color: #4caf50; }
.detail-master-btn.mastered { border-color: #4caf50; background: #e8f5e9; color: #4caf50; }
.detail-phonetic { font-size: 15px; color: #888; font-family: Georgia, serif; margin-bottom: 6px; }
.detail-translation { font-size: 16px; font-weight: 600; color: #e8820c; margin-bottom: 12px; }
.detail-meaning { margin-bottom: 12px; }
.detail-pos { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #fff; background: #607d8b; padding: 2px 7px; border-radius: 4px; display: inline-block; margin-bottom: 6px; letter-spacing: 0.5px; }
.detail-def { margin-bottom: 6px; padding-left: 8px; border-left: 2px solid #e0e0e0; }
.detail-def-text { font-size: 13px; color: #333; line-height: 1.5; }
.detail-example { font-size: 12px; color: #888; font-style: italic; margin-top: 3px; }
.detail-synonyms { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
.detail-syn-label { font-size: 11px; color: #999; }
.detail-syn-tag { font-size: 11px; background: #f0f4ff; color: #4a90d9; padding: 2px 7px; border-radius: 10px; }
.detail-meta { font-size: 11px; color: #bbb; margin-top: 14px; border-top: 1px solid #f0f0f0; padding-top: 10px; }
.detail-loading { text-align: center; color: #999; font-size: 13px; padding: 20px 0; }
.detail-no-data { padding: 10px 0; }

/* ── 设置页（深色） ── */
.s-body { padding: 10px 12px; display: flex; flex-direction: column; gap: 10px; }

.s-section {
  border-radius: 10px; overflow: hidden;
  background: #1e1e1e;
  border: 1px solid #2a2a2a;
}
.s-section-title {
  font-size: 11px; font-weight: 700; color: #e8820c;
  padding: 8px 14px 4px;
  border-left: 3px solid #e8820c;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.s-row {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 14px;
  border-top: 1px solid #2a2a2a;
  cursor: pointer;
  transition: background .12s;
}
.s-row:hover { background: rgba(255,255,255,.04); }
.s-row-static { cursor: default; }
.s-row-static:hover { background: transparent; }
.s-row-radio { cursor: pointer; }
.s-radio { margin-left: auto; font-size: 15px; color: #e8820c; }

.s-icon { font-size: 16px; width: 22px; text-align: center; flex-shrink: 0; }
.s-label { font-size: 13px; color: #e0e0e0; flex: 1; }
.s-meta { font-size: 12px; color: #666; flex-shrink: 0; }
.s-arrow { font-size: 18px; color: #444; flex-shrink: 0; line-height: 1; }

/* radio 行 */
.s-row-radio { gap: 10px; }
.s-row-selected { background: rgba(232,130,12,.08) !important; }
.s-radio { width: 16px; height: 16px; border-radius: 50%; border: 2px solid #444; flex-shrink: 0; transition: all .15s; }
.s-radio.active { border-color: #e8820c; background: #e8820c; box-shadow: inset 0 0 0 3px #1e1e1e; }
.s-label-group { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.s-label-group .s-label { flex: none; }
.s-desc { font-size: 11px; color: #555; }

/* badge */
.s-badge { font-size: 10px; padding: 1px 5px; border-radius: 8px; font-weight: 600; vertical-align: middle; }
.badge-default { background: #2a3a2a; color: #4caf50; }
.badge-best    { background: #1a3a1a; color: #81c784; }
.badge-free    { background: #1a2a3a; color: #64b5f6; }
.badge-offline { background: #2a1a3a; color: #ce93d8; }

/* key 输入 */
.s-key-wrap { padding: 10px 14px; border-top: 1px solid #2a2a2a; display: flex; flex-direction: column; gap: 6px; }
.s-key-row { display: flex; gap: 6px; }
.s-key-input { flex: 1; padding: 7px 10px; border: 1px solid #333; border-radius: 7px; font-size: 12px; background: #141414; color: #e0e0e0; outline: none; transition: border-color .15s; }
.s-key-input:focus { border-color: #e8820c; }
.s-eye-btn { width: 32px; height: 32px; border: 1px solid #333; border-radius: 7px; background: #141414; cursor: pointer; font-size: 14px; flex-shrink: 0; }
.s-key-hint { font-size: 11px; color: #555; }
.s-link { color: #e8820c; cursor: pointer; text-decoration: underline; }
.s-code { font-family: monospace; font-size: 10px; color: #888; background: #141414; border-radius: 6px; padding: 6px 8px; word-break: break-all; border: 1px solid #2a2a2a; }

/* toggle 行 */
.s-row-toggle { align-items: center; }
.s-toggle, .s-toggle-btn { width: 38px; height: 22px; border-radius: 11px; background: #333; position: relative; transition: background .2s; flex-shrink: 0; border: none; cursor: pointer; padding: 0; }
.s-toggle.on, .s-toggle-btn.on { background: #e8820c; }
.s-toggle-thumb { position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: white; box-shadow: 0 1px 3px rgba(0,0,0,.3); transition: transform .2s; }
.s-toggle.on .s-toggle-thumb, .s-toggle-btn.on .s-toggle-thumb { transform: translateX(16px); }

/* 词书详情 */
.wb-word-list { max-height: 280px; overflow-y: auto; padding: 4px 0; }
.wb-word-list::-webkit-scrollbar { width: 3px; }
.wb-word-list::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
.wb-word-row { display: flex; align-items: center; justify-content: space-between; padding: 7px 14px; border-top: 1px solid #2a2a2a; }
.wb-word-row:first-child { border-top: none; }
.wb-word { font-size: 13px; color: #d0d0d0; font-family: Georgia, serif; }
.wb-saved { font-size: 11px; color: #e8820c; font-weight: 700; }
.wb-empty { padding: 20px; text-align: center; color: #555; font-size: 13px; }

/* 词书级别徽章 */
.s-wb-badge {
  width: 32px; height: 32px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; color: #fff; flex-shrink: 0;
  opacity: 0.85;
}

/* 词书删除按钮 */
.s-icon-btn { background: none; border: none; cursor: pointer; padding: 4px; flex-shrink: 0; }
.s-delete-book { color: #555; font-size: 12px; }
.s-delete-book:hover { color: #e74c3c; }

/* 词类切换栏 */
.word-type-bar { display: flex; background: #f7f8fa; border-bottom: 1px solid #eee; }
.wt-btn { flex: 1; padding: 7px 10px; border: none; background: transparent; font-size: 12px; color: #888; cursor: pointer; border-bottom: 2px solid transparent; transition: all .15s; }
.wt-btn.active { color: #e8820c; border-bottom-color: #e8820c; font-weight: 600; }
.wt-count { font-size: 11px; background: #eee; border-radius: 8px; padding: 1px 5px; margin-left: 3px; }
.wt-btn.active .wt-count { background: rgba(232,130,12,0.15); color: #e8820c; }

/* 词书词汇池卡片 */
.word-card-pool { padding: 7px 12px; }
.pool-tag { font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 5px; margin-left: 4px; }
.pool-info { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 20px; text-align: center; color: #999; }

/* ── 分批添加新词 ── */
.add-words-bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #f0f6ff; border-bottom: 1px solid #dde8f8; }
.is-dark .add-words-bar { background: #1a2030; border-bottom-color: #2a3a50; }
.add-words-stats { display: flex; flex-direction: column; gap: 1px; }
.add-words-total { font-size: 11px; color: #888; }
.is-dark .add-words-total { color: #555; }
.add-words-unsaved { font-size: 12px; font-weight: 600; color: #4a90d9; }
.is-dark .add-words-unsaved { color: #7ab4e8; }
.add-words-btn { padding: 6px 12px; border: none; border-radius: 8px; background: #4a90d9; color: #fff; font-size: 12px; font-weight: 600; cursor: pointer; transition: background .15s; flex-shrink: 0; }
.add-words-btn:hover { background: #357abd; }
.add-words-btn:disabled { background: #4caf50; cursor: default; }

.add-words-panel { background: #fff; border-bottom: 1px solid #e8ecf8; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
.is-dark .add-words-panel { background: #1a1e28; border-bottom-color: #2a3040; }
.add-panel-label { font-size: 12px; color: #666; font-weight: 600; }
.is-dark .add-panel-label { color: #888; }
.add-count-row { display: flex; gap: 6px; }
.add-count-btn { padding: 5px 12px; border: 1.5px solid #e0e0e0; border-radius: 8px; background: #fff; color: #555; font-size: 13px; font-weight: 600; cursor: pointer; transition: all .15s; }
.is-dark .add-count-btn { background: #252a38; border-color: #3a4050; color: #aaa; }
.add-count-btn.active { border-color: #4a90d9; background: #e8f2fb; color: #4a90d9; }
.is-dark .add-count-btn.active { background: #1a2a3a; color: #7ab4e8; border-color: #4a70a0; }
.add-count-btn:hover:not(.active) { border-color: #bbb; }
.add-panel-hint { font-size: 11px; color: #999; line-height: 1.5; }
.is-dark .add-panel-hint { color: #556; }
.add-panel-actions { display: flex; gap: 8px; }
.add-confirm-btn { flex: 1; padding: 8px; border: none; border-radius: 8px; background: #4a90d9; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; transition: background .15s; }
.add-confirm-btn:hover { background: #357abd; }
.add-cancel-btn { padding: 8px 12px; border: 1px solid #ddd; border-radius: 8px; background: transparent; color: #888; font-size: 13px; cursor: pointer; }
.is-dark .add-cancel-btn { border-color: #3a4050; color: #666; }

/* API 切换 toast */
.s-toast { background: #e8820c; color: #fff; text-align: center; font-size: 12px; font-weight: 600; padding: 7px 14px; border-radius: 8px; margin: 8px 12px 0; }

/* ── 个人生词本切换栏（下拉模式） ── */
.pbook-bar { display: flex; align-items: center; gap: 6px; background: #fff; border-bottom: 1px solid #eee; padding: 6px 10px; }
.pbook-selector-wrap { flex: 1; position: relative; min-width: 0; }
.pbook-trigger { display: flex; align-items: center; gap: 5px; width: 100%; padding: 5px 10px; border: 1px solid #e0e0e0; border-radius: 8px; background: #fff; cursor: pointer; font-size: 13px; text-align: left; transition: border-color .15s; }
.pbook-trigger:hover { border-color: #e8820c; }
.pbook-trigger-icon { font-size: 14px; flex-shrink: 0; }
.pbook-trigger-name { flex: 1; font-weight: 600; color: #1a1a1a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pbook-trigger-count { font-size: 11px; background: rgba(232,130,12,0.12); color: #e8820c; padding: 1px 6px; border-radius: 8px; flex-shrink: 0; font-weight: 600; }
.pbook-trigger-arrow { font-size: 9px; color: #bbb; flex-shrink: 0; }
/* 下拉列表 */
.pbook-dropdown { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: #fff; border: 1px solid #e0e0e0; border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,.12); z-index: 200; overflow: hidden; }
.pbook-drop-item { display: flex; align-items: center; gap: 8px; padding: 10px 12px; cursor: pointer; transition: background .12s; border-top: 1px solid #f5f5f5; }
.pbook-drop-item:first-child { border-top: none; }
.pbook-drop-item:hover { background: #fef8f0; }
.pbook-drop-item.active { background: #fff8f0; }
.pbook-drop-radio { font-size: 12px; color: #bbb; flex-shrink: 0; }
.pbook-drop-item.active .pbook-drop-radio { color: #e8820c; }
.pbook-drop-name { flex: 1; font-size: 13px; color: #333; font-weight: 500; }
.pbook-drop-item.active .pbook-drop-name { color: #e8820c; font-weight: 600; }
.pbook-drop-count { font-size: 11px; color: #bbb; flex-shrink: 0; }
.pbook-drop-del { width: 20px; height: 20px; border: none; background: transparent; color: #ccc; cursor: pointer; font-size: 11px; flex-shrink: 0; border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: all .12s; }
.pbook-drop-del:hover { background: #fee; color: #e74c3c; }
/* 新建按钮 */
.pbook-new-btn { flex-shrink: 0; width: 30px; height: 30px; border: 1px solid #e0e0e0; border-radius: 8px; background: #fff; color: #888; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1; transition: all .15s; }
.pbook-new-btn:hover { border-color: #e8820c; color: #e8820c; }
.new-pbook-form { display: flex; gap: 6px; padding: 8px 10px; background: #fff; border-bottom: 1px solid #eee; }
.nb-confirm-btn { padding: 6px 10px; border: none; border-radius: 6px; background: #e8820c; color: #fff; font-size: 12px; cursor: pointer; flex-shrink: 0; }
.nb-cancel-btn { padding: 6px 8px; border: 1px solid #ddd; border-radius: 6px; background: transparent; color: #888; font-size: 12px; cursor: pointer; flex-shrink: 0; }

/* ── 深色模式：单词本相关元素 ── */
.is-dark .action-bar { background: #1e1e1e; border-bottom-color: #2a2a2a; }
.is-dark .action-btn { background: #2a2a2a; border-color: #383838; color: #d0d0d0; }
.is-dark .action-btn:hover { background: #333; }
.is-dark .review-btn { color: #c49fe0; border-color: #5a3a7a; }
.is-dark .export-btn { color: #7ab4e8; border-color: #2a4a6a; }
.is-dark .export-dropdown { background: #1e1e1e; border-color: #333; }
.is-dark .export-dropdown button { color: #d0d0d0; }
.is-dark .export-dropdown button:hover { background: #2a2a2a; }
.is-dark .export-dropdown button + button { border-top-color: #2a2a2a; }
.is-dark .word-type-bar { background: #1e1e1e; border-bottom-color: #2a2a2a; }
.is-dark .wt-btn { color: #666; }
.is-dark .wt-count { background: #2a2a2a; color: #666; }
.is-dark .search-wrap { background: #141414; }
.is-dark .search-input { background: #1e1e1e; border-color: #333; color: #e0e0e0; }
.is-dark .word-card { background: #1e1e1e; box-shadow: none; border: 1px solid #2a2a2a; }
.is-dark .word-original { color: #f0f0f0; }
.is-dark .word-translation { color: #888; }
.is-dark .word-date { color: #444; }
.is-dark .mastered-tabs { background: #1a1a28; border-bottom-color: #2a2a38; }
.is-dark .mt-btn { color: #555; }
.is-dark .pbook-bar { background: #1e1e1e; border-bottom-color: #2a2a2a; }
.is-dark .pbook-trigger { background: #2a2a2a; border-color: #383838; }
.is-dark .pbook-trigger-name { color: #e0e0e0; }
.is-dark .pbook-dropdown { background: #1e1e1e; border-color: #333; box-shadow: 0 4px 20px rgba(0,0,0,.4); }
.is-dark .pbook-drop-item { border-top-color: #2a2a2a; }
.is-dark .pbook-drop-item:hover { background: #2a220e; }
.is-dark .pbook-drop-item.active { background: #25200c; }
.is-dark .pbook-drop-name { color: #d0d0d0; }
.is-dark .pbook-drop-count { color: #555; }
.is-dark .pbook-new-btn { background: #2a2a2a; border-color: #383838; color: #666; }
.is-dark .new-pbook-form { background: #1e1e1e; border-bottom-color: #2a2a2a; }
.is-dark .nb-cancel-btn { border-color: #383838; color: #666; }
.is-dark .footer { background: #1e1e1e; border-top-color: #2a2a2a; }
.is-dark .clear-btn { background: #1e1e1e; border-color: #383838; }
.is-dark .empty { color: #444; }
.is-dark .empty-title { color: #666; }
.is-dark .detail-body { background: #141414; }
.is-dark .detail-word-title { color: #f0f0f0; }
.is-dark .detail-master-btn { background: #2a2a2a; border-color: #444; color: #888; }
.is-dark .detail-def-text { color: #c0c0c0; }
.is-dark .detail-def { border-left-color: #3a3a3a; }
.is-dark .detail-meta { color: #444; border-top-color: #2a2a2a; }
.is-dark .detail-syn-tag { background: #1a2a3a; color: #7ab4e8; }

/* ── 浅色模式：设置页相关元素 ── */
.container:not(.is-dark) .s-section { background: #fff; border-color: #eee; }
.container:not(.is-dark) .s-row { border-top-color: #f0f0f0; }
.container:not(.is-dark) .s-row:hover { background: rgba(0,0,0,.03); }
.container:not(.is-dark) .s-label { color: #1a1a1a; }
.container:not(.is-dark) .s-meta { color: #aaa; }
.container:not(.is-dark) .s-arrow { color: #ccc; }
.container:not(.is-dark) .s-desc { color: #aaa; }
.container:not(.is-dark) .s-key-wrap { border-top-color: #f0f0f0; }
.container:not(.is-dark) .s-key-input { background: #f9f9f9; border-color: #e0e0e0; color: #1a1a1a; }
.container:not(.is-dark) .s-key-input:focus { border-color: #e8820c; }
.container:not(.is-dark) .s-eye-btn { background: #f9f9f9; border-color: #e0e0e0; }
.container:not(.is-dark) .s-key-hint { color: #aaa; }
.container:not(.is-dark) .s-code { background: #f5f5f5; color: #666; border-color: #e0e0e0; }
.container:not(.is-dark) .s-toggle, .container:not(.is-dark) .s-toggle-btn { background: #ccc; }
.container:not(.is-dark) .s-toggle.on, .container:not(.is-dark) .s-toggle-btn.on { background: #e8820c; }
.container:not(.is-dark) .s-radio { border-color: #ccc; }
.container:not(.is-dark) .s-radio.active { border-color: #e8820c; background: #e8820c; box-shadow: inset 0 0 0 3px #fff; }
.container:not(.is-dark) .s-row-selected { background: rgba(232,130,12,.06) !important; }
.container:not(.is-dark) .s-toast { background: #e8820c; }
.container:not(.is-dark) .wb-word-row { border-top-color: #f0f0f0; }
.container:not(.is-dark) .wb-word { color: #333; }
.container:not(.is-dark) .wb-word-list::-webkit-scrollbar-thumb { background: #ccc; }
.container:not(.is-dark) .wb-empty { color: #aaa; }
.container:not(.is-dark) .badge-default { background: #e8f5e9; color: #4caf50; }
.container:not(.is-dark) .badge-best    { background: #e8f5e9; color: #388e3c; }
.container:not(.is-dark) .badge-free    { background: #e3f2fd; color: #1976d2; }
.container:not(.is-dark) .badge-offline { background: #f3e5f5; color: #7b1fa2; }
.container:not(.is-dark) .s-delete-book { color: #bbb; }

/* ── 上下文原句 ─────────────────────────────────────────────────── */
.word-context-snippet {
  font-size: 11px; color: #888; margin-top: 2px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;
  font-style: italic;
}
.container:not(.is-dark) .word-context-snippet { color: #aaa; }

.detail-tts-btn {
  background: none; border: none; font-size: 16px; cursor: pointer;
  opacity: 0.5; padding: 2px 4px; border-radius: 6px; vertical-align: middle;
  transition: opacity 0.15s;
}
.detail-tts-btn:hover { opacity: 1; }

.detail-user-context {
  margin: 8px 0; padding: 8px 12px; background: rgba(74,144,217,0.1);
  border-left: 3px solid #4a90d9; border-radius: 0 8px 8px 0;
  font-size: 13px; color: #ccc; line-height: 1.6; font-style: italic;
}
.container:not(.is-dark) .detail-user-context { color: #555; background: #f0f4ff; }
.detail-context-label {
  display: inline-block; font-size: 10px; font-weight: 700; color: #4a90d9;
  background: rgba(74,144,217,0.15); padding: 1px 5px; border-radius: 4px;
  margin-right: 6px; font-style: normal; vertical-align: middle;
}

/* ── 统计页 ─────────────────────────────────────────────────────── */
.stats-body { padding: 16px 14px 24px; display: flex; flex-direction: column; gap: 18px; }

.stats-overview { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.stats-ov-card {
  background: rgba(255,255,255,0.07); border-radius: 12px;
  padding: 12px 6px; text-align: center;
}
.container:not(.is-dark) .stats-ov-card { background: #f5f5f5; }
.stats-ov-num { font-size: 22px; font-weight: 800; color: #e8820c; }
.stats-ov-label { font-size: 11px; color: #888; margin-top: 2px; }
.stats-ov-streak .stats-ov-num { color: #ff6b35; }

.stats-progress-wrap { display: flex; flex-direction: column; gap: 6px; }
.stats-progress-label { display: flex; justify-content: space-between; font-size: 12px; color: #888; }
.stats-progress-bar { height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden; }
.container:not(.is-dark) .stats-progress-bar { background: #e0e0e0; }
.stats-progress-fill { height: 100%; background: linear-gradient(90deg, #e8820c, #f5a623); border-radius: 4px; transition: width 0.5s; }

.stats-chart-section, .stats-books-section { display: flex; flex-direction: column; gap: 10px; }
.stats-chart-title { font-size: 13px; font-weight: 600; color: #ccc; }
.container:not(.is-dark) .stats-chart-title { color: #555; }

.stats-legend { font-size: 11px; color: #888; display: flex; align-items: center; gap: 4px; }
.stats-legend-dot { display: inline-block; width: 8px; height: 8px; border-radius: 2px; }

.stats-chart { display: flex; gap: 6px; align-items: flex-end; padding-bottom: 4px; }
.stats-bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; }
.stats-bars-wrap { display: flex; gap: 2px; align-items: flex-end; height: 68px; }
.stats-bar-new    { width: 8px; background: #4a90d9; border-radius: 3px 3px 0 0; min-height: 2px; transition: height 0.4s; }
.stats-bar-review { width: 8px; background: #e8820c; border-radius: 3px 3px 0 0; min-height: 2px; transition: height 0.4s; }
.stats-bar-num  { font-size: 9px; color: #888; }
.stats-bar-label { font-size: 10px; color: #666; }

.stats-book-row { display: flex; align-items: center; gap: 8px; }
.stats-book-name { font-size: 12px; color: #ccc; width: 80px; flex-shrink: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.container:not(.is-dark) .stats-book-name { color: #555; }
.stats-book-bar-wrap { flex: 1; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden; }
.container:not(.is-dark) .stats-book-bar-wrap { background: #e0e0e0; }
.stats-book-bar { height: 100%; background: #4a90d9; border-radius: 3px; transition: width 0.4s; }
.stats-book-count { font-size: 11px; color: #888; width: 30px; text-align: right; }

/* ── 粘贴导入面板 ────────────────────────────────────────────────── */
.paste-import-panel {
  padding: 10px 14px 14px; background: rgba(255,255,255,0.04);
  border-top: 1px solid rgba(255,255,255,0.07);
  display: flex; flex-direction: column; gap: 8px;
}
.container:not(.is-dark) .paste-import-panel { background: #fafafa; border-top: 1px solid #eee; }
.paste-import-area {
  width: 100%; height: 100px; padding: 8px; border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.05);
  color: #f0f0f0; font-size: 12px; font-family: inherit; resize: vertical;
}
.container:not(.is-dark) .paste-import-area { border-color: #ddd; background: #fff; color: #333; }
.paste-import-area:focus { outline: none; border-color: #e8820c; }
.paste-import-info { font-size: 12px; color: #888; }
.paste-import-info b { color: #e8820c; }
.paste-import-actions { display: flex; gap: 8px; }
</style>
