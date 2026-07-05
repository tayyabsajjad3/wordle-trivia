// ==========================================================================
// Trivia Guess — Core Game Logic
// ==========================================================================

import { loadQuestions } from "./csv-loader.js";
import { sounds } from "./sounds.js";
import { haptics } from "./haptics.js";

const PLAYER_NAME = "Rameeza";

const RESCUE_FEATURE_ENABLED = false; // 👉 flip to true to re-enable rescue button

let hasPlayedWelcome = false;

const CATEGORIES = [
  { name: "Geography", emoji: "🌍" },
  { name: "Science", emoji: "🔬" },
  { name: "Movies", emoji: "🎬" },
  { name: "Animals", emoji: "🐾" },
  { name: "History", emoji: "📜" },
  { name: "Food", emoji: "🍜" },
  { name: "Music", emoji: "🎵" },
  { name: "Sports", emoji: "⚽" },
  { name: "Technology", emoji: "💻" },
  { name: "Art", emoji: "🎨" },
  { name: "Space", emoji: "🚀" },
  { name: "Literature", emoji: "📚" },
  { name: "Human Body", emoji: "🧬" },
  { name: "Famous People", emoji: "👑" },
  { name: "Nature", emoji: "🌿" },
  { name: "TV Shows", emoji: "📺" },
];

const KEYBOARD_ROWS = ["1234567890", "QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
const SYMBOL_ROW_LEFT = ["-", "'", ".", ","];
const SYMBOL_ROW_RIGHT = ["&", "#", "@", "?", "!"];
const LETTER_ATTEMPTS = 6;

// Single global state object — expanded across prompts (run, hearts, score, etc.)
const state = {
  player: {
    bestScore: 0,
    bestPeakStreak: 0,
  },
  questions: [],
  currentRun: {
    category: null,
    difficultyMode: "progressive",
    isDailyChallenge: false,
    questionsPool: [],
    usedIndices: new Set(),
    runPoints: 0,
    basePointsEarned: 0,
    streakBonusEarned: 0,
    streak: 0,
    peakStreak: 0,
    hearts: 3,
    currentQuestion: null,
    lettersLeft: LETTER_ATTEMPTS,
    wrongLetters: new Set(),
    correctLettersRevealed: new Set(),
    rescueUsed: false,
    questionsAnswered: 0,
  },
  daily: null,
};

const BASE_POINTS_BY_DIFFICULTY = { easy: 10, medium: 20, hard: 30 };
const STREAK_BONUS_PER_POINT = 5;

const DAILY_STREAK_MILESTONES = [5, 10, 25, 50, 100];

const DIFFICULTY_TIER = { easy: 0, medium: 1, hard: 2 };
const ANSWER_COLORS = ["red", "blue", "yellow", "green"];

function pickNextDifficulty(currentScore, difficultyMode) {
  switch (difficultyMode) {
    case "easy":
      return "easy";
    case "medium":
      return "medium";
    case "hard":
      return "hard";
    case "random": {
      const roll = Math.random();
      if (roll < 0.34) return "easy";
      if (roll < 0.67) return "medium";
      return "hard";
    }
    case "progressive":
    default: {
      if (currentScore < 30) return "easy";
      if (currentScore < 80) return Math.random() < 0.5 ? "easy" : "medium";
      const r = Math.random();
      if (r < 0.25) return "easy";
      if (r < 0.7) return "medium";
      return "hard";
    }
  }
}

function loadStats() {
  state.player.bestScore = Number(localStorage.getItem("trivia:bestScore")) || 0;
  state.player.bestPeakStreak = Number(localStorage.getItem("trivia:bestPeakStreak")) || 0;
}

// ---- Daily challenge date helpers (local timezone, not UTC) ----

function getLocalDateString(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getYesterdayDateString(todayStr) {
  const [y, m, d] = todayStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - 1);
  return getLocalDateString(date);
}

function dailyDateLabel(dateStr, { includeYear = true } = {}) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(
    undefined,
    includeYear ? { month: "long", day: "numeric", year: "numeric" } : { month: "long", day: "numeric" }
  );
}

function loadDailyState() {
  return {
    lastAttemptDate: localStorage.getItem("daily.lastAttemptDate"),
    lastResult: localStorage.getItem("daily.lastResult"),
    streak: Number(localStorage.getItem("daily.streak")) || 0,
    streakBeforeLoss: Number(localStorage.getItem("daily.streakBeforeLoss")) || 0,
  };
}

function renderHome() {
  loadStats();

  document.getElementById("greeting").textContent = `Hi ${PLAYER_NAME} 👋`;
  document.getElementById("best-score").textContent = state.player.bestScore;
  document.getElementById("best-streak").textContent = state.player.bestPeakStreak;

  document.getElementById("fireworks-replay-btn").style.display = isJulyFourth() ? "flex" : "none";

  renderDailyCard();

  const questionCount = document.getElementById("question-count");
  if (questionCount) {
    questionCount.textContent = `${state.questions.length} questions loaded`;
  }

  const grid = document.getElementById("category-grid");
  grid.innerHTML = "";

  CATEGORIES.forEach(({ name, emoji }) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "category-card";
    card.dataset.category = name;
    card.setAttribute("aria-label", name);
    card.innerHTML = `
      <span class="category-card__emoji" aria-hidden="true">${emoji}</span>
      <span class="category-card__label">${name}</span>
    `;
    grid.appendChild(card);
  });
}

