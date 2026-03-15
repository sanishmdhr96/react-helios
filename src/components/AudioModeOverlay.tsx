"use client";

import React, { type ReactNode } from "react";
import "../styles/AudioMode.css";

// 20 bars — stagger driven by CSS var(--bar-index) so no JS randomness needed
const BAR_INDICES = Array.from({ length: 20 }, (_, i) => i);

interface AudioModeOverlayProps {
  /** Video poster URL — highest-priority artwork source. */
  poster?: string;
  /**
   * Fallback artwork when no poster is available.
   * - string → rendered as a white-tinted logo image
   * - ReactNode → rendered as-is (coloured white via CSS)
   */
  logo?: string | ReactNode;
  /** Used to pause / resume the waveform animation. */
  isPlaying: boolean;
}

export const AudioModeOverlay: React.FC<AudioModeOverlayProps> = ({
  poster,
  logo,
  isPlaying,
}) => {
  // Resolve artwork node using priority order: poster → logo
  const artworkNode = (() => {
    if (poster) {
      return (
        <img
          src={poster}
          alt="Video artwork"
          className="rvp-audio-artwork"
          draggable={false}
        />
      );
    }
    if (logo) {
      if (typeof logo === "string") {
        return (
          <img
            src={logo}
            alt="Logo"
            className="rvp-audio-logo"
            draggable={false}
          />
        );
      }
      return <div className="rvp-audio-logo-node">{logo as ReactNode}</div>;
    }
    return null;
  })();

  return (
    <div className="rvp-audio-overlay" data-test="audio-mode-overlay">
      <div className="rvp-audio-content">
        {/* Artwork (optional) */}
        {artworkNode && (
          <div className="rvp-audio-artwork-wrapper">{artworkNode}</div>
        )}

        {/* AUDIO ONLY label */}
        <div className="rvp-audio-badge" aria-label="Audio only mode">
          {/* Headphones icon */}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 3a9 9 0 0 0-9 9v7c0 1.1.9 2 2 2h1a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1H4v-1a8 8 0 0 1 16 0v1h-2a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h1a3 3 0 0 0 3-3v-4c0-4.97-4.03-9-9-9z" />
          </svg>
          Audio Only
        </div>

        {/* Animated equalizer waveform */}
        <div
          className={`rvp-audio-equalizer${isPlaying ? " rvp-audio-equalizer--playing" : ""}`}
          aria-hidden="true"
        >
          {BAR_INDICES.map((i) => (
            <div
              key={i}
              className="rvp-audio-bar"
              style={{ "--bar-index": i } as React.CSSProperties}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

AudioModeOverlay.displayName = "AudioModeOverlay";
