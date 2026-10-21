"""Escape the Warehouse: game logic, ported from ch07-escape-the-warehouse.ipynb.

Creates the data files for each door, runs student code, checks answers and tracks XP.
Answers are stored as fingerprints (salted SHA-256 hashes), so reading this file won't reveal them.

The same module runs in the browser (inside Pyodide) and in the instructor's test suite (CPython).
"""
import builtins
import hashlib
import json
import linecache
import os
import traceback

_SALT = 'riverbend-ch7'
XP_TABLE = {'door1': 10, 'door2': 15, 'door3': 15, 'door4': 20, 'door5': 20, 'final': 20,
            'bugA': 5, 'bugB': 5, 'bugC': 5, 'bugD': 5, 'pro': 10}
MAX_XP = sum(XP_TABLE.values())
RANKS = [(0, '🥾 Lost in the Lobby'), (30, '📦 Dock Worker'), (60, '📋 Inventory Specialist'),
         (100, '🗝️ Escape Artist'), (130, '👑 Warehouse Legend')]


def _h(text):
    return hashlib.sha256((_SALT + str(text)).encode()).hexdigest()


_CODE_HASHES = {1: '7174b1e9d7f778d2ce69381d67ae17179da933edd365b498dc505d484d2da7b6', 2: '238e7479d6445592f1c2c36156013ce160313862dd76e9c0fea712a41745e4d4', 3: '89420c41ad2319c4721c8f940c0543b7b7716118c4577315aae4d03e7f1fd95c', 5: 'b8a0ce842b355ec6af4cdd6708ba92bf7fefd8bc9acbcaced0bfdf213ffb9130'}
# Bug A's expected average, rounded to 2 decimals before hashing (the notebook allowed a 0.01 tolerance).
_BUG_A_HASH = 'c1431cdf4b7a3898e67d8a002140e9a2c5a432ec48ea3af5db244e3747e3d60a'
_TRAP_HASHES = {3: {'9c4ce87095fb06e58159b97fca7da0bceced0da79c4126be42923b39d9c1be7e': "You got SGL, which means numbers were compared as TEXT. As strings, '9' < '25' is False! Convert the fields with int() before comparing."}}

# ---------- the warehouse data ----------
_DOOR1_LINES = ['BADGE-7741',
                '[02:13:07] Reader 3: badge scan rejected',
                '[02:13:09] Reader 3: tamper alarm reset',
                '[02:14:55] System: lockdown engaged',
                '[02:15:00] System: all doors sealed']
_WEIGHTS = ['412.5', '389.25', '501.0', '', '275.75', '610.4', '498.1', '   ', '333.0', '455.35']
_INVENTORY = [('B-101', 'Bolts', 500, 200, 0.12),
              ('S-204', 'Straps', 15, 40, 3.50),
              ('C-310', 'Casters', 80, 60, 7.25),
              ('U-415', 'Uprights', 4, 10, 89.00),
              ('P-522', 'Pallet wrap', 6, 20, 24.99),
              ('G-118', 'Gloves', 120, 50, 2.10),
              ('P-630', 'Padlocks', 9, 25, 11.40),
              ('H-207', 'Hinges', 300, 100, 1.05),
              ('L-742', 'Labels', 150, 400, 0.03),
              ('T-855', 'Tarps', 35, 30, 18.00),
              ('Y-901', 'Yellow floor tape', 2, 12, 6.75),
              ('W-333', 'Washers', 900, 300, 0.02)]
_SALES = {'sales_mon.txt': ['125.50', '89.99', '240.00', '15.25', '310.80', '64.46'],
          'sales_tue.txt': ['199.99', 'N/A', '45.00', '120.75', '88.40', '260.00'],
          'sales_thu.txt': ['175.20', '99.95', '', '330.10', '42.85', '118.00'],
          'sales_fri.txt': ['410.00', '55.55', 'ERROR', '205.25', '61.10']}