function renderDailyCard() {
  const daily = loadDailyState();
  const todayStr = getLocalDateString();
  const card = document.getElementById("daily-challenge");
  const attemptedToday = daily.lastAttemptDate === todayStr;

  card.classList.toggle("daily-card--completed", attemptedToday);

  if (!attemptedToday) {
    const yesterdayStr = getYesterdayDateString(todayStr);
    const streakBroken =
      daily.streak > 0 &&
      daily.lastResult === "won" &&
      daily.lastAttemptDate !== todayStr &&
      daily.lastAttemptDate !== yesterdayStr;

    let streakMarkup = "";
    if (streakBroken) {
      streakMarkup = `
        <span class="daily-card__streak daily-card__streak--lost">💔 ${daily.streak}-day streak lost</span>
        <span class="daily-card__streak-sub">Start fresh today</span>
      `;
    } else if (daily.streak > 0) {
      streakMarkup = `<span class="daily-card__streak">🔥 ${daily.streak} day streak</span>`;
    }

    card.innerHTML = `
      <span class="daily-card__icon" aria-hidden="true">🏆</span>
      <span class="daily-card__text">
        <span class="daily-card__title">Daily Challenge</span>
        <span class="daily-card__date" id="daily-date">${dailyDateLabel(todayStr)}</span>
        <span class="daily-card__subtitle">2× points • Hard mode</span>
        ${streakMarkup}
      </span>
      <span class="daily-card__arrow" aria-hidden="true">→</span>
    `;
  } else {
    const won = daily.lastResult === "won";
    card.innerHTML = `
      <span class="daily-card__icon" aria-hidden="true">${won ? "✅" : "❌"}</span>
      <span class="daily-card__text">
        <span class="daily-card__title">${won ? "Completed today" : "Better luck tomorrow"}</span>
        ${won && daily.streak > 0 ? `<span class="daily-card__streak">🔥 Streak: ${daily.streak} days</span>` : ""}
        ${!won && daily.streakBeforeLoss > 0 ? `<span class="daily-card__streak daily-card__streak--broken">Streak was: ${daily.streakBeforeLoss}</span>` : ""}
        <span class="daily-card__come-back">Come back tomorrow</span>
      </span>
    `;
  }
}

// ---- Screen system ----

let currentScreen = "home";

function showScreen(name) {
  currentScreen = name;
  document.querySelectorAll(".screen").forEach((el) => {
    if (el.dataset.screen === name) {
      el.style.display = "flex";
      requestAnimationFrame(() => {
        requestAnimationFrame(() => el.classList.add("screen--active"));
      });
    } else {
      el.classList.remove("screen--active");
      setTimeout(() => {
        if (!el.classList.contains("screen--active")) el.style.display = "none";
      }, 260);
    }
  });
}

// ---- Run lifecycle ----

function startRun(category, difficultyMode) {
  const allCategoryQuestions = getQuestionsForCategory(category);
  const isFixedDifficulty = difficultyMode === "easy" || difficultyMode === "medium" || difficultyMode === "hard";
  const pool = isFixedDifficulty
    ? allCategoryQuestions.filter((q) => q.difficulty === difficultyMode)
    : allCategoryQuestions;

  if (pool.length === 0) {
    alert(`No questions available yet for "${category}". Try another category!`);
    return;
  }

  const run = state.currentRun;
  run.category = category;
  run.difficultyMode = difficultyMode;
  run.isDailyChallenge = false;
  run.questionsPool = shuffleArray(pool);
  run.usedIndices = new Set();
  run.runPoints = 0;
  run.basePointsEarned = 0;
  run.streakBonusEarned = 0;
  run.streak = 0;
  run.peakStreak = 0;
  run.hearts = 3;
  run.currentQuestion = null;
  run.questionsAnswered = 0;

  showScreen("game");
  loadNextQuestion();
}

// ---- Difficulty picker ----

let pendingCategory = null;

function openDifficultyPicker(category) {
  pendingCategory = category;
  const catInfo = CATEGORIES.find((c) => c.name === category);
  const subtitle = category === "Mix" ? "🎲 Mix" : catInfo ? `${catInfo.emoji} ${catInfo.name}` : category;
  document.getElementById("picker-subtitle").textContent = subtitle;
  document.getElementById("difficulty-picker").classList.add("overlay--active");
}

function closeDifficultyPicker() {
  document.getElementById("difficulty-picker").classList.remove("overlay--active");
  pendingCategory = null;
}

function handleDifficultyPick(mode) {
  const category = pendingCategory;
  if (!category) return;

  if (mode === "easy" || mode === "medium" || mode === "hard") {
    const pool = getQuestionsForCategory(category).filter((q) => q.difficulty === mode);
    if (pool.length === 0) {
      showToast(`No ${mode} questions in ${category}. Try Progressive or Random instead.`);
      return;
    }
  }

  closeDifficultyPicker();
  startRun(category, mode);
}

function startDailyChallenge() {
  const todayStr = getLocalDateString();
  const daily = loadDailyState();

  if (daily.lastAttemptDate === todayStr) {
    showToast("Come back tomorrow");
    return;
  }

  const question = getDailyChallengeQuestion(state.questions);
  if (!question) {
    alert("No questions available for the Daily Challenge right now.");
    return;
  }

  const run = state.currentRun;
  run.category = "Daily Challenge";
  run.isDailyChallenge = true;
  run.questionsPool = [question];
  run.usedIndices = new Set();
  run.runPoints = 0;
  run.basePointsEarned = 0;
  run.streakBonusEarned = 0;
  run.streak = 0;
  run.peakStreak = 0;
  run.hearts = 1;
  run.currentQuestion = null;
  run.rescueUsed = true;
  run.questionsAnswered = 0;

  showDailyIntroOverlay(() => {
    showScreen("game");
    loadDailyQuestion(question);
  });
}

function showDailyIntroOverlay(onDone) {
  const overlay = document.getElementById("round-end-overlay");
  const card = document.getElementById("round-end-card");
  card.innerHTML = `
    <h2 class="round-end__title round-end__title--win">🌟 Daily Challenge</h2>
    <p class="round-end__meta">2× points • One shot</p>
    <p class="round-end__meta">Good luck!</p>
  `;
  overlay.classList.add("overlay--active");

  setTimeout(() => {
    hideRoundEndOverlay();
    onDone();
  }, 1500);
}

function loadDailyQuestion(question) {
  const run = state.currentRun;
  run.currentQuestion = question;
  run.usedIndices = new Set([0]);
  renderGameScreen();
}

function handleDailyWin() {
  const run = state.currentRun;
  const todayStr = getLocalDateString();
  const yesterdayStr = getYesterdayDateString(todayStr);
  const daily = loadDailyState();

  const previousStreak = daily.streak; // what she had going in — 0 for first-ever win
  const newStreak = daily.lastAttemptDate === yesterdayStr && daily.lastResult === "won" ? daily.streak + 1 : 1;

  const base = BASE_POINTS_BY_DIFFICULTY.hard * 2; // 60
  const multiplier = 1 + previousStreak * 0.1;
  const finalPoints = Math.round(base * multiplier);

  run.runPoints += finalPoints;
  run.questionsAnswered += 1;

  localStorage.setItem("daily.lastAttemptDate", todayStr);
  localStorage.setItem("daily.lastResult", "won");
  localStorage.setItem("daily.streak", String(newStreak));
  localStorage.removeItem("daily.streakBeforeLoss");

  if (run.runPoints > state.player.bestScore) {
    state.player.bestScore = run.runPoints;
    localStorage.setItem("trivia:bestScore", String(run.runPoints));
  }

  sounds.play("correct");
  setTimeout(() => sounds.play("victory"), 200);

  const overlay = document.getElementById("round-end-overlay");
  const card = document.getElementById("round-end-card");
  card.innerHTML = `
    <div class="confetti-container" id="confetti-container"></div>
    <h2 class="round-end__title round-end__title--win">✨ Correct!</h2>
    <p class="round-end__meta">Nice work!</p>
  `;
  spawnConfetti(document.getElementById("confetti-container"));
  overlay.classList.add("overlay--active");

  setTimeout(() => {
    hideRoundEndOverlay();
    showDailyCompleteScreen(base, multiplier, finalPoints, newStreak);
  }, 1300);
}

