// Historical wiring tables for the Wehrmacht Enigma I / M3.
// Wiring strings map A-Z (index 0-25) to the letter that position is hard-wired to.
// Notch: the letter that, when it sits in the viewing window, causes THIS rotor
// to advance the rotor to its left on the next keypress (the turnover point).

const ROTOR_WIRINGS = {
  I:   { wiring: "EKMFLGDQVZNTOWYHXUSPAIBRCJ", notch: "Q" },
  II:  { wiring: "AJDKSIRUXBLHWTMCQGZNPYFVOE", notch: "E" },
  III: { wiring: "BDFHJLCPRTXVZNYEIWGAKMUSQO", notch: "V" },
  IV:  { wiring: "ESOVPZJAYQUIRHXLNFTGKDCMWB", notch: "J" },
  V:   { wiring: "VZBRGITYUPSDNHLXAWMJQOFECK", notch: "Z" },
};

const REFLECTORS = {
  B: "YRUHQSLDPXNGOKMIEBFZCWVJAT",
  C: "FVPJIAOYEDRZXWGCTKUQSBNMHL",
};

// The historical QWERTZ Enigma keyboard/lampboard layout, kept for the UI.
const KEYBOARD_ROWS = [
  ["Q", "W", "E", "R", "T", "Z", "U", "I", "O"],
  ["A", "S", "D", "F", "G", "H", "J", "K"],
  ["P", "Y", "X", "C", "V", "B", "N", "M", "L"],
];

const A_CODE = "A".charCodeAt(0);
const letterToIndex = (ch) => ch.toUpperCase().charCodeAt(0) - A_CODE;
const indexToLetter = (i) => String.fromCharCode(((i % 26) + 26) % 26 + A_CODE);

export { ROTOR_WIRINGS, REFLECTORS, KEYBOARD_ROWS, letterToIndex, indexToLetter };
