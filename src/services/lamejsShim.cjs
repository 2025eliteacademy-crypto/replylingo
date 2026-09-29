// lamejs (npm, v1.2.1) has a real bug: several of its internal files
// (Encoder.js, Lame.js, BitStream.js, PsyModel.js) reference MPEGMode/Lame/
// BitStream as bare identifiers without requiring them — it only works when
// loaded as browser <script> tags sharing one global scope. Under normal
// require()/import, those bare references throw ReferenceErrors deep inside
// encodeBuffer(). Setting them as Node globals before lamejs's own modules
// run is the standard workaround. Must stay a .cjs file (not ESM) so these
// assignments run, in order, before anything requires lamejs — ESM imports
// are hoisted and would run before any of this.
global.MPEGMode = require("lamejs/src/js/MPEGMode.js");
global.Lame = require("lamejs/src/js/Lame.js");
global.BitStream = require("lamejs/src/js/BitStream.js");

module.exports = require("lamejs");