_SALES_ORDER = ['sales_mon.txt', 'sales_tue.txt', 'sales_wed.txt', 'sales_thu.txt', 'sales_fri.txt']
_TEMPS = ['reading', '68.2', '70.1', '69.5', '71.0']
_ORDERS_LOG = ['ORD-1001', 'ORD-1002', 'ORD-1003', 'ORD-1004', 'ORD-1005', 'ORD-1006', 'ORD-1007',
               'END', 'archived: ORD-0990', 'archived: ORD-0991', 'archived: ORD-0992']
_TEAM = ['Ava', 'Ben', 'Carmen']
_BUG_B_LINES = ['Q1 sales: 1200', 'Q2 sales: 1350', 'Q3 sales: 1425']


def _low_items():
    return [row for row in _INVENTORY if row[2] < row[3]]


def _expected_reorder_lines():
    lines = ['sku,item,qty_to_order']
    for sku, item, on_hand, reorder_point, cost in _low_items():
        lines.append(f'{sku},{item},{2 * reorder_point - on_hand}')
    return lines


def _week_sales():
    total, bad = 0, 0
    for name, lines in _SALES.items():
        for line in lines:
            if line.strip() == '':
                continue
            try:
                total += float(line)
            except ValueError:
                bad += 1
    return total, bad


def _expected_report_lines():
    weight = round(sum(float(w) for w in _WEIGHTS if w.strip() != ''))
    total, bad = _week_sales()
    return ['ESCAPE REPORT - Riverbend Supply Co.',
            f'Total shipment weight (kg): {weight}',
            f'Items to reorder: {len(_low_items())}',
            f'Weekly sales total: ${total:,.2f}',
            f'Bad sales records skipped: {bad}',
            'Missing sales files: sales_wed.txt']


# What each report line should look like. ____ marks the blank to fill in; _REPORT_FILL says what goes there.
_REPORT_PATTERNS = ['ESCAPE REPORT - Riverbend Supply Co.',
                    'Total shipment weight (kg): ____',
                    'Items to reorder: ____',
                    'Weekly sales total: $____',
                    'Bad sales records skipped: ____',
                    'Missing sales files: ____']
_REPORT_FILL = [None,
                'the total weight from door 2 as a whole number, like round(total_for)',
                'how many items are low on stock. code3 has one letter per low-stock item, so len(code3) is the count',
                "the week's sales total with commas and exactly 2 decimals, like f'{week_total:,.2f}'",
                'the number of corrupted lines from door 5 (bad_lines)',
                'the name of the missing file, like missing_files[0]']


def _report_hint(i, line, label):
    """A targeted hint for a wrong report line, or None."""
    value = line.split(':', 1)[1] if ':' in line else ''
    if '<' in line or '>' in line:
        return '   Leave out the < >. Print just the value in their place.'
    if '____' in line:
        return '   Replace the ____ with the value itself.'
    if line.startswith(label + ':  '):
        return ("   There are two spaces after the colon. print('Label: ', value) adds its own space between items, "
                "so drop the space inside the quotes (or use an f-string).")
    if i == 2 and value.strip().isalpha():
        return "   That's the door 3 password, not a count of items."
    return None


# Files each room's code writes. "Reset this room" deletes them.
ROOM_OUTPUTS = {'door4': ['scratch.txt', 'reorder_list.txt'],
                'final': ['escape_report.txt'],
                'bugs': ['bug_b.txt', 'team.txt'],
                'pro': ['scratch2.txt', 'reorder_list_v2.txt']}

# ---------- progress & XP ----------
_progress = {'unlocked': 0, 'xp': {}}
_attempts = {}


def set_state(state_json):
    """Load progress saved by the web page (a JSON string)."""
    global _progress, _attempts
    state = json.loads(state_json) if state_json else {}
    _progress = {'unlocked': int(state.get('unlocked', 0)),
                 'xp': {k: XP_TABLE[k] for k in state.get('xp', {}) if k in XP_TABLE}}
    _attempts = {str(k): int(v) for k, v in state.get('attempts', {}).items()}


