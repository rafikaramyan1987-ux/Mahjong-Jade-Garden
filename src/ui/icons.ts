/**
 * Icons (our own), 24 x 24, in the same illustrated look as the Garden tiles: bright gradient fills, a bold ink
 * outline and a glossy highlight. Gradients are shared by id (every icon defines the ones it uses; duplicates are
 * identical, so whichever the browser picks looks the same).
 */
const INK = '#203a2e';
const grad = (id: string, a: string, b: string) => `<linearGradient id="mjg-${id}" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
const G = {
  gold: grad('gold', '#fff1b8', '#e7a823'),
  jade: grad('jade', '#bff3d6', '#2f9a68'),
  ivory: grad('ivory', '#ffffff', '#e8dcc0'),
  red: grad('red', '#ff9b84', '#d23f2b'),
  sky: grad('sky', '#d7f1ff', '#4aa3d8'),
  pink: grad('pink', '#ffe1ea', '#ee8aa6'),
  grey: grad('grey', '#f4f4f4', '#9aa5a0'),
};
type Fill = keyof typeof G;

/** an icon: filled shapes with the ink outline, then a soft white gloss */
const icon = (fills: Fill[], body: string, gloss = '') =>
  `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" class="ico"><defs>${fills.map((f) => G[f]).join('')}</defs><g stroke="${INK}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">${body}</g>${gloss ? `<g fill="#fff" opacity="0.75">${gloss}</g>` : ''}</svg>`;
const f = (n: Fill) => `url(#mjg-${n})`;

