// Prüft die Knopf-Erkennung mit einem simulierten Lenkrad (statt winmm)
'use strict';
const assert = require('assert');
const { Joysticks, buttonLabel } = require('../src/joystick');
const presses = [];
const j = new Joysticks((dev, btn) => presses.push([dev, btn]));
let state = { 2: { buttons: 0, pov: 0xffff } }; // nur Gerät 3 angeschlossen
j.lib = {};
j.joyGetPosEx = (dev, buf) => {
  const s = state[dev]; if (!s) return 167; // JOYERR_UNPLUGGED
  buf.writeUInt32LE(s.buttons >>> 0, 32); buf.writeUInt32LE(s.pov, 40); return 0;
};
j.joyGetDevCapsW = (dev, caps) => { caps.writeUInt16LE(0x0eb7, 0); caps.writeUInt16LE(0x0024, 2); caps.write('Microsoft PC-joystick driver\0', 4, 'utf16le'); return 0; };
j.scan();
assert.deepStrictEqual(j.devices(), [{ dev: 2, name: 'Controller 0EB7:0024' }]);
state[2].buttons = 1 << 4; j.poll();             // Knopf 5 gedrückt
j.poll();                                          // gehalten -> kein neues Ereignis
state[2].buttons = (1 << 4) | (1 << 31); j.poll(); // Knopf 32 dazu
state[2].buttons = 0; j.poll();                    // losgelassen
state[2].pov = 9000; j.poll();                     // Hat rechts
state[2].pov = 9000; j.poll();
state[2].pov = 0xffff; j.poll();
delete state[2]; j.poll();                         // abgesteckt
assert.deepStrictEqual(presses, [[2, 5], [2, 32], [2, 34]]);
assert.strictEqual(j.devices().length, 0);
assert.strictEqual(buttonLabel(34), 'Hat rechts');
console.log('OK – Joystick:', presses.map(([d, b]) => `Gerät ${d + 1} ${buttonLabel(b)}`).join(', '));
