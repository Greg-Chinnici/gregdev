// build markdown writeups into public/<section>/<slug>/index.html, copy sibling
// assets, and regenerate each section's landing page.
//
//   content/blog/*/index.md   -> public/blog/   (chronological post list)
//   content/games/*/index.md  -> public/games/  (card grid w/ cover previews)
//
// the static shell (public/index.html, public/css/, public/js/) is hand-edited
// and not touched here. only public/blog/ and public/games/ are owned by the build.

import { readdir, readFile, writeFile, mkdir, copyFile, rm, stat } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';

// highlight fenced code blocks at build time. token spans (.hljs-*) are baked
// into the HTML; colors are themed via CSS vars in css/base.css + css/themes.css.
marked.use(markedHighlight({
  langPrefix: 'language-',
  highlight(code, lang) {
    const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
    return hljs.highlight(code, { language }).value;
  },
}));

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = join(ROOT, 'content');
const PUBLIC = join(ROOT, 'public');

// canonical/OG absolute base — GitHub Pages project URL.
const SITE_URL = 'https://greg-chinnici.github.io/gregdev/';

const themeBootScript = `(function () {
      var t = localStorage.getItem('theme');
      if (!t) t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      document.documentElement.dataset.theme = t;
    })();`;

// inline data-URI favicon: ">gc"-style mark, ">"-less "gc" in rgb(56,100,187).
// self-contained so it works at any directory depth without a relative path.
const favicon = `<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ctext x='2' y='47' font-family='ui-monospace,SFMono-Regular,Menlo,monospace' font-size='42' font-weight='700' fill='%233864bb'%3Egc%3C/text%3E%3C/svg%3E">`;

// nav sections rendered in the site header, in order.
const NAV = [{ slug: 'blog', label: 'blog' }, { slug: 'games', label: 'games' }];

// `prefix` is the relative path from the page back to public/ root.
// '' for root pages, '../' for /<section>/index.html, '../../' for /<section>/<slug>/index.html.
// using relative paths keeps the site working under any base (user-page or project-page).
// `path` is the page's location under SITE_URL, used for canonical + og:url (e.g. '', 'blog/', 'blog/slug/').
function shell({ title, body, current = null, prefix, path = '', description = '', ogType = 'website', ogImage = '', extraScripts = [], extraStyles = [] }) {
  const nav = NAV.map(({ slug, label }) => current === slug
    ? `<a href="${prefix}${slug}/" aria-current="page">${label}</a>`
    : `<a href="${prefix}${slug}/">${label}</a>`).join('\n      ');
  const styles = extraStyles.map(s => `  <link rel="stylesheet" href="${prefix}css/${s}">`).join('\n');
  const scripts = extraScripts.map(s => `  <script src="${prefix}js/${s}"></script>`).join('\n');

  const canonical = `${SITE_URL}${path}`;
  const desc = description ? esc(description) : '';
  const twitterCard = ogImage ? 'summary_large_image' : 'summary';
  const seo = [
    desc && `  <meta name="description" content="${desc}">`,
    `  <link rel="canonical" href="${canonical}">`,
    `  <meta property="og:type" content="${ogType}">`,
    `  <meta property="og:title" content="${esc(title)}">`,
    desc && `  <meta property="og:description" content="${desc}">`,
    `  <meta property="og:url" content="${canonical}">`,
    `  <meta property="og:site_name" content="greg chinnici">`,
    ogImage && `  <meta property="og:image" content="${esc(ogImage)}">`,
    `  <meta name="twitter:card" content="${twitterCard}">`,
    `  <meta name="twitter:title" content="${esc(title)}">`,
    desc && `  <meta name="twitter:description" content="${desc}">`,
    ogImage && `  <meta name="twitter:image" content="${esc(ogImage)}">`,
  ].filter(Boolean).join('\n');

  return `<!doctype html>
<html lang="en" data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
${seo}
  ${favicon}
  <script>
    ${themeBootScript}
  </script>
  <link rel="stylesheet" href="${prefix}css/themes.css">
  <link rel="stylesheet" href="${prefix}css/base.css">
${styles ? styles + '\n' : ''}</head>
<body>
  <header class="site-header">
    <a class="brand" href="${prefix || './'}">greg chinnici</a>
    <nav>
      ${nav}
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

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function listPostDirs(contentDir) {
  const entries = await readdir(contentDir, { withFileTypes: true });
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

// a cover can be a remote URL (used verbatim) or a local asset filename
// (copied next to the page, referenced relative to `prefix`).
function coverSrc(cover, prefix) {
  if (!cover) return null;
  return /^https?:\/\//.test(cover) ? cover : `${prefix}${cover}`;
}

// pull the 11-char id out of any youtube url form (watch?v=, youtu.be/,
// embed/, shorts/) or accept a bare id. returns null for non-youtube values.
function youtubeId(video) {
  if (!video) return null;
  const s = String(video).trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
}

// a still to use as a card cover when no explicit `cover` is set.
function videoThumb(video) {
  const id = youtubeId(video);
  return id ? `https://img.youtube.com/vi/${id}/maxresdefault.jpg` : null;
}

