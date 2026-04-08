# react-helios

Production-grade React video player with HLS streaming, zero-cost audio mode, adaptive quality selection, manual quality switching, live stream support, subtitle tracks, VTT sprite sheet thumbnail preview, waveform audio progress bar, Picture-in-Picture, configurable skip-back / skip-forward buttons, mobile-responsive controls, and full keyboard control.

## Installation

```bash
npm install react-helios
```

**Peer dependencies** — install if not already in your project:

```bash
npm install react react-dom
```

## Quick Start

```tsx
import { VideoPlayer } from "react-helios";
import "react-helios/styles";

export default function App() {
  return (
    <VideoPlayer
      src="https://example.com/video.mp4"
      poster="https://example.com/poster.jpg"
      controls
      options={{
        autoplay: false,
        loop: false,
        thumbnailVtt: "https://example.com/thumbs/storyboard.vtt",
      }}
    />
  );
}
```

> **Next.js** — import the styles in your root `layout.tsx` and mark the component as `"use client"` or wrap it in a client component.

## HLS Streaming

Pass any `.m3u8` URL — HLS.js is initialised automatically:

```tsx
<VideoPlayer
  src="https://example.com/stream.m3u8"
  controls
  options={{
    enableHLS: true,         // default: true
    hlsConfig: {
      maxBufferLength: 60,
      capLevelToPlayerSize: true,
    },
  }}
/>
```

On Safari the browser's native HLS engine is used. A **LIVE** badge and **GO LIVE** button appear automatically for live streams.

## Audio Mode

Audio mode pauses the video element completely (stopping all video decoding), shows the poster artwork, and hands playback off to a lightweight `<audio>` element — so the player uses roughly the same CPU/GPU as a music app instead of a playing video.

```tsx
<VideoPlayer
  src="https://example.com/stream.m3u8"
  poster="https://example.com/artwork.jpg"
  controls
  options={{
    audioSrc: "https://example.com/audio-only.m3u8",
    audioPoster: "https://example.com/audio-artwork.jpg",
    audioModeLabel: "Switch to Audio",
    videoModeLabel: "Switch to Video",
    defaultAudioMode: false,
    onAudioModeChange: (isAudio) => console.log("audio mode:", isAudio),
  }}
/>
```

The audio toggle button only appears in the control bar when `audioSrc` is provided. Custom icons can be passed via `audioModeIcon` / `videoModeIcon`.

When switching between modes, position, volume, and playback rate are synced automatically — the listener hears no gap.

### Audio mode poster

Use `audioPoster` to show a different image in audio mode than the video `poster`. If neither `audioPoster` nor `poster` is provided, the `audioModeFallback` content is shown instead:

```tsx
<VideoPlayer
  src="https://example.com/stream.m3u8"
  poster="https://example.com/video-thumb.jpg"
  options={{
    audioSrc: "https://example.com/audio-only.m3u8",
    // Show a dedicated artwork image in audio mode
    audioPoster: "https://example.com/audio-artwork.jpg",
  }}
/>
```

Priority order: `audioPoster` → `poster` (if `audioModeFallback` is not set) → `audioModeFallback` → `logo`.

Use `audioModeFallback` when you want to render arbitrary React content (e.g. an animated logo or custom component) instead of a static image:

```tsx
<VideoPlayer
  src="https://example.com/stream.m3u8"
  options={{
    audioSrc: "https://example.com/audio-only.m3u8",
    audioModeFallback: <MyAnimatedArtwork />,
  }}
/>
```

### Waveform progress bar

In audio mode the normal video progress bar is replaced by a **waveform-style bar graph** — 200 pseudo-random bars that reveal left-to-right as the audio plays. Buffered/preloaded content is shown in a lighter shade behind the played bars. No configuration is needed; the waveform appears automatically whenever audio mode is active.

### Automatic switching

The player uses two independent signals to detect poor conditions and switch to audio mode automatically. Either one firing is enough.

**Bandwidth-based** — measures the actual download speed of each HLS fragment and switches when the rolling average drops below a threshold:

