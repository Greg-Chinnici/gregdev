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
    <ul class="logo-track" aria-label="elsewhere">
      <li><a href="https://github.com/greg-chinnici" aria-label="github">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3"/></svg>
      </a></li>
      <li><a href="https://www.linkedin.com/in/gregory-chinnici/" aria-label="linkedin">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 2h-17A1.5 1.5 0 0 0 2 3.5v17A1.5 1.5 0 0 0 3.5 22h17a1.5 1.5 0 0 0 1.5-1.5v-17A1.5 1.5 0 0 0 20.5 2zM8 19H5v-9h3v9zM6.5 8.25A1.75 1.75 0 1 1 8.25 6.5 1.75 1.75 0 0 1 6.5 8.25zM19 19h-3v-4.5c0-1.1-.9-2-2-2s-2 .9-2 2V19h-3v-9h3v1.2a3.5 3.5 0 0 1 3-1.4c2.2 0 4 1.8 4 4V19z"/></svg>
      </a></li>
      <li><a href="mailto:gregchinnici@gmail.com" aria-label="email">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 4h20a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm10 7L2 6v12h20V6z"/></svg>
      </a></li>
    </ul>
    <button data-theme-toggle aria-label="cycle theme">
      <span data-theme-label></span>
    </button>
  </header>

  <main>
${body}
  </main>

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

  // drafts are skipped entirely: no page is emitted and they're left out of
  // the index. set `draft: true` in the post's front matter to hold it back.
  if (data.draft === true) return null;

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
        <input type="search" class="post-search" data-post-search placeholder="search posts…" aria-label="search posts" autocomplete="off">
        <button data-sort-toggle aria-label="toggle sort order">
          <span data-sort-label>newest first</span>
        </button>
      </div>` : '';

  const emptyState = posts.length > 1
    ? `\n      <p class="muted post-empty" data-post-empty hidden>no posts match your search.</p>`
    : '';

  const body = `    <section class="intro">
      <h1>blog</h1>
    </section>

    <section>${sortControls}
      <ul class="post-list" data-post-list>
${items}
      </ul>${emptyState}
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
    const post = await buildPost(slug);
    if (!post) {
      console.log(`skipped ${relative(ROOT, join(CONTENT, slug, 'index.md'))} (draft)`);
      continue;
    }
    posts.push(post);
    console.log(`built ${relative(ROOT, join(OUT, slug, 'index.html'))}`);
  }
  await buildIndex(posts);
  console.log(`built ${relative(ROOT, join(OUT, 'index.html'))} (${posts.length} posts)`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
