"use client";

import React, { forwardRef, useEffect, useRef, useCallback, useState, memo } from "react";
import type { VideoPlayerProps, VideoPlayerRef, PlaylistItem } from "../lib/types";
import { useVideoPlayer } from "../hooks/useVideoPlayer";
import { Controls } from "./Controls";
import { ContextMenu } from "./ContextMenu";
import { AudioModeOverlay } from "./AudioModeOverlay";

const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  (props, forwardedRef) => {
    const { src: srcProp, playlist, poster: posterProp, className, controls = true, options = {} } = props;

    const {
      autoplay = false,
      muted = false,
      loop = false,
      preload = "metadata",
      playbackRates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
      enableHLS = true,
      enablePreview = true,
      thumbnailVtt,
      thumbnailVttBaseUrl,
      hlsConfig,
      autoHideControls = true,
      showReplayOverlay = true,
      subtitles,
      crossOrigin,
      logo,
      audioModeFallback,
      audioPoster,
      audioSrc: audioSrcOption,
      showAudioButton,
      audioModeIcon,
      videoModeIcon,
      audioModeLabel,
      videoModeLabel,
      defaultAudioMode,
      showQualityMenu,
      manualQualityLevels,
      audioBandwidthThreshold,
      audioModeSwitchLevel,
      audioModeRecoveryInterval,
      loopPlaylist = false,
      upNextDelay = 5,
      onPlaylistIndexChange,
      onPlaylistEnded,
      onPlay,
      onPause,
      onEnded,
      onError,
      onTimeUpdate,
      onDurationChange,
      onBuffering,
      onTheaterModeChange,
      onAudioModeChange,
      contextMenuItems,
      controlBarItems,
      skipSeconds = 15,
    } = options;

    // ── Playlist state ────────────────────────────────────────────────────────
    const hasPlaylist = !!(playlist && playlist.length > 0);
    const [currentIndex, setCurrentIndex] = useState(0);

    // Reset to first item whenever the playlist reference changes
    useEffect(() => {
      setCurrentIndex(0);
    }, [playlist]);

    const currentItem: PlaylistItem | undefined = hasPlaylist ? playlist![currentIndex] : undefined;

    // Derive active source/poster/audioSrc from playlist item or bare props
    const activePoster = currentItem?.poster ?? posterProp;
    const audioSrc = currentItem?.audioSrc ?? audioSrcOption;

    const hasPrev = hasPlaylist && currentIndex > 0;
    const hasNext = hasPlaylist && currentIndex < playlist!.length - 1;

    // Next item for the Up Next overlay (respects loopPlaylist)
    const upNextIndex = hasPlaylist
      ? (currentIndex + 1 < playlist!.length ? currentIndex + 1 : loopPlaylist ? 0 : -1)
      : -1;
    const upNextItem = upNextIndex >= 0 ? playlist![upNextIndex] : null;

    // Up Next overlay visibility
    const [upNextActive, setUpNextActive] = useState(false);

    // ── Playlist navigation callbacks ─────────────────────────────────────────
    const goNext = useCallback(() => {
      if (!hasPlaylist) return;
      const next = currentIndex + 1;
      if (next < playlist!.length) {
        setCurrentIndex(next);
        onPlaylistIndexChange?.(next, playlist![next]);
      } else if (loopPlaylist) {
        setCurrentIndex(0);
        onPlaylistIndexChange?.(0, playlist![0]);
      }
    }, [hasPlaylist, currentIndex, playlist, loopPlaylist, onPlaylistIndexChange]);

    const goPrev = useCallback(() => {
      if (!hasPlaylist) return;
      const prev = currentIndex - 1;
      if (prev >= 0) {
        setCurrentIndex(prev);
        onPlaylistIndexChange?.(prev, playlist![prev]);
      } else if (loopPlaylist) {
        const last = playlist!.length - 1;
        setCurrentIndex(last);
        onPlaylistIndexChange?.(last, playlist![last]);
      }
    }, [hasPlaylist, currentIndex, playlist, loopPlaylist, onPlaylistIndexChange]);

    const goToIndex = useCallback((index: number) => {
      if (!hasPlaylist || index < 0 || index >= playlist!.length) return;
      setCurrentIndex(index);
      onPlaylistIndexChange?.(index, playlist![index]);
    }, [hasPlaylist, playlist, onPlaylistIndexChange]);

    // Cancel countdown — replay overlay appears since isEnded stays true
    const cancelUpNext = useCallback(() => setUpNextActive(false), []);

    // Skip countdown — advance immediately
    const playNextNow = useCallback(() => {
      setUpNextActive(false);
      goNext();
    }, [goNext]);

    // Clear Up Next whenever the track changes (manual prev/next/goToIndex navigation)
    useEffect(() => {
      setUpNextActive(false);
    }, [currentIndex]);

    // Internal onEnded: show Up Next overlay (or advance immediately if upNextDelay=0)
    const handleEnded = useCallback(() => {
      if (hasPlaylist) {
        const next = currentIndex + 1;
        const canAdvance = next < playlist!.length || loopPlaylist;
        if (canAdvance) {
          if (upNextDelay > 0) {
            setUpNextActive(true);
          } else {
            // Advance immediately — no overlay
            if (next < playlist!.length) {
              onPlaylistIndexChange?.(next, playlist![next]);
              setCurrentIndex(next);
            } else {
              onPlaylistIndexChange?.(0, playlist![0]);
              setCurrentIndex(0);
            }
          }
          return;
        }
        onPlaylistEnded?.();
      }
      onEnded?.();
    }, [hasPlaylist, currentIndex, playlist, loopPlaylist, upNextDelay, onPlaylistIndexChange, onPlaylistEnded, onEnded]);

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    // ── Manual quality src override ───────────────────────────────────────────
    const [manualSrc, setManualSrc] = useState<string | undefined>(undefined);
    const [activeManualSrc, setActiveManualSrc] = useState<string | undefined>(undefined);

    // Stores { time, playing } so we can resume at the same position after a quality switch
    const qualityResumeRef = useRef<{ time: number; playing: boolean } | null>(null);

    // Reset manual quality selection on src/playlist-index change
    useEffect(() => {
      setManualSrc(undefined);
      setActiveManualSrc(undefined);
    }, [srcProp, currentIndex]);

    // After a quality switch, the src effect in useVideoPlayer calls video.load()
    // which resets currentTime to 0. We restore the position in two steps:
    //   1. loadedmetadata — seek to the saved time (triggers `seeked` so the
    //      progress bar jumps to the correct position immediately)
    //   2. canplay — only then call play(), so the video never enters the
    //      "playing but waiting for data" state that causes timeupdate events
    //      to advance the progress bar while the frame is visually frozen.
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const handleLoadedMetadata = () => {
        if (!qualityResumeRef.current) return;
        video.currentTime = qualityResumeRef.current.time;
        // Don't play yet — wait for canplay so we have data at this position
      };

      const handleCanPlay = () => {
        const resume = qualityResumeRef.current;
        if (!resume) return;
        qualityResumeRef.current = null;
        if (resume.playing) video.play().catch(() => {});
      };

      video.addEventListener("loadedmetadata", handleLoadedMetadata);
      video.addEventListener("canplay", handleCanPlay);
      return () => {
        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
        video.removeEventListener("canplay", handleCanPlay);
      };
    }, [videoRef]);

    const handleManualQualityChange = useCallback((qualitySrc: string) => {
      const video = videoRef.current;
      qualityResumeRef.current = {
        time: video?.currentTime ?? 0,
        playing: video ? !video.paused : false,
      };
      setManualSrc(qualitySrc);
      setActiveManualSrc(qualitySrc);
    }, [videoRef]);

    // Active src: manual quality override → playlist item → bare src prop
    const baseSrc = hasPlaylist ? (currentItem?.src ?? '') : (srcProp ?? '');
    const activeSrc = manualSrc ?? baseSrc;

    // First playlist item respects the user's autoplay option;
    // subsequent items always autoplay (matches YouTube/Netflix behaviour).
    const effectiveAutoplay = (hasPlaylist && currentIndex > 0) ? true : autoplay;

    const { state, ref: playerRef, fullscreenContainerRef } = useVideoPlayer(
      videoRef,
      activeSrc,
      {
        autoplay: effectiveAutoplay,
        muted,
        loop,
        playbackRates,
        enableHLS,
        hlsConfig,
        defaultAudioMode,
        audioBandwidthThreshold,
        audioModeSwitchLevel,
        audioModeRecoveryInterval,
        onPlay,
        onPause,
        onEnded: handleEnded,
        onError,
        onTimeUpdate,
        onDurationChange,
        onBuffering,
        onTheaterModeChange,
        onAudioModeChange,
        audioRef,
        audioSrc,
      },
    );

    // Always keep activeMediaRef pointing to the playing element so Controls/ProgressBar
    // can subscribe to the right element's events without React re-renders
    const activeMediaRef = useRef<HTMLMediaElement | null>(null);
    React.useLayoutEffect(() => {
      activeMediaRef.current =
        state.isAudioMode && audioSrc && audioRef.current
          ? audioRef.current
          : videoRef.current;
    }, [state.isAudioMode, audioSrc]);
    // initialise synchronously so it's set before first paint
    if (activeMediaRef.current === null) {
      activeMediaRef.current = videoRef.current;
    }

    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

    useEffect(() => {
      fullscreenContainerRef.current = containerRef.current;
    }, [fullscreenContainerRef]);

    // Expose playlist navigation methods via the forwarded ref
    React.useImperativeHandle(forwardedRef, () => ({
      ...playerRef,
      goNext,
      goPrev,
      goToIndex,
      currentPlaylistIndex: () => currentIndex,
    }), [playerRef, goNext, goPrev, goToIndex, currentIndex]);

    const handleVideoClick = useCallback(() => {
      // Focus the container so keyboard shortcuts activate for this player
      containerRef.current?.focus();
      if (state.isPlaying) playerRef.pause();
      else playerRef.play();
    }, [state.isPlaying, playerRef]);

    const handleDoubleClick = useCallback(() => {
      playerRef.toggleFullscreen();
    }, [playerRef]);

    const handleContextMenu = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY });
    }, []);

    const handleReplay = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
      playerRef.seek(0);
      playerRef.play();
    }, [playerRef]);



    return (
      <div
        ref={containerRef}
        tabIndex={0}
        style={{
          position: "relative",
          width: "100%",
          backgroundColor: "#000",
          aspectRatio: "16 / 9",
          userSelect: "none",
          outline: "none",
        }}
        className={className}
        data-test="video-player-container"
        data-theater={state.isTheaterMode ? "true" : undefined}
        onContextMenu={handleContextMenu}
      >
        <video
          ref={videoRef}
          poster={activePoster}
          preload={preload}
          crossOrigin={crossOrigin}
          onClick={handleVideoClick}
          onDoubleClick={handleDoubleClick}
          playsInline
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            cursor: "pointer",
            // Keep the element in the DOM so audio keeps playing; just hide it visually
            visibility: state.isAudioMode ? "hidden" : "visible",
          }}
          data-test="video-element"
        >
          {subtitles?.map((track) => (
            <track
              key={track.id}
              kind="subtitles"
              src={track.src}
              label={track.label}
              srcLang={track.srclang}
              default={track.default}
            />
          ))}
        </video>

        {/* Hidden audio element — owns playback in audio mode, video is paused */}
        {audioSrc && (
          <audio
            ref={audioRef}
            preload="none"
            style={{ display: "none" }}
            aria-hidden="true"
          />
        )}

        {/* Audio mode overlay — sits above video, below controls (DOM order) */}
        {state.isAudioMode && (
          <AudioModeOverlay
            poster={audioPoster ?? (audioModeFallback ? undefined : activePoster)}
            logo={logo}
            audioModeFallback={audioModeFallback}
            isBuffering={state.isBuffering}
            onOverlayClick={handleVideoClick}
          />
        )}

        {controls && (
          <Controls
            videoRef={activeMediaRef}
            playerRef={playerRef}
            playerContainerRef={containerRef}
            playbackRates={playbackRates}
            enablePreview={enablePreview}
            thumbnailVtt={state.isAudioMode ? undefined : thumbnailVtt}
            thumbnailVttBaseUrl={thumbnailVttBaseUrl}
            isPlaying={state.isPlaying}
            volume={state.volume}
            isMuted={state.isMuted}
            playbackRate={state.playbackRate}
            isFullscreen={state.isFullscreen}
            isPictureInPicture={state.isPictureInPicture}
            isTheaterMode={state.isTheaterMode}
            isAudioMode={state.isAudioMode}
            showAudioButton={showAudioButton ?? !!audioSrc}
            audioModeIcon={audioModeIcon}
            videoModeIcon={videoModeIcon}
            audioModeLabel={audioModeLabel}
            videoModeLabel={videoModeLabel}
            isLive={state.isLive}
            qualityLevels={state.qualityLevels}
            currentQualityLevel={state.currentQualityLevel}
            playingQualityLevel={state.playingQualityLevel}
            showQualityMenu={showQualityMenu}
            manualQualityLevels={manualQualityLevels}
            activeManualSrc={activeManualSrc}
            onManualQualityChange={handleManualQualityChange}
            controlBarItems={controlBarItems}
            autoHideControls={autoHideControls}
            skipSeconds={skipSeconds}
            hasPrev={hasPlaylist ? hasPrev : undefined}
            hasNext={hasPlaylist ? hasNext : undefined}
            onPrev={hasPlaylist ? goPrev : undefined}
            onNext={hasPlaylist ? goNext : undefined}
          />
        )}

        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            isPlaying={state.isPlaying}
            src={activeSrc}
            videoRef={videoRef}
            playerRef={playerRef}
            onClose={() => setContextMenu(null)}
            contextMenuItems={contextMenuItems}
          />
        )}

        {/* LIVE badge */}
        {state.isLive && (
          <div
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              backgroundColor: "#e53935",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              padding: "2px 8px",
              borderRadius: 3,
              pointerEvents: "none",
            }}
          >
            LIVE
          </div>
        )}

        {/* Buffering spinner */}
        {state.isBuffering && !state.error && !state.isAudioMode && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              color: "#fff",
              pointerEvents: "none",
            }}
            data-test="buffering-indicator"
          >
            <div
              style={{
                width: 48,
                height: 48,
                border: "4px solid rgba(255,255,255,0.25)",
                borderTop: "4px solid #fff",
                borderRadius: "50%",
                animation: "rvp-spin 0.8s linear infinite",
              }}
            />
          </div>
        )}

        {/* Up Next overlay — countdown before auto-advancing to the next playlist item */}
        {upNextActive && upNextItem && (
          <UpNextOverlay
            upNextDelay={upNextDelay}
            nextItem={upNextItem}
            onCancel={cancelUpNext}
            onPlayNow={playNextNow}
          />
        )}

        {/* Replay overlay — suppressed while Up Next countdown is active */}
        {showReplayOverlay && state.isEnded && !state.error && !upNextActive && (
          <div
            onClick={handleReplay}
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              backgroundColor: "rgba(0,0,0,0.55)",
              cursor: "pointer",
              zIndex: 3,
              color: "#fff",
            }}
            data-test="replay-overlay"
            aria-label="Replay"
            role="button"
          >
            <button
              type="button"
              onClick={handleReplay}
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                border: "2px solid rgba(255,255,255,0.9)",
                backgroundColor: "rgba(0,0,0,0.5)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                padding: 0,
                transition: "transform 0.15s ease, background-color 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.08)";
                e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.75)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.5)";
              }}
              data-test="replay-button"
            >
              <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
              </svg>
            </button>
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: "0.04em",
                textShadow: "0 1px 3px rgba(0,0,0,0.6)",
              }}
            >
              Replay
            </span>
          </div>
        )}

        {/* Error overlay */}
        {state.error && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(0,0,0,0.85)",
              color: "#fff",
              padding: 24,
            }}
            data-test="error-overlay"
          >
            <div style={{ textAlign: "center", maxWidth: 400 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>⚠</div>
              <h3 style={{ margin: "0 0 8px", fontSize: 18 }}>
                {state.error.code === "MEDIA_ERR_SRC_NOT_SUPPORTED"
                  ? "Unsupported Format"
                  : state.error.code.startsWith("HLS")
                    ? "Stream Error"
                    : "Playback Error"}
              </h3>
              <p style={{ margin: 0, fontSize: 13, opacity: 0.75 }}>
                {state.error.message}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  },
);

