/* Assembles the DSP parts into one object: window.MachineDSP on the page, module.exports in Node.
   MachineDSP.workerSource() returns the same code as text, for building the render worker from a Blob
   (so the app still runs when opened straight from disk). */
(function (root) {
  'use strict';
  const parts = root.MACHINE_DSP_PARTS || [];
  const D = {};
  for (const p of parts) p(D);
  D.workerSource = function () {
    return 'const D={};\n' + parts.map(p => '(' + p.toString() + ')(D);').join('\n');
  };
  root.MachineDSP = D;
  if (typeof module !== 'undefined' && module.exports) module.exports = D;
})(typeof self !== 'undefined' ? self : globalThis);
