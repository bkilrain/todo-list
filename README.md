# Ledger

A single-screen todo list. No build step, no dependencies: open `index.html`'s folder over HTTP and it works.

## Run

```sh
python3 -m http.server 8765
# then open http://127.0.0.1:8765/
```

Serving matters because `localStorage` is scoped per origin: `file://` pages get an opaque
origin in some browsers, so state may not survive a reload. Use the HTTP URL.

## Behaviour

- **Active** is the default view. Marking an item done writes a completion timestamp and
  removes it from that list immediately.
- **Done** and **All** are reachable from the segmented control; Done is ordered by when
  items were finished, everything else by arrival (newest first).
- Each row shows when it was created and, once done, when it was completed — both as a
  readable timestamp and as a full local timestamp in the tooltip.
- New items: type in the composer and press Enter. Blank or whitespace-only input is
  ignored. Press `/` outside a text field to jump to the composer, `Esc` to clear it.
- The check button is a toggle: from the Done view it reopens an item.

## State

Everything lives in `localStorage` under `ledger.todos.v1` as
`{ v, filter, items: [{ id, text, done, createdAt, completedAt }] }`.

- The seed list (four items, one already done) is written only when that key is absent, so
  an emptied list stays empty.
- Clear the key in DevTools — or run `localStorage.removeItem('ledger.todos.v1')` — to
  reseed.
- If storage is unavailable (private mode, disabled), the app detects it, says so in the
  footer, and runs in memory until reload.

## Files

| File | Role |
| --- | --- |
| `index.html` | Structure and landmarks. |
| `styles.css` | Dark "ledger" theme, ambient glows, motion. |
| `app.js` | State, storage, rendering. |

Rendering rebuilds the list from state on every change and builds rows with DOM APIs plus
`textContent`, so todo text can never be parsed as markup.
