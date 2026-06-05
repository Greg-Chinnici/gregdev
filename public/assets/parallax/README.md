# parallax assets

Drop sprite images for the homepage parallax panel here. They're referenced
from `public/css/parallax.css` (background layers) and can be hooked per-prop
from `public/js/parallax.js` (foreground props via `data-prop`).

Suggested files (swap in whenever you have art):

- `bg-far.png`  — far background strip, tiles horizontally (slowest layer)
- `bg-mid.png`  — mid background strip, tiles horizontally
- `prop-*.png`  — individual foreground props

To use one, point a layer at it from `parallax.css`, e.g.:

```css
.parallax-bg-far { background-image: url("../assets/parallax/bg-far.png"); }
```

Until then the layers fall back to the inline SVG silhouettes defined in
`parallax.css`. Tileable strips look best; keep `image-rendering: pixelated`
for pixel-art sprites.