```tsx
import { AUDIO_BANDWIDTH_THRESHOLDS } from "react-helios";

<VideoPlayer
  src="https://example.com/stream.m3u8"
  options={{
    audioBandwidthThreshold: AUDIO_BANDWIDTH_THRESHOLDS.FAIR, // recommended
    // audioBandwidthThreshold: 0,  // disable bandwidth-based switching
  }}
/>
```

| Preset | Kbps | Typical connection |
|--------|------|--------------------|
| `EXTREME` | 100 | 2G / Edge |
| `POOR` | 300 | Slow 3G |
| `FAIR` | 800 | Marginal 3G ← **recommended** |
| `GOOD` | 1500 | Weak 4G / congested Wi-Fi |

**Level-based** — switches when HLS.js drops to a specific quality level (its own ABR algorithm already does the hard work):

```tsx
import { AUDIO_SWITCH_LEVELS } from "react-helios";

<VideoPlayer
  src="https://example.com/stream.m3u8"
  options={{
    audioModeSwitchLevel: AUDIO_SWITCH_LEVELS.LOWEST, // switch at lowest quality level
  }}
/>
```

| Preset | Value | Meaning |
|--------|-------|---------|
| `LOWEST` | 0 | Switch when HLS.js is at the lowest available quality |
| `SECOND_LOWEST` | 1 | Switch one level above the lowest |
| `DISABLED` | -1 | Disable level-based switching |

Using **both together** is the most reliable approach:

```tsx
<VideoPlayer
  src="https://example.com/stream.m3u8"
  options={{
    audioSrc: "https://example.com/audio-only.m3u8",
    audioBandwidthThreshold: AUDIO_BANDWIDTH_THRESHOLDS.FAIR,
    audioModeSwitchLevel: AUDIO_SWITCH_LEVELS.LOWEST,
  }}
/>
```

After the user manually toggles audio mode a 60-second cooldown suppresses automatic switching. The player also probes for bandwidth recovery every 30 seconds while in auto-switched audio mode (configurable via `audioModeRecoveryInterval`).

## Thumbnail Preview