def get_state():
    return json.dumps({'unlocked': _progress['unlocked'], 'xp': _progress['xp'], 'attempts': _attempts})


def total_xp():
    return sum(_progress['xp'].values())


def rank(xp=None):
    xp = total_xp() if xp is None else xp
    return [name for need, name in RANKS if xp >= need][-1]


# ---------- messages from the checkers ----------
# The notebook printed its messages. Here they are collected so the page can show them.
_out = []
_events = {}


def _say(*parts):
    _out.append(' '.join(str(p) for p in parts))


# ---------- file creation ----------
def _write_lines(name, lines):
    with open(name, 'w') as f:
        for line in lines:
            f.write(line + '\n')


def build_files():
    _write_lines('door1.txt', _DOOR1_LINES)
    _write_lines('temps.txt', _TEMPS)
    _write_lines('orders_log.txt', _ORDERS_LOG)
    made = ['door1.txt', 'temps.txt', 'orders_log.txt']
    if _progress['unlocked'] >= 1:
        _write_lines('shipment_weights.txt', _WEIGHTS); made.append('shipment_weights.txt')
    if _progress['unlocked'] >= 2:
        header = 'sku,item,on_hand,reorder_point,unit_cost'
        rows = [f'{s},{i},{o},{r},{c:.2f}' for s, i, o, r, c in _INVENTORY]
        _write_lines('inventory.csv', [header] + rows + ['']); made.append('inventory.csv')
    if _progress['unlocked'] >= 4:
        for name, lines in _SALES.items():
            _write_lines(name, lines); made.append(name)
        if os.path.exists('sales_wed.txt'):
            os.remove('sales_wed.txt')   # Wednesday's file was lost in the lockdown!
    return made


def _award(key):
    if key not in _progress['xp']:
        _progress['xp'][key] = XP_TABLE[key]
        _events['xp'] = XP_TABLE[key]
        _say(f'   +{XP_TABLE[key]} XP!  Total: {total_xp()} / {MAX_XP}')
    else:
        _say(f'   (XP for this was already collected. Total: {total_xp()} / {MAX_XP})')


_HINTS = {
    1: ["The code is the FIRST line of door1.txt. Call f.readline() just once.",
        "Run print(repr(code1)). Anything extra at the end, like \\n, is part of the string."],
    2: ["Add only the non-blank lines. Each line is a string, so convert it with float() first.",
        "One 'blank' line is really a few spaces. Use line.rstrip('\\n').strip() before checking if it's empty.",
        "Your code should be round(total_for), a whole number. Print the total and the count to check your loop."],
    3: ["Build the code from the FIRST letter (item[0]) of each low-stock item, in file order.",
        "Low stock means on_hand < reorder_point. Those are fields[2] and fields[3].",
        "Print each item you think is low. You should find 6 of them."],
    5: ["Total every valid sale in every file that exists. Skip blank lines, missing files, and lines that aren't numbers.",
        "Put one try/except around open() (FileNotFoundError) and another around float() (ValueError).",
        "Print the total after each file to see which file is giving you trouble."],
}


def _hint(door):
    key = str(door)
    _attempts[key] = _attempts.get(key, 0) + 1
    hints = _HINTS.get(door, [])
    if hints:
        n = min(_attempts[key], len(hints))
        _say(f'   💡 Hint {n} of {len(hints)}: {hints[n - 1]}')


_STORY = {
    1: ("🔓 DOOR 1 OPENS! You step onto the loading dock.",
        "📄 New file: shipment_weights.txt. The dock scale won't release the next door until you total last night's shipments."),
    2: ("🔓 DOOR 2 OPENS! You're in the inventory room.",
        "📄 New file: inventory.csv. The terminal wants a password made from the items that are running low."),
    3: ("🔓 DOOR 3 OPENS! You reach the purchasing office.",
        "🖨️ Door 4 has no clue file. It opens only when YOU write the correct reorder_list.txt."),
    4: ("🔓 DOOR 4 OPENS! You're in the sales office.",
        "📄 New files: the week's sales_*.txt files. Some are damaged, and one is missing..."),
    5: ("🔓 DOOR 5 OPENS! The exit is in sight.",
        "🏁 The final door needs a written report. Head to the Final Door."),
}


