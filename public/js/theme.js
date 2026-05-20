const THEMES = ['light', 'dark', 'tokyo-night', 'mono'];
const root = document.documentElement;

function setTheme(t) {
  root.dataset.theme = t;
  localStorage.setItem('theme', t);
  const label = document.querySelector('[data-theme-label]');
  if (label) label.textContent = t;
}

function cycleTheme() {
  const i = THEMES.indexOf(root.dataset.theme);
  setTheme(THEMES[(i + 1) % THEMES.length]);
}

document.addEventListener('DOMContentLoaded', () => {
  setTheme(root.dataset.theme || 'light');
  const btn = document.querySelector('[data-theme-toggle]');
  if (btn) btn.addEventListener('click', cycleTheme);
});
