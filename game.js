// ==========================================================================
// Trivia Guess — Core Game Logic
// ==========================================================================

import { loadQuestions } from "./csv-loader.js";

const PLAYER_NAME = "Rameeza";

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

// Single global state object — expanded in later prompts (run, hearts, score, etc.)
const state = {
  player: {
    bestScore: 0,
    bestStreak: 0,
  },
  questions: [],
  run: null,
  daily: null,
};

function loadStats() {
  state.player.bestScore = Number(localStorage.getItem("trivia:bestScore")) || 0;
  state.player.bestStreak = Number(localStorage.getItem("trivia:bestStreak")) || 0;
}

function todayLabel() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function renderHome() {
  loadStats();

  document.getElementById("greeting").textContent = `Hi ${PLAYER_NAME} 👋`;
  document.getElementById("best-score").textContent = state.player.bestScore;
  document.getElementById("best-streak").textContent = state.player.bestStreak;
  document.getElementById("daily-date").textContent = todayLabel();

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

function startRun(category) {
  console.log(`Starting run: ${category}`);
}

function startDailyChallenge() {
  console.log("Starting daily challenge");
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

  const dateKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) >>> 0;
  }

  return allQuestions[hash % allQuestions.length];
}

function setupEventListeners() {
  document.getElementById("mix-category").addEventListener("click", (e) => {
    startRun(e.currentTarget.dataset.category);
  });

  document.getElementById("daily-challenge").addEventListener("click", startDailyChallenge);

  document.getElementById("category-grid").addEventListener("click", (e) => {
    const card = e.target.closest(".category-card");
    if (!card) return;
    startRun(card.dataset.category);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  renderHome();
  setupEventListeners();

  state.questions = await loadQuestions();
  renderHome();
});

// Exposed for manual testing in the browser console.
window.state = state;
window.getQuestionsForCategory = getQuestionsForCategory;
window.getQuestionsForDifficulty = getQuestionsForDifficulty;
window.shuffleArray = shuffleArray;
window.getDailyChallengeQuestion = getDailyChallengeQuestion;
