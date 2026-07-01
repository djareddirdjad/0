import { KEYBOARD_ROWS, ROTOR_WIRINGS, letterToIndex, indexToLetter } from "./rotors.js";
import { EnigmaMachine } from "./enigma.js";
import { findValidAlignments, buildMenu, runBombeSearch } from "./bombe.js";

// ---------------------------------------------------------------- state ----
const state = {
  rotorNames: ["I", "II", "III"],
  rings: [0, 0, 0],
  positions: [0, 0, 0],
  reflector: "B",
  plugPairs: [],
};

let machine = buildMachine();

function buildMachine() {
  return new EnigmaMachine({
    rotorNames: state.rotorNames,
    positions: [...state.positions],
    rings: [...state.rings],
    reflector: state.reflector,
    plugPairs: [...state.plugPairs],
  });
}

// ------------------------------------------------------------ tabs UI ------
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const target = btn.dataset.tab;
    document.getElementById("view-machine").classList.toggle("hidden", target !== "machine");
    document.getElementById("view-bombe").classList.toggle("hidden", target !== "bombe");
  });
});

// --------------------------------------------------------- rotor rack UI ---
function renderRotorRack() {
  const rack = document.getElementById("rotor-rack");
  rack.innerHTML = "";
  const labels = ["LEFT", "MIDDLE", "RIGHT"];
  machine.rotors.forEach((rotor, i) => {
    const win = document.createElement("div");
    win.className = "rotor-window";
    win.innerHTML = `
      <div class="label">${labels[i]} · ${rotor.name}</div>
      <div class="letter">${indexToLetter(rotor.position)}</div>
      <div class="step-btns">
        <button data-i="${i}" data-dir="-1">−</button>
        <button data-i="${i}" data-dir="1">+</button>
      </div>`;
    rack.appendChild(win);
  });
  rack.querySelectorAll("button").forEach((b) => {
    b.addEventListener("click", () => {
      const i = +b.dataset.i;
      const dir = +b.dataset.dir;
      machine.rotors[i].position = (machine.rotors[i].position + dir + 26) % 26;
      state.positions[i] = machine.rotors[i].position;
      renderRotorRack();
    });
  });
}

// ------------------------------------------------------- keyboard/lamps ----
function renderBoard(containerId, isKey) {
  const el = document.getElementById(containerId);
  el.innerHTML = "";
  KEYBOARD_ROWS.forEach((row) => {
    const rowEl = document.createElement("div");
    rowEl.className = "board-row";
    row.forEach((letter) => {
      const cell = document.createElement("div");
      cell.className = isKey ? "key" : "lamp";
      cell.textContent = letter;
      cell.dataset.letter = letter;
      if (isKey) cell.addEventListener("click", () => pressKey(letter));
      rowEl.appendChild(cell);
    });
    el.appendChild(rowEl);
  });
}

document.addEventListener("keydown", (e) => {
  const letter = e.key.toUpperCase();
  if (/^[A-Z]$/.test(letter) && !document.activeElement.matches("input")) {
    pressKey(letter);
  }
});

function pressKey(letter) {
  const keyEl = document.querySelector(`.key[data-letter="${letter}"]`);
  if (keyEl) {
    keyEl.classList.add("pressed");
    setTimeout(() => keyEl.classList.remove("pressed"), 120);
  }

  const inputIdx = letterToIndex(letter);
  const output = machine.encryptChar(letter);
  animateSignalPath(inputIdx, output);

  document.querySelectorAll(".lamp.lit").forEach((l) => l.classList.remove("lit"));
  const lampEl = document.querySelector(`.lamp[data-letter="${output}"]`);
  if (lampEl) {
    lampEl.classList.add("lit");
    setTimeout(() => lampEl.classList.remove("lit"), 350);
  }

  document.getElementById("ticker").textContent += output;
  renderRotorRack();
}

document.getElementById("clear-ticker").addEventListener("click", () => {
  document.getElementById("ticker").textContent = "";
});

// --------------------------------------------------- signal path diagram ---
// The signature element: a schematic of the actual electrical path, lit up
// segment by segment on every keypress so the mechanism itself is visible.
const STAGES = ["KEY", "PLUG", "R", "M", "L", "REFLECTOR", "L", "M", "R", "PLUG", "LAMP"];

function buildSignalSvg() {
  const svg = document.getElementById("signal-path");
  const n = STAGES.length;
  const w = 900, h = 220, margin = 50;
  const step = (w - margin * 2) / (n - 1);
  let nodesHtml = "";
  let pathD = "";
  for (let i = 0; i < n; i++) {
    const x = margin + i * step;
    const y = h / 2 + (i % 2 === 0 ? -18 : 18) * (i > 0 && i < n - 1 ? 1 : 0);
    nodesHtml += `<circle class="node" data-idx="${i}" cx="${x}" cy="${h/2}" r="5" fill="#3a3c2c" />
      <text x="${x}" y="${h/2 - 16}" text-anchor="middle" font-family="IBM Plex Mono" font-size="10" fill="#7c7a68">${STAGES[i]}</text>`;
    if (i > 0) {
      const prevX = margin + (i - 1) * step;
      pathD += `M ${prevX} ${h/2} L ${x} ${h/2} `;
    }
  }
  svg.innerHTML = `
    <path d="${pathD}" stroke="#3a3c2c" stroke-width="2" fill="none" />
    <path id="signal-live" d="" stroke="#ffb84d" stroke-width="3" fill="none"
      stroke-dasharray="1000" stroke-dashoffset="1000" />
    ${nodesHtml}
  `;
}

