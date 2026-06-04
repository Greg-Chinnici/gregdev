const list = document.querySelector('[data-post-list]');
const sortBtn = document.querySelector('[data-sort-toggle]');
const sortLabel = document.querySelector('[data-sort-label]');
const search = document.querySelector('[data-post-search]');
const empty = document.querySelector('[data-post-empty]');

if (list) {
  const items = Array.from(list.querySelectorAll('li[data-date]')).map(el => ({
    el,
    date: el.dataset.date || '',
    text: ((el.querySelector('a')?.textContent || '') + ' ' +
           (el.querySelector('p')?.textContent || '')).toLowerCase(),
  }));

  const order = () => localStorage.getItem('blog-sort') || 'desc';

  // subsequence fuzzy match: every char of `needle` must appear in `haystack`
  // in order. returns a relevance score, or -1 when there's no match. closer,
  // consecutive, and word-start matches score higher.
  const fuzzyScore = (needle, haystack) => {
    if (!needle) return 0;
    let score = 0, n = 0, prev = -2;
    for (let h = 0; h < haystack.length && n < needle.length; h++) {
      if (haystack[h] !== needle[n]) continue;
      score += h === prev + 1 ? 3 : 1;                       // consecutive run
      if (h === 0 || /\s/.test(haystack[h - 1])) score += 2; // word boundary
      prev = h;
      n++;
    }
    return n === needle.length ? score : -1;
  };

  const render = () => {
    const q = (search?.value || '').trim().toLowerCase();
    let visible;
    if (q) {
      visible = items
        .map(it => ({ it, score: fuzzyScore(q, it.text) }))
        .filter(x => x.score >= 0)
        .sort((a, b) => b.score - a.score)
        .map(x => x.it);
    } else {
      visible = [...items].sort((a, b) => {
        const cmp = a.date.localeCompare(b.date);
        return order() === 'asc' ? cmp : -cmp;
      });
    }
    const shown = new Set(visible);
    items.forEach(it => { it.el.hidden = !shown.has(it); });
    visible.forEach(it => list.appendChild(it.el));
    if (empty) empty.hidden = visible.length > 0;
    if (sortLabel) sortLabel.textContent = order() === 'asc' ? 'oldest first' : 'newest first';
    if (sortBtn) sortBtn.disabled = !!q; // date sort is moot while searching
  };

  if (sortBtn) {
    sortBtn.addEventListener('click', () => {
      localStorage.setItem('blog-sort', order() === 'asc' ? 'desc' : 'asc');
      render();
    });
  }
  if (search) search.addEventListener('input', render);

  render();
}
