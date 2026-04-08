"use client";

import React, { forwardRef, useEffect, useRef, useCallback, useState } from "react";
import type { VideoPlayerProps, VideoPlayerRef } from "../lib/types";
import { useVideoPlayer } from "../hooks/useVideoPlayer";
import { Controls } from "./Controls";
import { ContextMenu } from "./ContextMenu";
import { AudioModeOverlay } from "./AudioModeOverlay";

const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  (props, forwardedRef) => {
    const { src, poster, className, controls = true, options = {} } = props;

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
      subtitles,
      crossOrigin,
      logo,
      audioModeFallback,
      audioPoster,
      audioSrc,
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

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    // ── Manual quality src override ───────────────────────────────────────────
    const [manualSrc, setManualSrc] = useState<string | undefined>(undefined);
    const [activeManualSrc, setActiveManualSrc] = useState<string | undefined>(undefined);

    // Stores { time, playing } so we can resume at the same position after a quality switch
    const qualityResumeRef = useRef<{ time: number; playing: boolean } | null>(null);

    // Reset manual selection whenever the base src prop changes
    useEffect(() => {
      setManualSrc(undefined);
      setActiveManualSrc(undefined);
    }, [src]);

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

    const activeSrc = manualSrc ?? src;

    const { state, ref: playerRef, fullscreenContainerRef } = useVideoPlayer(
      videoRef,
      activeSrc,
      {
        autoplay,
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
        onEnded,
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

    React.useImperativeHandle(forwardedRef, () => playerRef, [playerRef]);

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
          poster={poster}
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
            poster={audioPoster ?? (audioModeFallback ? undefined : poster)}
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
          />
        )}

        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            isPlaying={state.isPlaying}
            src={src}
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
