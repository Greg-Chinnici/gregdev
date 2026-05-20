---
title: hello, world
date: 2026-05-20
summary: a first post to prove the build works end to end.
---

this is a sample post. it lives in `content/blog/first-post/index.md`.

at build time, `scripts/build.js` turns this file into `public/blog/first-post/index.html`,
copies any sibling assets next to it, and regenerates the blog index.

## syntax

```js
const greeting = 'hello';
console.log(greeting);
```

drop a `cover.webp` (or any other file) next to this `index.md` and reference it
with a relative path like `![cover](cover.webp)` — the build copies it through.
