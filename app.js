'use strict';

/* ==========================================================================
   Ledger — a tiny todo list.
   State lives entirely in localStorage under one key; the whole app is a
   pure function of `state`, re-rendered on every change.
   ========================================================================== */

const STORAGE_KEY = '***';
const LEAVE_MS = 170;

/* ---------- tiny DOM helper ---------- */

const SVG_NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  }
  for (const kid of kids) node.append(kid);
  return node;
}

function checkIcon() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 14 14');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M2 7.6 5.4 11 12 3.6');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '2.2');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  return svg;
}

/* ---------- ids, time ---------- */

function newId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 't-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

const nowISO = () => new Date().toISOString();

function minsAgo(mins) {
  return new Date(Date.now() - mins * 60_000).toISOString();
}

/** "Oct 28 · 3:14 PM" (adds the year only when it differs from this one). */
function stampOf(iso) {
  const d = new Date(iso);
  const opts = { month: 'short', day: 'numeric' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return `${d.toLocaleDateString(undefined, opts)} · ${
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

/** "just now" / "12m ago" / "3h ago" / "2d ago"; older than a week shows nothing. */
function ageOf(iso) {
  const mins = (Date.now() - new Date(iso).getTime()) / 60_000;
  if (mins < 1) return 'just now';
  if (mins < 60) return `${Math.round(mins)}m ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
  if (mins < 60 * 24 * 7) return `${Math.round(mins / (60 * 24))}d ago`;
  return '';
}

/* ---------- state ---------- */

function seedItems() {
  const seed = [
    { text: 'Water the monstera', agoMin: 26 * 60 },
    { text: 'Reply to Kay about the kitchen reno', agoMin: 5 * 60 },
    { text: 'Renew passport — get the photos first', agoMin: 160 },
    { text: 'Cancel the newspaper subscription', agoMin: 50 * 60, done: true, doneAgoMin: 47 * 60 },
  ];
  return seed.map(({ text, agoMin, done, doneAgoMin }) => ({
    id: newId(),
    text,
    done: Boolean(done),
    createdAt: minsAgo(agoMin),
    completedAt: done ? minsAgo(doneAgoMin) : null,
  }));
}

function storageAvailable() {
  try {
    const probe = `${STORAGE_KEY}.probe`;
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

const canStore = storageAvailable();

function loadState() {
  const fallback = { filter: 'active', items: seedItems() };
  if (!canStore) return fallback;

  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return fallback;
  }
  if (raw === null) return fallback;

  try {
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed?.items) ? parsed.items.map(normalizeItem).filter(Boolean) : null;
    if (!items) return fallback;
    const filter = ['active', 'done', 'all'].includes(parsed.filter) ? parsed.filter : 'active';
    return { filter, items };
  } catch {
    return fallback; // unreadable blob: start over rather than wedge the app
  }
}

function normalizeItem(raw) {
  const text = typeof raw?.text === 'string' ? raw.text.trim() : '';
  if (!text) return null;
  const created = typeof raw.createdAt === 'string' && !Number.isNaN(Date.parse(raw.createdAt))
    ? raw.createdAt
    : nowISO();
  const done = raw.done === true;
  const completed = typeof raw.completedAt === 'string' && !Number.isNaN(Date.parse(raw.completedAt))
    ? raw.completedAt
    : null;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newId(),
    text,
    done,
    createdAt: created,
    completedAt: done ? (completed ?? created) : null,
  };
}

const state = loadState();

function persist() {
  if (!canStore) return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, ...state }));
    return true;
  } catch {
    return false;
  }
}

/* ---------- queries ---------- */

const byNewest = (a, b) => Date.parse(b.stamp) - Date.parse(a.stamp);

function visibleItems() {
  const { filter, items } = state;
  const pool = filter === 'active' ? items.filter((i) => !i.done)
    : filter === 'done' ? items.filter((i) => i.done)
    : items.slice();
  // Done items are ordered by when they were finished, everything else by arrival.
  const stamp = filter === 'done' ? (i) => i.completedAt ?? i.createdAt : (i) => i.createdAt;
  return pool.map((item) => ({ item, stamp: stamp(item) })).sort(byNewest).map((row) => row.item);
}

const countFor = (filter) =>
  filter === 'active' ? state.items.filter((i) => !i.done).length
  : filter === 'done' ? state.items.filter((i) => i.done).length
  : state.items.length;

const EMPTY_COPY = {
  active: 'Nothing active. Add something above.',
  done: 'Nothing marked done yet.',
  all: 'No todos yet. Add something above.',
};

/* ---------- rendering ---------- */

