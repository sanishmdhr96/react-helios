"use client";

import React, { useRef, useState, useCallback } from "react";
import {
  Play, Pause, SkipForward, Volume2, Maximize, PictureInPicture,
  Zap, Smartphone, Radio, Layers, MonitorPlay, Bookmark,
} from "lucide-react";
import { VideoPlayer } from "react-helios";
import type { VideoError, VideoPlayerRef } from "react-helios";
import "react-helios/styles";

// ─── Code snippet strings (outside component to avoid re-creation) ────────────

const CODE_MINIMAL = `import { VideoPlayer } from "react-helios";
import "react-helios/styles";

<VideoPlayer
  src="https://example.com/video.mp4"
  poster="https://example.com/poster.jpg"
  controls
  className="my-player"
  options={{
    autoplay: false,
    loop: false,
    muted: false,
    preload: "metadata",
    thumbnailVtt: "https://example.com/thumbs/storyboard.vtt",
    // Rewind / skip-forward buttons — 15s jump by default.
    // Hidden automatically on mobile (≤ 480 px). Set to 0 to hide entirely.
    skipSeconds: 15,
  }}
/>`;

// const CODE_SUBTITLES = `import { VideoPlayer } from "react-helios";

// <VideoPlayer
//   src="https://example.com/video.mp4"
//   subtitles={[
//     {
//       id: "en",
//       src: "/subs/en.vtt",
//       label: "English",
//       srclang: "en",
//       default: true,
//     },
//     {
//       id: "fr",
//       src: "/subs/fr.vtt",
//       label: "Français",
//       srclang: "fr",
//     },
//     {
//       id: "es",
//       src: "/subs/es.vtt",
//       label: "Español",
//       srclang: "es",
//     },
//   ]}
// />
// // Subtitle selection appears in the ⚙ settings menu.`;

const CODE_CONTEXT_MENU = `import { VideoPlayer } from "react-helios";
import type { ContextMenuItem } from "react-helios";

const menuItems: ContextMenuItem[] = [
  {
    label: "Add to Watchlist",
    onClick: () => addToWatchlist(),
  },
  {
    label: "Share",
    onClick: () => openShareDialog(),
  },
];

<VideoPlayer
  src="https://example.com/video.mp4"
  options={{ contextMenuItems: menuItems }}
/>
// Right-click the player to see custom items
// appended below the built-in context menu.`;

const CODE_CONTROL_BAR = `import { VideoPlayer } from "react-helios";
import type { ControlBarItem } from "react-helios";
import { Bookmark, Share2 } from "lucide-react";

const controlBarItems: ControlBarItem[] = [
  {
    key: "bookmark",
    icon: <Bookmark size={20} />,
    label: "Bookmark",
    title: "Save current position",
    onClick: () => {
      const time = playerRef.current?.getState().currentTime ?? 0;
      saveBookmark(Math.floor(time));
    },
  },
  {
    key: "share",
    icon: <Share2 size={20} />,
    label: "Share",
    onClick: () => openShareDialog(),
  },
];

<VideoPlayer
  src="https://example.com/video.mp4"
  options={{ controlBarItems }}
/>
// Buttons appear on the right side of the control bar.`;

const CODE_CALLBACKS = `<VideoPlayer
  src="https://example.com/video.mp4"
  options={{
    onPlay: () => console.log("play"),
    onPause: () => console.log("pause"),
    onEnded: () => console.log("ended"),

    // fires every ~250ms during playback (no React re-render)
    onTimeUpdate: (time) => updateProgressUI(time),

    onDurationChange: (duration) => {
      console.log("duration:", duration);
    },

    // true when stalled, false when can play
    onBuffering: (isBuffering) => setSpinner(isBuffering),

    onError: (err) => {
      console.error(err.code, err.message);
      reportToSentry(err);
    },

    // sync your layout when theater is toggled
    onTheaterModeChange: (isTheater) => {
      setWideLayout(isTheater);
    },

    // fired on manual toggle and auto bandwidth switching
    onAudioModeChange: (isAudio) => {
      console.log("audio mode:", isAudio);
    },
  }}
/>`;

