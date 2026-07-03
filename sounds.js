// ==========================================================================
// Sound manager — preloads and plays short SFX with mute/volume persistence
// ==========================================================================

const SOUND_FILES = {
  welcome: "assets/sounds/welcome.mp3",
  click: "assets/sounds/click.mp3",
  correct: "assets/sounds/correct.mp3",
  wrong: "assets/sounds/wrong.mp3",
  heartLost: "assets/sounds/heart-lost.mp3",
  victory: "assets/sounds/victory.mp3",
  gameOver: "assets/sounds/game-over.mp3",
};

const DEFAULT_VOLUME = 0.6;

let audioElements = {};
let muted = false;
let volume = DEFAULT_VOLUME;

function loadPrefs() {
  const storedMuted = localStorage.getItem("sound.muted");
  const storedVolume = localStorage.getItem("sound.volume");
  muted = storedMuted === null ? false : storedMuted === "true";
  volume = storedVolume === null ? DEFAULT_VOLUME : Number(storedVolume);
  if (Number.isNaN(volume)) volume = DEFAULT_VOLUME;
}

const sounds = {
  init() {
    loadPrefs();
    audioElements = {};
    Object.entries(SOUND_FILES).forEach(([name, src]) => {
      try {
        const audio = new Audio(src);
        audio.preload = "auto";
        audio.volume = volume;
        audioElements[name] = audio;
      } catch (err) {
        console.warn(`sounds: failed to preload "${name}"`, err);
      }
    });
  },

  // Returns a promise that resolves once playback actually starts, or
  // rejects (e.g. with a NotAllowedError when the browser blocks autoplay
  // before any user gesture) so callers can react — see the welcome-jingle
  // two-tier retry in game.js.
  play(name) {
    if (muted) return Promise.resolve();

    const base = audioElements[name];
    if (!base) {
      console.warn(`sounds: unknown sound "${name}"`);
      return Promise.reject(new Error(`unknown sound "${name}"`));
    }

    try {
      const node = base.cloneNode(true);
      node.volume = volume;
      const playPromise = node.play();

      if (playPromise && typeof playPromise.then === "function") {
        return playPromise.catch((err) => {
          // Autoplay-block rejections are expected before a user gesture —
          // don't clutter the console with them.
          if (err.name !== "NotAllowedError") {
            console.warn(`sounds: failed to play "${name}"`, err);
          }
          throw err;
        });
      }
      return Promise.resolve();
    } catch (err) {
      if (err.name !== "NotAllowedError") {
        console.warn(`sounds: failed to play "${name}"`, err);
      }
      return Promise.reject(err);
    }
  },

  setMuted(value) {
    muted = Boolean(value);
    localStorage.setItem("sound.muted", String(muted));
  },

  isMuted() {
    return muted;
  },

  setVolume(value) {
    volume = Math.min(1, Math.max(0, Number(value)));
    localStorage.setItem("sound.volume", String(volume));
    Object.values(audioElements).forEach((audio) => {
      audio.volume = volume;
    });
  },

  getVolume() {
    return volume;
  },
};

export { sounds };
