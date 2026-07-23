---
title: "Modifying a DEFCON 32 Badge to play media"
date: 2026-07-15
summary: "Turning the DC32 badge into a video/GIF/slideshow player: a custom RGB565 binary format, a streaming MicroPython firmware with PIO-driven SPI, and a web UI to build it all."
draft: false
---

The DEFCON 32 badge ships as a Game Boy emulator built around a Raspberry Pi RP2350, a 320x240 LCD, an SD card slot, nine buttons, a resistive touchscreen, ten addressable LEDs, and a little PWM speaker. That's a lot of hardware to leave running one cartridge. This project reflashes it into a media player: drop videos, GIFs, images, and PDF slide decks into a web UI, build a single binary, copy it to the SD card, and the badge plays it on a loop with real playback controls.

The interesting part isn't any single piece — it's how the constraints of a 520 KB microcontroller force the architecture into a particular shape. Here's the methodology, roughly in the order the problems showed up.

## The core constraint: 520 KB of RAM, no PSRAM

One 320x240 frame in RGB565 is 150 KB. The RP2350 has 520 KB of SRAM total, and MicroPython eats a chunk of that before your code runs. Decoding video on-device is out of the question, and even buffering whole frames is uncomfortable.

That constraint dictated the split that everything else follows from:

1. **Do all the hard work on a laptop.** A Python build tool decodes every media type down to raw, pre-scaled RGB565 frames — the exact bytes the LCD wants.
2. **Make the badge a dumb pipe.** The firmware never decodes anything. It streams bytes from the SD card to the display in small chunks, so peak RAM use is a few KB of buffer, not a 150 KB frame.

Raw RGB565 is enormously wasteful on disk compared to MP4 — but SD cards are big and cheap, and the payoff is *zero* decode cost on a chip that couldn't afford any.

## The binary format

Everything gets packed into one file, `SLIDESHOW.BIN`, with a layout designed around how the firmware needs to read it:

```
Header (14 bytes)         magic "SLID", version, slide count,
                          width, height, pixel byte order
Index table               one 14-byte entry per slide:
                          offset, frame count, ms-per-frame,
                          hold time, type (static/animated), flags
Padding                   zeros up to a 512-byte boundary
Frame data                raw RGB565 frames, back to back
```

Two details matter here.

**The index table is tiny and lives in RAM.** The firmware reads it once at startup — a few hundred bytes even for a big deck — and from then on can seek to any slide with a single file offset. Frame data itself is never held whole.

**Everything is aligned to 512-byte SD sectors.** SD cards read in 512-byte blocks, and a read that straddles a block boundary makes the filesystem layer do slow windowed copies. So the frame region is padded to start on a sector boundary, and since a 320x240x2 frame is exactly 300 sectors, every frame in the file stays block-aligned. Seeking to any frame reads only the sectors it needs. The firmware's streaming chunk size (8 KB) is asserted to be a multiple of 512 for the same reason.

## The build pipeline

`build.py` takes a YAML manifest — a list of media with per-slide settings — and produces the binary. Each media type gets its own ingest path, all converging on the same "sequence of RGB frames" representation:

- **Images** load through Pillow, with EXIF orientation honored so phone photos come out upright.
- **GIFs** expand frame-by-frame via `ImageSequence`, preserving per-frame timing.
- **Videos** go through ffmpeg, decoded at a target fps (frames land around 100 ms apart — about the ceiling the badge can sustain anyway).
- **PDFs** (slide decks exported from PowerPoint/Keynote) rasterize at 2x panel resolution and then downscale with Lanczos, which anti-aliases slide text far better than rendering at panel size directly. Each page becomes a "chunk" of one media, so the badge's next/prev keys page through the deck.
- **YouTube clips** can be pulled directly with yt-dlp, trimmed to a time range.

Every frame then goes through the same fitting step — `cover` (fill and crop), `contain` (letterbox), or `stretch` — settable deck-wide with per-slide overrides, since a 16:9 slide deck shouldn't be cropped the way a photo can be. Finally the frames are packed to RGB565 with numpy: mask, shift, and OR the three channels of the whole frame at once, then serialize in whichever byte order the panel wants.

### Chunking: seeking for free