function handleDailyLoss() {
  const run = state.currentRun;
  const todayStr = getLocalDateString();
  const daily = loadDailyState();
  const previousStreak = daily.streak;

  run.hearts -= 1;
  run.questionsAnswered += 1;
  animateHeartLoss(run.hearts, 1);

  sounds.play("heartLost");
  haptics.vibrate([100, 50, 100]);

  localStorage.setItem("daily.lastAttemptDate", todayStr);
  localStorage.setItem("daily.lastResult", "lost");
  localStorage.setItem("daily.streak", "0");
  if (previousStreak > 0) {
    localStorage.setItem("daily.streakBeforeLoss", String(previousStreak));
  } else {
    localStorage.removeItem("daily.streakBeforeLoss");
  }

  setTimeout(() => {
    showDailyFailedScreen(run.currentQuestion.answer, previousStreak);
  }, 600);
}

function showDailyCompleteScreen(base, multiplier, finalPoints, newStreak) {
  showScreen("dailyResult");
  const card = document.getElementById("daily-result-card");
  const isMilestone = DAILY_STREAK_MILESTONES.includes(newStreak);

  card.innerHTML = `
    <h2 class="daily-result__title daily-result__title--win">🎉 Daily Challenge Complete!</h2>
    <p class="daily-result__line">Base: +${base}</p>
    <p class="daily-result__line">Daily Streak Bonus: × ${multiplier.toFixed(1)}</p>
    <div class="daily-result__divider"></div>
    <p class="daily-result__points" id="daily-result-points">+0 points</p>
    <p class="daily-result__streak">🔥 Daily Streak: ${newStreak} day${newStreak === 1 ? "" : "s"}</p>
    ${isMilestone ? `<p class="daily-result__milestone">Amazing! 🎊</p>` : ""}
    <button class="daily-result__home-btn" id="daily-result-home-btn" type="button">🏠 Home</button>
  `;

  animateCountUp(document.getElementById("daily-result-points"), finalPoints, "+", " points");
  document.getElementById("daily-result-home-btn").addEventListener("click", () => {
    showScreen("home");
    renderHome();
  });
}

function showDailyFailedScreen(answer, streakBeforeLoss) {
  showScreen("dailyResult");
  const card = document.getElementById("daily-result-card");

  card.innerHTML = `
    <h2 class="daily-result__title daily-result__title--loss">😔 Better luck tomorrow</h2>
    <p class="daily-result__answer-label">The answer was:</p>
    <p class="daily-result__answer">${answer}</p>
    ${
      streakBeforeLoss > 0
        ? `<p class="daily-result__streak-broken">Your streak of ${streakBeforeLoss} day${
            streakBeforeLoss === 1 ? "" : "s"
          } ended</p>`
        : ""
    }
    <button class="daily-result__home-btn" id="daily-result-home-btn" type="button">🏠 Home</button>
  `;

  document.getElementById("daily-result-home-btn").addEventListener("click", () => {
    showScreen("home");
    renderHome();
  });
}

function loadNextQuestion() {
  const run = state.currentRun;

  if (run.usedIndices.size >= run.questionsPool.length) {
    run.questionsPool = shuffleArray(run.questionsPool);
    run.usedIndices = new Set();
  }

  const isFixedDifficulty =
    run.difficultyMode === "easy" || run.difficultyMode === "medium" || run.difficultyMode === "hard";

  let nextIndex = -1;

  if (isFixedDifficulty) {
    // Pool is already homogeneous (pre-filtered in startRun) — just walk the
    // shuffled order and take the next unused entry.
    for (let i = 0; i < run.questionsPool.length; i++) {
      if (!run.usedIndices.has(i)) {
        nextIndex = i;
        break;
      }
    }
  } else {
    // Progressive/random: roll a difficulty, then find the next unused
    // question matching it in shuffled order.
    const targetDifficulty = pickNextDifficulty(run.runPoints, run.difficultyMode);
    for (let i = 0; i < run.questionsPool.length; i++) {
      if (!run.usedIndices.has(i) && run.questionsPool[i].difficulty === targetDifficulty) {
        nextIndex = i;
        break;
      }
    }
    if (nextIndex === -1) {
      // No unused question left at the rolled difficulty — fall back to any unused one.
      for (let i = 0; i < run.questionsPool.length; i++) {
        if (!run.usedIndices.has(i)) {
          nextIndex = i;
          break;
        }
      }
    }
  }

  if (nextIndex === -1) nextIndex = 0;
  run.usedIndices.add(nextIndex);

  const previousDifficulty = run.currentQuestion ? run.currentQuestion.difficulty : null;

  run.currentQuestion = run.questionsPool[nextIndex];
  run.lettersLeft = LETTER_ATTEMPTS;
  run.wrongLetters = new Set();
  run.correctLettersRevealed = new Set();
  run.rescueUsed = false;

  renderGameScreen();

  if (
    run.difficultyMode === "progressive" &&
    previousDifficulty !== null &&
    DIFFICULTY_TIER[run.currentQuestion.difficulty] > DIFFICULTY_TIER[previousDifficulty]
  ) {
    showLevelUpToast();
  }
}

function showToast(message) {
  const toast = document.getElementById("level-up-toast");
  toast.textContent = message;
  toast.classList.add("level-up-toast--active");
  setTimeout(() => toast.classList.remove("level-up-toast--active"), 1500);
}

function showLevelUpToast() {
  showToast("⬆ Level up!");
}

