# Enigma — Field Cipher Machine Replica

A from-scratch simulation of the Wehrmacht Enigma I / M3, plus a working
implementation of the crib-based attack ("menu" method) that underpinned
Turing's Bombe at Bletchley Park.

This isn't a substitution cipher wearing rotor graphics — the wiring tables,
notch positions, reflector permutations, and the double-step stepping
anomaly are all the real historical specifications, verified against the
classic `AAAAA → BDZGO` reference test vector (rotors I-II-III, all
settings at A, reflector B).

## What's in here

- **`js/rotors.js`** — historical wiring tables for rotors I–V and
  reflectors B/C.
- **`js/enigma.js`** — the machine itself: rotor stepping (including the
  double-step anomaly), plugboard, encrypt/decrypt.
- **`js/bombe.js`** — the attack. Given ciphertext and a suspected crib
  (guessed plaintext fragment):
  1. filters impossible alignments (Enigma never encrypts a letter to
     itself),
  2. builds the "menu" — a graph connecting crib/cipher letters that share
     positions,
  3. searches rotor orders and starting positions for settings where a
     closed loop in that graph is internally consistent — which works
     *without ever guessing the plugboard*, since the plugboard cancels out
     algebraically around a loop. This is the actual mathematical trick the
     Bombe exploited.
- **`js/ui.js`** — wires it all to the interface, including an animated
  diagram of the real signal path (plugboard → rotors → reflector → rotors
  → plugboard) that lights up on every keystroke.

## A note on the Bombe's honesty

With a crib that has only one independent loop in its menu graph, roughly
**63% of random rotor settings will produce a spurious "stop"** — that's not
a bug, it's a property of permutations (any random permutation has an
expected 1 fixed point regardless of size). The real Bombe dealt with this
using multiple loops and a "diagonal board" to cross-check far more
constraints simultaneously. This simulator will happily show you that
higher false-stop rate on a thin crib — richer, longer cribs with more
repeated letters produce menus with more independent loops and narrow the
candidate list much further. Try `"WETTERBERICHT"` vs. denser text with more
letter repeats and compare.

## Pushing this to GitHub

```bash
cd enigma
git init
git add .
git commit -m "Enigma machine + Bombe crib attack, historically accurate wiring"
git branch -M main
git remote add origin https://github.com/djareddirdjad/enigma-bombe.git
git push -u origin main
```

Then open `index.html` directly, or serve it locally:

```bash
python3 -m http.server 8000
```
