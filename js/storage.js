// Progress lives in this browser's localStorage. Every access is guarded: storage can be
// blocked (private windows, strict settings), and the game must still work without it.
const KEY = 'escape-warehouse:v1';
const FILES_KEY = 'escape-warehouse:v1:files';

function fresh() {
  return {
    first: '', last: '',
    unlocked: 0, xp: {}, attempts: {},
    code: {}, predicts: {}, ran: {}, newFiles: [],
  };
}

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadProgress() {
  return { ...fresh(), ...(read(KEY) || {}) };
}

export function saveProgress(progress) {
  return write(KEY, progress);
}

export function loadFiles() {
  return read(FILES_KEY) || {};
}

export function saveFiles(files) {
  return write(FILES_KEY, files);
}

export function clearAll() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(FILES_KEY);
  } catch {
    // nothing to clear
  }
}

export function getPref(name, fallback) {
  const prefs = read(KEY + ':prefs') || {};
  return name in prefs ? prefs[name] : fallback;
}

export function setPref(name, value) {
  const prefs = read(KEY + ':prefs') || {};
  prefs[name] = value;
  write(KEY + ':prefs', prefs);
}