function abandonDailyChallenge() {
  const todayStr = getLocalDateString();
  const daily = loadDailyState();

  localStorage.setItem("daily.lastAttemptDate", todayStr);
  localStorage.setItem("daily.lastResult", "lost");
  localStorage.setItem("daily.streak", "0");
  if (daily.streak > 0) {
    localStorage.setItem("daily.streakBeforeLoss", String(daily.streak));
  } else {
    localStorage.removeItem("daily.streakBeforeLoss");
  }
}

function quitToHome() {
  const run = state.currentRun;

  if (run.isDailyChallenge) {
    if (confirm("Abandon daily challenge? You won't be able to retry until tomorrow.")) {
      abandonDailyChallenge();
      hideRoundEndOverlay();
      document.getElementById("rescue-overlay").classList.remove("overlay--active");
      showScreen("home");
      renderHome();
    }
    return;
  }

  if (confirm("Leave this game?\n\nYou'll see your score so far, then head back home.")) {
    hideRoundEndOverlay();
    document.getElementById("rescue-overlay").classList.remove("overlay--active");
    handleGameOver({ leftEarly: true });
  }
}

// ---- Game screen rendering ----

function answerLetterPositions(answer) {
  const positions = [];
  for (let i = 0; i < answer.length; i++) {
    if (answer[i] !== " ") positions.push(i);
  }
  return positions;
}

function renderAnswerBoxes(answer, revealedSet) {
  const container = document.getElementById("answer-boxes");
  container.innerHTML = "";

  [...answer].forEach((ch, i) => {
    if (ch === " ") {
      const gap = document.createElement("span");
      gap.className = "answer-gap";
      container.appendChild(gap);
      return;
    }

    const box = document.createElement("span");
    box.className = "letter-box";
    box.dataset.index = String(i);
    if (revealedSet.has(i)) {
      box.textContent = ch;
      box.classList.add("letter-box--revealed");
    }
    container.appendChild(box);
  });
}

function buildKeyboard() {
  const container = document.getElementById("keyboard");
  container.innerHTML = "";

  KEYBOARD_ROWS.forEach((rowLetters) => {
    const row = document.createElement("div");
    row.className = "keyboard__row";

    [...rowLetters].forEach((letter) => {
      const key = document.createElement("button");
      key.type = "button";
      key.className = "key";
      key.textContent = letter;
      key.dataset.letter = letter;
      key.addEventListener("click", () => handleKeyPress(letter));
      row.appendChild(key);
    });

    container.appendChild(row);
  });

  // Symbol row: covers the punctuation that real answers use (SPIDER-MAN,
  // HADRIAN'S WALL, E.T., R&B, C#), with a wide spacebar centered between
  // the two symbol clusters.
  const symbolRow = document.createElement("div");
  symbolRow.className = "keyboard__row keyboard__row--symbols";

  const appendSymbolKey = (symbol) => {
    const key = document.createElement("button");
    key.type = "button";
    key.className = "key key--symbol";
    key.textContent = symbol;
    key.dataset.letter = symbol;
    key.addEventListener("click", () => handleKeyPress(symbol));
    symbolRow.appendChild(key);
  };

  SYMBOL_ROW_LEFT.forEach(appendSymbolKey);

  const spaceKey = document.createElement("button");
  spaceKey.type = "button";
  spaceKey.className = "key key--symbol key--space";
  spaceKey.textContent = "SPACE";
  spaceKey.dataset.letter = " ";
  spaceKey.addEventListener("click", () => handleKeyPress(" "));
  symbolRow.appendChild(spaceKey);

  SYMBOL_ROW_RIGHT.forEach(appendSymbolKey);

  container.appendChild(symbolRow);
}

function renderHearts(hearts, maxHearts = 3) {
  const container = document.getElementById("hearts-display");
  container.innerHTML = "";
  for (let i = 0; i < maxHearts; i++) {
    const span = document.createElement("span");
    span.className = "heart";
    span.textContent = i < hearts ? "❤️" : "🤍";
    container.appendChild(span);
  }
}

function updateScoreStreakDisplay() {
  const run = state.currentRun;
  document.getElementById("score-value").textContent = run.runPoints;

  const streakDisplay = document.getElementById("streak-display");
  if (run.isDailyChallenge || run.streak <= 0) {
    streakDisplay.style.display = "none";
  } else {
    streakDisplay.style.display = "flex";
    document.getElementById("streak-value").textContent = run.streak;
  }
}

function renderTopBar() {
  const run = state.currentRun;
  renderHearts(run.hearts, run.isDailyChallenge ? 1 : 3);
  updateScoreStreakDisplay();
}

function updateLettersLeftDisplay() {
  document.getElementById("letters-left").textContent = `Letters left: ${state.currentRun.lettersLeft}`;
}

function renderDifficultyBadge(difficulty) {
  const badge = document.getElementById("difficulty-badge");
  if (difficulty === "daily") {
    badge.textContent = "🌟 DAILY";
    badge.className = "difficulty-badge difficulty-badge--daily";
    return;
  }
  badge.textContent = difficulty.toUpperCase();
  badge.className = `difficulty-badge difficulty-badge--${difficulty}`;
}

function syncKeyboardState() {
  const run = state.currentRun;
  const answer = run.currentQuestion.answer;

  // Correct keys stay enabled/re-pressable — a letter can appear more than
  // once, so finding one occurrence shouldn't block tapping it again.
  run.correctLettersRevealed.forEach((pos) => {
    const letter = answer[pos];
    const keyBtn = document.querySelector(`.key[data-letter="${letter}"]`);
    if (keyBtn) {
      keyBtn.classList.add("key--correct");
    }
  });

  run.wrongLetters.forEach((letter) => {
    const keyBtn = document.querySelector(`.key[data-letter="${letter}"]`);
    if (keyBtn) {
      keyBtn.classList.add("key--wrong");
      keyBtn.disabled = true;
    }
  });
}

// ---- Multiple choice (hard rounds + rescue modal) ----

function createOptionButtons(options, correctAnswer, onSelect) {
  const shuffledOptions = shuffleArray(options);
  const shuffledColors = shuffleArray(ANSWER_COLORS);

  const wrapper = document.createElement("div");
  wrapper.className = "mc-grid";

  shuffledOptions.forEach((optionText, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `mc-option mc-option--${shuffledColors[i % shuffledColors.length]}`;
    btn.textContent = optionText;
    btn.dataset.correct = String(optionText === correctAnswer);
    btn.addEventListener("click", () => onSelect(btn, optionText === correctAnswer, wrapper));
    wrapper.appendChild(btn);
  });

  return wrapper;
}

