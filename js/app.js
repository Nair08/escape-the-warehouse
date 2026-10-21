import { ROOMS, PREDICTS, MAP_ORDER, NEXT_ROOM, MAX_XP, rankFor } from './rooms.js';
import { Runner, TIMEOUT_MS } from './runner.js';
import { loadProgress, saveProgress, loadFiles, saveFiles, clearAll, getPref, setPref } from './storage.js';
import { completionCode } from './completion.js';

// ---------- tiny DOM helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(child));
  }
  return node;
}

const PADLOCK = `<svg class="padlock" viewBox="0 0 48 56" aria-hidden="true">
  <path class="shackle" d="M12 26V16a12 12 0 0 1 24 0v10" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>
  <rect x="4" y="24" width="40" height="30" rx="5" fill="currentColor"/>
  <circle cx="24" cy="37" r="4.5" class="keyhole"/><rect x="22" y="38" width="4" height="9" rx="2" class="keyhole"/>
</svg>`;

// ---------- state ----------
let progress = loadProgress();
let savedFiles = loadFiles();
let starters = {};
let fileList = [];
let room = null;           // the open room: {id, def, editors, ...}
let busy = null;           // {button, label} while code runs
let storageWarned = false;

const totalXp = () => Object.values(progress.xp).reduce((a, b) => a + b, 0);
const escaped = () => 'final' in progress.xp;
const fullName = () => `${progress.first} ${progress.last}`.trim();

function save() {
  if (!saveProgress(progress) && !storageWarned) {
    storageWarned = true;
    toast("Your browser isn't letting this page save progress. It will be lost if you close the tab.");
  }
}

function isOpen(id) {
  return progress.unlocked >= ROOMS[id].requires;
}

function isCleared(id) {
  const def = ROOMS[id];
  if (def.kind === 'door' && def.num <= 5) return progress.unlocked >= def.num;
  return def.xpKeys.every((key) => key in progress.xp);
}

function codeFor(blockId) {
  return progress.code[blockId] ?? starters[blockId] ?? '';
}

// ---------- Python ----------
const runner = new Runner({
  boot: () => ({ state: { unlocked: progress.unlocked, xp: progress.xp, attempts: progress.attempts }, files: savedFiles }),
  onStatus: (kind, text) => {
    const pill = $('#py-status');
    pill.dataset.kind = kind;
    pill.textContent = text;
  },
  onReady: () => {
    if (room) refreshFiles();
  },
  onFatal: (message) => {
    $('#fatal').hidden = false;
    $('#fatal-detail').textContent = message;
  },
});

function afterReply(reply) {
  if (reply.files) fileList = reply.files;
  if (reply.snapshot) {
    savedFiles = reply.snapshot.files;
    if (!saveFiles(savedFiles) && !storageWarned) {
      storageWarned = true;
      toast("Your browser isn't letting this page save files. They will be lost if you close the tab.");
    }
    for (const name of reply.snapshot.skipped) {
      consoleWrite(`(${name} is too big to save in your browser. It will be gone if you reload the page.)\n`, 'warn');
    }
  }
  renderFiles();
}

async function refreshFiles() {
  try {
    const reply = await runner.call({ type: 'list' });
    afterReply(reply);
  } catch {
    // Python restarted; the next run refreshes the list
  }
}

// ---------- header ----------
function renderHeader(gain = 0) {
  const xp = totalXp();
  $('#xp-fill').style.width = `${(100 * xp) / MAX_XP}%`;
  $('#xp-text').textContent = `${xp} / ${MAX_XP} XP`;
  $('#rank').textContent = rankFor(xp);
  $('#xp-bar').setAttribute('aria-valuenow', xp);
  $('#name-chip-text').textContent = fullName() || 'Add your name';
  if (gain) {
    const pop = el('span', { class: 'xp-pop', text: `+${gain} XP` });
    $('#xp-bar').append(pop);
    setTimeout(() => pop.remove(), 1600);
  }
}

function toast(text) {
  const box = el('div', { class: 'toast', role: 'status', text });
  $('#toasts').append(box);
  setTimeout(() => box.classList.add('leaving'), 3200);
  setTimeout(() => box.remove(), 3700);
}