// responsive player for a `video` front-matter value. youtube urls/ids become
// a privacy-friendly embed; any other url is used as a raw iframe src (vimeo, …).
function videoEmbed(video, title) {
  if (!video) return '';
  const id = youtubeId(video);
  const src = id ? `https://www.youtube-nocookie.com/embed/${id}` : String(video).trim();
  if (!/^https?:\/\//.test(src)) return '';
  return `      <div class="video-embed">
        <iframe src="${esc(src)}" title="${esc(title)} — video" loading="lazy" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
      </div>\n`;
}

// metadata chips shown on a game writeup and its card (tech · role · status).
function metaItems(data) {
  return [data.tech, data.role, data.status].filter(Boolean);
}

async function buildPost(section, slug, { includeDrafts = false } = {}) {
  const srcDir = join(CONTENT, section.slug, slug);
  const md = await readFile(join(srcDir, 'index.md'), 'utf8');
  const { data, content } = matter(md);

  // drafts are skipped entirely: no page is emitted and they're left out of
  // the index. set `draft: true` in the post's front matter to hold it back.
  if (data.draft === true && !includeDrafts) return null;

  const html = marked.parse(content);
  const title = data.title || slug;
  const date = formatDate(data.date);

  // game writeups get a metadata bar + external-link row under the title.
  let metaBar = '';
  if (section.slug === 'games') {
    const meta = metaItems(data);
    const links = Array.isArray(data.links) ? data.links : [];
    if (meta.length) {
      metaBar += `\n        <ul class="post-meta">${meta.map(m => `<li>${esc(m)}</li>`).join('')}</ul>`;
    }
    if (links.length) {
      metaBar += `\n        <p class="post-links">${links.map(l =>
        `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)} ↗</a>`).join('')}</p>`;
    }
  }

  // a `video` (youtube url/id or any embeddable url) plays inline under the header.
  const embed = videoEmbed(data.video, title);

  const body = `    <article class="post">
      <header class="post-header">
        <h1>${title}</h1>
        ${date ? `<p class="muted stamp">${date}</p>` : ''}${metaBar}
      </header>
${embed}${html}
    </article>`;

  const dstDir = join(PUBLIC, section.slug, slug);
  await mkdir(dstDir, { recursive: true });

  // absolute og:image — pass a full URL through verbatim; otherwise resolve
  // the sibling asset filename against SITE_URL. games fall back to the
  // video thumbnail so link previews still have something to show.
  let ogImage = '';
  if (section.slug === 'games') {
    const cover = data.cover
      ? (/^https?:\/\//.test(data.cover) ? data.cover : `${SITE_URL}${section.slug}/${slug}/${data.cover}`)
      : videoThumb(data.video);
    ogImage = cover || '';
  }

  await writeFile(join(dstDir, 'index.html'), shell({
    title: `${title} · greg chinnici`,
    body,
    current: section.slug,
    prefix: '../../',
    path: `${section.slug}/${slug}/`,
    description: data.summary || '',
    ogType: 'article',
    ogImage,
  }));
  await copyAssets(srcDir, dstDir);

  return { slug, title, date, summary: data.summary || '', data };
}

async function buildBlogIndex(posts) {
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

  await mkdir(join(PUBLIC, 'blog'), { recursive: true });
  await writeFile(join(PUBLIC, 'blog', 'index.html'), shell({
    title: 'blog · greg chinnici',
    body,
    current: 'blog',
    prefix: '../',
    path: 'blog/',
    description: 'Writeups by Greg Chinnici on game dev, matchmaking systems, embedded hacking, and other side projects.',
    extraScripts: posts.length > 1 ? ['blog.js'] : [],
  }));
}