function getRescueDistractors(question) {
  const seen = new Set([question.answer]);
  const distractors = [];

  const sameCategory = shuffleArray(
    state.questions.filter(
      (other) => other !== question && other.categories.some((c) => question.categories.includes(c))
    )
  );
  const anyOther = shuffleArray(state.questions.filter((other) => other !== question));

  for (const pool of [sameCategory, anyOther]) {
    for (const cand of pool) {
      if (distractors.length >= 3) break;
      if (seen.has(cand.answer)) continue;
      seen.add(cand.answer);
      distractors.push(cand.answer);
    }
    if (distractors.length >= 3) break;
  }

  return distractors;
}

function handleMultipleChoiceAnswer(btnEl, isCorrect, wrapperEl) {
  sounds.play("click");
  wrapperEl.querySelectorAll(".mc-option").forEach((b) => (b.disabled = true));

  const run = state.currentRun;

  if (isCorrect) {
    btnEl.classList.add("mc-option--selected-correct");
    if (run.isDailyChallenge) {
      handleDailyWin();
    } else {
      handleRoundWin();
    }
    return;
  }

  btnEl.classList.add("mc-option--selected-wrong");
  sounds.play("wrong");
  haptics.vibrate(60);

  const correctBtn = [...wrapperEl.querySelectorAll(".mc-option")].find((b) => b.dataset.correct === "true");
  if (correctBtn) correctBtn.classList.add("mc-option--reveal-correct");

  setTimeout(() => {
    if (run.isDailyChallenge) {
      handleDailyLoss();
    } else {
      handleRoundLoss();
    }
  }, 800);
}

function renderMultipleChoice(q) {
  const container = document.getElementById("mc-options");
  container.innerHTML = "";

  const options = q.options && q.options.length === 4 ? q.options : [q.answer, ...getRescueDistractors(q)];
  const grid = createOptionButtons(options, q.answer, handleMultipleChoiceAnswer);
  container.appendChild(grid);
}

function showRescueOptions() {
  if (!RESCUE_FEATURE_ENABLED) return;

  const run = state.currentRun;
  if (run.currentQuestion.difficulty === "hard") return;
  if (run.rescueUsed) return;
  if (run.lettersLeft < 2) return;

  sounds.play("click");

  run.rescueUsed = true;
  run.lettersLeft = Math.max(0, run.lettersLeft - 2);
  updateLettersLeftDisplay();

  const showOptionsBtn = document.getElementById("show-options-btn");
  showOptionsBtn.disabled = true;

  const q = run.currentQuestion;
  const options = [q.answer, ...getRescueDistractors(q)];

  const overlay = document.getElementById("rescue-overlay");
  const card = document.getElementById("rescue-card");
  card.innerHTML = '<h2 class="round-end__title round-end__title--rescue">💡 Show options</h2>';

  const grid = createOptionButtons(options, q.answer, (btnEl, isCorrect, wrapperEl) => {
    sounds.play("click");
    wrapperEl.querySelectorAll(".mc-option").forEach((b) => (b.disabled = true));
    btnEl.classList.add(isCorrect ? "mc-option--selected-correct" : "mc-option--selected-wrong");

    if (!isCorrect) {
      sounds.play("wrong");
      haptics.vibrate(60);
    }

    setTimeout(() => {
      overlay.classList.remove("overlay--active");
      card.innerHTML = "";
      if (isCorrect) {
        handleRoundWin({ wasRescued: true });
      } else {
        handleRoundLoss();
      }
    }, 350);
  });

  card.appendChild(grid);
  overlay.classList.add("overlay--active");
}

function renderGameScreen() {
  const run = state.currentRun;
  const q = run.currentQuestion;

  if (run.isDailyChallenge) {
    document.getElementById("game-category-label").textContent = `🌟 Daily Challenge — ${dailyDateLabel(
      getLocalDateString(),
      { includeYear: false }
    )}`;
    renderDifficultyBadge("daily");
  } else {
    const catInfo = CATEGORIES.find((c) => q.categories.includes(c.name));
    const label = catInfo ? `${catInfo.emoji} ${catInfo.name}` : run.category === "Mix" ? "🎲 Mix" : run.category;
    document.getElementById("game-category-label").textContent = label;
    renderDifficultyBadge(q.difficulty);
  }
  document.getElementById("clue-text").textContent = q.clue;
  renderTopBar();

  const answerBoxesEl = document.getElementById("answer-boxes");
  const lettersLeftEl = document.getElementById("letters-left");
  const keyboardEl = document.getElementById("keyboard");
  const showOptionsBtn = document.getElementById("show-options-btn");
  const mcOptionsEl = document.getElementById("mc-options");

  const useMultipleChoice = q.difficulty === "hard" || run.isDailyChallenge;

  if (useMultipleChoice) {
    answerBoxesEl.style.display = "none";
    lettersLeftEl.style.display = "none";
    keyboardEl.style.display = "none";
    showOptionsBtn.style.display = "none";
    answerBoxesEl.innerHTML = "";
    keyboardEl.innerHTML = "";

    mcOptionsEl.style.display = "grid";
    renderMultipleChoice(q);
  } else {
    mcOptionsEl.style.display = "none";
    mcOptionsEl.innerHTML = "";

    answerBoxesEl.style.display = "flex";
    lettersLeftEl.style.display = "block";
    keyboardEl.style.display = "flex";
    showOptionsBtn.style.display = RESCUE_FEATURE_ENABLED ? "inline-block" : "none";
    showOptionsBtn.disabled = false;

    if (q.difficulty === "medium") {
      const firstPos = answerLetterPositions(q.answer)[0];
      if (firstPos !== undefined) {
        run.correctLettersRevealed.add(firstPos);
      }
    }

    renderAnswerBoxes(q.answer, run.correctLettersRevealed);
    updateLettersLeftDisplay();
    buildKeyboard();
    syncKeyboardState();
  }
}

// ---- Letter guessing ----

function triggerShake() {
  const el = document.getElementById("game-middle");
  el.classList.remove("shake");
  void el.offsetWidth; // force reflow so the animation can restart
  el.classList.add("shake");
  setTimeout(() => el.classList.remove("shake"), 400);
}

function revealLetterBox(pos) {
  const answer = state.currentRun.currentQuestion.answer;
  const box = document.querySelector(`.letter-box[data-index="${pos}"]`);
  if (!box) return;
  box.textContent = answer[pos];
  box.classList.add("letter-box--revealed");
}