const CODE_HLS_CONFIG = `import { VideoPlayer } from "react-helios";

<VideoPlayer
  src="https://example.com/stream.m3u8"
  options={{
    enableHLS: true,
    hlsConfig: {
      // seconds of video to keep in forward buffer
      maxBufferLength: 60,
      maxMaxBufferLength: 600,

      // -1 = auto ABR; 0 = highest quality level
      startLevel: -1,

      // don't request 4K on a 480p player
      capLevelToPlayerSize: true,

      // live streams: number of segments behind live edge
      liveSyncDurationCount: 5,

      // cross-origin credentials for segment requests
      xhrSetup: (xhr) => {
        xhr.withCredentials = true;
      },
    },
  }}
/>
// All hls.js options are accepted via hlsConfig.
// See: https://github.com/video-dev/hls.js/blob/master/docs/API.md`;

const CODE_REF = `import { useRef } from "react";
import { VideoPlayer, VideoPlayerRef } from "react-helios";

export default function App() {
  const playerRef = useRef<VideoPlayerRef>(null);

  return (
    <>
      <VideoPlayer ref={playerRef} src="..." controls />

      {/* Playback */}
      <button onClick={() => playerRef.current?.play()}>Play</button>
      <button onClick={() => playerRef.current?.pause()}>Pause</button>
      <button onClick={() => playerRef.current?.seek(30)}>+30s</button>

      {/* Volume */}
      <button onClick={() => playerRef.current?.setVolume(0.5)}>50%</button>
      <button onClick={() => playerRef.current?.toggleMute()}>Mute</button>

      {/* Playback speed */}
      <button onClick={() => playerRef.current?.setPlaybackRate(1.5)}>1.5×</button>

      {/* HLS quality */}
      <button onClick={() => playerRef.current?.setQualityLevel(0)}>Max</button>
      <button onClick={() => playerRef.current?.setQualityLevel(-1)}>Auto</button>

      {/* UI modes */}
      <button onClick={() => playerRef.current?.toggleFullscreen()}>FS</button>
      <button onClick={() => playerRef.current?.togglePictureInPicture()}>PiP</button>
      <button onClick={() => playerRef.current?.toggleTheaterMode()}>Theater</button>
      <button onClick={() => playerRef.current?.toggleAudioMode()}>Audio</button>

      {/* Live streams */}
      <button onClick={() => playerRef.current?.seekToLive()}>Go Live</button>

      {/* State snapshot — includes isAudioMode, qualityLevels, etc. */}
      <button onClick={() => console.log(playerRef.current?.getState())}>
        Log State
      </button>
    </>
  );
}`;

const CODE_THEATER = `"use client";

import { useState } from "react";
import { VideoPlayer } from "react-helios";

export default function Page() {
  const [isTheater, setIsTheater] = useState(false);

  return (
    // Widen the layout container when theater is active
    <main style={{ maxWidth: isTheater ? "1600px" : "1200px" }}
          className="mx-auto px-6 transition-[max-width] duration-300">

      <VideoPlayer
        src="https://example.com/stream.m3u8"
        controls
        options={{
          // Keep your layout in sync with theater state
          onTheaterModeChange: (t) => setIsTheater(t),
        }}
      />

    </main>
  );
}`;

const CODE_AUDIO_MODE = `import { VideoPlayer, AUDIO_BANDWIDTH_THRESHOLDS } from "react-helios";

// Audio mode hides the video and shows the poster artwork.
// The toggle button only appears when audioSrc is provided.

<VideoPlayer
  src="https://example.com/stream.m3u8"
  poster="https://example.com/artwork.jpg"
  controls
  options={{
    audioSrc: "https://example.com/audio-only.m3u8",

    // Button labels (both are configurable)
    audioModeLabel: "Switch to Audio",
    videoModeLabel: "Switch to Video",

    // Start in audio mode (optional)
    defaultAudioMode: false,

    // Auto-switch when bandwidth drops below threshold (HLS only)
    // AUDIO_BANDWIDTH_THRESHOLDS: EXTREME=100, POOR=300, FAIR=700, GOOD=1500 Kbps
    audioBandwidthThreshold: AUDIO_BANDWIDTH_THRESHOLDS.POOR,

    // Fired on manual toggle AND automatic bandwidth switching
    onAudioModeChange: (isAudio) => {
      console.log("audio mode:", isAudio);
    },
  }}
/>`;

