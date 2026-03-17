"use client";

import React, { memo, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import type {
  PlaybackRate,
  VideoPlayerRef,
  HLSQualityLevel,
  ControlBarItem,
} from "../lib/types";
import { ControlElements } from "./control-elements";

interface ControlsProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  playerRef: VideoPlayerRef;
  playerContainerRef: React.RefObject<HTMLElement | null>;
  playbackRates: PlaybackRate[];
  enablePreview: boolean;
  thumbnailVtt?: string;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  isFullscreen: boolean;
  isPictureInPicture: boolean;
  isTheaterMode: boolean;
  isAudioMode: boolean;
  showAudioButton: boolean;
  audioModeIcon?: ReactNode;
  videoModeIcon?: ReactNode;
  audioModeLabel?: string;
  videoModeLabel?: string;
  isLive: boolean;
  qualityLevels: HLSQualityLevel[];
  currentQualityLevel: number;
  controlBarItems?: ControlBarItem[];
  autoHideControls: boolean;
}

export const Controls = memo<ControlsProps>(function Controls({
  videoRef,
  playerRef,
  playerContainerRef,
  playbackRates,
  enablePreview,
  thumbnailVtt,
  isPlaying,
  volume,
  isMuted,
  playbackRate,
  isFullscreen,
  isPictureInPicture,
  isTheaterMode,
  isAudioMode,
  showAudioButton,
  audioModeIcon,
  videoModeIcon,
  audioModeLabel,
  videoModeLabel,
  isLive,
  qualityLevels,
  currentQualityLevel,
  controlBarItems,
  autoHideControls,
}) {
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showControls, setShowControls] = useState(true);

  /**
   * Stable ref capturing the values the keyboard handler needs.
   * isPlaying/volume/isMuted/isLive come from React state (rare changes).
   * currentTime/duration are read directly from the video element so the
   * keyboard shortcuts always see fresh values without subscribing to state.
   */
  const liveRef = useRef({ isPlaying, volume, isMuted, isLive });
  liveRef.current = { isPlaying, volume, isMuted, isLive };

  // ─── Auto-hide controls ──────────────────────────────────────────────────
  useEffect(() => {
    // Audio mode or disabled: always show, never hide
    if (isAudioMode || !autoHideControls) {
      setShowControls(true);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      return;
    }
    // Paused: always show
    if (!isPlaying) {
      setShowControls(true);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      return;
    }

    // Playing + video mode: show on hover, hide on mouse leave
    const el = playerContainerRef.current;
    if (!el) return;

    const handleShow = () => {
      setShowControls(true);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      // Also start a 3s inactivity timer while mouse is inside
      hideTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
    };

    const handleHide = () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      setShowControls(false);
    };

    el.addEventListener("mousemove", handleShow);
    el.addEventListener("mouseenter", handleShow);
    el.addEventListener("mouseleave", handleHide);
    el.addEventListener("touchstart", handleShow, { passive: true });

    // Start hidden while playing
    setShowControls(false);

    return () => {
      el.removeEventListener("mousemove", handleShow);
      el.removeEventListener("mouseenter", handleShow);
      el.removeEventListener("mouseleave", handleHide);
      el.removeEventListener("touchstart", handleShow);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [isPlaying, isAudioMode, autoHideControls, playerContainerRef]);

  // ─── Keyboard shortcuts ─────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!playerContainerRef.current?.contains(document.activeElement)) return;

      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      const { isPlaying: playing, volume: vol, isLive: live } = liveRef.current;
      // Read time/duration directly from the video element — always fresh
      const ct = videoRef.current?.currentTime ?? 0;
      const dur = videoRef.current?.duration ?? 0;

      switch (e.code) {
        case "Space": case "KeyK":
          e.preventDefault();
          playing ? playerRef.pause() : playerRef.play();
          break;
        case "ArrowLeft":
          e.preventDefault();
          playerRef.seek(Math.max(0, ct - 5));
          break;
        case "ArrowRight":
          e.preventDefault();
          playerRef.seek(Math.min(dur || Infinity, ct + 5));
          break;
        case "ArrowUp":
          e.preventDefault();
          playerRef.setVolume(Math.min(1, vol + 0.1));
          break;
        case "ArrowDown":
          e.preventDefault();
          playerRef.setVolume(Math.max(0, vol - 0.1));
          break;
        case "KeyM":
          e.preventDefault();
          playerRef.toggleMute();
          break;
        case "KeyF":
          e.preventDefault();
          playerRef.toggleFullscreen();
          break;
        case "KeyP":
          e.preventDefault();
          playerRef.togglePictureInPicture();
          break;
        case "KeyT":
          e.preventDefault();
          playerRef.toggleTheaterMode();
          break;
        case "KeyL":
          e.preventDefault();
          if (live) playerRef.seekToLive();
          break;
        case "Digit0": case "Digit1": case "Digit2": case "Digit3": case "Digit4":
        case "Digit5": case "Digit6": case "Digit7": case "Digit8": case "Digit9": {
          e.preventDefault();
          const pct = Number(e.code.replace("Digit", "")) * 10;
          playerRef.seek((dur / 100) * pct);
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [playerRef, playerContainerRef, videoRef]);

  // ─── Stable callbacks for child components ───────────────────────────────
  const handlePlay = useCallback(() => playerRef.play(), [playerRef]);
  const handlePause = useCallback(() => playerRef.pause(), [playerRef]);
  const handleVolumeChange = useCallback((v: number) => playerRef.setVolume(v), [playerRef]);
  const handleToggleMute = useCallback(() => playerRef.toggleMute(), [playerRef]);
  const handleRateChange = useCallback((r: PlaybackRate) => playerRef.setPlaybackRate(r), [playerRef]);
  const handleQualityChange = useCallback((l: number) => playerRef.setQualityLevel(l), [playerRef]);
  const handlePiP = useCallback(() => playerRef.togglePictureInPicture(), [playerRef]);
  const handleTheaterToggle = useCallback(() => playerRef.toggleTheaterMode(), [playerRef]);
  const handleAudioToggle = useCallback(() => playerRef.toggleAudioMode(), [playerRef]);
  const handleFullscreen = useCallback(() => playerRef.toggleFullscreen(), [playerRef]);
  const handleSeekToLive = useCallback(() => playerRef.seekToLive(), [playerRef]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        opacity: showControls ? 1 : 0,
        transition: "opacity 0.3s",
        pointerEvents: "none",
        zIndex: 2, // must be above the audio overlay (z-index: 1)
      }}
    >
      <div
        style={{
          background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)",
          padding: "48px 12px 12px",
          pointerEvents: showControls ? "auto" : "none",
        }}
        role="region"
        aria-label="Video player controls"
      >
        {/* Progress bar */}
        <ControlElements.ProgressBar
          videoRef={videoRef}
          playerRef={playerRef}
          enablePreview={enablePreview}
          thumbnailVtt={thumbnailVtt}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
          {isPlaying ? (
            <ControlElements.PauseButton onClick={handlePause} />
          ) : (
            <ControlElements.PlayButton onClick={handlePlay} />
          )}

          <ControlElements.VolumeControl
            volume={volume}
            isMuted={isMuted}
            onVolumeChange={handleVolumeChange}
            onToggleMute={handleToggleMute}
          />

          {/* TimeDisplay — self-subscribes to timeupdate/durationchange on videoRef */}
          <ControlElements.TimeDisplay
            videoRef={videoRef}
            isLive={isLive}
          />

          <div style={{ flex: 1 }} />

          {isLive && (
            <GoLiveButton onClick={handleSeekToLive} />
          )}

          {/* Audio mode toggle — before Settings so it's easy to find */}
          {showAudioButton && (
            <AudioModeButton
              onClick={handleAudioToggle}
              isAudioMode={isAudioMode}
              audioModeIcon={audioModeIcon}
              videoModeIcon={videoModeIcon}
              audioModeLabel={audioModeLabel}
              videoModeLabel={videoModeLabel}
            />
          )}

          {/* Settings — speed always shown; quality tab appears for HLS streams */}
          <ControlElements.SettingsMenu
            currentRate={playbackRate}
            playbackRates={playbackRates}
            onRateChange={handleRateChange}
            qualityLevels={qualityLevels}
            currentQualityLevel={currentQualityLevel}
            onQualityChange={handleQualityChange}
          />

          {/* Custom control bar items injected by the consumer */}
          {controlBarItems?.map((item) => (
            <button
              key={item.key}
              className="controlButton"
              aria-label={item.label}
              title={item.title ?? item.label}
              onClick={item.onClick}
            >
              {item.icon}
            </button>
          ))}
          <ControlElements.PiPButton onClick={handlePiP} isPiP={isPictureInPicture} />
          <ControlElements.TheaterButton onClick={handleTheaterToggle} isTheater={isTheaterMode} />
          <ControlElements.FullscreenButton onClick={handleFullscreen} isFullscreen={isFullscreen} />
        </div>
      </div>
    </div>
  );
});
Controls.displayName = "Controls";