function flashKeyGreen(keyBtn) {
  if (!keyBtn) return;
  keyBtn.classList.add("key--correct", "key--correct-flash");
  setTimeout(() => keyBtn.classList.remove("key--correct-flash", "key--correct"), 200);
}

function handleKeyPress(letter) {
  const run = state.currentRun;
  if (run.wrongLetters.has(letter)) return;

  const keyBtn = document.querySelector(`.key[data-letter="${letter}"]`);
  const answer = run.currentQuestion.answer;

  const positionsForLetter = [];
  for (let i = 0; i < answer.length; i++) {
    if (answer[i] === letter) positionsForLetter.push(i);
  }

  if (positionsForLetter.length === 0) {
    // Wrong letter — not in the word at all. Permanently greys out.
    sounds.play("click");
    run.wrongLetters.add(letter);
    run.lettersLeft -= 1;
    if (keyBtn) {
      keyBtn.classList.add("key--wrong");
      keyBtn.disabled = true;
    }
    triggerShake();
    sounds.play("wrong");
    haptics.vibrate(60);
    updateLettersLeftDisplay();

    if (run.lettersLeft <= 0) {
      setTimeout(() => handleRoundLoss(), 300);
    }
    return;
  }

  // Letter is in the answer — fill only the next unrevealed occurrence.
  const nextPos = positionsForLetter.find((p) => !run.correctLettersRevealed.has(p));

  sounds.play("click");

  if (nextPos === undefined) {
    // Every occurrence of this letter is already revealed. Still a correct
    // letter overall, so the key stays enabled/pressable and never greys
    // out — but tapping it again wastes a guess, so it costs a life same
    // as a wrong letter.
    run.lettersLeft -= 1;
    triggerShake();
    sounds.play("wrong");
    haptics.vibrate(60);
    updateLettersLeftDisplay();

    if (run.lettersLeft <= 0) {
      setTimeout(() => handleRoundLoss(), 300);
    }
    return;
  }

  run.correctLettersRevealed.add(nextPos);
  revealLetterBox(nextPos);
  flashKeyGreen(keyBtn);

  const required = answerLetterPositions(answer);
  const isWin = required.every((i) => run.correctLettersRevealed.has(i));
  if (isWin) {
    setTimeout(() => handleRoundWin(), 400);
  }
}

// ---- Round outcomes ----