def _open_door(door, xp_key):
    before = set(build_files())
    _progress['unlocked'] = max(_progress['unlocked'], door)
    after = build_files()
    _events['ok'] = True
    _events['opened'] = door
    _events['new_files'] = [name for name in after if name not in before]
    first, second = _STORY[door]
    _say(first)
    _award(xp_key)
    _say(second)


def _door_status_ok(door):
    if door > _progress['unlocked'] + 1:
        _say(f'🔒 Door {door} is still sealed. Open door {_progress["unlocked"] + 1} first.')
        return False
    if door <= _progress['unlocked']:
        _events['already'] = True
        _say(f'✅ Door {door} is already open. Keep going!')
        return False
    return True


def unlock(door, code):
    """Try a code on door 1, 2, 3 or 5."""
    if door not in _CODE_HASHES:
        _say(f'Door {door} has no keypad. Check the instructions for that door.')
        return
    if not _door_status_ok(door):
        return
    if code is ... or code is None:
        _say('✋ Your variable is still empty (... or None). Finish the code above, run it, then try again.')
        return
    if door in (2, 5):
        if isinstance(code, bool):
            _say('❌ That is True/False, not a number.'); return
        if isinstance(code, str):
            try:
                code = float(code.strip())
            except ValueError:
                _say('❌ This lock wants a number.'); return
        if isinstance(code, float):
            if not code.is_integer():
                _say(f'❌ {code} has decimals. The keypad only takes whole numbers. Use round(your_total).')
                return
            code = int(code)
        if _h(code) == _CODE_HASHES[door]:
            _open_door(door, f'door{door}')
        else:
            _say(f'❌ ACCESS DENIED. {code} is not the code.')
            _hint(door)
        return
    # text codes (doors 1 and 3)
    if not isinstance(code, str):
        _say(f'❌ This lock wants text (a str), but you gave it a {type(code).__name__}.')
        return
    if _h(code) == _CODE_HASHES[door]:
        _open_door(door, f'door{door}')
        return
    if _h(code.strip()) == _CODE_HASHES[door]:
        if code.endswith('\n'):
            _say('❌ SO CLOSE! Your code ends with an invisible newline (\\n) that readline() left behind.')
            _say("   Remove it with .rstrip('\\n') and try again.")
        else:
            _say('❌ SO CLOSE! There are extra spaces at the start or end of your code. Try .strip().')
        return
    if _h(code) in _TRAP_HASHES.get(door, {}):
        _say('❌ ACCESS DENIED. ' + _TRAP_HASHES[door][_h(code)])
        return
    if _h(code.strip().upper()) == _CODE_HASHES[door]:
        _say('❌ Almost! The letters are right but upper/lower case matters. Keep the letters exactly as they appear.')
        return
    _say(f'❌ ACCESS DENIED. {code!r} is not the code.')
    _hint(door)


# ---------- file checkers ----------
def _read_student_file(filename):
    if not os.path.exists(filename):
        _say(f'❌ I can\'t find {filename}. Check the spelling and make sure your code ran without errors.')
        return None
    with open(filename, 'r') as f:
        text = f.read()
    if text.strip() == '':
        _say(f'❌ {filename} exists but it is EMPTY.')
        _say('   Python saves your writing when the file is closed. Did you call .close() on it?')
        return None
    lines = text.split('\n')
    while lines and lines[-1].strip() == '':
        lines.pop()
    return [line.rstrip() for line in lines]