// ---------- name & completion code ----------
function nameDialog({ required }) {
  const dialog = $('#name-dialog');
  $('#first-name').value = progress.first;
  $('#last-name').value = progress.last;
  $('#name-cancel').hidden = required;
  $('#name-intro').hidden = !required;
  dialog.dataset.required = required ? 'yes' : '';
  dialog.showModal();
  setTimeout(() => $('#first-name').focus(), 0);
}

function setupNameDialog() {
  const dialog = $('#name-dialog');
  dialog.addEventListener('cancel', (e) => {
    if (dialog.dataset.required) e.preventDefault();
  });
  $('#name-cancel').addEventListener('click', () => dialog.close());
  $('#name-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const first = $('#first-name').value.trim();
    const last = $('#last-name').value.trim();
    if (!first || !last) {
      $('#name-error').hidden = false;
      return;
    }
    $('#name-error').hidden = true;
    progress.first = first;
    progress.last = last;
    save();
    dialog.close();
    renderHeader();
    route();
  });
  $('#name-chip').addEventListener('click', () => nameDialog({ required: false }));
}

async function completionBlock() {
  const code = await completionCode(fullName());
  const copy = el('button', {
    class: 'btn small',
    text: 'Copy',
    onclick: async () => {
      try {
        await navigator.clipboard.writeText(code);
        toast('Completion code copied.');
      } catch {
        toast('Select the code and copy it by hand.');
      }
    },
  });
  return el('div', { class: 'completion' },
    el('div', { class: 'completion-label', text: `Completion code for ${fullName()}` }),
    el('div', { class: 'completion-row' }, el('code', { class: 'completion-code', 'data-testid': 'completion-code', text: code }), copy),
    el('p', { class: 'completion-help', text: 'Hand this code in to your instructor. It only matches your name as typed above, so fix your name first if it’s wrong.' }));
}

// ---------- map ----------
function tile(id) {
  const def = ROOMS[id];
  const open = isOpen(id);
  const cleared = isCleared(id);
  const state = cleared ? 'cleared' : open ? 'open' : 'locked';
  const label = def.kind === 'door' ? (def.num <= 5 ? `Door ${def.num}` : '🏁 Final Door') : 'Bonus';
  let status;
  if (state === 'locked') {
    const need = def.requires;
    status = need >= 5 ? 'Open Door 5 first' : `Open Door ${need} first`;
  } else if (id === 'bugs') {
    const done = def.xpKeys.filter((k) => k in progress.xp).length;
    status = `${done} of 4 bugs squashed`;
  } else {
    status = cleared ? 'Cleared ✓' : 'Enter →';
  }
  const inner = [
    el('div', { class: 'tile-top' },
      el('span', { class: 'tile-num', text: label }),
      el('span', { class: 'tile-icon', html: cleared ? '<span class="check">✓</span>' : PADLOCK })),
    el('div', { class: 'tile-name', text: def.short }),
    el('div', { class: 'tile-skill', text: def.skill }),
    el('div', { class: 'tile-foot' }, el('span', { class: 'tile-xp', text: `${def.xp} XP` }), el('span', { class: 'tile-status', text: status })),
  ];
  const attrs = { class: `tile tile-${id} ${state}`, 'data-room': id, style: `grid-area: ${id}` };
  if (state === 'locked') {
    return el('div', { ...attrs, role: 'button', tabindex: 0, 'aria-disabled': 'true', 'aria-label': `${def.short}, locked`,
      onclick: () => toast(`🔒 ${def.short} is sealed. ${status}.`) }, inner);
  }
  return el('a', { ...attrs, href: `#/${id}` }, inner);
}

async function renderMap() {
  room = null;
  document.title = 'Escape the Warehouse';
  const main = $('#main');
  main.replaceChildren();
  main.dataset.room = 'map';
  const lobby = el('div', { class: 'tile tile-lobby', style: 'grid-area: lobby' },
    el('div', { class: 'tile-num', text: 'Lobby' }),
    el('p', { class: 'lobby-story', html: "It's your first day as a data analyst at <strong>Riverbend Supply Co.</strong> Overnight the security system glitched and sealed every door. The only way out is through the data." }),
    el('p', { class: 'lobby-rules', html: 'Chapter 7 tools only: <code>open()</code>, <code>readline()</code>, loops, <code>strip()</code>, <code>split()</code>, <code>print(..., file=f)</code>, <code>close()</code>, <code>try</code>/<code>except</code>. No pandas!' }));
  const floor = el('div', { class: 'floor' }, lobby, MAP_ORDER.map(tile));
  const parts = [];
  if (escaped()) parts.push(el('div', { class: 'escaped-banner' }, el('h2', { text: '🎉 You escaped the warehouse!' }), await completionBlock()));
  parts.push(el('h1', { class: 'sr-only', text: 'Warehouse map' }), floor);
  parts.push(el('div', { class: 'map-foot' },
    el('button', { class: 'link-btn', text: 'Start over', onclick: startOver })));
  main.append(...parts);
}