function animateCountUp(el, target, prefix = "", suffix = "") {
  const duration = 500;
  const start = performance.now();

  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    const value = Math.round(target * t);
    el.textContent = `${prefix}${value}${suffix}`;
    if (t < 1) requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

function spawnConfetti(container) {
  if (!container) return;
  const colors = ["#F2C94C", "#E74C3C", "#3498DB", "#2ECC71", "#F1C40F"];

  for (let i = 0; i < 26; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = `${Math.random() * 0.3}s`;
    piece.style.animationDuration = `${0.9 + Math.random() * 0.6}s`;
    container.appendChild(piece);
  }
}

function showRoundEndOverlay({ type, base, streakBonus, roundPoints, answer, heartsLeft }) {
  const overlay = document.getElementById("round-end-overlay");
  const card = document.getElementById("round-end-card");
  const run = state.currentRun;

  if (type === "win") {
    card.innerHTML = `
      <div class="confetti-container" id="confetti-container"></div>
      <h2 class="round-end__title round-end__title--win">✨ Correct! ✨</h2>
      <p class="round-end__answer">${answer}</p>
      <div class="round-end__breakdown">
        <div class="round-end__breakdown-row"><span>Base</span><span>+${base}</span></div>
        <div class="round-end__breakdown-row"><span>Streak bonus 🔥</span><span>+${streakBonus}</span></div>
        <div class="round-end__breakdown-divider"></div>
        <div class="round-end__breakdown-row round-end__breakdown-row--total"><span>Round Points</span><span id="round-end-points">+0</span></div>
      </div>
      <p class="round-end__meta">Score: ${run.runPoints}</p>
    `;
    animateCountUp(document.getElementById("round-end-points"), roundPoints, "+");
    spawnConfetti(document.getElementById("confetti-container"));
  } else {
    const heartsMarkup = "❤️".repeat(heartsLeft) + "🤍".repeat(3 - heartsLeft);
    card.innerHTML = `
      <h2 class="round-end__title round-end__title--loss">😔 Not this time</h2>
      <p class="round-end__answer-label">The answer was:</p>
      <p class="round-end__answer">${answer}</p>
      <p class="round-end__meta">Hearts remaining: ${heartsMarkup}</p>
    `;
  }

  overlay.classList.add("overlay--active");
}

function hideRoundEndOverlay() {
  const overlay = document.getElementById("round-end-overlay");
  overlay.classList.remove("overlay--active");
  document.getElementById("round-end-card").innerHTML = "";
}

function handleRoundWin({ wasRescued = false } = {}) {
  const run = state.currentRun;
  const difficulty = run.currentQuestion.difficulty;

  let base = BASE_POINTS_BY_DIFFICULTY[difficulty] ?? BASE_POINTS_BY_DIFFICULTY.easy;
  if (wasRescued) base = base / 2;

  run.streak += 1;
  run.peakStreak = Math.max(run.peakStreak, run.streak);

  const streakBonus = run.streak * STREAK_BONUS_PER_POINT;
  const roundPoints = base + streakBonus;

  run.basePointsEarned += base;
  run.streakBonusEarned += streakBonus;
  run.runPoints += roundPoints;
  run.questionsAnswered += 1;

  renderTopBar();
  showRoundEndOverlay({ type: "win", base, streakBonus, roundPoints, answer: run.currentQuestion.answer });

  sounds.play("correct");
  setTimeout(() => sounds.play("victory"), 200);

  if (run.streak === 3 || run.streak === 5 || run.streak === 10) {
    haptics.vibrate([50, 30, 50]);
  }

  setTimeout(() => {
    hideRoundEndOverlay();
    loadNextQuestion();
  }, 1500);
}

function revealAnswerInRed() {
  const run = state.currentRun;
  const answer = run.currentQuestion.answer;

  answerLetterPositions(answer).forEach((i) => {
    if (run.correctLettersRevealed.has(i)) return;
    const box = document.querySelector(`.letter-box[data-index="${i}"]`);
    if (!box) return;
    box.textContent = answer[i];
    box.classList.add("letter-box--wrong-reveal");
  });
}

function animateHeartLoss(heartsRemaining, maxHearts = 3) {
  const container = document.getElementById("hearts-display");
  const heartEls = container.querySelectorAll(".heart");
  const losingHeart = heartEls[heartsRemaining];
  if (losingHeart) {
    losingHeart.classList.add("heart--crumble");
    setTimeout(() => renderHearts(heartsRemaining, maxHearts), 500);
  } else {
    renderHearts(heartsRemaining, maxHearts);
  }
}

function handleRoundLoss() {
  const run = state.currentRun;

  revealAnswerInRed();
  run.streak = 0;
  run.hearts -= 1;
  run.questionsAnswered += 1;

  animateHeartLoss(run.hearts);
  updateScoreStreakDisplay();

  sounds.play("heartLost");
  haptics.vibrate([100, 50, 100]);

  showRoundEndOverlay({ type: "loss", answer: run.currentQuestion.answer, heartsLeft: run.hearts });

  setTimeout(() => {
    hideRoundEndOverlay();
    if (run.hearts > 0) {
      loadNextQuestion();
    } else {
      handleGameOver();
    }
  }, 2000);
}

function handleGameOver({ leftEarly = false } = {}) {
  const run = state.currentRun;

  showScreen("gameOver");
  document.getElementById("game-over-heading").textContent = leftEarly ? "👋 See you soon!" : "🎮 Game Over";
  sounds.play("gameOver");
  haptics.vibrate([200, 100, 200]);

  const daily = loadDailyState();
  const dailyStreak = daily.streak;
  const dailyMultiplier = 1 + dailyStreak * 0.1;
  const finalScore = Math.round(run.runPoints * dailyMultiplier);

  const prevBest = state.player.bestScore;
  const isNewBest = finalScore > prevBest;

  const statsEl = document.getElementById("game-over-stats");
  statsEl.innerHTML = `
    <p class="game-over-line">Questions Answered: ${run.questionsAnswered}</p>
    <p class="game-over-line">Best Streak This Run: 🔥 ${run.peakStreak}</p>
    <div class="game-over-divider"></div>
    <p class="game-over-line game-over-line--muted">Points breakdown</p>
    <p class="game-over-line">Base points earned: ${run.basePointsEarned}</p>
    <p class="game-over-line">Streak bonuses earned: ${run.streakBonusEarned}</p>
    <div class="game-over-divider"></div>
    <p class="game-over-line game-over-line--sub">Run Points: ${run.runPoints}</p>
    <p class="game-over-line">Daily Streak: 🔥 ${dailyStreak} days</p>
    <p class="game-over-line">Daily Bonus: × ${dailyMultiplier.toFixed(1)}</p>
    <div class="game-over-divider"></div>
    <p class="game-over-line--label">Final Score</p>
    <div class="final-score" id="final-score">0</div>
    ${isNewBest ? `<p class="game-over-new-best">🏆 New Personal Best! (Previous: ${prevBest})</p>` : ""}
  `;

  animateCountUp(document.getElementById("final-score"), finalScore);

  if (isNewBest) {
    state.player.bestScore = finalScore;
    localStorage.setItem("trivia:bestScore", String(finalScore));
  }

  if (run.peakStreak > state.player.bestPeakStreak) {
    state.player.bestPeakStreak = run.peakStreak;
    localStorage.setItem("trivia:bestPeakStreak", String(run.peakStreak));
  }
}

// ---- Question helpers ----

function getQuestionsForCategory(categoryName) {
  if (categoryName === "Mix") return state.questions;
  return state.questions.filter((q) => q.categories.includes(categoryName));
}

function getQuestionsForDifficulty(questions, difficulty) {
  return questions.filter((q) => q.difficulty === difficulty);
}

function shuffleArray(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getDailyChallengeQuestion(allQuestions) {
  if (allQuestions.length === 0) return null;

  let pool = allQuestions.filter((q) => q.difficulty === "hard");
  if (pool.length === 0) {
    console.warn("getDailyChallengeQuestion: no hard questions available, falling back to any difficulty");
    pool = allQuestions;
  }

  const dateKey = getLocalDateString(); // local date, so it's stable within the same calendar day
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) >>> 0;
  }

  return pool[hash % pool.length];
}

function setupEventListeners() {
  document.getElementById("mix-category").addEventListener("click", (e) => {
    openDifficultyPicker(e.currentTarget.dataset.category);
  });

  document.getElementById("daily-challenge").addEventListener("click", startDailyChallenge);

  document.getElementById("category-grid").addEventListener("click", (e) => {
    const card = e.target.closest(".category-card");
    if (!card) return;
    openDifficultyPicker(card.dataset.category);
  });

  document.getElementById("picker-close-btn").addEventListener("click", closeDifficultyPicker);

  document.getElementById("difficulty-picker").addEventListener("click", (e) => {
    if (e.target.id === "difficulty-picker") closeDifficultyPicker();
  });

  document.getElementById("picker-options").addEventListener("click", (e) => {
    const btn = e.target.closest(".picker-option");
    if (!btn) return;
    handleDifficultyPick(btn.dataset.mode);
  });

  document.getElementById("back-to-home").addEventListener("click", quitToHome);

  document.getElementById("show-options-btn").addEventListener("click", showRescueOptions);

  document.getElementById("play-again-btn").addEventListener("click", () => {
    startRun(state.currentRun.category, state.currentRun.difficultyMode);
  });

  document.getElementById("go-home-btn").addEventListener("click", () => {
    showScreen("home");
    renderHome();
  });

  document.getElementById("settings-btn").addEventListener("click", () => {
    showScreen("settings");
  });

  document.getElementById("settings-back-btn").addEventListener("click", () => {
    showScreen("home");
  });

  document.getElementById("how-to-play-btn").addEventListener("click", () => {
    showScreen("howToPlay");
  });

  document.getElementById("htp-back-btn").addEventListener("click", () => {
    showScreen("home");
  });

  document.getElementById("fireworks-replay-btn").addEventListener("click", () => {
    showBirthdayFireworks();
  });

  const muteToggle = document.getElementById("mute-toggle");
  const volumeSlider = document.getElementById("volume-slider");
  const hapticsToggle = document.getElementById("haptics-toggle");
  const testSoundBtn = document.getElementById("test-sound-btn");

  muteToggle.checked = sounds.isMuted();
  volumeSlider.value = Math.round(sounds.getVolume() * 100);
  volumeSlider.disabled = sounds.isMuted();
  hapticsToggle.checked = haptics.isEnabled();

  muteToggle.addEventListener("change", () => {
    sounds.setMuted(muteToggle.checked);
    volumeSlider.disabled = muteToggle.checked;
  });

  volumeSlider.addEventListener("input", () => {
    sounds.setVolume(Number(volumeSlider.value) / 100);
  });

  hapticsToggle.addEventListener("change", () => {
    haptics.setEnabled(hapticsToggle.checked);
  });

  testSoundBtn.addEventListener("click", () => {
    sounds.play("click");
  });
}

