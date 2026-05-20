const list = document.querySelector('[data-post-list]');
const btn = document.querySelector('[data-sort-toggle]');
const label = document.querySelector('[data-sort-label]');
if (list && btn) {
  const items = Array.from(list.querySelectorAll('li[data-date]'));
  const apply = (order) => {
    const sorted = [...items].sort((a, b) => {
      const cmp = a.dataset.date.localeCompare(b.dataset.date);
      return order === 'asc' ? cmp : -cmp;
    });
    sorted.forEach(el => list.appendChild(el));
    if (label) label.textContent = order === 'asc' ? 'oldest first' : 'newest first';
    localStorage.setItem('blog-sort', order);
  };
  apply(localStorage.getItem('blog-sort') || 'desc');
  btn.addEventListener('click', () => {
    apply(localStorage.getItem('blog-sort') === 'asc' ? 'desc' : 'asc');
  });
}