const board = document.querySelector('.board');
const listEl = document.getElementById('list');
const emptyEl = document.getElementById('empty');
const statusEl = document.getElementById('status');
const composer = document.getElementById('composer');
const input = document.getElementById('new-todo');
const meter = document.getElementById('meter');
const meterFill = document.getElementById('meter-fill');
const doneCountEl = document.getElementById('done-count');
const totalCountEl = document.getElementById('total-count');
const persistenceEl = document.getElementById('persistence');
const chips = [...document.querySelectorAll('.chip')];

function stampLine(kind, label, iso) {
  const span = el('span', { class: `stamp ${kind}`, title: new Date(iso).toLocaleString() });
  span.append(`${label} `);
  span.append(el('time', { datetime: iso, text: stampOf(iso) }));
  const age = ageOf(iso);
  if (age) span.append(' ', el('span', { class: 'age', text: `· ${age}` }));
  return span;
}

function renderItem(item, freshId) {
  const button = el('button', {
    type: 'button',
    class: 'check',
    'data-id': item.id,
    'aria-pressed': item.done ? 'true' : 'false',
    'aria-label': item.done
      ? `Mark “${item.text}” not done`
      : `Mark “${item.text}” done`,
  }, checkIcon());

  const meta = el('div', { class: 'meta' }, stampLine('added', 'Added', item.createdAt));
  // The leading space is dropped by flex layout but keeps copied text readable.
  if (item.done && item.completedAt) meta.append(' ', stampLine('completed', 'Done', item.completedAt));

  const li = el('li', {
    class: `item${item.done ? ' done' : ''}${item.id === freshId ? ' fresh' : ''}`,
    'data-id': item.id,
  }, button, el('div', { class: 'body' }, el('p', { class: 'text', text: item.text }), meta));

  return li;
}

function render({ freshId = null } = {}) {
  const shown = visibleItems();

  listEl.replaceChildren(...shown.map((item) => renderItem(item, freshId)));

  emptyEl.hidden = shown.length > 0;
  if (shown.length === 0) emptyEl.textContent = EMPTY_COPY[state.filter];

  for (const chip of chips) {
    const filter = chip.dataset.filter;
    const on = filter === state.filter;
    chip.classList.toggle('is-on', on);
    chip.setAttribute('aria-pressed', on ? 'true' : 'false');
    chip.querySelector('.chip-count').textContent = String(countFor(filter));
  }

  const total = state.items.length;
  const done = countFor('done');
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  meterFill.style.setProperty('--p', `${pct}%`);
  meter.setAttribute('aria-valuenow', String(pct));
  doneCountEl.textContent = String(done);
  totalCountEl.textContent = String(total);

  const when = new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  statusEl.textContent = total === 0
    ? `empty · ${when}`
    : `${total - done} active · ${done} done · shown at ${when}`;

  document.title = (total - done > 0 ? `(${total - done}) ` : '') + 'Ledger — todo list';
}

/* ---------- actions ---------- */

function addItem(text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  const item = {
    id: newId(),
    text: trimmed,
    done: false,
    createdAt: nowISO(),
    completedAt: null,
  };
  state.items.push(item);
  state.filter = 'active'; // new work belongs to the Active view
  persist();
  render({ freshId: item.id });
}

function toggleItem(id) {
  const item = state.items.find((i) => i.id === id);
  if (!item) return;

  item.done = !item.done;
  item.completedAt = item.done ? nowISO() : null;
  persist();

  const hides = (state.filter === 'active' && item.done) || (state.filter === 'done' && !item.done);
  const node = listEl.querySelector(`li[data-id="${CSS.escape(id)}"]`);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (hides && node && !reduceMotion) {
    // Let the row fade out before the list is rebuilt underneath it.
    node.classList.add('leaving');
    const check = node.querySelector('.check');
    if (check) check.disabled = true;
    setTimeout(render, LEAVE_MS);
  } else {
    render();
  }
}

/* ---------- wiring ---------- */

composer.addEventListener('submit', (event) => {
  event.preventDefault();
  addItem(input.value);
  input.value = '';
  input.focus();
});

input.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    input.value = '';
    event.preventDefault();
  }
});

listEl.addEventListener('click', (event) => {
  const check = event.target.closest?.('.check');
  if (!check || check.disabled) return;
  toggleItem(check.dataset.id);
});

for (const chip of chips) {
  chip.addEventListener('click', () => {
    if (state.filter === chip.dataset.filter) return;
    state.filter = chip.dataset.filter;
    persist();
    render();
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.target instanceof HTMLInputElement) return;
  event.preventDefault();
  input.focus();
  input.select();
});

if (!canStore) persistenceEl.textContent = 'No browser storage available — changes last until you reload.';

render();