def _compare(lines, expected, patterns=None):
    if len(lines) > len(expected) and len(set(lines)) < len(lines):
        _say(f'❌ The file has {len(lines)} lines and some are repeated.')
        _say("   Did you open it with 'a' (append) and run your code more than once? Use 'w' to start fresh.")
        return False
    for i, exp in enumerate(expected):
        if i >= len(lines):
            _say(f'❌ The file stops after {len(lines)} line(s). It should have {len(expected)}.')
            return False
        if lines[i] != exp:
            _say(f'❌ Line {i + 1} doesn\'t match.')
            _say(f'   yours:     {lines[i]!r}')
            if patterns:
                _say(f'   should be: {patterns[i]}')
                if _REPORT_FILL[i]:
                    _say(f'   (fill in the ____ with {_REPORT_FILL[i]})')
                label = patterns[i].split(':')[0]
                hint = _report_hint(i, lines[i], label)
                if hint:
                    _say(hint)
                elif lines[i].startswith(label + ':'):
                    _say('   The label is right, so check the value and its formatting.')
            else:
                if ', ' in lines[i]:
                    _say("   There's a space after a comma. print() adds spaces between items unless you use sep=','.")
                elif '.0' in lines[i].split(',')[-1]:
                    _say('   The quantity looks like a decimal. It should be a whole number (use int()).')
                else:
                    _say('   Format: sku,item,qty_to_order   where qty_to_order = 2 * reorder_point - on_hand')
            return False
    if len(lines) > len(expected):
        _say(f'❌ The file has {len(lines)} lines but should have {len(expected)}. Are you writing items that aren\'t low on stock?')
        return False
    return True


def check_door4(filename='reorder_list.txt'):
    """Door 4 opens when reorder_list.txt is correct."""
    if not _door_status_ok(4):
        return
    lines = _read_student_file(filename)
    if lines is None:
        return
    if lines[0] != 'sku,item,qty_to_order':
        _say(f"❌ The first line should be the header sku,item,qty_to_order but it's {lines[0]!r}.")
        return
    if _compare(lines, _expected_reorder_lines()):
        _say('🖨️ The purchasing printer accepts your reorder list...')
        _open_door(4, 'door4')


def check_final(filename='escape_report.txt'):
    """The final door opens when escape_report.txt is correct."""
    if _progress['unlocked'] < 5:
        _say('🔒 The final door is sealed. Open door 5 first.')
        return
    lines = _read_student_file(filename)
    if lines is None:
        return
    if _compare(lines, _expected_report_lines(), _REPORT_PATTERNS):
        _events['ok'] = True
        _events['escaped'] = True
        _say('🎉🎉🎉 THE FINAL DOOR SWINGS OPEN. YOU ESCAPED THE WAREHOUSE! 🎉🎉🎉')
        _award('final')


def check_bug(letter, value=None):
    """Check a Bug Bounty fix: 'A', 'B', 'C' or 'D'."""
    letter = str(letter).upper()
    ok = False
    if letter == 'A':
        if value is ... or value is None:
            _say('✋ Set avg_a first.'); return
        ok = isinstance(value, (int, float)) and _h(f'{value:.2f}') == _BUG_A_HASH
        if not ok:
            _say(f'❌ avg_a is {value!r}. Is the header line being skipped? Is the average using 4 readings?')
    elif letter == 'B':
        if value is None or not hasattr(value, 'closed'):
            _say('✋ fout_b should be your file variable (the one you got from open()).'); return
        if not value.closed:
            _say('❌ fout_b is still open, so the lines are stuck in memory and never reach the disk.'); return
        lines = _read_student_file('bug_b.txt')
        ok = lines == _BUG_B_LINES
        if lines is not None and not ok:
            _say(f'❌ bug_b.txt contains {lines}. It should have the three sales lines.')
    elif letter == 'C':
        lines = _read_student_file('team.txt')
        ok = lines == _TEAM
        if lines is not None and not ok:
            if len(lines) > 3:
                _say("❌ Too many lines. If you used 'a', every run adds the names again. Open once with 'w', before the loop.")
            else:
                _say(f'❌ team.txt contains {lines}. All three names should be there, one per line.')
    elif letter == 'D':
        if value is ... or value is None:
            _say('✋ Set count_d first.'); return
        ok = value == 7
        if not ok and value == 11:
            _say("❌ count_d is 11: the loop never stopped at END. What's hiding at the end of each line?")
        elif not ok:
            _say(f'❌ count_d is {value!r}. Count only the orders BEFORE the END line.')
    else:
        _say("Use 'A', 'B', 'C' or 'D'."); return
    if ok:
        _events['ok'] = True
        _say(f'🐛 Bug {letter} squashed!')
        _award('bug' + letter)