function animateSignalPath(inputIdx, outputLetter) {
  const svg = document.getElementById("signal-path");
  const n = STAGES.length;
  const w = 900, h = 220, margin = 50;
  const step = (w - margin * 2) / (n - 1);
  let d = `M ${margin} ${h/2} `;
  for (let i = 1; i < n; i++) d += `L ${margin + i * step} ${h/2} `;

  const live = document.getElementById("signal-live");
  live.setAttribute("d", d);
  live.style.transition = "none";
  live.style.strokeDashoffset = "1000";
  live.getBoundingClientRect(); // force reflow
  live.style.transition = "stroke-dashoffset 0.5s ease-out";
  live.style.strokeDashoffset = "0";

  svg.querySelectorAll(".node").forEach((node, i) => {
    setTimeout(() => {
      node.setAttribute("fill", "#ffb84d");
      node.setAttribute("r", "6");
    }, (i / (n - 1)) * 500);
  });
  setTimeout(() => {
    svg.querySelectorAll(".node").forEach((node) => {
      node.setAttribute("fill", "#3a3c2c");
      node.setAttribute("r", "5");
    });
  }, 700);
}

// ------------------------------------------------------------- settings ----
function renderRotorSelects() {
  const container = document.getElementById("rotor-selects");
  container.innerHTML = "";
  ["Left", "Middle", "Right"].forEach((label, i) => {
    const sel = document.createElement("select");
    sel.dataset.i = i;
    Object.keys(ROTOR_WIRINGS).forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = `${label}: ${name}`;
      if (name === state.rotorNames[i]) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener("change", () => (state.rotorNames[i] = sel.value));
    container.appendChild(sel);
  });
}