function startOver() {
  if (!confirm('Start over? This erases your XP, your code and your files on this computer. Your name is kept.')) return;
  const { first, last } = progress;
  clearAll();
  progress = { ...loadProgress(), first, last };
  saveProgress(progress);
  location.hash = '#/';
  location.reload();
}

// ---------- room ----------
function predictCard(qid) {
  const p = PREDICTS[qid];
  const card = el('div', { class: 'predict', 'data-q': qid },
    el('div', { class: 'predict-head', text: '🔮 Predict first' }),
    el('p', { class: 'predict-q', html: p.q }));
  const options = el('div', { class: 'options' });
  const explain = el('p', { class: 'explain', hidden: true });
  p.options.forEach((text, i) => {
    options.append(el('button', { class: 'opt', type: 'button', 'data-i': i, html: `<span class="opt-letter">${'ABCD'[i]}</span><span>${text}</span>`,
      onclick: () => { progress.predicts[qid] = i; save(); showAnswer(); } }));
  });
  function showAnswer() {
    const chosen = progress.predicts[qid];
    if (chosen === undefined) return;
    card.classList.add('answered');
    for (const btn of $$('.opt', options)) {
      const i = Number(btn.dataset.i);
      btn.disabled = true;
      btn.classList.toggle('correct', i === p.answer);
      btn.classList.toggle('wrong', i === chosen && i !== p.answer);
    }
    explain.hidden = false;
    explain.replaceChildren(el('strong', { text: chosen === p.answer ? '✅ Right! ' : '❌ Not quite. ' }), p.explain);
  }
  card.append(options, explain);
  showAnswer();
  return card;
}

function makeEditor(host, block) {
  const cm = CodeMirror(host, {
    value: codeFor(block.id),
    mode: { name: 'python', version: 3 },
    theme: 'warehouse',
    lineNumbers: true,
    indentUnit: 4,
    tabSize: 4,
    indentWithTabs: false,
    matchBrackets: true,
    viewportMargin: Infinity,
    inputStyle: 'contenteditable',
    screenReaderLabel: `${block.label} code editor`,
    extraKeys: {
      Tab: (c) => (c.somethingSelected() ? c.indentSelection('add') : c.replaceSelection('    ', 'end')),
      'Shift-Tab': (c) => c.indentSelection('subtract'),
      'Ctrl-Enter': () => runBlock(block),
      'Cmd-Enter': () => runBlock(block),
    },
  });
  let timer;
  cm.on('change', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      progress.code[block.id] = cm.getValue();
      save();
    }, 300);
  });
  return cm;
}

function blockView(block, def) {
  const view = el('div', { class: 'block', 'data-block': block.id });
  if (block.title) view.append(el('h2', { class: 'block-title', html: block.title }));
  if (block.spec) view.append(el('pre', { class: 'spec', text: block.spec }));
  if (block.note) view.append(el(block.note.startsWith('<p>') ? 'div' : 'p', { class: 'note', html: block.note }));
  for (const qid of block.predicts || []) view.append(predictCard(qid));
  const host = el('div', { class: 'editor' });
  view.append(host);
  const runBtn = el('button', { class: 'btn run', type: 'button', 'data-action': 'run', text: '▶ Run', onclick: () => runBlock(block) });
  const actions = el('div', { class: 'block-actions' }, runBtn);
  const nudge = el('div', { class: 'nudge', hidden: true },
    el('span', { text: '🔮 Make your prediction above first, or ' }),
    el('button', { class: 'link-btn', type: 'button', text: 'run anyway', onclick: () => runBlock(block, true) }));
  if (block.check) {
    actions.append(el('button', { class: 'btn lock', type: 'button', 'data-action': 'check', html: `${PADLOCK}<span>Check fix</span>`, onclick: () => tryLock(block.check, [block.id], view) }));
    if (block.xpKey in progress.xp) view.classList.add('solved');
  }
  view.append(actions, nudge);
  if (block.check) view.append(el('div', { class: 'result', 'aria-live': 'polite' }));
  room.editors[block.id] = makeEditor(host, block);
  return view;
}

