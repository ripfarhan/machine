/* Glitch Reel Machine — font library and font sets (condensed workhorses, clean sans, real serifs; no novelty faces) */
'use strict';
// Each face: family stack, weight, whether it covers Devanagari. Google Fonts are linked from index.html; stacks fall back to system faces.
const FONTS = {
  narrow:   {f: '"Archivo Narrow","Arial Narrow","Roboto Condensed","TeX Gyre Heros Cn","Helvetica Neue Condensed",sans-serif', w: 700, label: 'Arial Narrow'},
  anton:    {f: '"Anton","TeX Gyre Heros Cn",Impact,"Arial Narrow",sans-serif', w: 400, label: 'Anton'},
  bebas:    {f: '"Bebas Neue","Oswald","Arial Narrow",sans-serif', w: 400, label: 'Bebas'},
  sixcaps:  {f: '"Six Caps","Anton","Arial Narrow",sans-serif', w: 400, label: 'Six Caps'},
  oswald:   {f: '"Oswald","Arial Narrow",sans-serif', w: 300, label: 'Oswald light'},
  black:    {f: '"Archivo Black","Arial Black",Impact,sans-serif', w: 400, label: 'Archivo Black'},
  inter:    {f: '"Inter","Helvetica Neue",Arial,sans-serif', w: 800, label: 'Inter'},
  grotesk:  {f: '"Space Grotesk","Inter",Arial,sans-serif', w: 700, label: 'Space Grotesk'},
  teko:     {f: '"Teko","Khand","Arial Narrow",sans-serif', w: 700, deva: true, label: 'Teko'},
  khand:    {f: '"Khand","Teko","Arial Narrow",sans-serif', w: 700, deva: true, label: 'Khand'},
  noto:     {f: '"Noto Sans Devanagari","FreeSans",sans-serif', w: 900, deva: true, label: 'Noto Devanagari'},
  notoserif:{f: '"Noto Serif Devanagari","Noto Sans Devanagari",serif', w: 700, deva: true, label: 'Noto Serif Devanagari'},
  playfair: {f: '"Playfair Display","Bodoni MT","Didot",serif', w: 900, label: 'Playfair'},
  bodoni:   {f: '"Bodoni Moda","Playfair Display","Didot",serif', w: 900, label: 'Bodoni'},
  cormorant:{f: '"Cormorant Garamond","EB Garamond",Garamond,serif', w: 600, label: 'Cormorant'},
  dmserif:  {f: '"DM Serif Display","Playfair Display",serif', w: 400, label: 'DM Serif'},
  garamond: {f: '"EB Garamond",Garamond,"Times New Roman",serif', w: 500, label: 'Garamond'},
  mono:     {f: '"JetBrains Mono","Courier New",monospace', w: 600, label: 'Mono'},
};
// Named sets the user can force from the Words panel. 'auto' uses the style's own list.
const FONT_SETS = {
  auto: null,
  narrow: ['narrow', 'narrow', 'narrow', 'sixcaps', 'bebas'],
  display: ['anton', 'bebas', 'sixcaps', 'black'],
  sans: ['inter', 'grotesk', 'oswald', 'black'],
  serif: ['playfair', 'bodoni', 'cormorant', 'dmserif', 'garamond'],
  desi: ['khand', 'teko', 'noto', 'notoserif'],
  mono: ['mono'],
};
// Devanagari words need a face that has the script; map Latin-only picks to the closest Indian face.
const DEVA_MAP = {narrow: 'khand', sixcaps: 'khand', bebas: 'teko', anton: 'teko', oswald: 'khand', black: 'noto', inter: 'noto', grotesk: 'noto', mono: 'noto',
  playfair: 'notoserif', bodoni: 'notoserif', cormorant: 'notoserif', dmserif: 'notoserif', garamond: 'notoserif'};
const DEVA_RE = /[ऀ-ॿ]/;
function fontForWord(key, word){ if (!FONTS[key]) key = 'narrow'; if (DEVA_RE.test(word) && !FONTS[key].deva) key = DEVA_MAP[key] || 'noto'; const F = FONTS[key]; return {css: F.w + ' {S}px ' + F.f, key}; }
// Google Fonts request for everything above (one stylesheet).
const FONT_LINK = 'https://fonts.googleapis.com/css2?' + [
  'Anton', 'Archivo:wght@400;500;700', 'Archivo+Narrow:wght@700', 'Archivo+Black', 'Bebas+Neue', 'Six+Caps', 'Oswald:wght@300;500', 'Inter:wght@800', 'Space+Grotesk:wght@700',
  'Teko:wght@700', 'Khand:wght@700', 'Noto+Sans+Devanagari:wght@700;900', 'Noto+Serif+Devanagari:wght@700',
  'Playfair+Display:wght@900', 'Bodoni+Moda:wght@900', 'Cormorant+Garamond:wght@600', 'DM+Serif+Display', 'EB+Garamond:wght@500', 'JetBrains+Mono:wght@400;600'
].map(f => 'family=' + f).join('&') + '&display=swap';
const FONT_PRELOAD = Object.keys(FONTS).map(k => FONTS[k].w + ' 80px ' + FONTS[k].f.split(',')[0]);
