// build content/blog/*/index.md into public/blog/<slug>/index.html,
// copy sibling assets, and regenerate the blog index at public/blog/index.html.
//
// the static shell (public/index.html, public/css/, public/js/) is hand-edited
// and not touched here. only public/blog/ is owned by the build.

import { readdir, readFile, writeFile, mkdir, copyFile, rm, stat } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { marked } from 'marked';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = join(ROOT, 'content', 'blog');
const OUT = join(ROOT, 'public', 'blog');

const themeBootScript = `(function () {
      var t = localStorage.getItem('theme');
      if (!t) t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      document.documentElement.dataset.theme = t;
    })();`;

// `prefix` is the relative path from the page back to public/ root.
// '' for root pages, '../' for /blog/index.html, '../../' for /blog/<slug>/index.html.
// using relative paths keeps the site working under any base (user-page or project-page).
function shell({ title, body, currentBlog = false, prefix, extraScripts = [] }) {
  const navBlog = currentBlog
    ? `<a href="${prefix}blog/" aria-current="page">blog</a>`
    : `<a href="${prefix}blog/">blog</a>`;
  const scripts = extraScripts.map(s => `  <script src="${prefix}js/${s}"></script>`).join('\n');
  return `<!doctype html>
<html lang="en" data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <script>
    ${themeBootScript}
  </script>
  <link rel="stylesheet" href="${prefix}css/themes.css">
  <link rel="stylesheet" href="${prefix}css/base.css">
</head>
<body>
  <header class="site-header">
    <a class="brand" href="${prefix || './'}">greg chinnici</a>
    <nav>
      ${navBlog}
    </nav>
    <button data-theme-toggle aria-label="cycle theme">
      <span data-theme-label></span>
    </button>
  </header>

  <main>
${body}
  </main>

  <footer class="site-footer">
    <p class="muted">built static. <a href="https://github.com/greg-chinnici">github</a></p>
  </footer>

  <script src="${prefix}js/theme.js"></script>
${scripts}
</body>
</html>
`;
}

function formatDate(d) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toISOString().slice(0, 10);
}

async function listPostDirs() {
  const entries = await readdir(CONTENT, { withFileTypes: true });
  return entries.filter(e => e.isDirectory()).map(e => e.name);
}

async function copyAssets(srcDir, dstDir) {
  const entries = await readdir(srcDir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name === 'index.md') continue;
    const src = join(srcDir, e.name);
    const dst = join(dstDir, e.name);
    if (e.isDirectory()) {
      await mkdir(dst, { recursive: true });
      await copyAssets(src, dst);
    } else {
      await copyFile(src, dst);
    }
  }
}

async function buildPost(slug) {
  const srcDir = join(CONTENT, slug);
  const md = await readFile(join(srcDir, 'index.md'), 'utf8');
  const { data, content } = matter(md);
  const html = marked.parse(content);
  const title = data.title || slug;
  const date = formatDate(data.date);

  const body = `    <article class="post">
      <header class="post-header">
        <h1>${title}</h1>
        ${date ? `<p class="muted stamp">${date}</p>` : ''}
      </header>
${html}
    </article>`;

  const dstDir = join(OUT, slug);
  await mkdir(dstDir, { recursive: true });
  await writeFile(join(dstDir, 'index.html'), shell({ title: `${title} · greg chinnici`, body, prefix: '../../' }));
  await copyAssets(srcDir, dstDir);

  return { slug, title, date, summary: data.summary || '' };
}

async function buildIndex(posts) {
  posts.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const items = posts.length
    ? posts.map(p => `        <li data-date="${p.date || ''}">
          <a href="${p.slug}/">${p.title}</a>
          ${p.date ? `<span class="muted stamp"> · ${p.date}</span>` : ''}
          ${p.summary ? `<p class="muted">${p.summary}</p>` : ''}
        </li>`).join('\n')
    : `        <li class="muted">no posts yet.</li>`;

  const sortControls = posts.length > 1 ? `
      <div class="post-list-controls">
        <button data-sort-toggle aria-label="toggle sort order">
          <span data-sort-label>newest first</span>
        </button>
      </div>` : '';

  const body = `    <section class="intro">
      <h1>blog</h1>
    </section>

    <section>${sortControls}
      <ul class="post-list" data-post-list>
${items}
      </ul>
    </section>`;

  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, 'index.html'), shell({
    title: 'blog · greg chinnici',
    body,
    currentBlog: true,
    prefix: '../',
    extraScripts: posts.length > 1 ? ['blog.js'] : [],
  }));
}

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

async function main() {
  if (await exists(OUT)) {
    await rm(OUT, { recursive: true, force: true });
  }
  await mkdir(OUT, { recursive: true });

  const slugs = await listPostDirs();
  const posts = [];
  for (const slug of slugs) {
    posts.push(await buildPost(slug));
    console.log(`built ${relative(ROOT, join(OUT, slug, 'index.html'))}`);
  }
  await buildIndex(posts);
  console.log(`built ${relative(ROOT, join(OUT, 'index.html'))} (${posts.length} posts)`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