function renderRoom(id) {
  const def = ROOMS[id];
  room = { id, def, editors: {} };
  document.title = `${def.short} · Escape the Warehouse`;
  const main = $('#main');
  main.replaceChildren();
  main.dataset.room = id;

  const head = el('div', { class: 'room-head' },
    el('a', { class: 'back', href: '#/', text: '← Map' }),
    el('h1', { text: def.title }),
    el('span', { class: `room-xp ${isCleared(id) ? 'done' : ''}`, text: isCleared(id) ? `✓ ${def.xp} XP` : `${def.xp} XP` }));
  const intro = [el('p', { class: 'mission', html: def.mission })];
  if (def.tip) intro.push(el('p', { class: 'tip', html: `💡 ${def.tip}` }));
  if (def.preludeNote) intro.push(el('p', { class: 'tip prelude-note', html: `↻ ${def.preludeNote}` }));
  if (def.intro) intro.push(el('div', { class: 'intro' }, el('pre', { class: 'spec', text: def.intro }), el('p', { class: 'note', html: def.introNote })));

  const work = el('div', { class: 'work' });
  for (const block of def.blocks) work.append(blockView(block, def));
  if (def.lock) {
    work.append(el('div', { class: 'lock-area' },
      el('button', { class: 'btn lock big', type: 'button', 'data-action': 'lock', html: `${PADLOCK}<span>Try the lock</span>`,
        onclick: () => tryLock(def.lock.check, def.lock.blocks, $('.lock-area')) }),
      el('div', { class: 'result', 'aria-live': 'polite' })));
  }
  if (escaped() && id === 'final') completionBlock().then((node) => work.append(node));

  const side = el('aside', { class: 'side' },
    el('div', { class: 'panel console-panel' },
      el('div', { class: 'panel-head' }, el('span', { text: 'Console' }),
        el('button', { class: 'btn small stop', type: 'button', text: '■ Stop', disabled: true, onclick: () => runner.stop() })),
      el('pre', { class: 'console', id: 'console', 'aria-live': 'polite' })),
    el('div', { class: 'panel files-panel' },
      el('div', { class: 'panel-head' }, el('span', { text: 'Files' }),
        el('label', { class: 'hidden-toggle' },
          el('input', { type: 'checkbox', id: 'show-hidden', checked: getPref('showHidden', false),
            onchange: (e) => { setPref('showHidden', e.target.checked); renderFileView(); } }),
          ' show hidden characters')),
      el('ul', { class: 'file-list', id: 'file-list' }),
      el('div', { class: 'file-view', id: 'file-view', hidden: true })));

  const foot = el('div', { class: 'room-foot' }, el('button', { class: 'link-btn', type: 'button', text: 'Reset this room', onclick: resetRoom }));
  main.append(head, ...intro, el('div', { class: 'room-grid' }, work, side), foot);
  for (const cm of Object.values(room.editors)) cm.refresh();
  consoleWrite(runner.ready ? '' : 'Starting Python… the first time takes a few seconds.\n', 'info');
  renderFiles();
  if (runner.ready) refreshFiles();
  window.scrollTo(0, 0);
}

// ---------- console & files ----------
function consoleWrite(text, kind = 'out') {
  const box = $('#console');
  if (!box || !text) return;
  box.append(el('span', { class: kind, text }));
  if (box.textContent.length > 250000) box.firstChild.remove();
  box.scrollTop = box.scrollHeight;
}

function consoleClear() {
  const box = $('#console');
  if (box) box.replaceChildren();
}

let viewing = null;

