// hydrate the page from data served by the `data` branch.
// the workflow at .github/workflows/hydrate.yml writes manifest.json
// + one file per source. add new sources there; this script reads the
// manifest and dispatches per `kind`.
//
// add a renderer to the `renderers` map below for each source `kind`,
// and mount a [data-hydrate-target] element on the page for output.

const REPO = 'greg-chinnici/gregdev';
const DATA_URL = `https://raw.githubusercontent.com/${REPO}/data`;

async function fetchJSON(path) {
  const res = await fetch(`${DATA_URL}/${path}`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

// map of source `kind` -> (data, el) => void. empty for now; the weather
// source was retired with the homepage activity widget. add entries here
// alongside new sources in scripts/hydrate.js.
const renderers = {};

async function hydrate() {
  const target = document.querySelector('[data-hydrate-target]');
  const stamp = document.querySelector('[data-updated]');
  if (!target) return;

  let manifest;
  try {
    manifest = await fetchJSON('manifest.json');
  } catch {
    return; // data branch not populated yet — leave placeholder in place
  }

  if (stamp && manifest.updated) {
    stamp.textContent = `updated ${new Date(manifest.updated).toLocaleString()}`;
  }

  const sources = manifest.sources || [];
  if (sources.length === 0) return;

  target.innerHTML = '';
  for (const src of sources) {
    const render = renderers[src.kind];
    if (!render) continue;
    try {
      const data = await fetchJSON(src.file);
      const block = document.createElement('div');
      block.className = `source source-${src.kind}`;
      render(data, block);
      target.appendChild(block);
    } catch (e) {
      console.warn(`hydrate ${src.kind} failed`, e);
    }
  }
}

hydrate();