// ─────────────────────────────────────────────────────────────────────────────

const EXAMPLE_TABS = [
  { id: "minimal", label: "Minimal" },
  { id: "audio-mode", label: "Audio Mode" },
  { id: "ctx-menu", label: "Context Menu" },
  { id: "ctrl-bar", label: "Control Bar" },
  { id: "callbacks", label: "Callbacks" },
  { id: "hls-config", label: "HLS Config" },
  { id: "ref-api", label: "Ref API" },
  { id: "theater", label: "Theater Mode" },
] as const;

const EXAMPLE_CODE: Record<string, string> = {
  "minimal": CODE_MINIMAL,
  "audio-mode": CODE_AUDIO_MODE,
  "ctx-menu": CODE_CONTEXT_MENU,
  "ctrl-bar": CODE_CONTROL_BAR,
  "callbacks": CODE_CALLBACKS,
  "hls-config": CODE_HLS_CONFIG,
  "ref-api": CODE_REF,
  "theater": CODE_THEATER,
};

// ─────────────────────────────────────────────────────────────────────────────

export default function DemoPage() {
  const playerRef = useRef<VideoPlayerRef>(null);
  const [activeTab, setActiveTab] = useState("demo");
  const [activeExTab, setActiveExTab] = useState("minimal");
  const [isTheater, setIsTheater] = useState(false);
  const [eventLog, setEventLog] = useState<string[]>([]);

  const addEvent = useCallback((msg: string) => {
    const t = new Date().toLocaleTimeString("en-US", { hour12: false });
    setEventLog(prev => [`${t}  ${msg}`, ...prev].slice(0, 8));
  }, []);

  // Live demo controlBarItems — shows the Control Bar feature in action
  const demoControlBarItems = [
    {
      key: "bookmark",
      icon: <Bookmark size={20} />,
      label: "Bookmark",
      title: "Log current time",
      onClick: () => {
        const t = Math.floor(playerRef.current?.getState().currentTime ?? 0);
        addEvent(`bookmark at ${t}s`);
      },
    },
  ];

  return (
    <div className="min-h-screen bg-linear-to-br from-[#667eea] to-[#764ba2]">
      {/* Header */}
      <header className="px-6 py-10 text-center text-white">
        <div className="max-w-300 mx-auto">
          <div className="inline-block px-5 py-2 bg-white/20 rounded-full text-sm font-semibold mb-5 backdrop-blur">
            react-helios
          </div>
          <h1 className="text-[3.5rem] font-extrabold mb-5 -tracking-tight leading-tight">
            Production-Ready<br />Video Player
          </h1>
          <p className="text-xl opacity-95 max-w-lg mx-auto mb-8 leading-relaxed">
            HLS streaming, adaptive quality, live streams, VTT sprite thumbnails, theater mode — zero re-renders during playback.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <a
              href="https://www.npmjs.com/package/react-helios"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3.5 bg-white text-[#667eea] rounded-xl text-base font-semibold shadow-[0_4px_15px_rgba(0,0,0,0.2)] no-underline hover:shadow-lg transition-shadow"
            >
              Get Started
            </a>
            <a
              href="https://github.com/sanishmdhr96/react-video-player"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3.5 bg-white/20 text-white border-2 border-white rounded-xl text-base font-semibold backdrop-blur no-underline hover:bg-white/30 transition-colors"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </header>

      {/* Main Content — widens in theater mode */}
      <main
        className="mx-auto px-6 pb-20 transition-[max-width] duration-300"
        style={{ maxWidth: isTheater ? "1600px" : "1200px" }}
      >

        {/* ── Live Demo ──────────────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl p-10 mb-8 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
          <div className="flex gap-4 mb-8 border-b-2 border-gray-100 overflow-x-auto">
            {["demo", "features", "shortcuts"].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 bg-transparent border-0 border-b-[3px] -mb-0.5 cursor-pointer text-base font-semibold capitalize whitespace-nowrap transition-colors ${activeTab === tab
                  ? "text-[#667eea] border-b-[#667eea]"
                  : "text-gray-500 border-b-transparent"
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === "demo" && (
            <>
              <div className="aspect-video w-full mb-8 shadow-[0_10px_40px_rgba(0,0,0,0.1)] rounded-xl overflow-hidden">
                <VideoPlayer
                  ref={playerRef}
                  src="https://luniba.com/high_quality_video/index.m3u8"

                  controls
                  options={{
                    thumbnailVtt: "https://luniba.com/high_quality_video/thumbnails/thumbnails.vtt",

                    // thumbnailVttBaseUrl: "https://s3.do.webpoint.io/wepreach",
                    audioSrc: "https://luniba.com/high_quality_video/audio/testvideo.m3u8",

                    audioPoster: "https://luniba.com/high_quality_video/thumbnails/thumbnail.png",
                    audioModeLabel: "Switch to Audio",
                    videoModeLabel: "Switch to Video",
                    autoplay: false,
                    playbackRates: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
                    enablePreview: true,
                    enableHLS: true,
                    // Skip-back / skip-forward buttons (15s jump, hidden on mobile)
                    skipSeconds: 15,
                    controlBarItems: demoControlBarItems,
                    contextMenuItems: [
                      { label: "Add to Watchlist", onClick: () => addEvent("add to watchlist") },
                    ],
                    onTheaterModeChange: (t) => setIsTheater(t),
                    onAudioModeChange: (isAudio) => addEvent(isAudio ? "→ audio mode (auto)" : "→ video mode (auto)"),
                    onPlay: () => addEvent("play"),
                    onPause: () => addEvent("pause"),
                    onEnded: () => addEvent("ended"),
                    onDurationChange: (d) => addEvent(`duration: ${d.toFixed(1)}s`),
                    onBuffering: (b) => addEvent(b ? "buffering…" : "buffering ended"),
                    onError: (err: VideoError) => addEvent(`error: ${err.code}`),
                  }}
                />
              </div>

              {/* Programmatic Controls */}
              <div className="mb-8">
                <h3 className="text-lg font-bold mb-5 text-gray-800">
                  Programmatic Controls
                </h3>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
                  {[
                    { icon: Play, label: "Play", active: false, action: () => playerRef.current?.play() },
                    { icon: Pause, label: "Pause", active: false, action: () => playerRef.current?.pause() },
                    { icon: SkipForward, label: "Jump 30s", active: false, action: () => playerRef.current?.seek(30) },
                    { icon: Volume2, label: "50% Vol", active: false, action: () => playerRef.current?.setVolume(0.5) },
                    { icon: Zap, label: "1.5× Speed", active: false, action: () => playerRef.current?.setPlaybackRate(1.5) },
                    { icon: Maximize, label: "Fullscreen", active: false, action: () => playerRef.current?.toggleFullscreen() },
                    { icon: PictureInPicture, label: "PiP", active: false, action: () => playerRef.current?.togglePictureInPicture() },
                    { icon: MonitorPlay, label: "Theater", active: isTheater, action: () => playerRef.current?.toggleTheaterMode() },
                  ].map(({ icon: Icon, label, active, action }) => (
                    <button
                      key={label}
                      onClick={action}
                      className={`p-4 rounded-xl cursor-pointer text-sm font-semibold flex flex-col items-center gap-2 border-2 transition-all duration-200 ${active
                        ? "bg-[#667eea] text-white border-[#667eea]"
                        : "bg-gray-50 text-gray-800 border-gray-200 hover:bg-[#667eea] hover:text-white hover:border-[#667eea] hover:-translate-y-0.5"
                        }`}
                    >
                      <Icon size={20} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Event Log */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-gray-800">Event Log</h3>
                  <button
                    onClick={() => setEventLog([])}
                    className="text-sm text-gray-400 hover:text-gray-600 cursor-pointer bg-transparent border-0 transition-colors"
                  >
                    Clear
                  </button>
                </div>
                <div className="bg-[#1e1e1e] rounded-xl p-4 font-mono text-sm min-h-25">
                  {eventLog.length === 0 ? (
                    <div className="text-gray-600">
                      Interact with the player to see events fire in real time…
                    </div>
                  ) : (
                    eventLog.map((msg, i) => (
                      <div key={i} className={i === 0 ? "text-[#4ec9b0]" : "text-gray-500"}>
                        {msg}
                      </div>
                    ))
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  The bookmark button in the player&apos;s control bar and the custom context menu item also log events here.
                </p>
              </div>
            </>
          )}

          {activeTab === "features" && (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-6">
              {[
                { icon: Radio, title: "HLS Streaming", desc: "Adaptive bitrate via HLS.js. Auto quality selection with manual override. Native HLS on Safari.", color: "#667eea" },
                { icon: Layers, title: "VTT Thumbnails", desc: "Sprite-sheet preview on progress bar hover, edge-clamped like YouTube. Zero extra network requests per hover.", color: "#764ba2" },
                { icon: MonitorPlay, title: "Theater Mode", desc: "Wide-layout theater mode toggle. Fires onTheaterModeChange for layout integration.", color: "#f093fb" },
                { icon: Radio, title: "Live Streams", desc: "Infinite-duration detection, LIVE badge, GO LIVE button, and L key shortcut to seek to the live edge.", color: "#4facfe" },
                { icon: Zap, title: "Audio Mode", desc: "One-click audio-only mode with poster artwork. Video pauses completely — zero decode cost. Auto-switches on poor bandwidth or low HLS quality level.", color: "#43e97b" },
                { icon: Smartphone, title: "Zero Re-renders", desc: "timeupdate and progress events handled via direct DOM mutation. Controls and overlays wrapped in React.memo.", color: "#fa709a" },
              ].map(({ icon: Icon, title, desc, color }) => (
                <div
                  key={title}
                  className="p-7 rounded-2xl bg-linear-to-br from-gray-50 to-white border-2 border-gray-200 transition-all duration-300"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = color;
                    e.currentTarget.style.transform = "translateY(-4px)";
                    e.currentTarget.style.boxShadow = `0 12px 24px ${color}30`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "";
                    e.currentTarget.style.transform = "";
                    e.currentTarget.style.boxShadow = "";
                  }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                    style={{ backgroundColor: `${color}20` }}
                  >
                    <Icon size={24} color={color} />
                  </div>
                  <h3 className="text-lg font-bold mb-2 text-gray-800">{title}</h3>
                  <p className="text-sm text-gray-500 m-0 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === "shortcuts" && (
            <>
              <h3 className="text-base font-bold text-gray-800 mb-4">Player focus</h3>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3 mb-8">
                {[
                  { key: "Space / K", action: "Play / Pause" },
                  { key: "← →", action: "Seek ±5 seconds" },
                  { key: "↑ ↓", action: "Volume ±10%" },
                  { key: "M", action: "Mute / Unmute (restores volume)" },
                  { key: "F", action: "Toggle Fullscreen" },
                  { key: "T", action: "Toggle Theater mode" },
                  { key: "P", action: "Toggle Picture-in-Picture" },
                  { key: "L", action: "Seek to live edge (live streams)" },
                  { key: "0 – 9", action: "Jump to 0 – 90% of duration" },
                ].map(({ key, action }) => (
                  <div key={key} className="p-5 bg-gray-50 rounded-xl border-2 border-gray-200">
                    <div className="inline-block px-4 py-2 bg-white border-2 border-[#667eea] rounded-lg font-mono font-bold text-sm text-[#667eea] mb-3">
                      {key}
                    </div>
                    <div className="text-sm text-gray-500 font-medium">{action}</div>
                  </div>
                ))}
              </div>

              <h3 className="text-base font-bold text-gray-800 mb-4">Progress bar focus</h3>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
                {[
                  { key: "← →", action: "Seek ±5 seconds" },
                  { key: "Shift + ← →", action: "Seek ±10 seconds" },
                  { key: "Home", action: "Jump to start" },
                  { key: "End", action: "Jump to end" },
                ].map(({ key, action }) => (
                  <div key={key} className="p-5 bg-gray-50 rounded-xl border-2 border-gray-200">
                    <div className="inline-block px-4 py-2 bg-white border-2 border-[#764ba2] rounded-lg font-mono font-bold text-sm text-[#764ba2] mb-3">
                      {key}
                    </div>
                    <div className="text-sm text-gray-500 font-medium">{action}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* ── Usage Examples ────────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl p-10 mb-8 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
          <h2 className="text-3xl font-extrabold mb-2 text-gray-800">Usage Examples</h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            Ready-to-copy snippets for every feature and prop.
          </p>

          {/* Example tabs */}
          <div className="flex gap-2 mb-8 border-b-2 border-gray-100 overflow-x-auto pb-0">
            {EXAMPLE_TABS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setActiveExTab(id)}
                className={`px-4 py-2.5 bg-transparent border-0 border-b-[3px] -mb-0.5 cursor-pointer text-sm font-semibold whitespace-nowrap transition-colors ${activeExTab === id
                  ? "text-[#667eea] border-b-[#667eea]"
                  : "text-gray-500 border-b-transparent"
                  }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Code block */}
          <pre className="bg-[#1e1e1e] text-[#d4d4d4] p-6 rounded-xl font-mono text-sm overflow-x-auto leading-relaxed whitespace-pre">
            {EXAMPLE_CODE[activeExTab]}
          </pre>

          {/* Per-tab notes */}
          {/* {activeExTab === "subtitles" && (
            <p className="text-sm text-gray-500 mt-4 leading-relaxed">
              Each <code className="bg-gray-100 px-1 rounded">SubtitleTrack</code> maps to a native{" "}
              <code className="bg-gray-100 px-1 rounded">&lt;track&gt;</code> element.
              The settings menu automatically shows a subtitle selector when tracks are provided.
              Files must be served with a CORS header (<code className="bg-gray-100 px-1 rounded">Access-Control-Allow-Origin</code>)
              if hosted on a different origin.
            </p>
          )} */}
          {activeExTab === "audio-mode" && (
            <p className="text-sm text-gray-500 mt-4 leading-relaxed">
              The audio toggle button only appears when <code className="bg-gray-100 px-1 rounded">audioSrc</code> is provided.
              In audio mode the <code className="bg-gray-100 px-1 rounded">&lt;video&gt;</code> element is paused (zero decode cost) and a lightweight{" "}
              <code className="bg-gray-100 px-1 rounded">&lt;audio&gt;</code> element takes over — same resources as a music app.
              Auto-switching uses both bandwidth sampling and HLS quality level detection. A 60-second cooldown prevents re-triggering after a manual toggle.
            </p>
          )}
          {activeExTab === "ctx-menu" && (
            <p className="text-sm text-gray-500 mt-4 leading-relaxed">
              Custom items are appended below the built-in menu (Play/Pause, Loop, Copy URL, PiP).
              Each item automatically closes the menu after its <code className="bg-gray-100 px-1 rounded">onClick</code> is called.
            </p>
          )}
          {activeExTab === "ctrl-bar" && (
            <p className="text-sm text-gray-500 mt-4 leading-relaxed">
              Buttons are inserted between the settings gear and the fullscreen/PiP/theater buttons.
              They receive the same hover and press styling as built-in buttons.
              Use <code className="bg-gray-100 px-1 rounded">title</code> for a custom tooltip (falls back to <code className="bg-gray-100 px-1 rounded">label</code>).
            </p>
          )}
          {activeExTab === "callbacks" && (
            <p className="text-sm text-gray-500 mt-4 leading-relaxed">
              <code className="bg-gray-100 px-1 rounded">onTimeUpdate</code> fires every ~250 ms during playback —
              it is handled via a ref internally so it never causes React re-renders.
              All other callbacks are ref-stable across renders.
            </p>
          )}
          {activeExTab === "hls-config" && (
            <p className="text-sm text-gray-500 mt-4 leading-relaxed">
              Any <a href="https://github.com/video-dev/hls.js/blob/master/docs/API.md#fine-tuning" target="_blank" rel="noopener noreferrer" className="text-[#667eea] hover:underline">hls.js configuration option</a> can
              be passed via <code className="bg-gray-100 px-1 rounded">hlsConfig</code>.
              Your overrides are merged with the player&apos;s defaults.
            </p>
          )}
          {activeExTab === "ref-api" && (
            <p className="text-sm text-gray-500 mt-4 leading-relaxed">
              The ref is stable — it never changes between renders.
              <code className="bg-gray-100 px-1 rounded">getState()</code> returns a snapshot including{" "}
              <code className="bg-gray-100 px-1 rounded">currentTime</code>, quality levels, buffered ranges, and all boolean flags.
            </p>
          )}
          {activeExTab === "theater" && (
            <p className="text-sm text-gray-500 mt-4 leading-relaxed">
              The player does not manage your page layout — it only fires{" "}
              <code className="bg-gray-100 px-1 rounded">onTheaterModeChange</code> so you can respond however suits your design.
              The <code className="bg-gray-100 px-1 rounded">T</code> keyboard shortcut and the theater button in the control bar both trigger this callback.
            </p>
          )}
        </section>

        {/* ── Quick Start ───────────────────────────────────────────────────── */}
        <section className="bg-white/95 rounded-2xl p-10 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
          <h2 className="text-3xl font-extrabold mb-6 text-gray-800">Quick Start</h2>
          <div className="bg-[#1e1e1e] text-[#d4d4d4] p-6 rounded-xl font-mono text-sm mb-5 overflow-x-auto">
            <div className="text-[#6a9955] mb-1">// Install</div>
            <div className="mb-5">npm install react-helios</div>

            <div className="text-[#6a9955] mb-1">// Import</div>
            <div><span className="text-[#c586c0]">import</span>{" "}{"{ VideoPlayer }"}{" "}<span className="text-[#c586c0]">from</span>{" "}<span className="text-[#ce9178]">"react-helios"</span>;</div>
            <div className="mb-5"><span className="text-[#c586c0]">import</span>{" "}<span className="text-[#ce9178]">"react-helios/styles"</span>;</div>

            <div className="text-[#6a9955] mb-1">// Use</div>
            <div>{"<"}<span className="text-[#4ec9b0]">VideoPlayer</span></div>
            <div className="pl-4"><span className="text-[#9cdcfe]">src</span>=<span className="text-[#ce9178]">"https://example.com/stream.m3u8"</span></div>
            <div className="pl-4"><span className="text-[#9cdcfe]">thumbnailVtt</span>=<span className="text-[#ce9178]">"https://example.com/thumbs/storyboard.vtt"</span></div>
            <div className="pl-4"><span className="text-[#9cdcfe]">controls</span></div>
            <div>{"/"}{">"}
            </div>
          </div>
          <p className="text-base text-gray-500 leading-relaxed">
            Works with Next.js and plain React. TypeScript types included. HLS.js is bundled — no extra install needed.
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="text-center px-6 py-10 text-white">
        <p className="text-sm opacity-80">
          Built with ❤️ for the React community
        </p>
      </footer>
    </div>
  );
}