function renderFiles() {
  const list = $('#file-list');
  if (!list) return;
  list.replaceChildren(...fileList.map((f) => el('li', {},
    el('button', { class: `file ${viewing === f.name ? 'active' : ''}`, type: 'button', 'data-name': f.name, onclick: () => openFile(f.name) },
      el('span', { class: 'file-name', text: `📄 ${f.name}` }),
      progress.newFiles.includes(f.name) ? el('span', { class: 'badge', text: 'NEW' }) : null,
      el('span', { class: 'file-size', text: f.size === 0 ? 'empty' : `${f.size} B` })))));
  if (!fileList.length) list.append(el('li', { class: 'muted', text: runner.ready ? 'No files yet.' : 'Loading…' }));
  if (viewing) {
    if (fileList.some((f) => f.name === viewing)) openFile(viewing, true);
    else closeFile();
  }
}

let viewText = '';

async function openFile(name, quiet = false) {
  viewing = name;
  if (progress.newFiles.includes(name)) {
    progress.newFiles = progress.newFiles.filter((n) => n !== name);
    save();
  }
  if (!quiet) renderFiles();
  try {
    const reply = await runner.call({ type: 'read', name });
    viewText = reply.result.text + (reply.result.truncated ? '\n… (file too long to show it all)' : '');
  } catch {
    return;
  }
  renderFileView();
}

function closeFile() {
  viewing = null;
  const view = $('#file-view');
  if (view) view.hidden = true;
  renderFiles();
}

function renderFileView() {
  const view = $('#file-view');
  if (!view || !viewing) return;
  const hidden = $('#show-hidden').checked;
  const lines = viewText.split('\n');
  const endsWithNewline = lines.length > 1 && lines[lines.length - 1] === '';
  if (endsWithNewline) lines.pop();
  const rows = lines.map((line, i) => {
    const hasNewline = i < lines.length - 1 || endsWithNewline;
    const shown = hidden ? line.replace(/ /g, '·').replace(/\t/g, '→') : line;
    return el('div', { class: 'file-line' }, el('span', { class: 'ln', text: i + 1 }),
      el('span', { class: 'lt', text: shown }), hidden && hasNewline ? el('span', { class: 'nl', text: '↵' }) : null);
  });
  view.hidden = false;
  view.replaceChildren(
    el('div', { class: 'file-view-head' }, el('strong', { text: viewing }),
      el('button', { class: 'link-btn', type: 'button', 'aria-label': 'Close file', text: 'close ✕', onclick: closeFile })),
    viewText === '' ? el('p', { class: 'muted', text: '(this file is empty)' }) : el('div', { class: 'file-text' }, rows));
}

// ---------- running code ----------
function setBusy(button) {
  busy = button ? { button, html: button.innerHTML } : null;
  for (const btn of $$('[data-action]')) btn.disabled = Boolean(button) && btn !== button;
  const stop = $('.console-panel .stop');
  if (stop) stop.disabled = !button;
  if (button) {
    button.classList.add('running');
    button.innerHTML = '■ Stop';
  }
}

function clearBusy() {
  if (busy && busy.button.isConnected) {
    busy.button.classList.remove('running');
    busy.button.innerHTML = busy.html;
  }
  busy = null;
  for (const btn of $$('[data-action]')) btn.disabled = false;
  const stop = $('.console-panel .stop');
  if (stop) stop.disabled = true;
}

function preludeSources() {
  return (room.def.prelude || []).map(([id, label, code]) => [label, code ?? codeFor(id)]);
}

function reportPrelude(result) {
  for (const p of result.prelude_problems || []) {
    const last = p.error.trim().split('\n').pop();
    consoleWrite(`⚠️ Your saved ${p.label} code raised an error when it was re-run: ${last}\n   Fix it in that room so its variables are available here.\n`, 'warn');
  }
}

function handleStop(err) {
  if (err.reason === 'timeout') {
    consoleWrite(`\n⏱ Your code ran for ${TIMEOUT_MS / 1000} seconds without finishing, so it was stopped. Is there a loop that never ends? A while loop needs something inside it that eventually makes its condition False.\n`, 'err');
  } else if (err.reason === 'stopped') {
    consoleWrite('\n■ Stopped.\n', 'err');
  } else if (err.reason === 'failed') {
    consoleWrite(`\nSomething went wrong inside the game: ${err.message}\n`, 'err');
    return;
  } else {
    return;
  }
  consoleWrite('Python restarted. Your files are back to how they were before that run.\n', 'info');
}

