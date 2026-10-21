// Talks to the Python worker: one job at a time, with a Stop button and a timeout.
export const TIMEOUT_MS = 10000;

export class Runner {
  // boot() returns {state, files} for (re)starting Python; onStatus(text) shows what Python is doing;
  // onReady() runs each time a fresh Python finishes starting.
  constructor({ boot, onStatus, onReady, onFatal }) {
    this.boot = boot;
    this.onStatus = onStatus;
    this.onReady = onReady;
    this.onFatal = onFatal;
    this.nextId = 1;
    this.current = null;
    this.queue = [];
    this.start();
  }

  start(status = 'Starting Python…') {
    this.ready = false;
    this.onStatus('loading', status);
    this.worker = new Worker('js/worker.js', { type: 'module' });
    this.worker.onmessage = (e) => this.handle(e.data);
    this.worker.onerror = (e) => {
      if (!this.ready) this.onFatal(e.message || 'The Python worker failed to start.');
    };
    const { state, files } = this.boot();
    this.worker.postMessage({ type: 'init', state, files });
  }

  handle(msg) {
    if (msg.type === 'ready') {
      this.ready = true;
      this.version = msg.version;
      this.onStatus('ready', 'Python ready');
      this.onReady();
      this.pump();
      return;
    }
    if (msg.type === 'fatal') {
      this.onFatal(msg.message);
      return;
    }
    const job = this.current;
    if (!job || msg.id !== job.id) return;
    if (msg.type === 'out') {
      if (job.onOut) job.onOut(msg.text);
      return;
    }
    clearTimeout(job.timer);
    this.current = null;
    this.onStatus('ready', 'Python ready');
    if (msg.type === 'done') job.resolve(msg);
    else job.reject({ reason: 'failed', message: msg.message });
    this.pump();
  }

  // Send a job: {type: 'run'|'lock'|'read'|'reset', ...}. Resolves with the worker's reply.
  call(msg, onOut) {
    return new Promise((resolve, reject) => {
      this.queue.push({ msg: { ...msg, id: this.nextId++ }, onOut, resolve, reject });
      this.pump();
    });
  }

  pump() {
    if (!this.ready || this.current || !this.queue.length) return;
    const job = this.queue.shift();
    job.id = job.msg.id;
    this.current = job;
    if (job.msg.type === 'run' || job.msg.type === 'lock') this.onStatus('running', 'Running…');
    job.timer = setTimeout(() => this.kill('timeout'), TIMEOUT_MS);
    this.worker.postMessage(job.msg);
  }

  get busy() {
    return Boolean(this.current);
  }

  stop() {
    if (this.current) this.kill('stopped');
  }

  // Terminating the worker is the only way to interrupt Python without special server headers.
  kill(reason) {
    const job = this.current;
    this.current = null;
    if (job) clearTimeout(job.timer);
    this.worker.terminate();
    for (const queued of this.queue.splice(0)) queued.reject({ reason: 'cancelled' });
    if (job) job.reject({ reason });
    this.start('Restarting Python…');
  }
}