function gameCard(g) {
  // explicit cover wins; otherwise fall back to the video's thumbnail.
  const cover = coverSrc(g.data.cover, `${g.slug}/`) || videoThumb(g.data.video);
  const coverEl = cover
    ? `<a class="game-card-cover" href="${g.slug}/" aria-label="${esc(g.title)}"><img src="${esc(cover)}" alt="" loading="lazy"></a>`
    : `<a class="game-card-cover placeholder" href="${g.slug}/" aria-label="${esc(g.title)}"><span aria-hidden="true">${esc(g.data.icon || '🎮')}</span></a>`;

  const meta = metaItems(g.data);
  const metaEl = meta.length
    ? `\n          <ul class="game-meta">${meta.map(m => `<li>${esc(m)}</li>`).join('')}</ul>`
    : '';

  const links = Array.isArray(g.data.links) ? g.data.links : [];
  const actions = [`<a href="${g.slug}/">writeup →</a>`]
    .concat(links.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)} ↗</a>`))
    .join('');

  return `        <li class="game-card" data-date="${g.date || ''}" data-text="${esc((g.title + ' ' + g.summary + ' ' + meta.join(' ')).toLowerCase())}">
          ${coverEl}
          <div class="game-card-body">
            <h2 class="game-card-title"><a href="${g.slug}/">${g.title}</a></h2>
            ${g.date ? `<p class="muted stamp">${g.date}</p>` : ''}${metaEl}
            ${g.summary ? `<p class="muted game-card-summary">${g.summary}</p>` : ''}
            <p class="game-card-actions">${actions}</p>
          </div>
        </li>`;
}

async function buildGamesIndex(games) {
  games.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const cards = games.length
    ? games.map(gameCard).join('\n')
    : `        <li class="muted">no games yet.</li>`;

  const sortControls = games.length > 1 ? `
      <div class="post-list-controls">
        <input type="search" class="post-search" data-post-search placeholder="search games…" aria-label="search games" autocomplete="off">
        <button data-sort-toggle aria-label="toggle sort order">
          <span data-sort-label>newest first</span>
        </button>
      </div>` : '';

  const emptyState = games.length > 1
    ? `\n      <p class="muted post-empty" data-post-empty hidden>no games match your search.</p>`
    : '';

  const body = `    <section class="intro">
      <h1>games</h1>
      <p class="muted">game dev projects — showcases, breakdowns, and the odd prototype.</p>
    </section>

    <section>${sortControls}
      <ul class="game-grid" data-game-grid>
${cards}
      </ul>${emptyState}
    </section>`;

  await mkdir(join(PUBLIC, 'games'), { recursive: true });
  await writeFile(join(PUBLIC, 'games', 'index.html'), shell({
    title: 'games · greg chinnici',
    body,
    current: 'games',
    prefix: '../',
    path: 'games/',
    description: 'Game dev projects by Greg Chinnici — showcases, breakdowns, and prototypes across Unity, C#, and Python.',
    extraScripts: games.length > 1 ? ['games.js'] : [],
  }));
}

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

async function buildSection(section, { includeDrafts }) {
  const contentDir = join(CONTENT, section.slug);
  const outDir = join(PUBLIC, section.slug);

  if (await exists(outDir)) {
    await rm(outDir, { recursive: true, force: true });
  }
  await mkdir(outDir, { recursive: true });

  if (!(await exists(contentDir))) {
    console.log(`no content/${section.slug}/ — writing empty index`);
    await section.buildIndex([]);
    return;
  }

  const slugs = await listPostDirs(contentDir);
  const built = [];
  for (const slug of slugs) {
    const post = await buildPost(section, slug, { includeDrafts });
    if (!post) {
      console.log(`skipped ${relative(ROOT, join(contentDir, slug, 'index.md'))} (draft)`);
      continue;
    }
    built.push(post);
    console.log(`built ${relative(ROOT, join(outDir, slug, 'index.html'))}`);
  }
  await section.buildIndex(built);
  console.log(`built ${relative(ROOT, join(outDir, 'index.html'))} (${built.length} ${section.slug})`);
}

// wraps the hand-written body at content/index.html in the shared shell,
// so the header/nav lives in exactly one place (shell()) rather than being
// duplicated per page.
async function buildHome() {
  const src = join(CONTENT, 'index.html');
  if (!(await exists(src))) {
    console.log('no content/index.html — skipping home');
    return;
  }
  const body = await readFile(src, 'utf8');
  await writeFile(join(PUBLIC, 'index.html'), shell({
    title: 'greg chinnici',
    body,
    prefix: '',
    path: '',
    description: 'Greg Chinnici — software engineer in Orange County, CA. Backend, game dev, and technical design.',
    extraStyles: ['resume.css', 'parallax.css'],
    extraScripts: ['parallax.js', 'latest-post.js'],
  }));
  console.log(`built ${relative(ROOT, join(PUBLIC, 'index.html'))}`);
}

async function main() {
  const includeDrafts = process.argv.includes('--drafts');
  if (includeDrafts) console.log('including drafts');

  const sections = [
    { slug: 'blog', buildIndex: buildBlogIndex },
    { slug: 'games', buildIndex: buildGamesIndex },
  ];

  for (const section of sections) {
    await buildSection(section, { includeDrafts });
  }

  await buildHome();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