async function runBlock(block, force = false) {
  if (!room) return;
  const view = $(`[data-block="${block.id}"]`);
  const button = $('[data-action="run"]', view);
  if (busy) {
    if (busy.button === button) runner.stop();
    return;
  }
  const unanswered = (block.predicts || []).filter((q) => progress.predicts[q] === undefined);
  const nudge = $('.nudge', view);
  if (!force && unanswered.length && !progress.ran[block.id]) {
    nudge.hidden = false;
    const card = $(`.predict[data-q="${unanswered[0]}"]`, view);
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.remove('pulse');
    void card.offsetWidth;
    card.classList.add('pulse');
    return;
  }
  nudge.hidden = true;
  progress.ran[block.id] = true;
  progress.code[block.id] = room.editors[block.id].getValue();
  save();
  consoleClear();
  consoleWrite(`▶ ${block.label}\n`, 'info');
  if (room.def.prelude) consoleWrite('↻ Re-running your saved code from Doors 2, 3 and 5 first (output hidden)…\n', 'info');
  setBusy(button);
  let gotOutput = false;
  try {
    const reply = await runner.call(
      { type: 'run', sources: [[block.label, progress.code[block.id]]], prelude: preludeSources() },
      (text) => { gotOutput = true; consoleWrite(text); });
    reportPrelude(reply.result);
    if (reply.result.error) consoleWrite(reply.result.error, 'err');
    else if (!gotOutput) consoleWrite('(finished, no output)\n', 'info');
    afterReply(reply);
  } catch (err) {
    handleStop(err);
  } finally {
    clearBusy();
  }
}

async function tryLock(check, blockIds, area) {
  if (!room) return;
  const button = $('[data-action="lock"], [data-action="check"]', area);
  if (busy) {
    if (busy.button === button) runner.stop();
    return;
  }
  const blocks = room.def.blocks.filter((b) => blockIds.includes(b.id));
  for (const b of blocks) progress.code[b.id] = room.editors[b.id].getValue();
  save();
  const result = $('.result', area);
  result.className = 'result';
  result.replaceChildren();
  consoleClear();
  consoleWrite(`🔒 Trying the lock: running ${blocks.map((b) => b.label).join(', ')}…\n`, 'info');
  if (room.def.prelude) consoleWrite('↻ Re-running your saved code from Doors 2, 3 and 5 first (output hidden)…\n', 'info');
  setBusy(button);
  try {
    const reply = await runner.call(
      { type: 'lock', check, sources: blocks.map((b) => [b.label, progress.code[b.id]]), prelude: preludeSources() },
      (text) => consoleWrite(text));
    const r = reply.result;
    reportPrelude(r);
    if (r.error) consoleWrite(r.error, 'err');
    if (r.lock_error) consoleWrite(r.lock_error, 'err');
    progress.unlocked = r.state.unlocked;
    progress.xp = r.state.xp;
    progress.attempts = r.state.attempts;
    if (r.new_files.length) progress.newFiles = [...new Set([...progress.newFiles, ...r.new_files])];
    save();
    afterReply(reply);
    showResult(result, r);
    renderHeader(r.xp);
    if (r.ok) celebrate(r, area);
  } catch (err) {
    handleStop(err);
    result.className = 'result error';
    result.replaceChildren(el('p', { text: 'The lock never got an answer because your code was stopped.' }));
  } finally {
    clearBusy();
  }
}

function showResult(box, r) {
  const kind = r.ok ? 'success' : r.error || r.lock_error ? 'error' : r.already ? 'info' : 'hint';
  box.className = `result ${kind}`;
  box.replaceChildren(...r.messages.map((m) => el('p', { text: m.trim() })));
}

