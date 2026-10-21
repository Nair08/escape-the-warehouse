// Runs Python (Pyodide) off the main thread, so an infinite loop can't freeze the page.
// The page stops a runaway program by terminating this worker and starting a new one.
// This is a module worker: Pyodide's ES module build loads with CORS requests in every browser.
import { loadPyodide, version as PYODIDE_VERSION } from 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.mjs';

const HOME = '/home/pyodide';
const OUTPUT_LIMIT = 200000;

let glue = null;
let jobId = null;
let buffer = '';
let written = 0;
let capped = false;
let lastFlush = 0;

function flush() {
  if (buffer) {
    postMessage({ type: 'out', id: jobId, text: buffer });
    buffer = '';
  }
  lastFlush = Date.now();
}

function write(text) {
  if (capped) return;
  written += text.length;
  if (written > OUTPUT_LIMIT) {
    capped = true;
    buffer += '\n… output stopped here: your program printed more than 200,000 characters.\n';
    flush();
    return;
  }
  buffer += text;
  if (buffer.length > 4096 || Date.now() - lastFlush > 50) flush();
}

const GLUE = `
import json, sys
sys.path.insert(0, '/ewlib')
import warehouse as w

def boot(home, state_json, files_json):
    w.start(home, state_json, json.loads(files_json))
    return json.dumps({'files': w.list_files()})

def after():
    return {'files': w.list_files(), 'snapshot': w.snapshot()}

def run(payload, write):
    p = json.loads(payload)
    result = w.run(p['sources'], write, p.get('prelude', []))
    return json.dumps({'result': result, **after()})

def lock(payload, write):
    p = json.loads(payload)
    result = w.try_lock(p['check'], p['sources'], write, p.get('prelude', []))
    result['state'] = json.loads(w.get_state())
    return json.dumps({'result': result, **after()})

def listing():
    return json.dumps({'result': None, **after()})

def read(name):
    return json.dumps({'result': w.read_file(name)})

def reset(room):
    w.reset_room(room)
    return json.dumps({'result': None, **after()})
`;

async function boot(state, files) {
  const pyodide = await loadPyodide();
  const source = await (await fetch('../py/warehouse.py', { cache: 'no-cache' })).text();
  pyodide.FS.mkdirTree('/ewlib');
  pyodide.FS.writeFile('/ewlib/warehouse.py', source);
  const ns = pyodide.globals.get('dict')();
  pyodide.runPython(GLUE, { globals: ns });
  glue = {
    boot: ns.get('boot'), run: ns.get('run'), lock: ns.get('lock'),
    read: ns.get('read'), reset: ns.get('reset'), list: ns.get('listing'),
  };
  return JSON.parse(glue.boot(HOME, JSON.stringify(state), JSON.stringify(files || {})));
}

self.onmessage = async (event) => {
  const msg = event.data;
  try {
    if (msg.type === 'init') {
      const result = await boot(msg.state, msg.files);
      postMessage({ type: 'ready', files: result.files, version: PYODIDE_VERSION });
      return;
    }
    jobId = msg.id;
    buffer = '';
    written = 0;
    capped = false;
    lastFlush = Date.now();
    let reply;
    const payload = JSON.stringify(msg);
    if (msg.type === 'run') reply = glue.run(payload, write);
    else if (msg.type === 'lock') reply = glue.lock(payload, write);
    else if (msg.type === 'read') reply = glue.read(msg.name);
    else if (msg.type === 'reset') reply = glue.reset(msg.room);
    else if (msg.type === 'list') reply = glue.list();
    flush();
    postMessage({ type: 'done', id: msg.id, ...JSON.parse(reply) });
  } catch (err) {
    flush();
    if (msg.type === 'init') postMessage({ type: 'fatal', message: String(err && err.message || err) });
    else postMessage({ type: 'failed', id: msg.id, message: String(err && err.message || err) });
  }
};