// ---- Birthday fireworks (July 4th special event) ----

function isJulyFourth(date = new Date()) {
  return date.getMonth() === 6 && date.getDate() === 4;
}

let fireworksCtx = null;
let fireworksParticles = [];
let fireworksRafId = null;
let fireworksSpawnInterval = null;
let fireworksAutoAdvanceTimer = null;

function spawnFireworksBurst(canvas) {
  const colors = ["#F2C94C", "#E74C3C", "#3498DB", "#2ECC71", "#F1C40F", "#ffffff"];
  const x = Math.random() * canvas.width;
  const y = canvas.height * (0.25 + Math.random() * 0.35);
  const color = colors[Math.floor(Math.random() * colors.length)];
  const count = 28;

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;
    const speed = 1.5 + Math.random() * 2.5;
    fireworksParticles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      color,
    });
  }
}

function startFireworksAnimation() {
  const canvas = document.getElementById("fireworks-canvas");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  fireworksCtx = canvas.getContext("2d");
  fireworksParticles = [];

  spawnFireworksBurst(canvas);
  fireworksSpawnInterval = setInterval(() => spawnFireworksBurst(canvas), 600);

  function frame() {
    fireworksCtx.clearRect(0, 0, canvas.width, canvas.height);
    fireworksParticles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.03;
      p.life -= 0.015;
      fireworksCtx.globalAlpha = Math.max(p.life, 0);
      fireworksCtx.fillStyle = p.color;
      fireworksCtx.beginPath();
      fireworksCtx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      fireworksCtx.fill();
    });
    fireworksCtx.globalAlpha = 1;
    fireworksParticles = fireworksParticles.filter((p) => p.life > 0);
    fireworksRafId = requestAnimationFrame(frame);
  }
  frame();
}

function stopFireworksAnimation() {
  if (fireworksRafId) cancelAnimationFrame(fireworksRafId);
  if (fireworksSpawnInterval) clearInterval(fireworksSpawnInterval);
  fireworksRafId = null;
  fireworksSpawnInterval = null;
  fireworksParticles = [];
  if (fireworksCtx) {
    fireworksCtx.clearRect(0, 0, fireworksCtx.canvas.width, fireworksCtx.canvas.height);
  }
}

function showBirthdayFireworks(onDone) {
  if (fireworksAutoAdvanceTimer) clearTimeout(fireworksAutoAdvanceTimer);
  stopFireworksAnimation();

  const screen = document.getElementById("fireworks-screen");
  screen.classList.add("fireworks-screen--active");

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reducedMotion) {
    startFireworksAnimation();
  }

  sounds.play("victory");

  const finish = () => {
    clearTimeout(fireworksAutoAdvanceTimer);
    fireworksAutoAdvanceTimer = null;
    hideBirthdayFireworks();
    if (onDone) onDone();
  };

  document.getElementById("fireworks-continue-btn").addEventListener("click", finish, { once: true });
  fireworksAutoAdvanceTimer = setTimeout(finish, 5000);
}

function hideBirthdayFireworks() {
  document.getElementById("fireworks-screen").classList.remove("fireworks-screen--active");
  stopFireworksAnimation();
}

document.addEventListener("DOMContentLoaded", async () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch((err) => console.warn("SW registration failed:", err));
  }

  sounds.init();

  renderHome();
  setupEventListeners();

  state.questions = await loadQuestions();
  renderHome();

  if (isJulyFourth()) {
    showBirthdayFireworks(() => attemptWelcomeJingle());
  } else {
    attemptWelcomeJingle();
  }
});

// Two-tier welcome jingle: try to play immediately (works unprompted in
// installed PWAs/APKs); if the browser blocks autoplay before any user
// gesture, fall back to playing on the first tap anywhere on the page.
function attemptWelcomeJingle() {
  sounds
    .play("welcome")
    .then(() => {
      hasPlayedWelcome = true;
    })
    .catch(() => {
      document.addEventListener("pointerdown", handleFirstPointerdown, { once: true });
    });
}

function handleFirstPointerdown() {
  if (hasPlayedWelcome || currentScreen !== "home") return;

  sounds
    .play("welcome")
    .then(() => {
      hasPlayedWelcome = true;
    })
    .catch(() => {
      hasPlayedWelcome = true; // give up quietly rather than nagging on every tap
    });
}

// Exposed for manual testing in the browser console.
window.state = state;
window.getQuestionsForCategory = getQuestionsForCategory;
window.getQuestionsForDifficulty = getQuestionsForDifficulty;
window.shuffleArray = shuffleArray;
window.getDailyChallengeQuestion = getDailyChallengeQuestion;
window.startRun = startRun;
window.handleKeyPress = handleKeyPress;
window.showScreen = showScreen;
window.pickNextDifficulty = pickNextDifficulty;
window.showRescueOptions = showRescueOptions;
window.getRescueDistractors = getRescueDistractors;
window.loadNextQuestion = loadNextQuestion;
window.renderGameScreen = renderGameScreen;
window.handleRoundWin = handleRoundWin;
window.handleRoundLoss = handleRoundLoss;
window.sounds = sounds;
window.haptics = haptics;
window.startDailyChallenge = startDailyChallenge;
window.getLocalDateString = getLocalDateString;
window.getYesterdayDateString = getYesterdayDateString;
window.loadDailyState = loadDailyState;
window.renderDailyCard = renderDailyCard;
window.renderHome = renderHome;
window.handleDailyWin = handleDailyWin;
window.handleDailyLoss = handleDailyLoss;
window.quitToHome = quitToHome;
window.handleGameOver = handleGameOver;
window.openDifficultyPicker = openDifficultyPicker;
window.closeDifficultyPicker = closeDifficultyPicker;
window.handleDifficultyPick = handleDifficultyPick;
window.isJulyFourth = isJulyFourth;
window.showBirthdayFireworks = showBirthdayFireworks;
window.hideBirthdayFireworks = hideBirthdayFireworks;