async function celebrate(r, area) {
  const def = room.def;
  const roomXp = $('.room-xp');
  if (isCleared(room.id) && roomXp) {
    roomXp.classList.add('done');
    roomXp.textContent = `✓ ${def.xp} XP`;
  }
  const block = area.closest('.block');
  if (block) block.classList.add('solved', 'just-solved');
  if (!r.opened && !r.escaped) {
    if (r.xp) area.classList.add('just-solved');
    return;
  }
  const overlay = el('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'unlock-title' });
  const card = el('div', { class: `unlock-card ${r.escaped ? 'escape' : ''}` },
    el('div', { class: 'unlock-lock', html: PADLOCK }),
    el('h2', { id: 'unlock-title', text: r.escaped ? 'YOU ESCAPED!' : `Door ${r.opened} opens!` }),
    r.xp ? el('div', { class: 'xp-gain', text: `+${r.xp} XP` }) : null,
    el('div', { class: 'unlock-lines' }, r.messages.filter((m) => !m.includes('XP') && !m.includes('OPENS!') && !m.includes('YOU ESCAPED')).map((m) => el('p', { text: m.trim() }))));
  if (r.new_files.length) card.append(el('p', { class: 'new-files' }, 'New files: ', r.new_files.map((n) => el('code', { text: n })).flatMap((c, i) => (i ? [', ', c] : [c]))));
  if (r.escaped) {
    card.append(await completionBlock());
    for (let i = 0; i < 40; i++) {
      overlay.append(el('span', { class: 'confetti', style: `left:${Math.random() * 100}%;animation-delay:${Math.random() * 1.2}s;background:${['#F2B705', '#2E9E5B', '#E8EAED'][i % 3]}` }));
    }
  }
  const next = NEXT_ROOM[room.id];
  const buttons = el('div', { class: 'unlock-actions' });
  const close = () => overlay.remove();
  if (next) buttons.append(el('a', { class: 'btn primary', href: `#/${next}`, text: `Go to ${ROOMS[next].num <= 5 ? `Door ${ROOMS[next].num}` : 'the Final Door'} →`, onclick: close }));
  buttons.append(el('a', { class: 'btn', href: '#/', text: 'Back to the map', onclick: close }));
  buttons.append(el('button', { class: 'btn ghost', type: 'button', text: 'Stay here', onclick: close }));
  card.append(buttons);
  overlay.append(card);
  overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  document.body.append(overlay);
  $('a, button', buttons).focus();
}

async function resetRoom() {
  if (!room) return;
  if (!confirm('Reset this room? Your code goes back to the starter code and this room\'s files are restored. Your XP is kept.')) return;
  if (busy) runner.stop();
  for (const block of room.def.blocks) {
    delete progress.code[block.id];
    delete progress.ran[block.id];
    room.editors[block.id].setValue(starters[block.id]);
  }
  save();
  for (const box of $$('.result')) { box.className = 'result'; box.replaceChildren(); }
  consoleClear();
  try {
    const reply = await runner.call({ type: 'reset', room: room.id });
    afterReply(reply);
    consoleWrite('↺ Room reset: starter code and data files restored.\n', 'info');
  } catch {
    // Python restarted
  }
}

// ---------- routing ----------
function route() {
  if (!progress.first || !progress.last) {
    nameDialog({ required: true });
  }
  $$('.overlay').forEach((o) => o.remove());
  const id = location.hash.replace(/^#\/?/, '');
  if (ROOMS[id]) {
    if (!isOpen(id)) {
      toast(`🔒 ${ROOMS[id].short} is still sealed.`);
      location.replace('#/');
      return;
    }
    if (busy) runner.stop();
    viewing = null;
    renderRoom(id);
  } else {
    renderMap();
  }
}

async function loadStarters() {
  const ids = Object.values(ROOMS).flatMap((r) => r.blocks.map((b) => b.id));
  const texts = await Promise.all(ids.map((id) => fetch(`starters/${id}.py`).then((res) => {
    if (!res.ok) throw new Error(`starters/${id}.py`);
    return res.text();
  })));
  ids.forEach((id, i) => { starters[id] = texts[i]; });
}

async function main() {
  setupNameDialog();
  renderHeader();
  try {
    await loadStarters();
  } catch (err) {
    $('#fatal').hidden = false;
    $('#fatal-detail').textContent = `Couldn't load ${err.message}.`;
    return;
  }
  if (typeof CodeMirror === 'undefined') {
    $('#fatal').hidden = false;
    $('#fatal-detail').textContent = "The code editor didn't load.";
    return;
  }
  window.addEventListener('hashchange', route);
  window.addEventListener('pagehide', () => {
    if (room) for (const [id, cm] of Object.entries(room.editors)) progress.code[id] = cm.getValue();
    save();
  });
  route();
}

main();
