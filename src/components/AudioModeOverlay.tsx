"use client";

import React, { memo, type ReactNode } from "react";

interface AudioModeOverlayProps {
  poster?: string;
  logo?: string | ReactNode;
  audioModeFallback?: ReactNode;
  isBuffering?: boolean;
  onOverlayClick?: () => void;
}

export const AudioModeOverlay = memo<AudioModeOverlayProps>(function AudioModeOverlay({
  poster,
  logo,
  audioModeFallback,
  isBuffering = false,
  onOverlayClick,
}) {
  const spinner = isBuffering ? (
    <div className="rvp-audio-buffering-overlay" aria-label="Buffering">
      <div className="rvp-audio-spinner" />
    </div>
  ) : null;

  const artwork = (() => {
    if (poster) {
      return (
        <div className="rvp-audio-artwork-container">
          <img src={poster} alt="Artwork" className="rvp-audio-artwork" draggable={false} />
        </div>
      );
    }
    if (audioModeFallback) {
      return <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>{audioModeFallback}</div>;
    }
    if (logo) {
      return typeof logo === "string"
        ? <img src={logo} alt="Logo" className="rvp-audio-logo" draggable={false} />
        : <div className="rvp-audio-logo-node">{logo as ReactNode}</div>;
    }
    return null;
  })();

  return (
    <div className="rvp-audio-overlay" onClick={onOverlayClick} data-test="audio-mode-overlay">
      {artwork}
      <span className="rvp-audio-label">Audio Mode</span>
      {spinner}
    </div>
  );
});

AudioModeOverlay.displayName = "AudioModeOverlay";