Long clips get split into "episodic chunks" of N seconds. The trick is that this costs nothing in the file: since frames are fixed-size and stored back to back, a chunk is just an extra index entry pointing into the same contiguous frame data. No bytes are duplicated. The badge's prev/next buttons step between index entries, so chunking turns "skip the whole 60-second clip" into "seek through it 10 seconds at a time."

A flag bit (`FLAG_MEDIA_START`) marks the first chunk of each media, which lets a second pair of buttons do "big skips" — jump a whole clip at a time, stepping over its remaining chunks, like track buttons on a music player.

### Transitions and differential encoding

Two later additions rode on the same index-entry mechanism:

- **Transitions** between clips are baked at build time: a short run of generated frames morphing the last frame of one clip into the first frame of the next, emitted as its own index entry *without* the media-start flag. So it plays on the way out of a clip, but the big-skip keys step straight over it — you can never skip *to* a transition.
- **Differential rendering** (optional) stores an entry as one full keyframe plus per-frame pixel diffs instead of full frames. Since every index entry is a seek point, seeking still always lands on a full frame. Diff-encoded files bump the header version so an old player rejects them instead of rendering garbage.

## The firmware

The player (`firmware/slideshow.py`, MicroPython) is where the hardware fights back. Three problems dominated.

**The display isn't wired for hardware SPI.** The badge routes the LCD's SCK to a pin that's SPI1-RX and MOSI to a pin that's SPI0-SCK — not a usable pair for any hardware SPI block. The reference firmware bit-bangs SoftSPI, which is far too slow for full-frame video. The fix is the RP2350's PIO: small programmable state machines that can clock SPI out of *any* GPIOs at MHz rates, fed by DMA so the CPU isn't in the byte loop. That's roughly a 50x speedup over SoftSPI, running the panel at 24 MHz (conservatively — ST7789-class panels accept more).

**The stock SD driver sleeps.** micropython-lib's `sdcard.py` sleeps 1 ms per poll while waiting for each block's data token. At ~300 blocks per frame, that dead time dominates the read entirely — it's why cranking the SPI clock past ~10 MHz stopped helping. The firmware swaps in a busy-polling `readinto`, which recovers most of the frame time.

**Python overhead per block is the remaining bottleneck.** Since frame reads are bound by interpreter overhead in the driver loop, raising the CPU clock cuts frame time almost linearly. The RP2350 boots at 150 MHz; the firmware overclocks to 200 MHz (a very safe margin) before constructing any SPI or PIO objects, since their clock dividers derive from the system clock.

The main loop polls `ticks_ms()` rather than sleeping, so buttons stay responsive during long holds and between frames. And since the badge hardware was all sitting there anyway: prev/next chirp low/high beeps on the speaker, the WS2812 strip picks a color per slide, one LED turns yellow while paused, and a tap on the resistive touchscreen (an NS2009 on I2C, a different peripheral block than the SD's SPI, so no conflict) toggles pause just like the button.

| Button | Function |
| --- | --- |
| LEFT / RIGHT | Previous / next chunk |
| B / A | Big skip: previous / next media |
| DOWN or screen tap | Pause / resume |

## The web UI

Nobody wants to hand-edit YAML at a conference, so a Flask app (`webui.py`) wraps the whole workflow: upload media (or paste an image URL or YouTube link), drag the order around, tweak per-slide hold times and fit modes, see an estimated final binary size, build, and copy the result — plus the firmware itself, via `mpremote` — onto a connected SD card or badge.

The important design decision is that the UI re-implements nothing: its build endpoint calls `build.build()` directly, so the web UI and the CLI can never disagree about the format.

## Takeaways

- **Move work to build time.** The whole system works because the expensive parts (decode, scale, color-convert, even transitions) happen once on a machine with gigabytes of RAM, leaving the device a byte-copying loop.
- **Design file formats around the storage medium.** Sector-aligning the frame data was a one-line padding calculation in the builder that eliminated an entire class of slow reads on the device.
- **An index table is a powerful primitive.** Chunked seeking, big-skip navigation, transitions, and diff keyframes all fell out of "a slide is just an entry pointing at an offset" without changing the frame data layout.
- **Profile before cranking clocks.** The SD bottleneck turned out to be a 1 ms sleep in a driver loop, not bus speed. Fixing that (and the interpreter-bound block loop) is why the overclock helped at all.