const AudioModeButton = memo(({
  onClick,
  isAudioMode,
  audioModeIcon,
  videoModeIcon,
  audioModeLabel,
  videoModeLabel,
}: {
  onClick: () => void;
  isAudioMode: boolean;
  audioModeIcon?: ReactNode;
  videoModeIcon?: ReactNode;
  audioModeLabel?: string;
  videoModeLabel?: string;
}) => {
  const label = isAudioMode ? (videoModeLabel ?? "Video") : (audioModeLabel ?? "Audio");
  const icon = isAudioMode
    ? (videoModeIcon ?? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
        </svg>
      ))
    : (audioModeIcon ?? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3a9 9 0 0 0-9 9v7c0 1.1.9 2 2 2h1a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1H4v-1a8 8 0 0 1 16 0v1h-2a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h1a3 3 0 0 0 3-3v-4c0-4.97-4.03-9-9-9z" />
        </svg>
      ));

  return (
    <button
      onClick={onClick}
      className="rvp-audio-toggle-btn"
      aria-label={label}
      title={label}
      aria-pressed={isAudioMode}
    >
      {icon}
      {label}
    </button>
  );
});
AudioModeButton.displayName = "AudioModeButton";

const GoLiveButton = memo(({ onClick }: { onClick: () => void }) => (
  <button
    onClick={onClick}
    style={{
      background: "none",
      border: "1px solid rgba(255,255,255,0.6)",
      color: "#fff",
      borderRadius: 3,
      padding: "2px 8px",
      fontSize: 11,
      fontWeight: 700,
      cursor: "pointer",
      letterSpacing: "0.06em",
    }}
    title="Go to live (L)"
  >
    GO LIVE
  </button>
));
GoLiveButton.displayName = "GoLiveButton";
