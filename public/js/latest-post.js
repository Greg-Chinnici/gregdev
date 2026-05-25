(async function () {
  const toast = document.querySelector('[data-latest-post]');
  if (!toast) return;

  try {
    const res = await fetch('blog/', { cache: 'no-cache' });
    if (!res.ok) return;
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const item = doc.querySelector('[data-post-list] li[data-date] a');
    if (!item) return;

    const href = item.getAttribute('href') || '';
    const slug = href.replace(/\/$/, '');
    const dismissed = localStorage.getItem('latest-post-dismissed');
    if (dismissed === slug) return;

    const link = toast.querySelector('[data-latest-post-link]');
    link.textContent = item.textContent.trim();
    link.setAttribute('href', `blog/${href}`);
    toast.hidden = false;

    toast.querySelector('[data-latest-post-close]').addEventListener('click', () => {
      localStorage.setItem('latest-post-dismissed', slug);
      toast.hidden = true;
    });

    const onScroll = () => {
      if (window.scrollY > 80) {
        toast.hidden = true;
        window.removeEventListener('scroll', onScroll);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
  } catch (_) {
    // fail silent — toast just stays hidden
  }
})();
