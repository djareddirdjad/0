import { ROTOR_WIRINGS, REFLECTORS, letterToIndex, indexToLetter } from "./rotors.js";
import { Rotor } from "./enigma.js";

// --- Step 1: alignment filtering -------------------------------------------
// The Enigma can never encrypt a letter to itself (a quirk of the reflector).
// So any crib alignment where crib[i] === cipher[i] for some i is IMPOSSIBLE
// and can be thrown out immediately. This alone eliminates most guesses —
// exactly how real codebreakers first narrowed down where a crib could sit.
function findValidAlignments(ciphertext, crib) {
  const valid = [];
  for (let start = 0; start + crib.length <= ciphertext.length; start++) {
    let ok = true;
    for (let i = 0; i < crib.length; i++) {
      if (ciphertext[start + i] === crib[i]) {
        ok = false;
        break;
      }
    }
    if (ok) valid.push(start);
  }
  return valid;
}

// --- Step 2: build the "menu" (crib graph) ----------------------------------
// Each position pairs a crib letter with a cipher letter. Chaining shared
// letters across positions builds a graph. A repeated letter creates a LOOP,
// and a loop is what makes the whole attack work: the unknown plugboard
// permutation cancels out perfectly all the way around it, so a candidate
// rotor setting can be tested without ever guessing the plugboard.
//
// Rather than picking just one minimal loop, we use every edge in the crib's
// connected component containing a loop — more constraints, far fewer false
// "stops". A pure tree (no loop at all) gives zero filtering power, since
// every letter would get a value with nothing to contradict it.
function buildMenu(ciphertext, crib, start) {
  // pos is the letter's ABSOLUTE position in the full message — rotor
  // stepping is counted from message start, not from where the crib begins.
  const edges = [];
  for (let i = 0; i < crib.length; i++) {
    edges.push({ pos: start + i + 1, a: crib[i], b: ciphertext[start + i] });
  }

  const adj = {};
  edges.forEach((e, idx) => {
    (adj[e.a] ||= []).push(idx);
    (adj[e.b] ||= []).push(idx);
  });

  // Find connected components (as sets of edge indices) via BFS over letters.
  const seenLetters = new Set();
  const components = [];
  for (const letter of Object.keys(adj)) {
    if (seenLetters.has(letter)) continue;
    const compEdgeIdx = new Set();
    const queue = [letter];
    seenLetters.add(letter);
    while (queue.length) {
      const node = queue.shift();
      for (const idx of adj[node] || []) {
        compEdgeIdx.add(idx);
        const other = edges[idx].a === node ? edges[idx].b : edges[idx].a;
        if (!seenLetters.has(other)) {
          seenLetters.add(other);
          queue.push(other);
        }
      }
    }
    components.push([...compEdgeIdx].map((i) => edges[i]));
  }

  // A component has a loop iff it has more edges than (distinct nodes - 1).
  const withLoop = components.filter((comp) => {
    const nodes = new Set();
    comp.forEach((e) => { nodes.add(e.a); nodes.add(e.b); });
    return comp.length > nodes.size - 1;
  });
  if (!withLoop.length) return null;

  // Prefer the richest (most constrained) component.
  withLoop.sort((a, b) => b.length - a.length);
  return withLoop[0]; // array of {pos, a, b}
}

// --- Step 3: precompute rotor positions at every step of the menu ----------
function stepPositions(rotors, count) {
  const snapshots = [];
  const [left, middle, right] = rotors;
  for (let s = 1; s <= count; s++) {
    const middleWillStep = middle.position === middle.notch;
    const rightAtNotch = right.position === right.notch;
    if (middleWillStep) {
      middle.position = (middle.position + 1) % 26;
      left.position = (left.position + 1) % 26;
    } else if (rightAtNotch) {
      middle.position = (middle.position + 1) % 26;
    }
    right.position = (right.position + 1) % 26;
    snapshots.push([left.position, middle.position, right.position]);
  }
  return snapshots;
}

function scramble(rotors, positions, x) {
  const [left, middle, right] = rotors;
  [left.position, middle.position, right.position] = positions;
  let c = x;
  c = right.forward(c);
  c = middle.forward(c);
  c = left.forward(c);
  c = REFLECTORS.__current[c];
  c = left.backward(c);
  c = middle.backward(c);
  c = right.backward(c);
  return c;
}

// --- Step 4: the search ------------------------------------------------------
// For a candidate rotor order + start position: hypothesize a plugboard
// value for one letter, then propagate it around the ENTIRE menu graph via
// the scrambler (no plugboard needed — it cancels out edge by edge, same
// insight as before, just applied everywhere at once). If propagation ever
// contradicts itself, this setting is impossible. If some seed value gets
// through the whole graph with zero contradictions, it's a genuine "stop" —
// exactly what Turing's Bombe found electromechanically.
function testSetting(rotors, menu, snaps) {
  const nodes = new Set();
  menu.forEach((e) => { nodes.add(e.a); nodes.add(e.b); });
  const startNode = menu[0].a;

  for (let seed = 0; seed < 26; seed++) {
    const assigned = { [startNode]: seed };
    let changed = true;
    let contradiction = false;

    while (changed && !contradiction) {
      changed = false;
      for (const edge of menu) {
        const va = assigned[edge.a];
        const vb = assigned[edge.b];
        if (va !== undefined && vb === undefined) {
          assigned[edge.b] = scramble(rotors, snaps[edge.pos - 1], va);
          changed = true;
        } else if (vb !== undefined && va === undefined) {
          // scramble is an involution, so the same function run on b's value
          // recovers a's value — this is what lets propagation go both ways.
          assigned[edge.a] = scramble(rotors, snaps[edge.pos - 1], vb);
          changed = true;
        } else if (va !== undefined && vb !== undefined) {
          if (scramble(rotors, snaps[edge.pos - 1], va) !== vb) { contradiction = true; break; }
        }
      }
    }
    if (!contradiction && Object.keys(assigned).length === nodes.size) {
      return { seed, letter: startNode };
    }
  }
  return null;
}

function permutations3(pool) {
  const results = [];
  for (const a of pool)
    for (const b of pool)
      for (const c of pool) if (a !== b && b !== c && a !== c) results.push([a, b, c]);
  return results;
}

async function runBombeSearch(menu, rotorPool, reflector, { onProgress, maxResults = 25 } = {}) {
  REFLECTORS.__current = REFLECTORS[reflector].split("").map(letterToIndex);
  const orders = permutations3(rotorPool);
  const results = [];
  let done = 0;
  const total = orders.length * 26 * 26 * 26;
  const maxPos = Math.max(...menu.map((e) => e.pos));

  for (const order of orders) {
    for (let lp = 0; lp < 26; lp++) {
      for (let mp = 0; mp < 26; mp++) {
        for (let rp = 0; rp < 26; rp++) {
          const rotors = order.map((name, i) => new Rotor(name, [lp, mp, rp][i], 0));
          const snaps = stepPositions(rotors, maxPos);
          const hit = testSetting(rotors, menu, snaps);

          if (hit) {
            results.push({
              order,
              positions: [lp, mp, rp].map(indexToLetter),
              plugHint: `${hit.letter}${indexToLetter(hit.seed)}`,
            });
            if (results.length >= maxResults) return results;
          }
        }
        done += 26;
        if (onProgress && done % (26 * 26) === 0) {
          onProgress(done / total);
          await new Promise((r) => setTimeout(r, 0)); // yield to keep UI responsive
        }
      }
    }
  }
  return results;
}

export { findValidAlignments, buildMenu, runBombeSearch, stepPositions, scramble, testSetting };