VideoPlayer.displayName = "VideoPlayer";

export default VideoPlayer;

// ── Up Next overlay ───────────────────────────────────────────────────────────

interface UpNextOverlayProps {
  upNextDelay: number;
  nextItem: { src: string; poster?: string; title?: string };
  onCancel: () => void;
  onPlayNow: () => void;
}

const UpNextOverlay = memo(function UpNextOverlay({ upNextDelay, nextItem, onCancel, onPlayNow }: UpNextOverlayProps) {
  const [countdownSec, setCountdownSec] = useState(upNextDelay);
  const onPlayNowRef = useRef(onPlayNow);
  onPlayNowRef.current = onPlayNow;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tick countdown every second; clear interval when it reaches 0
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setCountdownSec(s => {
        if (s <= 1) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  // Auto-advance when countdown hits 0
  useEffect(() => {
    if (countdownSec <= 0) onPlayNowRef.current();
  }, [countdownSec]);

  const R = 20;
  const circ = 2 * Math.PI * R; // ≈ 125.66
  const dashOffset = circ * (1 - countdownSec / upNextDelay);

  return (
    <div
      onClick={onPlayNow}
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.82)",
        zIndex: 4,
        cursor: "pointer",
      }}
      data-test="upnext-overlay"
    >
      {/* Card — stop clicks from bubbling to the outer play-now handler */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          color: "#fff",
          width: "min(260px, 78%)",
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", opacity: 0.55, textTransform: "uppercase" }}>
          Up Next
        </span>

        {/* Thumbnail — clicking plays immediately */}
        <div
          onClick={onPlayNow}
          style={{
            width: "100%",
            aspectRatio: "16 / 9",
            borderRadius: 6,
            overflow: "hidden",
            backgroundColor: "#111",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          {nextItem.poster ? (
            <img
              src={nextItem.poster}
              alt={nextItem.title ?? "Next video"}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#1a1a2e 0%,#16213e 100%)" }} />
          )}
        </div>

        {/* Title */}
        {nextItem.title && (
          <span style={{ fontSize: 13, fontWeight: 600, textAlign: "center", lineHeight: 1.4, opacity: 0.9, margin: "0 4px" }}>
            {nextItem.title}
          </span>
        )}

        {/* Bottom row: countdown ring + cancel button */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 2 }}>
          {/* Circular countdown */}
          <div style={{ position: "relative", width: 48, height: 48, flexShrink: 0 }}>
            <svg width="48" height="48" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="24" cy="24" r={R} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" />
              <circle
                cx="24" cy="24" r={R}
                fill="none"
                stroke="#fff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={dashOffset}
                style={{ transition: "stroke-dashoffset 1s linear" }}
              />
            </svg>
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 15, fontWeight: 700,
            }}>
              {countdownSec}
            </div>
          </div>

          {/* Cancel */}
          <button
            onClick={(e) => { e.stopPropagation(); onCancel(); }}
            style={{
              background: "none",
              border: "1px solid rgba(255,255,255,0.45)",
              color: "#fff",
              borderRadius: 4,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              letterSpacing: "0.04em",
              transition: "border-color 0.15s, background 0.15s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.9)";
              e.currentTarget.style.background = "rgba(255,255,255,0.1)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.45)";
              e.currentTarget.style.background = "none";
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
});
UpNextOverlay.displayName = "UpNextOverlay";
