/* Stub List — a tiny browser-only todo app.
   State lives in localStorage; the whole UI is rebuilt from state on each change. */
(() => {
  'use strict';

  /* ------------------------------------------------------------------ config */
  const STORAGE_KEY = 'stub-lis…t.v1';
  const VIEWS = ['active', 'done', 'all'];
  const MIN = 60e3, HOUR = 60 * MIN, DAY = 24 * HOUR;
  const LEAVE_MS = 260;                 // row exit animation budget
  const TOAST_MS = 6000;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const $ = (sel, root = document) => root.querySelector(sel);
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  /* ----------------------------------------------------------------- storage */
  // localStorage may be unavailable (private mode, sandboxed origin); fall back to
  // session-only state so the app still works, just without persistence.
  const readRaw = () => { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } };
  const writeRaw = raw => { try { localStorage.setItem(STORAGE_KEY, raw); } catch { /* session-only */ } };

  /* ------------------------------------------------------------------- state */
  // item = { id, text, done, createdAt: ms, doneAt: ms|null }
  let state = load() || { view: 'active', items: seed() };
  let lastAdded = null;                 // id of a freshly created row (for entry animation)
  let toastTimer = 0;

  function load() {
    const raw = readRaw();
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      // A payload with no usable item list is junk, not an empty list: reseed it.
      if (!Array.isArray(parsed?.items)) return null;
      return {
        view: VIEWS.includes(parsed.view) ? parsed.view : 'active',
        items: parsed.items.filter(isItem).map(i => ({
          id: String(i.id), text: String(i.text), done: !!i.done,
          createdAt: Number(i.createdAt) || Date.now(),
          doneAt: Number(i.doneAt) || null,
        })),
      };
    } catch { return null; }                            // unreadable payload → reseed
  }

  function save() {
    writeRaw(JSON.stringify(state));
  }

  function isItem(v) {
    return v && typeof v.text === 'string' && v.text.length > 0 && Number.isFinite(Number(v.createdAt));
  }

  function makeId() {
    return (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2));
  }

  function seed() {
    const now = Date.now();
    const t = (days, hours) => now - days * DAY - hours * HOUR;
    const rows = [
      ['Replace the dishwasher water filter', t(3, 6), t(2, 2)],
      ['Rotate tires — front-left is at 6k miles', t(5, 3), t(4, 9)],
      ['Water the fern. It is judging you.', t(0, 18), t(0, 17)],
      ['Draft the Q4 roadmap one-pager', t(1, 4), null],
      ['Reply to Marta about the storage unit', t(0, 9), null],
      ['Book the Thursday climbing-gym slot', t(0, 4), null],
      ['Back up the laptop before the update', t(0, 1), null],
    ];
    return rows.map(([text, createdAt, doneAt]) => ({
      id: makeId(), text, done: doneAt !== null, createdAt, doneAt,
    }));
  }

  /* --------------------------------------------------------------- formatting */
  const dateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
  const yearFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

  function stamp(ms, now) {
    const d = new Date(ms);
    const date = (d.getFullYear() === new Date(now).getFullYear() ? dateFmt : yearFmt).format(d);
    return `${date} · ${timeFmt.format(d)}`;
  }

  function ago(ms, now) {
    const d = now - ms;
    if (d < 45e3) return 'just now';
    if (d < HOUR) return `${Math.round(d / MIN)}m ago`;
    if (d < DAY) return `${Math.round(d / HOUR)}h ago`;
    if (d < 14 * DAY) return `${Math.round(d / DAY)}d ago`;
    return '';
  }

  function span(from, to) {
    const d = Math.max(0, to - from);
    if (d < HOUR) return `${Math.max(1, Math.round(d / MIN))}m`;
    if (d < DAY) return `${Math.floor(d / HOUR)}h ${Math.round((d % HOUR) / MIN)}m`;
    return `${Math.floor(d / DAY)}d ${Math.round((d % DAY) / HOUR)}h`;
  }

  /* ------------------------------------------------------------------ queries */
  const activeItems = () => state.items.filter(i => !i.done);
  const doneItems = () => state.items.filter(i => i.done);

  function visible() {
    const byNewest = (a, b) => b.createdAt - a.createdAt;
    if (state.view === 'done') return doneItems().sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
    if (state.view === 'all') {
      const rows = activeItems().sort(byNewest);
      return rows.concat(doneItems().sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)));
    }
    return activeItems().sort(byNewest);
  }

  const find = id => state.items.find(i => i.id === id);

  /* ----------------------------------------------------------------- mutations */
  function add(text) {
    const item = { id: makeId(), text, done: false, createdAt: Date.now(), doneAt: null };
    state.items.push(item);
    lastAdded = item.id;
    if (state.view === 'done') state.view = 'active';    // don't hide the new row
    save();
    render();
  }

  function setDone(id, done) {
    const item = find(id);
    if (!item || item.done === done) return;
    item.done = done;
    item.doneAt = done ? Date.now() : null;
    save();
    render();
    if (done) {
      flash(`“${item.text}” closed after ${span(item.createdAt, item.doneAt)}`);
    }
  }

  function remove(id) {
    const item = find(id);
    if (!item) return;
    state.items = state.items.filter(i => i.id !== id);
    save();
    render();
    flash(`Deleted “${item.text}”`);
  }

  /* --------------------------------------------------------------------- view */
  const listEl = $('#list');
  const emptyEl = $('#empty');
  const tallyEl = $('#tally');
  const meterEl = $('#meter');
  const meterFill = $('#meterFill');
  const toastEl = $('#toast');
  const toastText = $('#toastText');
  const glider = $('#tabGlider');
  const tabs = Array.from(document.querySelectorAll('.tab'));

  const EMPTY_COPY = {
    active: 'Inbox zero. Add something below.',
    done: 'Nothing finished yet — go tick something.',
    all: 'This list is completely empty.',
  };

  function render() {
    const now = Date.now();
    const rows = visible();

    listEl.replaceChildren(...rows.map(item => row(item, now)));
    listEl.hidden = rows.length === 0;

    emptyEl.hidden = rows.length !== 0;
    emptyEl.textContent = EMPTY_COPY[state.view];

    const done = doneItems().length, total = state.items.length;
    tallyEl.textContent = total === 0
      ? 'no items'
      : `${total - done} open · ${done} done · ${Math.round((done / total) * 100)}% closed`;
    meterFill.style.setProperty('--pct', `${total ? (done / total) * 100 : 0}%`);
    meterEl.setAttribute('aria-label', `${done} of ${total} items done`);

    for (const tab of tabs) {
      const view = tab.dataset.view;
      tab.setAttribute('aria-selected', String(view === state.view));
      tab.querySelector('.tab-count').textContent =
        view === 'all' ? total : view === 'done' ? done : total - done;
    }
    glider.dataset.to = state.view;
    lastAdded = null;
  }

  function row(item, now) {
    const li = el('li', 'item' + (item.done ? ' is-done' : ''));
    li.dataset.id = item.id;
    if (item.id === lastAdded) li.classList.add('is-new');

    const label = el('label', 'tick');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = item.done;
    box.setAttribute('aria-label', item.done ? `Reopen ${item.text}` : `Complete ${item.text}`);
    box.dataset.action = 'toggle';
    box.dataset.id = item.id;
    label.append(box, el('span', 'tick-box', '\u2713'));
    label.title = item.done ? 'Reopen this item' : 'Mark done';

    const body = el('div', 'body');
    body.append(el('p', 'text', item.text));

    const meta = el('div', 'meta');
    const created = `${stamp(item.createdAt, now)}${ago(item.createdAt, now) ? ' · ' + ago(item.createdAt, now) : ''}`;
    meta.append(el('span', 'meta-line', `created ${created}`));
    if (item.done && item.doneAt) {
      meta.append(el('span', 'meta-line done-at',
        `done ${stamp(item.doneAt, now)} · open ${span(item.createdAt, item.doneAt)}`));
    }
    body.append(meta);

    const actions = el('div', 'actions');
    if (item.done) {
      const reopen = el('button', 'ghost', 'reopen');
      reopen.type = 'button';
      reopen.dataset.action = 'reopen';
      reopen.dataset.id = item.id;
      actions.append(reopen);
    }
    const kill = el('button', 'ghost kill', '\u2715');
    kill.type = 'button';
    kill.dataset.action = 'delete';
    kill.dataset.id = item.id;
    kill.title = 'Delete permanently';
    kill.setAttribute('aria-label', `Delete ${item.text}`);
    actions.append(kill);

    li.append(label, body, actions);
    return li;
  }

  function flash(message) {
    toastText.textContent = message;
    toastEl.classList.remove('is-live');
    void toastEl.offsetWidth;                           // restart the entry animation
    toastEl.hidden = false;
    toastEl.classList.add('is-live');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, TOAST_MS);
  }

  /* ---------------------------------------------------------------- wiring */
  listEl.addEventListener('change', e => {
    const box = e.target;
    if (box.dataset.action === 'toggle') setDone(box.dataset.id, box.checked);
  });

  listEl.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.tagName === 'INPUT') return;
    const { action, id } = btn.dataset;
    if (action === 'reopen') setDone(id, false);
    if (action === 'delete') {
      const li = btn.closest('.item');
      if (!li || reduceMotion) return remove(id);
      li.classList.add('is-leaving');
      setTimeout(() => remove(id), LEAVE_MS);            // let the row finish falling away
    }
  });

  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      if (state.view === tab.dataset.view) return;
      state.view = tab.dataset.view;
      save();
      render();
    });
  }

  $('#composer').addEventListener('submit', e => {
    e.preventDefault();
    const field = $('#field');
    const text = field.value.trim();
    if (!text) { field.focus(); return; }
    add(text);
    field.value = '';
  });

  $('#reset').addEventListener('click', () => {
    state = { view: 'active', items: seed() };
    save();
    render();
    flash('Sample data restored');
  });

  document.addEventListener('keydown', e => {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    e.preventDefault();
    $('#field').focus();
  });

  save();                                                 // persist the seed on first run
  render();
  // Relative timestamps drift, so re-render periodically — but skip the tick while the
  // keyboard lives inside the list, because a re-render rebuilds every row.
  setInterval(() => {
    if (!listEl.contains(document.activeElement)) render();
  }, 6e4);
})();