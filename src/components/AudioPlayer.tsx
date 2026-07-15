"use client";

import React, { forwardRef, useEffect, useRef, useCallback } from "react";
import type { AudioPlayerProps, AudioPlayerRef } from "../lib/types";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { ControlElements } from "./control-elements";

const AudioPlayer = forwardRef<AudioPlayerRef, AudioPlayerProps>(
  (props, forwardedRef) => {
    const { src, poster, title, artist, className, style, controls = true, options = {} } = props;

    const {
      autoplay = false,
      muted = false,
      loop = false,
      preload = "metadata",
      enableHLS = true,
      hlsConfig,
      crossOrigin,
      skipSeconds = 15,
      progressBarVariant = "bar",
      showMeta = true,
      theme,
      onPlay,
      onPause,
      onEnded,
      onError,
      onTimeUpdate,
      onDurationChange,
      onBuffering,
    } = options;

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const { state, ref: playerRef } = useAudioPlayer(audioRef, src, {
      autoplay,
      muted,
      loop,
      enableHLS,
      hlsConfig,
      onPlay,
      onPause,
      onEnded,
      onError,
      onTimeUpdate,
      onDurationChange,
      onBuffering,
    });

    React.useImperativeHandle(forwardedRef, () => playerRef, [playerRef]);

    const handleTogglePlay = useCallback(() => {
      state.isPlaying ? playerRef.pause() : playerRef.play();
    }, [state.isPlaying, playerRef]);

    const handleSkipBack = useCallback(() => {
      const ct = audioRef.current?.currentTime ?? 0;
      playerRef.seek(Math.max(0, ct - skipSeconds));
    }, [playerRef, skipSeconds]);

    const handleSkipForward = useCallback(() => {
      const ct = audioRef.current?.currentTime ?? 0;
      const dur = audioRef.current?.duration ?? Infinity;
      playerRef.seek(Math.min(isFinite(dur) ? dur : ct + skipSeconds, ct + skipSeconds));
    }, [playerRef, skipSeconds]);

    const handleVolumeChange = useCallback((v: number) => playerRef.setVolume(v), [playerRef]);
    const handleToggleMute = useCallback(() => playerRef.toggleMute(), [playerRef]);

    // ─── Keyboard shortcuts (space, arrows, mute) — scoped to the container ──
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (!containerRef.current?.contains(document.activeElement)) return;
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

        const ct = audioRef.current?.currentTime ?? 0;
        const dur = audioRef.current?.duration ?? 0;

        switch (e.code) {
          case "Space": case "KeyK":
            e.preventDefault();
            state.isPlaying ? playerRef.pause() : playerRef.play();
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
            playerRef.setVolume(Math.min(1, state.volume + 0.1));
            break;
          case "ArrowDown":
            e.preventDefault();
            playerRef.setVolume(Math.max(0, state.volume - 0.1));
            break;
          case "KeyM":
            e.preventDefault();
            playerRef.toggleMute();
            break;
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [playerRef, state.isPlaying, state.volume]);

    // Theme colours map to CSS custom properties consumed by AudioPlayer.css —
    // unset fields fall back to the stylesheet's defaults. `style` merges last
    // so it can also override the same variables directly.
    const themeStyle: React.CSSProperties = {
      ...(theme?.background && { "--rvp-audio-bg": theme.background }),
      ...(theme?.textColor && { "--rvp-audio-text": theme.textColor }),
      ...(theme?.secondaryTextColor && { "--rvp-audio-subtext": theme.secondaryTextColor }),
      ...(theme?.accentColor && { "--rvp-audio-accent": theme.accentColor }),
      ...(theme?.trackColor && { "--rvp-audio-track": theme.trackColor }),
      ...(theme?.iconColor && { "--rvp-audio-icon": theme.iconColor }),
      ...style,
    } as React.CSSProperties;

    const showMetaRow = showMeta && (poster || title || artist);

    return (
      <div
        ref={containerRef}
        tabIndex={0}
        className={["rvp-audio-player", className].filter(Boolean).join(" ")}
        data-test="audio-player-container"
        style={themeStyle}
      >
        <audio
          ref={audioRef}
          preload={preload}
          crossOrigin={crossOrigin}
          data-test="audio-element"
        />

        {showMetaRow && (
          <div className="rvp-audio-player-meta">
            {poster && (
              <img
                src={poster}
                alt={title ?? "Artwork"}
                draggable={false}
                className="rvp-audio-player-artwork"
              />
            )}
            {(title || artist) && (
              <div className="rvp-audio-player-text">
                {title && <span className="rvp-audio-player-title">{title}</span>}
                {artist && <span className="rvp-audio-player-artist">{artist}</span>}
              </div>
            )}
          </div>
        )}

        {controls && (
          <>
            <ControlElements.ProgressBar
              videoRef={audioRef}
              playerRef={playerRef}
              enablePreview={false}
              isAudioMode={progressBarVariant === "waveform"}
            />

            <div className="rvp-audio-player-controls">
              {skipSeconds > 0 && (
                <ControlElements.SkipBackButton onClick={handleSkipBack} seconds={skipSeconds} />
              )}

              {state.isPlaying ? (
                <ControlElements.PauseButton onClick={handleTogglePlay} />
              ) : (
                <ControlElements.PlayButton onClick={handleTogglePlay} />
              )}

              {skipSeconds > 0 && (
                <ControlElements.SkipForwardButton onClick={handleSkipForward} seconds={skipSeconds} />
              )}

              <ControlElements.TimeDisplay videoRef={audioRef} isLive={state.isLive} />

              <div style={{ flex: 1 }} />

              <ControlElements.VolumeControl
                volume={state.volume}
                isMuted={state.isMuted}
                onVolumeChange={handleVolumeChange}
                onToggleMute={handleToggleMute}
              />
            </div>
          </>
        )}

        {state.error && (
          <div className="rvp-audio-player-error" data-test="audio-error">
            {state.error.message}
          </div>
        )}
      </div>
    );
  },
);

AudioPlayer.displayName = "AudioPlayer";

export default AudioPlayer;
