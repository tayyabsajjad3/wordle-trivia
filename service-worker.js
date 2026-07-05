const CACHE_NAME = "rameezas-trivia-v7";

// Deployed to GitHub Pages at https://tayyabsajjad3.github.io/wordle-trivia/,
// so every cached path is prefixed with the /wordle-trivia/ project subdirectory.
const ASSETS_TO_CACHE = [
  "/wordle-trivia/",
  "/wordle-trivia/index.html",
  "/wordle-trivia/style.css",
  "/wordle-trivia/game.js",
  "/wordle-trivia/csv-loader.js",
  "/wordle-trivia/sounds.js",
  "/wordle-trivia/haptics.js",
  "/wordle-trivia/questions.csv",
  "/wordle-trivia/manifest.json",
  "/wordle-trivia/assets/icons/icon-192.png",
  "/wordle-trivia/assets/icons/icon-512.png",
  "/wordle-trivia/assets/sounds/welcome.mp3",
  "/wordle-trivia/assets/sounds/click.mp3",
  "/wordle-trivia/assets/sounds/correct.mp3",
  "/wordle-trivia/assets/sounds/wrong.mp3",
  "/wordle-trivia/assets/sounds/heart-lost.mp3",
  "/wordle-trivia/assets/sounds/victory.mp3",
  "/wordle-trivia/assets/sounds/game-over.mp3",
];

// Install: cache all assets
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE)));
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Fetch: network-first for questions.csv (so updated questions show up as soon
// as she's online), cache-first for everything else (so offline still works).
self.addEventListener("fetch", (event) => {
  const url = event.request.url;

  if (url.includes("questions.csv")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
