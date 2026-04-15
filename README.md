# Voca — English Learning Browser Extension

Read English smarter. Instant hover translation, bilingual YouTube subtitles, and spaced-repetition flashcards.

---

## Features

- **Hover Translation** — Click any English word to see its translation, phonetic, and definitions (Google Translate / DeepL / LibreTranslate)
- **Phrase Translation** — Select any text to translate a full phrase or sentence
- **Word Bank** — Save words and phrases with one click; view and manage your collection in the popup
- **Flashcard Review** — SM-2 spaced repetition algorithm, with definitions, synonyms, antonyms, and example sentences
- **YouTube Bilingual Subtitles** — Auto-loads English CC, translates each line, and syncs with video playback
- **Desktop Sync** — Syncs your word bank with the Voca desktop app in real time (requires Voca desktop v1.0.4+)

---

## Changelog

### v1.0.2 (2026-04-15)

#### Fix
- Fixed desktop-to-plugin deletion sync: words deleted in the desktop app now correctly disappear from the plugin word bank (previously only additions were synced)

---

### v1.0.1 (2026-04-06)

#### New
- **Save from phrase panel** — After translating a selection, click ☆ to save directly to your word bank
- **Hide Chinese subtitles** — Toggle button in the YouTube subtitle panel to hide Chinese translations and focus on English listening
- **Subtitle context highlight** — The lines before and after the current subtitle are shown with a soft orange background for easier context tracking
- **Sentence bookmarks** — Each subtitle line now has a ☆ button to save the full sentence (with translation) to your word bank

#### Improved
- **Word variant matching** — Highlights now match inflected and derived forms:
  - Plurals: `marquees` → `marquee`, `stories` → `story`
  - Tenses: `running` → `run`, `stopped` → `stop`, `walked` → `walk`
  - Comparatives: `biggest` → `big`, `fastest` → `fast`
  - Derivations: `quickly` → `quick`, `happily` → `happy`, `helpful` → `help`, `darkness` → `dark`, `movement` → `move`

#### Fixed
- Fixed `icon-16.png` loading error on extension startup

---

### v1.0.0 (2026-03-xx)

Initial release.

- Hover translation (Google Translate / DeepL / LibreTranslate)
- Edit modal: modify source text, switch target language, live re-translation
- Word bank with memory level tags
- Flashcard review with SM-2 algorithm
- YouTube bilingual subtitles synced to video playback