Hover over the progress bar to see a time tooltip. For rich sprite-sheet thumbnails, pass a `thumbnailVtt` URL pointing to a [WebVTT thumbnail file](https://developer.bitmovin.com/playback/docs/webvtt-based-thumbnails).

```tsx
<VideoPlayer
  src="https://example.com/video.mp4"
  options={{
    thumbnailVtt: "https://example.com/thumbs/storyboard.vtt",
  }}
/>
```

If the image paths inside the VTT file are relative, supply `thumbnailVttBaseUrl` so the player can resolve them:

```tsx
<VideoPlayer
  src="https://example.com/video.mp4"
  options={{
    thumbnailVtt: "/thumbs/storyboard.vtt",
    thumbnailVttBaseUrl: "https://example.com",
  }}
/>
```

### VTT format

Each cue in the `.vtt` file maps a time range to a rectangular region inside a sprite image using the `#xywh=x,y,w,h` fragment:

```
WEBVTT

00:00:00.000 --> 00:00:05.000
https://example.com/thumbs/sprite.jpg#xywh=0,0,160,90

00:00:05.000 --> 00:00:10.000
https://example.com/thumbs/sprite.jpg#xywh=160,0,160,90

00:00:10.000 --> 00:00:15.000
https://example.com/thumbs/sprite.jpg#xywh=320,0,160,90
```

The player fetches the VTT file once, parses all cues, and uses CSS `background-position` to display the correct sprite cell during hover — **no additional network requests per hover**.

To disable the preview entirely:

```tsx
<VideoPlayer src="..." options={{ enablePreview: false }} />
```

## Props

### Top-level props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `src` | `string` | — | Video URL (MP4, WebM, HLS `.m3u8`, …) |
| `poster` | `string` | — | Poster image shown before playback and in audio mode |
| `controls` | `boolean` | `true` | Show the built-in control bar |
| `className` | `string` | — | CSS class on the player container |
| `options` | `VideoPlayerOptions` | `{}` | All configuration (see below) |

### `options` — Playback

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `autoplay` | `boolean` | `false` | Start playback on mount |
| `muted` | `boolean` | `false` | Start muted |
| `loop` | `boolean` | `false` | Loop the video |
| `preload` | `"none" \| "metadata" \| "auto"` | `"metadata"` | Native `preload` attribute |
| `playbackRates` | `PlaybackRate[]` | `[0.25 … 2]` | Available speed options |
| `crossOrigin` | `"anonymous" \| "use-credentials"` | — | CORS attribute for the video element |
| `subtitles` | `SubtitleTrack[]` | — | Subtitle / caption tracks |

### `options` — HLS

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enableHLS` | `boolean` | `true` | Enable HLS.js for `.m3u8` sources |
| `hlsConfig` | `Partial<HlsConfig>` | — | Override any [hls.js config](https://github.com/video-dev/hls.js/blob/master/docs/API.md#fine-tuning) option |

### `options` — Preview

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enablePreview` | `boolean` | `true` | Show thumbnail / time tooltip on progress bar hover |
| `thumbnailVtt` | `string` | — | URL to a WebVTT sprite sheet file for rich thumbnail preview |
| `thumbnailVttBaseUrl` | `string` | — | Base URL prepended to relative image paths inside the VTT file |

### `options` — UI

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `autoHideControls` | `boolean` | `true` | Hide control bar on mouse leave when playing (video mode only) |
| `skipSeconds` | `number` | `15` | Seconds to jump when the rewind / skip-forward buttons are clicked. Set to `0` to hide the buttons. Buttons are always hidden on mobile screens (≤ 480 px) to save space, matching YouTube's mobile layout |

### `options` — Audio mode

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `audioSrc` | `string` | — | Audio-only stream URL; the audio toggle button only shows when this is set |
| `showAudioButton` | `boolean` | `!!audioSrc` | Force-show or hide the audio toggle button |
| `defaultAudioMode` | `boolean` | `false` | Start in audio mode |
| `audioPoster` | `string` | — | Image shown in audio mode (takes priority over `poster`) |
| `audioModeLabel` | `string` | `"Audio"` | Label on the toggle button when in video mode |
| `videoModeLabel` | `string` | `"Video"` | Label on the toggle button when in audio mode |
| `audioModeIcon` | `ReactNode` | built-in headphones icon | Icon shown when in video mode (click → audio) |
| `videoModeIcon` | `ReactNode` | built-in video icon | Icon shown when in audio mode (click → video) |
| `audioModeFallback` | `ReactNode` | — | Custom React content shown in audio mode when neither `audioPoster` nor `poster` is set |
| `logo` | `string \| ReactNode` | — | Logo shown in audio mode when no poster or fallback is set |
| `audioBandwidthThreshold` | `number` | `300` | Kbps — switch when per-fragment bandwidth average drops below this. `0` = disabled (HLS only) |
| `audioModeSwitchLevel` | `number` | — | HLS quality level index — switch when HLS.js drops to this level or below. `0` = lowest. `-1` = disabled |
| `audioModeRecoveryInterval` | `number` | `30000` | Ms between recovery probes while in auto-switched audio mode |

### `options` — Callbacks

| Option | Type | Description |
|--------|------|-------------|
| `onPlay` | `() => void` | Fired when playback starts |
| `onPause` | `() => void` | Fired when playback pauses |
| `onEnded` | `() => void` | Fired when playback ends |
| `onError` | `(error: VideoError) => void` | Fired on playback or stream errors |
| `onTimeUpdate` | `(time: number) => void` | Fired every ~250 ms during playback |
| `onDurationChange` | `(duration: number) => void` | Fired when video duration becomes known |
| `onBuffering` | `(isBuffering: boolean) => void` | Fired when buffering starts / stops |
| `onTheaterModeChange` | `(isTheater: boolean) => void` | Fired when theater mode is toggled |
| `onAudioModeChange` | `(isAudio: boolean) => void` | Fired when audio mode is toggled (manual or automatic) |

### `options` — Custom controls

| Option | Type | Description |
|--------|------|-------------|
| `contextMenuItems` | `ContextMenuItem[]` | Extra items appended to the right-click context menu |
| `controlBarItems` | `ControlBarItem[]` | Extra icon buttons appended to the right side of the control bar |

## Quality Selection

### HLS adaptive quality

For HLS streams (`.m3u8`) the player automatically parses the available quality levels from the manifest. Once levels are available, the **Settings (⚙)** button in the control bar grows a **Speed / Quality** tab bar:

- **Speed tab** — always visible, lets you change playback rate.
- **Quality tab** — appears for HLS streams. Lists all levels sorted by bitrate (e.g. 1080p, 720p, 480p) plus an **Auto** option that enables ABR (adaptive bitrate). The current auto-selected level is shown in parentheses next to "Auto".

You can also switch quality programmatically via the ref:

```tsx
playerRef.current?.setQualityLevel(0);   // pin to highest level
playerRef.current?.setQualityLevel(-1);  // back to ABR auto
```

### Manual quality selection

For non-HLS sources (or when you want to control quality URLs yourself), pass a `manualQualityLevels` array. Each item has a human-readable `label` and the `src` URL to load when the user selects it.

```tsx
import { VideoPlayer } from "react-helios";
import type { ManualQualityLevel } from "react-helios";

const qualityLevels: ManualQualityLevel[] = [
  { label: "1080p",  src: "https://example.com/video-1080p.mp4" },
  { label: "720p",   src: "https://example.com/video-720p.mp4" },
  { label: "480p",   src: "https://example.com/video-480p.mp4" },
  { label: "360p",   src: "https://example.com/video-360p.mp4" },
];

<VideoPlayer
  src="https://example.com/video-720p.mp4"
  controls
  options={{
    manualQualityLevels: qualityLevels,
  }}
/>
```

When `manualQualityLevels` is provided, the **Quality tab** appears automatically in the Settings menu. Selecting an option swaps the player `src` and resumes playback at the same position.

Use `showQualityMenu: true` to force the Quality tab open even when no quality levels have been detected yet (useful during the initial HLS manifest load):

```tsx
options={{ showQualityMenu: true }}
```

Both manual and HLS quality levels can coexist in the same Quality tab — manual levels appear at the top, HLS ABR levels below a divider.

### `options` — Quality

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `manualQualityLevels` | `ManualQualityLevel[]` | — | Src-based quality options shown in the Settings → Quality tab |
| `showQualityMenu` | `boolean` | `false` | Force-show the Quality tab in Settings even before HLS levels are detected |

## Custom Control Bar Buttons

Inject your own icon buttons into the right side of the control bar using `controlBarItems`:

```tsx
import { VideoPlayer } from "react-helios";
import type { ControlBarItem } from "react-helios";

const items: ControlBarItem[] = [
  {
    key: "bookmark",
    label: "Bookmark",
    title: "Save current position",
    icon: <BookmarkIcon />,
    onClick: () => saveBookmark(playerRef.current?.getState().currentTime ?? 0),
  },
];

<VideoPlayer src="..." options={{ controlBarItems: items }} />
```

## Context Menu

Right-clicking the player shows a built-in menu (Play/Pause, Loop, Copy URL, Picture-in-Picture). Append your own items via `contextMenuItems`:

```tsx
import { VideoPlayer } from "react-helios";
import type { ContextMenuItem } from "react-helios";

const items: ContextMenuItem[] = [
  { label: "Add to Watchlist", onClick: () => addToWatchlist() },
  { label: "Share", onClick: () => openShareDialog() },
];

<VideoPlayer src="..." options={{ contextMenuItems: items }} />
```

## Imperative API (Ref)

Use a `ref` to control the player programmatically:

```tsx
import { useRef } from "react";
import { VideoPlayer, VideoPlayerRef } from "react-helios";

export default function App() {
  const playerRef = useRef<VideoPlayerRef>(null);

  return (
    <>
      <VideoPlayer ref={playerRef} src="..." controls />
      <button onClick={() => playerRef.current?.play()}>Play</button>
      <button onClick={() => playerRef.current?.pause()}>Pause</button>
      <button onClick={() => playerRef.current?.seek(30)}>Jump to 30s</button>
      <button onClick={() => playerRef.current?.setVolume(0.5)}>50% volume</button>
      <button onClick={() => playerRef.current?.toggleAudioMode()}>Toggle Audio</button>
    </>
  );
}
```

### `VideoPlayerRef` methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `play` | `() => Promise<void>` | Start playback |
| `pause` | `() => void` | Pause playback |
| `seek` | `(time: number) => void` | Seek to a time in seconds |
| `setVolume` | `(volume: number) => void` | Set volume `0–1` |
| `toggleMute` | `() => void` | Toggle mute, restoring the pre-mute volume |
| `setPlaybackRate` | `(rate: PlaybackRate) => void` | Set playback speed |
| `setQualityLevel` | `(level: number) => void` | Set HLS quality level; `-1` = auto ABR |
| `seekToLive` | `() => void` | Jump to the live edge (HLS live streams) |
| `toggleFullscreen` | `() => Promise<void>` | Toggle fullscreen |
| `togglePictureInPicture` | `() => Promise<void>` | Toggle Picture-in-Picture |
| `toggleTheaterMode` | `() => void` | Toggle theater (wide) mode |
| `toggleAudioMode` | `() => void` | Toggle audio-only mode |
| `getState` | `() => PlayerState` | Snapshot of current player state |
| `getVideoElement` | `() => HTMLVideoElement \| null` | Access the underlying `<video>` element |

## Theater Mode

The player fires `onTheaterModeChange` when theater mode is toggled. Wire it to your layout state to widen your container:

```tsx
"use client";

import { useState } from "react";
import { VideoPlayer } from "react-helios";

export default function Page() {
  const [isTheater, setIsTheater] = useState(false);

  return (
    <main
      style={{ maxWidth: isTheater ? "1600px" : "1200px" }}
      className="mx-auto px-6 transition-[max-width] duration-300"
    >
      <VideoPlayer
        src="https://example.com/stream.m3u8"
        controls
        options={{
          onTheaterModeChange: (t) => setIsTheater(t),
        }}
      />
    </main>
  );
}
```

## Subtitles

```tsx
<VideoPlayer
  src="https://example.com/video.mp4"
  options={{
    subtitles: [
      { id: "en", src: "/subs/en.vtt", label: "English", srclang: "en", default: true },
      { id: "es", src: "/subs/es.vtt", label: "Español", srclang: "es" },
    ],
  }}
/>
```

Subtitle files must be served with `Access-Control-Allow-Origin` if hosted on a different origin than the page.

## Keyboard Shortcuts

Shortcuts activate when the player has focus (click the player or tab to it).

| Key | Action |
|-----|--------|
| `Space` / `K` | Play / Pause |
| `←` / `→` | Seek −5 s / +5 s |
| `↑` / `↓` | Volume +10% / −10% |
| `M` | Toggle mute (restores previous volume) |
| `F` | Toggle fullscreen |
| `T` | Toggle theater mode |
| `P` | Toggle Picture-in-Picture |
| `L` | Seek to live edge (live streams only) |
| `0`–`9` | Jump to 0%–90% of duration |

Progress bar keyboard (when the progress bar has focus):

| Key | Action |
|-----|--------|
| `←` / `→` | Seek −5 s / +5 s |
| `Shift + ←` / `Shift + →` | Seek −10 s / +10 s |
| `Home` | Jump to start |
| `End` | Jump to end |

## TypeScript

All types are exported from the package:

```ts
import type {
  VideoPlayerProps,
  VideoPlayerOptions,
  VideoPlayerRef,
  PlayerState,
  PlaybackRate,
  HLSQualityLevel,
  ManualQualityLevel,
  SubtitleTrack,
  BufferedRange,
  VideoError,
  VideoErrorCode,
  ContextMenuItem,
  ControlBarItem,
} from "react-helios";

import { AUDIO_BANDWIDTH_THRESHOLDS, AUDIO_SWITCH_LEVELS } from "react-helios";

// VTT utilities (useful for server-side pre-parsing or custom UIs)
import { parseThumbnailVtt, findThumbnailCue } from "react-helios";
import type { ThumbnailCue } from "react-helios";
```

### `PlayerState`

```ts
interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  bufferedRanges: BufferedRange[];
  isBuffering: boolean;
  error: VideoError | null;
  isFullscreen: boolean;
  isPictureInPicture: boolean;
  isTheaterMode: boolean;
  isAudioMode: boolean;
  isLive: boolean;
  qualityLevels: HLSQualityLevel[];
  currentQualityLevel: number; // -1 = ABR auto
}
```

### `VideoError`

```ts
type VideoErrorCode =
  | "MEDIA_ERR_ABORTED"
  | "MEDIA_ERR_NETWORK"
  | "MEDIA_ERR_DECODE"
  | "MEDIA_ERR_SRC_NOT_SUPPORTED"
  | "HLS_NETWORK_ERROR"
  | "HLS_FATAL_ERROR"
  | "UNKNOWN";

interface VideoError {
  code: VideoErrorCode;
  message: string;
}
```

### `ControlBarItem`

```ts
interface ControlBarItem {
  key: string;       // React reconciliation key
  icon: ReactNode;   // SVG, img, or any React node
  label: string;     // aria-label
  title?: string;    // tooltip (falls back to label)
  onClick: () => void;
}
```

### `ContextMenuItem`

```ts
interface ContextMenuItem {
  label: string;
  onClick: () => void;
}
```

### `ManualQualityLevel`

```ts
interface ManualQualityLevel {
  label: string; // Display name shown in the Settings menu (e.g. "1080p", "HD", "Low")
  src: string;   // URL to load when this quality level is selected
}
```

### `ThumbnailCue`

```ts
interface ThumbnailCue {
  start: number; // seconds
  end: number;   // seconds
  url: string;   // absolute URL to the sprite image
  x: number;     // pixel offset within sprite
  y: number;
  w: number;     // cell width in pixels
  h: number;     // cell height in pixels
}
```

## Utility Functions

```ts
import { formatTime, isHLSUrl, getMimeType } from "react-helios";

formatTime(90);        // "1:30"
formatTime(3661);      // "1:01:01"

isHLSUrl("stream.m3u8");   // true
isHLSUrl("video.mp4");     // false

getMimeType("video.mp4");  // "video/mp4"
getMimeType("video.webm"); // "video/webm"
```

For VTT parsing in custom UIs or server-side pre-processing:

```ts
import { parseThumbnailVtt, findThumbnailCue } from "react-helios";
import type { ThumbnailCue } from "react-helios";

const cues: ThumbnailCue[] = parseThumbnailVtt(vttText, baseUrl);

// Binary search — O(log n)
const cue = findThumbnailCue(cues, currentTime);
if (cue) {
  // cue.url, cue.x, cue.y, cue.w, cue.h
}
```

## Performance

The player is architected to produce **zero React re-renders during playback**:

- `timeupdate` and `progress` events are handled by direct DOM mutation (refs), not React state.
- `ProgressBar` and `TimeDisplay` self-subscribe to the active media element — the parent tree never re-renders on seek or time change.
- `Controls` and `AudioModeOverlay` are wrapped in `React.memo` — they only re-render when their own props change, not when unrelated state (buffering, errors) updates.
- VTT sprite thumbnails are looked up via binary search (O(log n)) and rendered via CSS `background-position` — no hidden `<video>` element, no canvas, no network requests per hover.
- Buffered ranges are the only state that triggers a re-render (fires every few seconds during buffering, not 60× per second).
- In audio mode the `<video>` element is **paused** — the browser stops decoding frames entirely. A lightweight `<audio>` element takes over with `preload="none"` (no network cost at startup). The `<audio>` element only loads its source the first time the user switches to audio mode.

## Project Structure

```
react-helios/
├── src/                    # Library source
│   ├── components/         # VideoPlayer, Controls, AudioModeOverlay, control elements
│   ├── hooks/              # useVideoPlayer (state + HLS init)
│   ├── lib/                # Types, HLS utilities, VTT parser, format helpers
│   └── styles/             # CSS
├── examples/
│   └── nextjs-demo/        # Standalone Next.js demo app
├── dist/                   # Build output (ESM + CJS + DTS)
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

## Development

```bash
# Install dependencies
npm install

# Build the library
npm run build

# Watch mode (rebuild on changes)
npm run dev

# Type-check only
npm run typecheck
```

To run the demo app against your local build:

```bash
cd examples/nextjs-demo
npm install
npm run dev
```

## Publishing

`prepublishOnly` runs the build automatically:

```bash
npm publish
```

## License

MIT