def check_pro(filename='reorder_list_v2.txt'):
    """Bonus: check the reorder list written with `with` and .write()."""
    if _progress['unlocked'] < 2:
        _say('🔒 You need inventory.csv for this one. It appears after door 2.'); return
    lines = _read_student_file(filename)
    if lines is None:
        return
    if len(lines) == 1 and len(_expected_reorder_lines()) > 1:
        _say("❌ Everything is on ONE line. .write() doesn't add a newline for you. Add '\\n' to each string.")
        return
    if _compare(lines, _expected_reorder_lines()):
        _events['ok'] = True
        _say('🧑‍💻 Pro move! Same file, written the professional way.')
        _award('pro')


# The notebook's lock cells. They run in the student's namespace after the student's code.
LOCKS = {
    'door1': 'unlock(1, code1)',
    'door2': 'code2 = round(total_for)\nunlock(2, code2)',
    'door3': 'unlock(3, code3)',
    'door4': 'check_door4()',
    'door5': 'code5 = round(week_total)\nunlock(5, code5)',
    'final': 'check_final()',
    'bugA': "check_bug('A', avg_a)",
    'bugB': "check_bug('B', fout_b)",
    'bugC': "check_bug('C')",
    'bugD': "check_bug('D', count_d)",
    'pro': 'check_pro()',
}
_CHECKERS = {'unlock': unlock, 'check_door4': check_door4, 'check_final': check_final,
             'check_bug': check_bug, 'check_pro': check_pro}


# ---------- running student code ----------
# Namespaces are kept alive, like variables in a notebook kernel. A file the student
# never closed therefore stays unflushed (and empty on disk), exactly as in Jupyter.
_kept = []
HOME = None


class _Writer:
    def __init__(self, fn):
        self._fn = fn

    def write(self, s):
        if s:
            self._fn(s)
        return len(s)

    def flush(self):
        pass

    def isatty(self):
        return False


class _Quiet(_Writer):
    def __init__(self):
        super().__init__(lambda s: None)


def _no_input(prompt=''):
    raise RuntimeError("input() isn't available in the escape room. Put the value straight into your code instead.")


def _new_namespace():
    ns = {'__name__': '__main__', '__builtins__': builtins, 'input': _no_input}
    _kept.append(ns)
    return ns


def _filter_frames(te):
    te.stack = traceback.StackSummary.from_list([f for f in te.stack if f.filename.startswith('<')])
    for nested in (te.__cause__, te.__context__):
        if nested is not None:
            _filter_frames(nested)
    return te


def _format_error(exc):
    te = traceback.TracebackException.from_exception(exc)
    return ''.join(_filter_frames(te).format())


def _exec(label, src, ns):
    filename = f'<{label}>'
    linecache.cache[filename] = (len(src), None, src.splitlines(True), filename)
    exec(compile(src, filename, 'exec'), ns)


def _run_sources(sources, ns, write):
    """Run (label, code) pairs in one namespace. Returns the error text, or None."""
    import sys
    old_out, old_err = sys.stdout, sys.stderr
    sys.stdout = sys.stderr = _Writer(write)
    try:
        if HOME:
            os.chdir(HOME)
        for label, src in sources:
            _exec(label, src, ns)
        return None
    except SystemExit:
        return None
    except BaseException as exc:   # show students the real Python error, whatever it is
        return _format_error(exc)
    finally:
        sys.stdout, sys.stderr = old_out, old_err


