import { ROTOR_WIRINGS, REFLECTORS, letterToIndex, indexToLetter } from "./rotors.js";

class Rotor {
  constructor(name, position = 0, ring = 0) {
    const def = ROTOR_WIRINGS[name];
    this.name = name;
    this.wiring = def.wiring.split("").map(letterToIndex); // forward map
    this.inverse = new Array(26);
    this.wiring.forEach((out, inp) => (this.inverse[out] = inp)); // backward map
    this.notch = letterToIndex(def.notch);
    this.position = position; // 0-25, current rotation offset (Grundstellung)
    this.ring = ring; // 0-25, Ringstellung
  }

  // Is this rotor sitting at its turnover notch right now?
  atNotch() {
    return this.position === this.notch;
  }

  step() {
    this.position = (this.position + 1) % 26;
  }

  // Signal entering from the right-hand side (keyboard side), going left.
  forward(c) {
    const shifted = (c + this.position - this.ring + 26) % 26;
    const wired = this.wiring[shifted];
    return (wired - this.position + this.ring + 26) % 26;
  }

  // Signal returning from the reflector, going right.
  backward(c) {
    const shifted = (c + this.position - this.ring + 26) % 26;
    const wired = this.inverse[shifted];
    return (wired - this.position + this.ring + 26) % 26;
  }
}

class Plugboard {
  constructor(pairs = []) {
    this.map = new Array(26).fill(null).map((_, i) => i);
    this.setPairs(pairs);
  }

  setPairs(pairs) {
    this.map = new Array(26).fill(null).map((_, i) => i);
    for (const [a, b] of pairs) {
      const i = letterToIndex(a);
      const j = letterToIndex(b);
      this.map[i] = j;
      this.map[j] = i;
    }
  }

  swap(c) {
    return this.map[c];
  }
}

class EnigmaMachine {
  // rotorNames: [left, middle, right] e.g. ["I","III","V"]
  // positions/rings: [left, middle, right], 0-25
  constructor({ rotorNames, positions = [0, 0, 0], rings = [0, 0, 0], reflector = "B", plugPairs = [] }) {
    this.rotors = rotorNames.map((name, i) => new Rotor(name, positions[i], rings[i]));
    this.reflectorWiring = REFLECTORS[reflector].split("").map(letterToIndex);
    this.plugboard = new Plugboard(plugPairs);
  }

  // The famous double-step anomaly: the middle rotor, if it is sitting on
  // its own notch, steps itself AND kicks the left rotor over too — meaning
  // it moves on two consecutive keypresses in a row.
  stepRotors() {
    const [left, middle, right] = this.rotors;
    const middleWillStep = middle.atNotch();
    const rightAtNotch = right.atNotch();

    if (middleWillStep) {
      middle.step();
      left.step();
    } else if (rightAtNotch) {
      middle.step();
    }
    right.step();
  }

  encryptChar(ch) {
    if (!/[A-Za-z]/.test(ch)) return ch;
    this.stepRotors();

    let c = letterToIndex(ch);
    c = this.plugboard.swap(c);

    // Right to left through the rotors (keyboard -> reflector)
    for (let i = this.rotors.length - 1; i >= 0; i--) {
      c = this.rotors[i].forward(c);
    }

    c = this.reflectorWiring[c];

    // Left to right back through the rotors (reflector -> lamp)
    for (let i = 0; i < this.rotors.length; i++) {
      c = this.rotors[i].backward(c);
    }

    c = this.plugboard.swap(c);
    return indexToLetter(c);
  }

  encryptString(text) {
    return text
      .split("")
      .map((ch) => (/[A-Za-z]/.test(ch) ? this.encryptChar(ch) : ch))
      .join("");
  }

  positionsAsLetters() {
    return this.rotors.map((r) => indexToLetter(r.position));
  }
}

export { EnigmaMachine, Rotor, Plugboard };
