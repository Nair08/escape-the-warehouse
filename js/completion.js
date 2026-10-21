// The completion code students hand in. The instructor's private checker (_private/verify.html) copies SALT and
// normalizeName; _private/e2e/test_site.py fails if the two ever disagree. Never change either: codes already handed in would stop matching.
const SALT = 'riverbend-escape-complete';

export function normalizeName(name) {
  return String(name).trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function completionCode(name) {
  const bytes = new TextEncoder().encode(SALT + normalizeName(name));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return 'RIVERBEND-' + hex.slice(0, 6).toUpperCase();
}