def _run_prelude(prelude, ns):
    """Quietly re-run saved code from earlier rooms. Returns a list of {label, error}."""
    problems = []
    for label, src in prelude:
        err = _run_sources([(label, src)], ns, lambda s: None)
        if err:
            problems.append({'label': label, 'error': err})
    return problems


def run(sources, write, prelude=()):
    """The Run button. sources and prelude are lists of (label, code)."""
    ns = _new_namespace()
    problems = _run_prelude(prelude, ns)
    error = _run_sources(sources, ns, write)
    return {'error': error, 'prelude_problems': problems}


def try_lock(check, sources, write, prelude=()):
    """The Try the lock button: run the student's code, then the notebook's lock cell."""
    global _out, _events
    ns = _new_namespace()
    problems = _run_prelude(prelude, ns)
    error = _run_sources(sources, ns, write)
    result = {'error': error, 'prelude_problems': problems, 'messages': [], 'ok': False,
              'xp': 0, 'opened': None, 'new_files': [], 'escaped': False, 'already': False}
    if error:
        result['messages'] = ['⚠️ Your code raised an error, so the lock never got your answer. Fix the error shown in the console, then try again.']
        return result
    _out, _events = [], {}
    lock_ns = dict(ns)
    lock_ns.update(_CHECKERS)
    _kept.append(lock_ns)
    try:
        _exec('lock', LOCKS[check], lock_ns)
    except NameError as exc:
        _out.append(f"✋ I can't find the variable {exc.name}. Keep the variable names from the starter code, and make sure your code sets it.")
    except BaseException as exc:
        result['lock_error'] = _format_error(exc)
        _out.append('⚠️ The lock hit a Python error while reading your answer (shown in the console).')
    result['messages'] = _out
    result['ok'] = bool(_events.get('ok'))
    result['xp'] = _events.get('xp', 0)
    result['opened'] = _events.get('opened')
    result['new_files'] = _events.get('new_files', [])
    result['escaped'] = bool(_events.get('escaped'))
    result['already'] = bool(_events.get('already'))
    return result


# ---------- the file system, for the files panel ----------
SNAPSHOT_FILE_LIMIT = 100_000   # characters per file kept in the browser's storage
VIEW_LIMIT = 200_000


def _here():
    if HOME:
        os.chdir(HOME)
    return sorted(name for name in os.listdir('.') if os.path.isfile(name))


def list_files():
    return [{'name': name, 'size': os.path.getsize(name)} for name in _here()]


def read_file(name):
    with open(name, 'r', errors='replace') as f:
        text = f.read(VIEW_LIMIT + 1)
    return {'text': text[:VIEW_LIMIT], 'truncated': len(text) > VIEW_LIMIT}


def snapshot():
    """Every file's text, so the page can save it. Oversized files are left out."""
    files, skipped = {}, []
    for name in _here():
        if os.path.getsize(name) > SNAPSHOT_FILE_LIMIT:
            skipped.append(name)
            continue
        with open(name, 'r', errors='replace') as f:
            files[name] = f.read()
    return {'files': files, 'skipped': skipped}


def restore(files):
    for name, text in files.items():
        if '/' in name or name in ('', '.', '..'):
            continue
        with open(name, 'w') as f:
            f.write(text)


def reset_room(room):
    """Reset this room: delete what the room's code writes and rebuild the data files."""
    _here()
    for name in ROOM_OUTPUTS.get(room, []):
        if os.path.exists(name):
            os.remove(name)
    return build_files()


def start(home, state_json, files):
    """Called once when Python starts: restore the student's files, then the data files."""
    global HOME
    HOME = home
    os.makedirs(home, exist_ok=True)
    os.chdir(home)
    set_state(state_json)
    restore(files or {})
    build_files()
