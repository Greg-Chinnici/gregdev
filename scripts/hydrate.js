// fetch external data and write json files + manifest.json into cwd.
// invoked by .github/workflows/hydrate.yml inside a checkout of the
// orphan `data` branch. the workflow handles git; this script only
// touches files.
//
// add new sources by appending to the SOURCES array. each source
// returns the data to write; on throw it's skipped and logged. add
// a matching renderer in public/js/hydrate.js for it to appear.

import { writeFile } from 'node:fs/promises';

const SOURCES = [
  // weather was retired when the homepage activity widget was replaced by the
  // parallax playground. add new sources here and a matching renderer in
  // public/js/hydrate.js to bring the activity section back.
];

async function run() {
  const ok = [];
  for (const src of SOURCES) {
    try {
      const data = await src.fetch();
      await writeFile(src.file, JSON.stringify(data, null, 2));
      ok.push({ kind: src.kind, file: src.file });
      console.log(`ok ${src.kind} -> ${src.file}`);
    } catch (e) {
      console.warn(`skip ${src.kind}: ${e.message}`);
    }
  }
  const manifest = {
    updated: new Date().toISOString(),
    sources: ok,
  };
  await writeFile('manifest.json', JSON.stringify(manifest, null, 2));
  console.log(`wrote manifest.json (${ok.length} sources)`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
