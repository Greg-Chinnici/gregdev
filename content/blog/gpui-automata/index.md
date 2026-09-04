---
title: "Composable Cellular Automata"
date: 2026-09-04
summary: A Rust desktop app for exploring Life-like automata — with a rule stack, an infinite sparse world, and a falling-sand mode.
video: "https://www.youtube.com/watch?v=U684lGvNkEs"
draft: false
---

I wanted a scratchpad for cellular automata where I could line up several rules, set how long each runs, and watch a pattern shift as the sequence advances — Life for a while, then Seeds for a burst, then back to Life.

That's what this app is. It also grew a falling-sand mode along the way, since once you have an infinite sparse grid sitting there, why not.

Written in Rust with [GPUI](https://www.gpui.rs), the framework Zed uses. About 100KB of source across seven files.

## Rules as bitmasks

Life-like rules use B/S notation. `B3/S23` means "a dead cell is born with 3 live neighbors; a live cell survives with 2 or 3". There are nine possible neighbor counts, so each half fits in a `u16`:

```rust
pub struct BsRule {
    birth: u16,
    survival: u16,
}

pub fn next_state(&self, alive: bool, neighbors: u8) -> bool {
    let mask = if alive { self.survival } else { self.birth };
    (mask >> neighbors) & 1 == 1
}
```

Two shifts and a compare in the hot loop. Parsing takes `B3/S23` in either order, case-insensitive, plus the Golly-style `23/3`. Rules serialize back to their notation string so saved files stay readable.

## The rule stack

This is the piece I built the app for. A `RuleStack` is a list of `(rule, generations)` pairs that loops. One entry can be marked infinite, which absorbs every generation from its start onward.

Editing is drag-and-drop with undo/redo, implemented as a command pattern where each edit inverts itself:

```rust
pub enum EditCommand {
    Add    { index: usize, entry: StackEntry },
    Remove { index: usize, entry: StackEntry },
    SetGenerations { index: usize, old: Option<u32>, new: Option<u32> },
    Move   { from: usize, to: usize },
}
```

Two stacks (undo and redo); any new edit clears the redo history. Round-trips through JSON.

## An infinite sparse world

The grid is chunked into 64×64 dense tiles. Only chunks with live cells exist in `HashMap<ChunkPos, Chunk>`. A chunk drops itself when its live count hits zero, and setting a dead cell in empty space doesn't allocate:

```rust
pub fn set(&mut self, x: i64, y: i64, value: bool) {
    let pos = /* chunk for (x, y) */;
    if !value {
        if let Some(chunk) = self.chunks.get_mut(&pos) {
            chunk.set(lx, ly, false);
            if chunk.live == 0 {
                self.chunks.remove(&pos);
            }
        }
        return;
    }
    self.chunks.entry(pos).or_insert_with(Chunk::new).set(lx, ly, true);
}
```

Stepping is double-buffered. Each generation I gather every chunk with life plus its eight neighbors as candidates — nothing outside that set can change. For each candidate I read halo cells from the 3×3 chunk neighborhood, compute the next state, and drop empty results.

The tests I care about: a blinker straddling a chunk boundary oscillates, a glider crosses seams intact, and set-then-clear leaves zero allocated chunks.

## Falling sand

Halfway through I caved and added a physics mode. Same chunked grid, but each cell holds a `MaterialId` into a material table:

```rust
pub enum Phase { Empty, Solid, Powder, Liquid, Gas }

pub struct Material {
    pub name: String,
    pub phase: Phase,
    pub density: f32,
    pub color: u32,
}
```

Stepping works differently. CA reads from an immutable snapshot each generation. Falling sand runs in-place — a "move" is clear + set, and against a snapshot you'd draw the same grain over and over, or lose collisions between grains. Standard approach; it's how Noita and Powder Toy do it.

The scan runs bottom-to-top so falling resolves in one pass, and horizontal direction alternates each tick so piles don't skew. A `HashSet<(i64, i64)>` marks cells that already moved so nothing gets pushed twice. Denser fluids sink through lighter ones via a `can_displace` check on density and direction.

`M` toggles between modes. Both worlds stay alive and share the camera.

## Odds and ends

- **Drop-to-stamp**: drag a PNG or JPEG onto the window and it's thresholded and stamped at the view center. Good for seeding Life with a photo.
- **Themes** are palettes. One is a Rainbow mode where cell color is a diagonal hue sweep across world coordinates, so gliders change color as they travel.
- **Snapshots**: `S` saves, `B` restores. One slot per mode.
- **Randomize visible region**: `R`. Capped at 600 cells wide so an extreme zoom-out doesn't touch millions of cells.
- **EMA-smoothed metrics** in the top bar — steps/sec, ms/step, population delta. Raw numbers flicker too much to read.

## GPUI

First real project with it. The API is Tailwind-in-Rust — `.px_2().rounded_sm().bg(rgb(...))` — and custom drawing goes through a `canvas()` element that hands you a paint context. Drag-and-drop is first-class: `.on_drag(payload, |...| DragPreview { ... })` on the source, `.on_drop(...)` on the target, with the typed payload threaded through.

The one snag was Metal shader compilation. The default path shells out to `xcrun metal` at build time, which isn't in my Nix devshell. GPUI has a `runtime_shaders` feature that compiles at app start; flipping it on made the Nix build work.

## Where it's going

The rule stack is what I actually use. Watching a pattern evolve under B3/S23 for a hundred generations and then hit three generations of B2/S is more interesting than any single rule. I want to push the pipeline idea further — rule blending, per-region rules, maybe scripted transitions between segments.

For now it's a toy, but the code for it is here: [GitHub](https://github.com/Greg-Chinnici/automata).