export const ICONS = {
  menu: icon(['ivory'], `<rect x="3.5" y="5" width="17" height="3.4" rx="1.7" fill="${f('ivory')}"/><rect x="3.5" y="10.3" width="17" height="3.4" rx="1.7" fill="${f('ivory')}"/><rect x="3.5" y="15.6" width="17" height="3.4" rx="1.7" fill="${f('ivory')}"/>`),
  pause: icon(['ivory'], `<rect x="5.5" y="4.5" width="4.6" height="15" rx="1.8" fill="${f('ivory')}"/><rect x="13.9" y="4.5" width="4.6" height="15" rx="1.8" fill="${f('ivory')}"/>`, '<rect x="6.6" y="5.6" width="1.4" height="5" rx=".7"/><rect x="15" y="5.6" width="1.4" height="5" rx=".7"/>'),
  gear: icon(
    ['grey'],
    `<path fill="${f('grey')}" d="M10.3 2.8h3.4l.5 2.6 1.7.8 2.3-1.4 2.4 2.4-1.4 2.3.8 1.7 2.6.5v3.4l-2.6.5-.8 1.7 1.4 2.3-2.4 2.4-2.3-1.4-1.7.8-.5 2.6h-3.4l-.5-2.6-1.7-.8-2.3 1.4-2.4-2.4 1.4-2.3-.8-1.7-2.6-.5v-3.4l2.6-.5.8-1.7-1.4-2.3 2.4-2.4 2.3 1.4 1.7-.8z"/><circle cx="12" cy="12" r="3.2" fill="#fff"/>`,
    '<ellipse cx="9" cy="6.6" rx="2.2" ry="1" transform="rotate(-25 9 6.6)"/>',
  ),
  hint: icon(['gold', 'grey'], `<path fill="${f('gold')}" d="M12 2.6a6.6 6.6 0 0 0-4 11.9c.8.6 1.2 1.4 1.2 2.3h5.6c0-.9.4-1.7 1.2-2.3A6.6 6.6 0 0 0 12 2.6z"/><rect x="9" y="16.8" width="6" height="2.6" rx="1" fill="${f('grey')}"/><rect x="10" y="19.4" width="4" height="2.2" rx="1" fill="${f('grey')}"/>`, '<ellipse cx="9.4" cy="7" rx="1.6" ry="2.4" transform="rotate(30 9.4 7)"/>'),
  undo: icon(['sky'], `<path fill="${f('sky')}" d="M9.6 3.2 2.8 9.2l6.8 6v-3.6h4.2a3.9 3.9 0 0 1 0 7.8h-2.6v3.4h2.6a7.3 7.3 0 0 0 0-14.6H9.6z"/>`, '<ellipse cx="7.6" cy="8" rx="1.2" ry="2" transform="rotate(50 7.6 8)"/>'),
  shuffle: icon(
    ['pink', 'jade'],
    `<path fill="${f('jade')}" d="M2.8 6h3.8c2.5 0 3.9 1.3 5.1 3.3l2.2 3.9c.8 1.4 1.6 2 3 2h.6v-2.4l4.3 3.9-4.3 3.9v-2.3h-.6c-2.5 0-3.9-1.3-5.1-3.3L9.6 11c-.8-1.4-1.6-2-3-2H2.8z"/><path fill="${f('pink')}" d="M2.8 15.2h3.8c1.1 0 1.8-.3 2.4-1l1.6 2.6c-1 1-2.3 1.6-4 1.6H2.8zM13.4 8.4c1-1.2 2.3-2 4.1-2h.6V4l4.3 3.9-4.3 3.9V9.4h-.6c-1.1 0-1.8.4-2.4 1.1z"/>`,
  ),
  fit: icon(['ivory'], `<path fill="${f('ivory')}" d="M3.5 3.5h6.5v3H6.5v3.5h-3zM20.5 3.5H14v3h3.5v3.5h3zM3.5 20.5H10v-3H6.5V14h-3zM20.5 20.5H14v-3h3.5V14h3z"/>`),
  close: icon(['ivory'], `<path fill="${f('ivory')}" d="M6.2 3.8 12 9.6l5.8-5.8 2.4 2.4-5.8 5.8 5.8 5.8-2.4 2.4-5.8-5.8-5.8 5.8-2.4-2.4L9.6 12 3.8 6.2z"/>`),
  back: icon(['ivory'], `<path fill="${f('ivory')}" d="M15.6 3.2 18.2 6l-6 6 6 6-2.6 2.8L6.8 12z"/>`),
  play: icon(['ivory'], `<path fill="${f('ivory')}" d="M7 3.6c0-1 1-1.6 1.9-1.1l11.4 8.4c.8.6.8 1.6 0 2.2L8.9 21.5c-.9.5-1.9-.1-1.9-1.1z"/>`, '<ellipse cx="9.4" cy="7.4" rx="1" ry="2.2"/>'),
  calendar: icon(['ivory', 'red'], `<rect x="3" y="4.6" width="18" height="16.4" rx="3" fill="${f('ivory')}"/><path fill="${f('red')}" d="M3 7.6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v2.6H3z"/><path fill="none" d="M8 2.8v4M16 2.8v4"/><circle cx="8" cy="14" r="1.3" fill="${INK}" stroke="none"/><circle cx="12" cy="14" r="1.3" fill="${INK}" stroke="none"/><circle cx="16" cy="14" r="1.3" fill="${INK}" stroke="none"/><circle cx="8" cy="17.6" r="1.3" fill="${INK}" stroke="none"/><circle cx="12" cy="17.6" r="1.3" fill="#e7a823" stroke="none"/>`),
  /** the journey: a little map with a dotted path */
  map: icon(['jade', 'ivory', 'red'], `<path fill="${f('ivory')}" d="M2.8 5.4 8.6 3l6.8 2.4L21.2 3v15.6L15.4 21l-6.8-2.4-5.8 2.4z"/><path fill="none" stroke-dasharray="1.6 1.8" d="M5.4 16.4c2-.2 3-1.8 4.6-3.8s3.4-2.4 5.4-1.8"/><circle cx="17" cy="9.8" r="2.4" fill="${f('red')}"/>`),
  leaf: icon(['jade'], `<path fill="${f('jade')}" d="M4.2 20.2C3.6 11 9 4 20.6 3.4 21 14.6 14 20.4 4.2 20.2z"/><path fill="none" d="M4.6 19.8 14 10.2"/>`),
  chart: icon(['jade', 'gold', 'sky'], `<rect x="3.4" y="11" width="4.4" height="9.6" rx="1.2" fill="${f('sky')}"/><rect x="9.8" y="4" width="4.4" height="16.6" rx="1.2" fill="${f('gold')}"/><rect x="16.2" y="8" width="4.4" height="12.6" rx="1.2" fill="${f('jade')}"/>`),
  star: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" fill="currentColor" stroke="rgba(60,40,10,.55)" stroke-width="1.2" stroke-linejoin="round"/><ellipse cx="10" cy="8.6" rx="1.1" ry="2" fill="#fff" opacity=".6" transform="rotate(35 10 8.6)"/></svg>',
  lock: icon(['grey', 'gold'], `<path fill="none" stroke-width="2.2" d="M8 11V8a4 4 0 0 1 8 0v3"/><rect x="4.6" y="10.4" width="14.8" height="10.6" rx="2.6" fill="${f('gold')}"/><circle cx="12" cy="15.4" r="1.5" fill="${INK}" stroke="none"/>`),
  /** rewarded ads: a little TV */
  tv: icon(['sky', 'ivory'], `<path fill="none" d="M8.6 2.8 12 6l3.4-3.2"/><rect x="2.6" y="6" width="18.8" height="13.6" rx="3" fill="${f('ivory')}"/><rect x="5" y="8.2" width="14" height="9.2" rx="1.8" fill="${f('sky')}"/><path fill="#fff" stroke="none" d="M10.4 10.4v4.8l4-2.4z"/>`),
  music: icon(['gold'], `<path fill="none" stroke-width="2" d="M9 17.5V5.2l10-2v12.2"/><ellipse cx="6.6" cy="17.8" rx="3" ry="2.4" fill="${f('gold')}"/><ellipse cx="16.6" cy="15.6" rx="3" ry="2.4" fill="${f('gold')}"/>`),
  sound: icon(['jade', 'ivory'], `<path fill="${f('ivory')}" d="M3 9h4l5-4.4v14.8L7 15H3z"/><path fill="none" d="M15.4 8.6a5 5 0 0 1 0 6.8M18.2 6a8.6 8.6 0 0 1 0 12"/>`),
  globe: icon(['sky', 'jade'], `<circle cx="12" cy="12" r="9" fill="${f('sky')}"/><path fill="${f('jade')}" d="M7 6.4c2 .2 3 1.4 2.6 3-.4 1.4-2.6 1.4-2.8 3.2-.2 1.6 1.4 2.4 1 4.4-.2 1-1 1.6-1.6 1.6A9 9 0 0 1 7 6.4zM14.4 4.6c2.6.8 4.4 2.6 5.4 5-1.4.4-2.6-.4-3.4.6-.8 1-.2 2.6-1.6 3.2-1.4.6-2.6-1-2.4-2.6.2-1.8 2.4-2 2.6-3.6.1-1-.6-1.8-.6-2.6z"/>`),
  tiles: icon(['ivory', 'jade'], `<rect x="3" y="4.4" width="10" height="13" rx="2" fill="${f('jade')}"/><rect x="2.4" y="3.2" width="10" height="13" rx="2" fill="${f('ivory')}"/><rect x="11" y="7.8" width="10.6" height="13.4" rx="2" fill="${f('jade')}"/><rect x="10.4" y="6.6" width="10.6" height="13.4" rx="2" fill="${f('ivory')}"/><circle cx="15.7" cy="13.3" r="2.6" fill="#ee8aa6"/>`),
  reset: icon(['red'], `<path fill="${f('red')}" d="M12 3.2a8.8 8.8 0 1 1-8.3 11.7l3.2-1.1A5.4 5.4 0 1 0 8.4 8l2 2H3.6V3.2l2.4 2.4A8.8 8.8 0 0 1 12 3.2z"/>`),
  home: icon(['ivory', 'red'], `<path fill="${f('red')}" d="M2.6 11.6 12 3.4l9.4 8.2-1.8 2-7.6-6.6-7.6 6.6z"/><path fill="${f('ivory')}" d="M5.6 12.4 12 6.8l6.4 5.6v8.2H14v-5h-4v5H5.6z"/>`),
};
