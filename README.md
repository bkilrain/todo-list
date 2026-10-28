# Stub List

A browser-only todo list. No build step, no dependencies, no server-side code: three files
(`index.html`, `styles.css`, `app.js`) that Chrome, Safari and Firefox load as-is.

## Run it

Serve the folder over HTTP and open `http://127.0.0.1:8731/index.html`:

```sh
cd todo-list
python3 -m http.server 8731        # or: npx serve ., or any static file server
```

Opening `index.html` straight off disk (`file://`) renders, but persistence is unreliable
there: Safari blocks `localStorage` for `file://` origins outright, and Chrome scopes it to
an opaque per-file origin that can silently reset between launches. The app degrades to
session-only state when storage throws, so nothing looks broken — it just forgets. Use a
local server.

## How it behaves

- **Three views.** `Active` holds open items, `Done` holds finished ones, `All` holds both.
  The selected tab is remembered, so a reload returns you to the view you were in.
- **Ticking a row finishes it.** The row leaves `Active` and its record is kept, stamped with
  the time it was done — it is not deleted. Undo by ticking it again, or with the `reopen`
  button in the `Done` / `All` views.
- **`kill` deletes for good.** That button removes the record, not just the row.
- **Timestamps.** Every row shows when it was created and how long it has been open; finished
  rows add when it was done and how long it took. Values refresh every 60 s (paused while the
  keyboard is inside the list).
- **`/` focuses the input** from anywhere except another text field. Adding from the `Done`
  view switches back to `Active` so the new row is visible.
- **The meter** tracks finished ÷ total, the tab counts track each view.

## Storage

One `localStorage` key, `stub-list.v1`, holding `{ view, items }`. Each item is
`{ id, text, done, createdAt, doneAt }`.

- First run (or an unreadable / non-array payload) reseeds seven sample items, three of them
  already finished; the seed is written to storage immediately.
- An empty list is treated as a real empty list, not as missing data.
- If storage is unavailable or full, the app keeps working for the session without saving.
- The `reset sample data` button in the footer restores the seven samples. To wipe instead,
  run `localStorage.removeItem('stub-list.v1')` and reload — no manual seeding required.

## Files

| File | Contents |
| --- | --- |
| `index.html` | Markup plus the `<script>` tag; the list, empty state and toast start empty and are filled by script. |
| `styles.css` | Design tokens for dark and light (`prefers-color-scheme`), the ticket-stub row styling, reduced-motion overrides. |
| `app.js` | State, `localStorage` read/write, the render pass and the event handlers. One IIFE, no globals. |

To change the starter data, edit `seed()` in `app.js`, then press `reset sample data` once —
existing storage wins over the seed.
