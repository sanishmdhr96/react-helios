"use client";

import { memo } from "react";

export interface PlayButtonProps { onClick: () => void; }
export interface PauseButtonProps { onClick: () => void; }
export interface FullscreenButtonProps { onClick: () => void; isFullscreen?: boolean; }
export interface PiPButtonProps { onClick: () => void; isPiP?: boolean; }

export const PlayButton = memo<PlayButtonProps>(({ onClick }) => (
  <button onClick={onClick} className="controlButton" aria-label="Play" title="Play (Space)">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  </button>
));
PlayButton.displayName = "PlayButton";

export const PauseButton = memo<PauseButtonProps>(({ onClick }) => (
  <button onClick={onClick} className="controlButton" aria-label="Pause" title="Pause (Space)">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
    </svg>
  </button>
));
PauseButton.displayName = "PauseButton";

export const FullscreenButton = memo<FullscreenButtonProps>(({ onClick, isFullscreen = false }) => (
  <button
    onClick={onClick}
    className="controlButton"
    aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
    title={isFullscreen ? "Exit Fullscreen (F)" : "Fullscreen (F)"}
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      {isFullscreen ? (
        <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
      ) : (
        <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
      )}
    </svg>
  </button>
));
FullscreenButton.displayName = "FullscreenButton";

export const PiPButton = memo<PiPButtonProps>(({ onClick, isPiP = false }) => (
  <button
    onClick={onClick}
    className="controlButton rvp-pip-btn"
    aria-label={isPiP ? "Exit Picture-in-Picture" : "Picture-in-Picture"}
    title={isPiP ? "Exit Picture-in-Picture (P)" : "Picture-in-Picture (P)"}
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V5h18v14.02z" />
    </svg>
  </button>
));
PiPButton.displayName = "PiPButton";

export interface TheaterButtonProps { onClick: () => void; isTheater?: boolean; }

export const TheaterButton = memo<TheaterButtonProps>(({ onClick, isTheater = false }) => (
  <button
    onClick={onClick}
    className="controlButton rvp-theater-btn"
    aria-label={isTheater ? "Exit Theater Mode" : "Theater Mode"}
    title={isTheater ? "Exit Theater Mode (T)" : "Theater Mode (T)"}
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      {isTheater ? (
        /* Exit theater: narrower inner rectangle — signals "shrink back" */
        <path d="M19 7H5c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm0 8H5V9h14v6z" />
      ) : (
        /* Enter theater: full-width rectangle — signals "expand wide" */
        <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z" />
      )}
    </svg>
  </button>
));
TheaterButton.displayName = "TheaterButton";

export interface SkipBackButtonProps { onClick: () => void; seconds: number; }
export interface SkipForwardButtonProps { onClick: () => void; seconds: number; }

/**
 * Half-circle skip icon.
 *
 * Geometry (viewBox 0 0 24 24, centre 12,12, radius 8):
 *   - BACKWARD: arc is the RIGHT half of the circle (opens to the LEFT).
 *     Path: from (12, 4) → down the right side → (12, 20).
 *     Arrowhead at the top endpoint, pointing LEFT (into the opening).
 *   - FORWARD: arc is the LEFT half of the circle (opens to the RIGHT).
 *     Path: from (12, 4) → down the left side → (12, 20).
 *     Arrowhead at the top endpoint, pointing RIGHT.
 */
const SkipIcon = ({ seconds, forward }: { seconds: number; forward: boolean }) => (
  <span className="rvp-skip-icon-wrap">
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ transform: forward ? "rotate(45deg)" : "rotate(-45deg)" }}
    >
      {forward ? (
        <>
          {/* ~225° arc — extends past half-circle, opening on the right */}
          <path d="M12 4 A 8 8 0 1 0 17.66 17.66" />
          {/* Horizontal arrowhead at the top, tangent to the loop, pointing right */}
          <polygon points="9 1.5, 13 4, 9 6.5" fill="currentColor" stroke="currentColor" />
        </>
      ) : (
        <>
          {/* ~225° arc — extends past half-circle, opening on the left */}
          <path d="M12 4 A 8 8 0 1 1 6.34 17.66" />
          {/* Horizontal arrowhead at the top, tangent to the loop, pointing left */}
          <polygon points="15 1.5, 11 4, 15 6.5" fill="currentColor" stroke="currentColor" />
        </>
      )}
    </svg>
    <span className={`rvp-skip-num ${forward ? "rvp-skip-num-fwd" : "rvp-skip-num-back"}`} aria-hidden="true">{seconds}</span>
  </span>
);

export const SkipBackButton = memo<SkipBackButtonProps>(({ onClick, seconds }) => (
  <button
    onClick={onClick}
    className="controlButton rvp-skip-btn"
    aria-label={`Rewind ${seconds} seconds`}
    title={`Rewind ${seconds}s`}
  >
    <SkipIcon seconds={seconds} forward={false} />
  </button>
));
SkipBackButton.displayName = "SkipBackButton";

export const SkipForwardButton = memo<SkipForwardButtonProps>(({ onClick, seconds }) => (
  <button
    onClick={onClick}
    className="controlButton rvp-skip-btn"
    aria-label={`Skip forward ${seconds} seconds`}
    title={`Skip forward ${seconds}s`}
  >
    <SkipIcon seconds={seconds} forward={true} />
  </button>
));
SkipForwardButton.displayName = "SkipForwardButton";

export default { PlayButton, PauseButton, FullscreenButton, PiPButton, TheaterButton, SkipBackButton, SkipForwardButton };
