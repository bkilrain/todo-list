(function () {
  "use strict";

  var STORAGE_KEY = "todo-list-ornith.v1";

  // --- State -------------------------------------------------------------
  var state = {
    items: [],        // { id, text, createdAt, doneAt }
    view: "active"    // "active" | "done"
  };

  var seedData = [
    { text: "Design the landing page for the new product", createdAt: Date.now() - 86400000 * 2 },
    { text: "Buy groceries — milk, eggs, coffee", createdAt: Date.now() - 3600000 * 5 },
    { text: "Reply to the design review comments", createdAt: Date.now() - 600000 },
    { text: "Read a chapter of that new book", createdAt: Date.now() - 86400000 * 6, doneAt: Date.now() - 86400000 }
  ];

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.items)) {
        state.items = parsed.items.map(function (it) {
          return {
            id: it.id,
            text: String(it.text),
            createdAt: Number(it.createdAt) || Date.now(),
            doneAt: it.doneAt ? Number(it.doneAt) : null
          };
        });
      }
    } catch (e) {
      console.error("Could not load todos:", e);
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: state.items }));
    } catch (e) {
      console.error("Could not save todos:", e);
    }
  }

  function seed() {
    seedData.forEach(function (s) {
      state.items.push({
        id: uid(),
        text: s.text,
        createdAt: s.createdAt,
        doneAt: s.doneAt || null
      });
    });
    persist();
  }

  // --- Utils -------------------------------------------------------------
  function uid() {
    return "id_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function add(text) {
    text = text.trim();
    if (!text) return;
    state.items.unshift({
      id: uid(),
      text: text,
      createdAt: Date.now(),
      doneAt: null
    });
    persist();
    render();
  }

  function toggleDone(id) {
    var item = byId(id);
    if (!item) return;
    item.doneAt = item.doneAt == null ? Date.now() : null;
    persist();
    render();
  }

  function remove(id) {
    state.items = state.items.filter(function (it) { return it.id !== id; });
    persist();
    render();
  }

  function clearDone() {
    state.items = state.items.filter(function (it) { return it.doneAt == null; });
    persist();
    render();
  }

  function byId(id) {
    for (var i = 0; i < state.items.length; i++) {
      if (state.items[i].id === id) return state.items[i];
    }
    return null;
  }

  // --- Rendering ---------------------------------------------------------
  var els = {};

  function $(sel) { return document.querySelector(sel); }

  function fmt(ts) {
    var d = new Date(ts);
    return d.toLocaleString(undefined, {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  }

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function render() {
    var list = els.list;
    var active = state.items.filter(function (it) { return it.doneAt == null; });
    var done = state.items.filter(function (it) { return it.doneAt != null; });

    // counts
    els.count.textContent =
      active.length + " active" + (active.length === 1 ? "" : "s") +
      " · " + done.length + " done";
    els.doneBadge.textContent = String(done.length);

    // tabs
    var isDone = state.view === "done";
    els.tabActive.classList.toggle("is-active", !isDone);
    els.tabActive.setAttribute("aria-selected", String(!isDone));
    els.tabDone.classList.toggle("is-active", isDone);
    els.tabDone.setAttribute("aria-selected", String(isDone));

    els.clearDone.hidden = !isDone || done.length === 0;

    list.dataset.view = state.view;
    list.innerHTML = "";

    var show = isDone ? done : active;
    if (show.length === 0) {
      els.empty.hidden = false;
      els.empty.textContent = isDone
        ? "No completed items yet. Nice work!"
        : "All caught up — nothing active.";
      return;
    }

    els.empty.hidden = true;

    show.forEach(function (it) {
      var li = document.createElement("li");
      li.className = "item" + (it.doneAt ? " is-done" : "");

      var check = document.createElement("button");
      check.type = "button";
      check.className = "item__check";
      check.setAttribute("aria-label", it.doneAt ? "Mark as not done" : "Mark as done");
      check.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7.5L5.5 11L12 3" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      check.addEventListener("click", function () { toggleDone(it.id); });

      var body = document.createElement("div");
      body.className = "item__body";

      var text = document.createElement("div");
      text.className = "item__text";
      text.textContent = it.text;

      var meta = document.createElement("div");
      meta.className = "item__meta";

      var created = document.createElement("span");
      created.className = "dot";
      created.innerHTML = "created " + fmt(it.createdAt);

      meta.appendChild(created);

      if (it.doneAt) {
        var doneEl = document.createElement("span");
        doneEl.className = "is-done";
        doneEl.innerHTML = "done " + fmt(it.doneAt);
        meta.appendChild(doneEl);
      }

      body.appendChild(text);
      body.appendChild(meta);

      var del = document.createElement("button");
      del.type = "button";
      del.className = "item__del";
      del.setAttribute("aria-label", "Delete item");
      del.textContent = "✕";
      del.addEventListener("click", function () { remove(it.id); });

      li.appendChild(check);
      li.appendChild(body);
      li.appendChild(del);
      list.appendChild(li);
    });
  }

  // --- Wiring ------------------------------------------------------------
  function init() {
    els.list = $("#list");
    els.count = $("#count");
    els.doneBadge = $("#doneBadge");
    els.empty = $("#empty");
    els.tabActive = $("#tabActive");
    els.tabDone = $("#tabDone");
    els.clearDone = $("#clearDone");

    load();
    if (state.items.length === 0) seed();

    $("#addForm").addEventListener("submit", function (e) {
      e.preventDefault();
      add($("#addInput").value);
      $("#addInput").value = "";
      state.view = "active"; // jump to active so the new item is visible
      render();
      $("#addInput").focus();
    });

    els.tabActive.addEventListener("click", function () { state.view = "active"; render(); });
    els.tabDone.addEventListener("click", function () { state.view = "done"; render(); });
    els.clearDone.addEventListener("click", clearDone);

    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
