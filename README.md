# Todo List

A sandbox for watching agents build the same small thing. Each branch holds one todo-list
implementation written end to end by a local model from a single prompt, with no follow-up
messages. `main` carries no code — only the brief and the numbers, so the runs stay
comparable instead of drifting apart.

The brief is deliberately narrow: browser-only, no build step, no dependencies, no server.
Everything that differs between runs comes from the agent rather than from the task.

## The prompt

> This is a fresh git repo. I'd like to spin up a simple todo-list app that runs in a browser (using js, html, css). Use browser storage to persist state. Initialize state with a few todo items. A user should be able to mark an item as done, at which point, it will disappear from the list. There should be an input for creating new items. Be creative with your styling. I'd also like an option to view done items. Each item should track and display when it was created, and when it was marked done.

## Runs

Same model, same agent, same hardware, same prompt, with a different context window. The
window turned out not to be the deciding variable: the 128K run peaked at 47.5K tokens, under
the ~50K point where the 64K run handed off, so it never used the extra room. The gap between
the runs is the route each agent took. Numbers come from the omp session logs, except where a
row names its source.

### 64K context — branch [`run-64k`](../../tree/run-64k)

"Stub List": ticket-stub rows, dark and light themes, a `kill` button that deletes a record
for good, timestamps that refresh every 60 seconds. Nine handoffs at the ~50K mark, and the
longer route: a shell and headless Chrome, with roughly a third of the 120 tool calls spent
re-reading work it had already written.

| | |
|---|---|
| Model | Qwen 3.8 Flash-Next, MTPLX "Optimized-Speed" 4-bit pack, served locally by MTPLX 2.12.0 |
| Agent | omp 18.12.6 |
| Hardware | Apple Silicon Mac, 128 GB unified memory, fully offline |
| Context window | 64K tokens |
| Prompts from me | 1 |
| Wall-clock time | 37.5 min (35.8 min of model time) |
| Model turns | 115 |
| Tool calls | 120: 39 shell, 36 read, 27 edit, 14 write, 4 grep |
| Tokens generated | ~105K, of which ~57K reasoning |
| Context handoffs | 9: at ~50K tokens, each compressed to ~25–30K |
| Median turn | 9.2 s; median time to first token 1.0 s |
| Generation speed | ~70–80 tokens/s (from the MTPLX server's metrics, not omp) |
| Result | 4 files, 919 lines |

### 128K context — branch [`run-128k`](../../tree/run-128k)

"Ledger": dark-only theme, three views, per-row created/done timestamps with relative ages.
The shorter route: 14 of its 41 calls drove a headless browser through omp's `eval` tool,
which is where adding, completing, the empty state, markup typed as todo text, and persistence
across a reload got checked. Peak context 47.5K, so the extra 64K of window went unused.

| | |
|---|---|
| Model | Qwen 3.8 Flash-Next, MTPLX "Optimized-Speed" 4-bit pack, served locally by MTPLX 2.12.0 |
| Agent | omp 18.12.6 |
| Hardware | Apple Silicon Mac, 128 GB unified memory, fully offline |
| Context window | 128K tokens |
| Prompts from me | 1 |
| Wall-clock time | 6.6 min (6.2 min of model time) |
| Model turns | 36 |
| Tool calls | 41: 14 browser eval, 8 read, 6 shell, 6 write, 6 edit, 1 grep |
| Tokens generated | ~26K, of which ~11K reasoning |
| Context handoffs | 0 (peak context 47.5K) |
| Median turn | 5.0 s; median time to first token 0.86 s |
| Result | 5 files, 788 lines |

No `Generation speed` row for the second run: that figure comes from the MTPLX server, which
keeps only its last 32 requests, and this build's turns had already aged out of that history
by the time the numbers were taken. What those metrics held afterwards was the later GitHub
work, at 44–60K-token prompts.

## Looking at one

Branches are self-contained; `main` has no code to run.

```sh
git switch run-64k           # or run-128k
python3 -m http.server 8731 --bind 127.0.0.1   # then open http://127.0.0.1:8731/
```

Two things worth knowing. `--bind` is there because `http.server` listens on every interface
by default, so on shared Wi-Fi an unbound server hands your todo list to the room. And serve
rather than double-clicking `index.html`: `localStorage` is scoped per origin and `file://`
gives an opaque one, so state can silently reset between launches. Each branch's own README
covers its storage key and how to reseed or wipe it.
