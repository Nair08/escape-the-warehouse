// Room content, ported from ch07-escape-the-warehouse.ipynb. Starter code lives in starters/*.py.
// Each block is one editor. `check` names the notebook's lock cell (see LOCKS in py/warehouse.py).

export const RANKS = [
  [0, '🥾 Lost in the Lobby'], [30, '📦 Dock Worker'], [60, '📋 Inventory Specialist'],
  [100, '🗝️ Escape Artist'], [130, '👑 Warehouse Legend'],
];
export const MAX_XP = 130;

export const PREDICTS = {
  d1: {
    q: '<code>readline()</code> gives you the line plus an invisible character at the end. What is it, and what happens if you type it into a keypad?',
    options: [
      'A space; the keypad ignores spaces.',
      "A newline <code>'\\n'</code>; the keypad sees an extra character and rejects the code.",
      'A tab; the code still matches.',
      'Nothing extra: readline() returns exactly the text you see.',
    ],
    answer: 1,
    explain: "readline() keeps the newline that ends each line, so the string is one character longer than the code until you remove it with rstrip('\\n').",
  },
  d2: {
    q: 'What would happen if you forgot the last <code>readline()</code> inside the <code>while</code> loop?',
    options: [
      'The loop would stop after the first line.',
      'Python would raise an error right away.',
      'The loop would run forever.',
      'The loop would skip every other line.',
    ],
    answer: 2,
    explain: "Nothing inside the loop would change line, so it never becomes '' and the condition stays True forever. (If you try it, press Stop.)",
  },
  d3: {
    q: 'What does the <code>f.readline()</code> before the loop do, and what goes wrong without it?',
    options: [
      'It opens the file; without it you get a NameError.',
      "It reads and throws away the header line; without it, int() gets the text 'on_hand' and raises a ValueError.",
      'It reads the last line; without it, the loop misses the last item.',
      'Nothing important; you can delete it safely.',
    ],
    answer: 1,
    explain: "The first line is the header sku,item,on_hand,..., so reading it once moves past it. Otherwise the loop tries int('on_hand') and crashes with ValueError.",
  },
  d4a: {
    q: "You run this cell twice in <code>'a'</code> mode. What will <code>scratch.txt</code> contain?",
    options: [
      'One line, because each run replaces the file.',
      'Two identical lines, because append mode adds to the end each time.',
      'Nothing, because append mode only saves on the third run.',
      'An error, because the file already exists.',
    ],
    answer: 1,
    explain: "'a' keeps what's already in the file and adds to the end, so every run adds another copy of the line. 'w' would erase the file first and leave just one line.",
  },
  d4b: {
    q: 'Which mode should a report use?',
    options: [
      "<code>'a'</code>, so nothing is ever lost.",
      "<code>'w'</code>, so each run starts from an empty file.",
      "<code>'r'</code>, because reports are read by people.",
    ],
    answer: 1,
    explain: "A report should describe one run of your program. With 'a', every rerun would stack another copy of the report onto the old one.",
  },
  d5: {
    q: '<code>sales_wed.txt</code> was lost in the lockdown. What error will <code>open(\'sales_wed.txt\', \'r\')</code> raise?',
    options: ['ValueError', 'FileNotFoundError', 'NameError', 'TypeError'],
    answer: 1,
    explain: 'Opening a file that doesn\'t exist for reading raises FileNotFoundError. The last line of the error message always names the error.',
  },
  p1: {
    q: 'What will <code>scratch2.txt</code> contain after the first cell?',
    options: [
      "<code>'Line one\\nLine two\\n'</code>",
      "<code>'Line oneLine two'</code>",
      "<code>'Line one Line two'</code>",
      "<code>'Line two'</code>, because the second write replaces the first.",
    ],
    answer: 1,
    explain: '.write() writes exactly the string you give it. It adds no newline and no space, so the two strings run together.',
  },
  p2: {
    q: 'What happens when you run <code>f.write(42)</code>?',
    options: [
      "It writes the text '42'.",
      'It raises a TypeError.',
      'It writes the number as bytes.',
      'Nothing is written, but there is no error.',
    ],
    answer: 1,
    explain: '.write() only accepts strings. Convert numbers first with str(42) or an f-string.',
  },
};

