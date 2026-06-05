// Parallax box-follower: a box chases the cursor along a horizontal line inside
// a bounded panel, with background layers that scroll and foreground props that
// parallax past. Adapted from a full-viewport demo to be scoped to one element.
(function () {
  const stage = document.querySelector('[data-parallax]');
  if (!stage) return;

  const box = stage.querySelector('[data-parallax-box]');
  const fg = stage.querySelector('[data-parallax-fg]');
  const bgLayers = [
    { el: stage.querySelector('.parallax-bg-far'), factor: 0.2 },
    { el: stage.querySelector('.parallax-bg-mid'), factor: 0.5 },
  ];
  const FG_FACTOR = 1.4;

  // ---- Tuning ----
  const LERP = 0.12;          // how fast the box chases the cursor (0..1)
  const MOVE_THRESHOLD = 0.5; // px-to-target above which the box is "moving"
  const IDLE_DELAY = 1500;    // ms of cursor inactivity before resting -> idle

  // ---- State ----
  let width = stage.clientWidth;
  let targetX = width / 2;     // start centered so it doesn't snap on load
  let currentX = targetX;
  let lastMoveAt = performance.now();
  let state = 'resting';
  let facing = 1;

  const rand = (min, max) => min + Math.random() * (max - min);

  // Foreground props spread across a world wider than the panel, so there's
  // always something to parallax into. Each gets a data-prop index hook.
  (function buildProps() {
    const count = 5;
    const worldWidth = width * 3;
    const worldLeft = -width;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'parallax-prop';
      p.dataset.prop = i;
      const size = rand(28, 64);
      p.style.width = p.style.height = size + 'px';
      p.style.left = worldLeft + (i + Math.random()) * (worldWidth / count) + 'px';
      p.style.top = `calc(50% + ${rand(20, 75)}px)`;
      fg.appendChild(p);
    }
  })();

  // Track the cursor anywhere on the page, mapped into stage-local X and
  // clamped to the panel edges — so the box follows even when the pointer is
  // outside the panel.
  window.addEventListener('pointermove', (e) => {
    const rect = stage.getBoundingClientRect();
    targetX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    lastMoveAt = performance.now();
  });

  window.addEventListener('resize', () => {
    width = stage.clientWidth;
    targetX = Math.min(targetX, width);
    currentX = Math.min(currentX, width);
  });

  function setState(next) {
    if (next === state) return;
    box.classList.remove(state);
    box.classList.add(next);
    box.dataset.state = next; // ::before reads this
    state = next;
  }

  function tick(now) {
    // Ease toward the target (lerp = ease-out feel).
    currentX += (targetX - currentX) * LERP;
    const delta = targetX - currentX;
    const distance = Math.abs(delta);

    // Only flip facing while clearly moving, to avoid sub-pixel jitter.
    if (distance > MOVE_THRESHOLD) facing = delta > 0 ? 1 : -1;

    const sinceMove = now - lastMoveAt;
    setState(
      distance > MOVE_THRESHOLD ? 'moving' : sinceMove > IDLE_DELAY ? 'idle' : 'resting'
    );

    box.style.left = currentX + 'px';
    box.style.setProperty('--facing', facing);

    // Parallax everything off the smoothed camera offset from panel center.
    const cameraOffset = currentX - width / 2;
    for (const layer of bgLayers) {
      layer.el.style.backgroundPositionX = -cameraOffset * layer.factor + 'px';
    }
    fg.style.transform = `translateX(${-cameraOffset * FG_FACTOR}px)`;

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
