/** Simple line icons (our own), 24x24, stroke = currentColor. */
const wrap = (d: string) =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const ICONS = {
  menu: wrap('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  gear: wrap(
    '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8M18.5 18.5l-1.8-1.8M7.3 7.3 5.5 5.5"/><circle cx="12" cy="12" r="6.6"/>',
  ),
  hint: wrap('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.8.6 1.1 1.4 1.1 2.2h5c0-.8.3-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>'),
  undo: wrap('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
  shuffle: wrap('<path d="M3 7h3.5c2 0 3.2 1 4.3 2.6l2.4 4.8c1.1 1.6 2.3 2.6 4.3 2.6H21"/><path d="M3 17h3.5c1.6 0 2.6-.6 3.5-1.6M14 8.6c.9-1 1.9-1.6 3.5-1.6H21"/><path d="m18 4 3 3-3 3M18 14l3 3-3 3"/>'),
  fit: wrap('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  close: wrap('<path d="M6 6l12 12M18 6 6 18"/>'),
  back: wrap('<path d="M15 5l-7 7 7 7"/>'),
  play: wrap('<path d="M8 5v14l11-7z" fill="currentColor"/>'),
  calendar: wrap('<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  leaf: wrap('<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19 13 11"/>'),
  chart: wrap('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  star: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" fill="currentColor"/></svg>',
  lock: wrap('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
};
