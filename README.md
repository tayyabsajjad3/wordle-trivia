# Trivia Guess 🎯

A general-knowledge trivia game with hangman-style guessing, built as an installable Progressive Web App.

Answer questions across 16 categories, build streaks, chase your high score.

## Features

- 🎨 16 categories — Geography, Science, Movies, Animals, History, Food, Music, Sports, Technology, Art, Space, Literature, Human Body, Famous People, Nature, TV Shows
- 🎮 Three question formats — hangman (easy), hangman with hint (medium), multiple choice (hard)
- ❤️ Three hearts per run, high score chase
- 🔥 Combo multiplier — streaks multiply your points
- 📅 Daily challenge — a special question every day
- 📱 Installable on Android + iOS (PWA), works offline
- 🔊 Sound effects and haptic feedback

## Tech Stack

- Vanilla HTML, CSS, JavaScript (no frameworks)
- CSV-based question storage (editable in Excel)
- Service Worker for offline support
- PWA — installable via browser or wrapped as APK

## Local Development

Clone the repo and open `index.html` in a browser, or serve it with any static server:

```bash
npx serve .
```

## Deployment

Deployed via **GitHub Pages** — see repo settings.

APK build via [PWABuilder](https://www.pwabuilder.com).

## Editing Questions

Open `questions.csv` in Excel or any spreadsheet editor. Add rows following the format:

```
category,difficulty,clue,answer,option2,option3,option4
```

Multi-category questions can be tagged with `|`, e.g. `Space|History`.

Save as CSV, commit, redeploy.

## License

Personal project — all rights reserved.
