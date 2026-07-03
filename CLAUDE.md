# Trivia Guess Game — Project Context

> This file is read by Claude Code at the start of every session. It contains the full project brief, decisions, and conventions. Keep it up to date as the project evolves.

## Project Overview

A **general-knowledge trivia guessing game** built as a Progressive Web App (PWA) that can be:
1. Deployed to GitHub Pages as a web game
2. Packaged as an installable Android APK (via PWABuilder)
3. Played fully offline once installed

**Built as a birthday gift for Rameeza.** She will play it long-term, so the game must be genuinely fun, replayable, and polished — not a novelty.

## Core Vision

A game in the spirit of Snake / 2048 / Wordle — simple to pick up, hard to master, endless replay value. Think **Kahoot meets Hangman meets a high-score arcade game.**

Player answers trivia questions across 16 categories, guessing answers hangman-style (letter by letter) with a limited number of hearts per run. High score chasing is the core loop.

## Tech Stack

- **Frontend:** Vanilla HTML + CSS + JavaScript (no framework — keep it lightweight and fast)
- **Data:** Questions loaded from a `questions.csv` file at runtime
- **Storage:** `localStorage` for high scores, streaks, and settings
- **Offline:** Service Worker + Web App Manifest (PWA)
- **Deployment:** GitHub Pages (web) + PWABuilder (APK)

**Why vanilla JS:** Fast to load, works offline easily, small bundle for APK wrapping, no build tools needed.

## File Structure

```
/
├── index.html          # Main entry point
├── style.css           # All styling
├── game.js             # Core game logic
├── csv-loader.js       # Question loading + parsing
├── sounds.js           # Sound effects manager
├── questions.csv       # All trivia questions (editable in Excel)
├── manifest.json       # PWA manifest
├── service-worker.js   # Offline support
├── assets/
│   ├── icon-192.png    # PWA icon
│   ├── icon-512.png    # PWA icon
│   └── sounds/         # Sound effect files
├── CLAUDE.md           # This file
└── README.md           # Public-facing description
```

## Game Design

### Core Loop
1. Player opens app → home screen with high score, streak, category picker
2. Picks a category (or "Mix" for random) → starts a run
3. Answers questions one by one, building score and streak
4. Loses a heart when a round is failed
5. Loses all 3 hearts → game over → shows final score → "Play again"

### Question Formats by Difficulty
- **Easy:** Pure hangman — 6 letter attempts, no hints
- **Medium:** Hangman with first letter revealed as a hint
- **Hard:** Multiple choice — 4 options (correct + 3 wrong from CSV)

### Difficulty Ramp
Difficulty tier ramps as the player's score in the current run climbs:
- Score 0–30: only easy questions
- Score 30–80: easy + medium mix
- Score 80+: easy + medium + hard mix

### Scoring
- Correct answer: **+10 points**
- Correct with "Show options" rescue (on hangman): **+5 points**
- Streak bonus: **+1 per correct in a row** (e.g., streak of 5 = +5 on top)
- Combo multiplier:
  - Streak of 3+: **2×** all points earned
  - Streak of 5+: **3×** all points earned
  - Streak of 10+: **5×** all points earned
- Wrong round: **0 points, streak resets to 0, −1 heart**

### Hearts
- 3 hearts per run, shown at top of screen
- Losing a round (running out of letter attempts) costs 1 heart
- Wrong letter guesses within a round do NOT cost hearts — only failing the whole round does
- 0 hearts = game over

### Rescue Feature (Hangman rounds only)
- Player can tap "Show options" mid-round
- Reveals 4 multiple-choice options
- Costs 2 letter attempts (not a heart)
- Reduces points to +5 instead of +10

### Daily Challenge
- One special question per day, deterministic (same for all users on a given date)
- Bonus points (2× reward)
- Tracked separately from main runs
- Encourages daily habit

## Categories (16 total)

Geography, Science, Movies, Animals, History, Food, Music, Sports, Technology, Art, Space, Literature, Human Body, Famous People, Nature, TV Shows

Each category has an emoji identifier used in UI. The game must handle multi-tag questions (one question in multiple categories).

## Question CSV Format

**File:** `questions.csv`

**Columns:** `category,difficulty,clue,answer,option2,option3,option4`

**Rules:**
- `category`: single category OR multiple categories separated by `|` (e.g., `Space|History|Famous People`)
- `difficulty`: `easy`, `medium`, or `hard`
- `clue`: the question text shown to the player
- `answer`: UPPERCASE, single or multi-word (spaces preserved for hangman display)
- `option2`, `option3`, `option4`: only filled for `hard` questions (multiple-choice wrong answers). Empty for easy/medium.