export const ROOMS = {
  door1: {
    kind: 'door', num: 1, title: 'Door 1 · The Badge Reader', short: 'Badge Reader',
    skill: 'Reading one line', xp: 10, xpKeys: ['door1'], requires: 0,
    mission: "The first line of <code>door1.txt</code> is today's access code; everything after it is noise. Read only that line into <code>code1</code>, close the file, and try the lock.",
    tip: "Try the lock once <em>before</em> you clean up the line. Watching the lock reject your code is the fastest way to remember why <code>rstrip('\\n')</code> matters.",
    blocks: [{ id: 'door1', label: 'Door 1', predicts: ['d1'] }],
    lock: { check: 'door1', blocks: ['door1'] },
  },
  door2: {
    kind: 'door', num: 2, title: 'Door 2 · The Loading Dock Scale', short: 'Loading Dock Scale',
    skill: 'Reading every line with a loop', xp: 15, xpKeys: ['door2'], requires: 1,
    mission: "<code>shipment_weights.txt</code> has one weight (kg) per line, plus some blank lines, and one of them isn't quite empty. The code is the total weight, rounded to a whole number.",
    blocks: [
      { id: 'door2a', label: 'Door 2 Part A', title: 'Part A · the <code>while</code> loop', note: 'Fill in the three <code>...</code> blanks.', predicts: ['d2'] },
      { id: 'door2b', label: 'Door 2 Part B', title: 'Part B · the <code>for</code> loop', note: 'No scaffolding: total the weights with a <code>for</code> loop <strong>and</strong> count the shipments. The lock uses <code>round(total_for)</code>.' },
    ],
    lock: { check: 'door2', blocks: ['door2b'] },
  },
  door3: {
    kind: 'door', num: 3, title: 'Door 3 · The Inventory Terminal', short: 'Inventory Terminal',
    skill: 'Parsing fields with split()', xp: 15, xpKeys: ['door3'], requires: 2,
    mission: 'Each line of <code>inventory.csv</code> is <code>sku,item,on_hand,reorder_point,unit_cost</code>. The password is the first letter of every item whose <code>on_hand</code> is less than its <code>reorder_point</code>, in file order.',
    blocks: [{ id: 'door3', label: 'Door 3', predicts: ['d3'] }],
    lock: { check: 'door3', blocks: ['door3'] },
  },
  door4: {
    kind: 'door', num: 4, title: 'Door 4 · The Purchasing Printer', short: 'Purchasing Printer',
    skill: 'Writing a file', xp: 20, xpKeys: ['door4'], requires: 3,
    mission: 'This door has no clue file. It opens when <strong>you</strong> write a correct <code>reorder_list.txt</code> for the purchasing team.',
    blocks: [
      { id: 'door4-experiment', label: 'Door 4 experiment', title: "Experiment first · <code>'w'</code> vs <code>'a'</code>", note: 'Run this <strong>twice</strong>, then open <code>scratch.txt</code> in the files panel.', predicts: ['d4a', 'd4b'] },
      {
        id: 'door4', label: 'Door 4', title: 'Your task',
        spec: 'sku,item,qty_to_order\nS-204,Straps,65\n...',
        note: "One line per <strong>low-stock</strong> item. <code>qty_to_order = 2 * reorder_point - on_hand</code>. Use <code>print(..., sep=',', file=fout)</code>.",
      },
    ],
    lock: { check: 'door4', blocks: ['door4'] },
  },
  door5: {
    kind: 'door', num: 5, title: 'Door 5 · The Sales Office', short: 'Sales Office',
    skill: 'Handling errors with try/except', xp: 20, xpKeys: ['door5'], requires: 4,
    mission: "Total every valid sale in the week's <code>sales_*.txt</code> files without crashing: one file is missing, some lines are corrupted, and blank lines don't count. The code is that total, rounded to a whole number.",
    blocks: [
      { id: 'door5-crash', label: 'Door 5 crash test', title: 'Predict, then run', note: 'This is <em>supposed</em> to crash. Read the <strong>last line</strong> of the error.', predicts: ['d5'] },
      { id: 'door5', label: 'Door 5', title: 'Your task', note: 'Keep <code>missing_files</code> and <code>bad_lines</code>: the final door needs them. Tip: <code>except FileNotFoundError:</code> and <code>except ValueError:</code> catch just the errors you expect.' },
    ],
    lock: { check: 'door5', blocks: ['door5'] },
  },
  final: {
    kind: 'door', num: 6, title: 'Final Door · The Escape Report', short: 'Escape Report',
    skill: 'Writing a formatted report', xp: 20, xpKeys: ['final'], requires: 5,
    mission: 'Write <code>escape_report.txt</code> for your manager with <strong>exactly</strong> these six lines, filled in with your numbers.',
    blocks: [{
      id: 'final', label: 'Final Door',
      spec: 'ESCAPE REPORT - Riverbend Supply Co.\nTotal shipment weight (kg): ____\nItems to reorder: ____\nWeekly sales total: $____\nBad sales records skipped: ____\nMissing sales files: ____',
      note: '<p>Replace each <code>____</code> with a value (no brackets, no blanks left over):</p><ul class="fill-list">'
        + '<li><strong>Total shipment weight:</strong> the door 2 total as a whole number, e.g. <code class="use">round(total_for)</code> or <code class="use">code2</code></li>'
        + '<li><strong>Items to reorder:</strong> how many items are low on stock, as a number. <code>code3</code> has one letter per low-stock item, so <code class="use">len(code3)</code> is the count.</li>'
        + `<li><strong>Weekly sales total:</strong> commas and exactly 2 decimals, like $1,234.50. <code class="use">f'{week_total:,.2f}'</code> does this.</li>`
        + '<li><strong>Bad sales records skipped:</strong> the count from door 5, <code class="use">bad_lines</code></li>'
        + '<li><strong>Missing sales files:</strong> the missing file\'s name. <code class="use">missing_files[0]</code> gets the first item of a list.</li></ul>',
    }],
    // The notebook's lock cells also left code2 and code5 behind, so the final room recreates them.
    prelude: [['door2b', 'Door 2 Part B'], [null, 'Door 2 lock', 'code2 = round(total_for)'],
      ['door3', 'Door 3'], ['door5', 'Door 5'], [null, 'Door 5 lock', 'code5 = round(week_total)']],
    preludeNote: 'Each time you run, your saved code from Doors 2, 3 and 5 runs first (quietly), so these are ready to use: <code>total_for</code>, <code>code2</code>, <code>code3</code>, <code>week_total</code>, <code>code5</code>, <code>bad_lines</code> and <code>missing_files</code>.',
    lock: { check: 'final', blocks: ['final'] },
  },
  bugs: {
    kind: 'bonus', title: '⭐ Bug Bounty', short: 'Bug Bounty', skill: 'Fixing classic file mistakes',
    xp: 20, xpKeys: ['bugA', 'bugB', 'bugC', 'bugD'], requires: 0,
    mission: 'Each program has one classic file-handling bug, the kind professionals make too. Fix it in place, then check it. 5 XP each.',
    blocks: [
      { id: 'bugA', label: 'Bug A', title: '🐛 Bug A · The Header Crash', note: '<code>temps.txt</code> holds four temperature readings, but this crashes. Make <code>avg_a</code> the average of the readings.', check: 'bugA', xpKey: 'bugA' },
      { id: 'bugB', label: 'Bug B', title: '🐛 Bug B · The Empty Report', note: 'This runs without errors, but open <code>bug_b.txt</code>: it\'s empty! Why?', check: 'bugB', xpKey: 'bugB' },
      { id: 'bugC', label: 'Bug C', title: '🐛 Bug C · The Disappearing Lines', note: 'This should write all three team members to <code>team.txt</code>, one per line. Only one name survives. Why?', check: 'bugC', xpKey: 'bugC' },
      { id: 'bugD', label: 'Bug D', title: "🐛 Bug D · The Loop That Wouldn't Stop", note: '<code>orders_log.txt</code> lists today\'s orders, then <code>END</code>, then old archived orders. Count only the orders <strong>before</strong> <code>END</code>.', check: 'bugD', xpKey: 'bugD' },
    ],
  },
  pro: {
    kind: 'bonus', title: '⭐ The Pro Way', short: 'The Pro Way', skill: 'with and .write()',
    xp: 10, xpKeys: ['pro'], requires: 2,
    mission: 'A <code>with</code> block closes the file for you, even if an error happens. Rewrite your Door 4 program the professional way.',
    intro: "with open('notes.txt', 'w') as f:\n    f.write('First line\\n')\n# f is closed here, automatically",
    introNote: '<code>.write()</code> takes exactly <strong>one string</strong>, adds <strong>no newline</strong> (include <code>\'\\n\'</code> yourself), and does <strong>not</strong> convert numbers.',
    blocks: [
      { id: 'pro-predict1', label: 'Pro Way predict 1', title: 'Predict, then run', predicts: ['p1'] },
      { id: 'pro-predict2', label: 'Pro Way predict 2', title: 'And this one?', predicts: ['p2'] },
      { id: 'pro', label: 'Pro Way', title: 'Your task', note: 'Create <code>reorder_list_v2.txt</code> using <code>with</code> for <strong>both</strong> files and <code>.write()</code> instead of <code>print()</code>. It must match <code>reorder_list.txt</code> exactly.' },
    ],
    lock: { check: 'pro', blocks: ['pro'] },
  },
};

export const MAP_ORDER = ['door1', 'door2', 'door3', 'door4', 'door5', 'final', 'bugs', 'pro'];
export const NEXT_ROOM = { door1: 'door2', door2: 'door3', door3: 'door4', door4: 'door5', door5: 'final' };

export function rankFor(xp) {
  return RANKS.filter(([need]) => xp >= need).pop()[1];
}