function renderRingSelects() {
  const container = document.getElementById("ring-selects");
  container.innerHTML = "";
  ["Left", "Middle", "Right"].forEach((label, i) => {
    const sel = document.createElement("select");
    for (let r = 0; r < 26; r++) {
      const opt = document.createElement("option");
      opt.value = r;
      opt.textContent = `${label}: ${indexToLetter(r)}`;
      if (r === state.rings[i]) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener("change", () => (state.rings[i] = +sel.value));
    container.appendChild(sel);
  });
}

document.getElementById("reflector-select").addEventListener("change", (e) => {
  state.reflector = e.target.value;
});

let plugSelection = null;
function renderPlugboard() {
  const board = document.getElementById("plugboard");
  board.innerHTML = "";
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach((letter) => {
    const cell = document.createElement("div");
    cell.className = "plug-key";
    cell.textContent = letter;
    const paired = state.plugPairs.find((p) => p.includes(letter));
    if (paired) cell.classList.add("paired");
    cell.addEventListener("click", () => handlePlugClick(letter, cell));
    board.appendChild(cell);
  });
  renderPlugPairsList();
}

function handlePlugClick(letter, cell) {
  const alreadyPaired = state.plugPairs.find((p) => p.includes(letter));
  if (alreadyPaired) return; // must unpair via the list below

  if (!plugSelection) {
    plugSelection = letter;
    cell.classList.add("selected");
    return;
  }
  if (plugSelection === letter) {
    plugSelection = null;
    cell.classList.remove("selected");
    return;
  }
  if (state.plugPairs.length >= 10) {
    plugSelection = null;
    return;
  }
  state.plugPairs.push([plugSelection, letter]);
  plugSelection = null;
  renderPlugboard();
}

function renderPlugPairsList() {
  const list = document.getElementById("plug-pairs-list");
  list.innerHTML = "";
  state.plugPairs.forEach((pair, idx) => {
    const span = document.createElement("span");
    span.textContent = `${pair[0]}${pair[1]} ×`;
    span.addEventListener("click", () => {
      state.plugPairs.splice(idx, 1);
      renderPlugboard();
    });
    list.appendChild(span);
  });
}

document.getElementById("reset-machine").addEventListener("click", () => {
  machine = buildMachine();
  renderRotorRack();
});

// ----------------------------------------------------------- Bombe view ----
let currentLoop = null;
let currentAlignment = null;

document.getElementById("find-alignments").addEventListener("click", () => {
  const cipher = document.getElementById("bombe-cipher").value.toUpperCase().replace(/[^A-Z]/g, "");
  const crib = document.getElementById("bombe-crib").value.toUpperCase().replace(/[^A-Z]/g, "");
  const out = document.getElementById("alignments-out");
  document.getElementById("loop-out").classList.add("hidden");
  document.getElementById("bombe-results").innerHTML = "";

  if (!cipher || !crib || crib.length > cipher.length) {
    out.innerHTML = `<p style="color:var(--muted)">Enter ciphertext and a shorter crib.</p>`;
    return;
  }

  const alignments = findValidAlignments(cipher, crib);
  if (!alignments.length) {
    out.innerHTML = `<p style="color:var(--wire)">No valid alignment — this crib can't fit anywhere (self-collision at every offset).</p>`;
    return;
  }

  out.innerHTML = `<p style="color:var(--muted); font-family: var(--mono); font-size:12px;">
    ${alignments.length} valid alignment(s). Click one to build the attack menu:</p>`;
  alignments.forEach((start) => {
    const chip = document.createElement("span");
    chip.className = "align-chip";
    chip.textContent = `offset ${start}`;
    chip.addEventListener("click", () => {
      document.querySelectorAll(".align-chip").forEach((c) => c.classList.remove("selected"));
      chip.classList.add("selected");
      selectAlignment(cipher, crib, start);
    });
    out.appendChild(chip);
  });
});

function selectAlignment(cipher, crib, start) {
  currentAlignment = start;
  const menu = buildMenu(cipher, crib, start);
  const loopOut = document.getElementById("loop-out");
  const diagram = document.getElementById("loop-diagram");

  if (!menu) {
    loopOut.classList.remove("hidden");
    diagram.innerHTML = `<span style="color:var(--wire)">No loop at this alignment (crib graph has no repeated-letter cycle) — try another offset, or a longer/different crib.</span>`;
    currentLoop = null;
    return;
  }

  currentLoop = menu;
  loopOut.classList.remove("hidden");
  diagram.innerHTML = menu.map((e) => `pos ${e.pos}: ${e.a} ⇄ ${e.b}`).join("<br/>") +
    `<br/><span style="color:var(--muted)">${menu.length} links in the menu graph — every repeated letter adds a constraint.</span>`;

  renderRotorPool();
}

function renderRotorPool() {
  const pool = document.getElementById("rotor-pool");
  pool.innerHTML = "";
  Object.keys(ROTOR_WIRINGS).forEach((name) => {
    const id = `pool-${name}`;
    const wrap = document.createElement("label");
    wrap.style.cssText = "font-family:var(--mono);font-size:12px;display:flex;gap:4px;align-items:center;";
    wrap.innerHTML = `<input type="checkbox" id="${id}" value="${name}" checked /> ${name}`;
    pool.appendChild(wrap);
  });
}

document.getElementById("run-bombe").addEventListener("click", async () => {
  if (!currentLoop) return;
  const pool = [...document.querySelectorAll("#rotor-pool input:checked")].map((i) => i.value);
  if (pool.length < 3) {
    alert("Select at least 3 rotors for the search pool.");
    return;
  }

  const progressWrap = document.getElementById("progress-wrap");
  const bar = document.getElementById("progress-bar");
  const label = document.getElementById("progress-label");
  progressWrap.classList.remove("hidden");
  bar.style.width = "0%";
  label.textContent = "0%";

  const resultsEl = document.getElementById("bombe-results");
  resultsEl.innerHTML = `<p style="color:var(--muted); font-family: var(--mono); font-size:12px;">Searching...</p>`;

  const results = await runBombeSearch(currentLoop, pool, state.reflector, {
    onProgress: (frac) => {
      bar.style.width = `${Math.round(frac * 100)}%`;
      label.textContent = `${Math.round(frac * 100)}%`;
    },
  });

  progressWrap.classList.add("hidden");
  renderBombeResults(results);
});

function renderBombeResults(results) {
  const el = document.getElementById("bombe-results");
  if (!results.length) {
    el.innerHTML = `<p style="color:var(--muted); font-family: var(--mono); font-size:12px;">No consistent settings found in this rotor pool. Try a different crib alignment, a longer crib, or a wider rotor pool.</p>`;
    return;
  }
  el.innerHTML = `<p style="color:var(--ok); font-family: var(--mono); font-size:12px;">${results.length} candidate "stop(s)" found — plugboard-independent loop closure held:</p>`;
  results.forEach((r) => {
    const row = document.createElement("div");
    row.className = "result-row";
    row.innerHTML = `<span>${r.order.join("-")}</span><span>${r.positions.join("")}</span><span class="ok">stop</span>`;
    row.addEventListener("click", () => {
      state.rotorNames = [...r.order];
      state.positions = r.positions.map(letterToIndex);
      machine = buildMachine();
      renderRotorSelects();
      renderRotorRack();
      document.querySelector('.tab[data-tab="machine"]').click();
    });
    el.appendChild(row);
  });
}

// -------------------------------------------------------------- init ------
function init() {
  buildSignalSvg();
  renderRotorRack();
  renderBoard("keyboard", true);
  renderBoard("lampboard", false);
  renderRotorSelects();
  renderRingSelects();
  renderPlugboard();
}
init();