**Example:**
```csv
category,difficulty,clue,answer,option2,option3,option4
Geography,easy,Country shaped like a boot,ITALY,,,
Space|History|Famous People,medium,First person on the moon,ARMSTRONG,,,
Movies|Literature,hard,Author of Harry Potter,ROWLING,Meyer,King,Collins
```

**Selection logic:**
- If player picks a category → filter questions where that category appears in the tags → shuffle → play
- If player picks "Mix" → all questions eligible → shuffle → play
- Never repeat a question within the same run
- Difficulty tier filter still applies within category selection

**Target: ~200 questions to start**, roughly 40% easy / 40% medium / 20% hard.

## Visual Design

**Aesthetic:** Rich Kahoot-style purple + colorful answer buttons + warm gold accents.

**Color palette:**
- Primary background: `#46178F` (deep saturated Kahoot purple)
- Background variation: `#5B24A8` (slightly lighter for cards)
- Accent gold: `#F2C94C` (hearts, streak flame, celebratory highlights)
- Text primary: `#FFFFFF` (crisp white)
- Text muted: `#D9C7F0` (soft lavender-white)
- Answer button colors (for multiple choice — distinct, playful):
  - Red: `#E74C3C`
  - Blue: `#3498DB`
  - Yellow: `#F1C40F`
  - Green: `#2ECC71`
- Correct: `#2ECC71` (green)
- Wrong: `#E74C3C` (red)
- Hint/subtle: `#9B7BC7` (dusty purple)

**Typography:**
- Display font (headings, hangman letters): **Fredoka** or **Poppins Bold** — rounded, characterful, playful
- Body font: **Poppins** (400/500/600) — clean, modern, readable
- Load from Google Fonts

**Feel:** Energetic, confident, playful — like a real quiz game, not a study app. Purple should feel *rich* (like Kahoot) not *washed out*.

## Personalization

- Player's name displayed on home screen: "Hi Rameeza 👋"
- Name is stored in a JS constant at top of `game.js` for easy editing:
  ```js
  const PLAYER_NAME = "Rameeza";
  ```

## Feel & Juice (Non-Negotiable)

The following are what elevate this from "trivia app" to "actually fun game":

1. **Sound effects** on: letter tap, correct answer, wrong answer, victory, game over, streak milestone, heart lost. Short, punchy, satisfying. Preload all sounds.
2. **Haptic vibration** (via `navigator.vibrate`) on: wrong letter, wrong answer, heart lost, streak milestone.
3. **Visual celebrations:**
   - Correct: letters flip green in sequence, brief confetti burst, subtle screen flash
   - Wrong: screen shake, letter shakes red
   - Streak milestone (3, 5, 10): flame emoji grows, background pulse
   - Game over: hearts crumble, final score counts up
4. **Smooth transitions:** all screen changes use CSS transitions, no jarring cuts.
5. **Animated feedback for every tap** — buttons should visibly respond.

If any of this feels flat, the game feels dead. Prioritize these.

## PWA Requirements

- Fully installable on Android as an app icon (no browser chrome)
- Works offline after first load
- Custom app icon (purple background with a `?` mark or trivia bulb — TBD)
- Custom splash screen matching Kahoot-purple palette
- Manifest name: "Trivia Guess" (customizable)
- Theme color: `#46178F`

## APK Packaging

Once deployed to GitHub Pages, use **PWABuilder** (https://www.pwabuilder.com) to wrap the PWA URL into an Android APK. Steps documented in a separate prompt.

## Coding Conventions

- **No frameworks.** Vanilla JS. Modules if needed (`type="module"`).
- **CSS custom properties** (`--var-name`) for all colors and fonts, defined at `:root`.
- **BEM-ish class naming:** `.card`, `.card__title`, `.card--active`.
- **Semantic HTML** for accessibility.
- **All game state** in a single `state` object for easy debugging.
- **Comment the "why," not the "what."** Code should be readable enough that the "what" is obvious.
- **No external dependencies** beyond Google Fonts. Everything self-contained.
- **Mobile-first responsive.** Design for portrait phone screens first, then scale up.

## Accessibility Baseline

- Keyboard focus visible on all interactive elements
- Sufficient color contrast (WCAG AA minimum)
- `prefers-reduced-motion` respected — animations shortened/disabled
- Screen reader labels on icon-only buttons
- Sound is optional (mute button in settings)

## Out of Scope (For v1)

- Multiplayer / online features
- User accounts / login
- Backend / database
- Question editor UI (edit CSV directly)
- Achievements system (maybe v2)
- Multiple language support (English only for v1)

## Future Ideas (Post-v1)

- Achievements + badges
- Unlockable color themes at score milestones
- Weekly leaderboard (local, then maybe online)
- Question difficulty auto-adjustment based on player skill
- Additional categories on request
