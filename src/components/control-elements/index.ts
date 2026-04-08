import {
  PlayButton,
  PauseButton,
  FullscreenButton,
  PiPButton,
  TheaterButton,
  SkipBackButton,
  SkipForwardButton,
} from "./control-buttons";
import VolumeControl from "./volume-control";
import ProgressBar from "./progress-bar";
import SettingsMenu from "./settings-menu";
import TimeDisplay from "./time-display";

export type {
  PlayButtonProps,
  PauseButtonProps,
  FullscreenButtonProps,
  PiPButtonProps,
  TheaterButtonProps,
  SkipBackButtonProps,
  SkipForwardButtonProps,
} from "./control-buttons";

export type { VolumeControlProps } from "./volume-control";
export type { ProgressBarProps } from "./progress-bar";
export type { SettingsMenuProps } from "./settings-menu";
export type { TimeDisplayProps } from "./time-display";

export {
  PlayButton,
  PauseButton,
  FullscreenButton,
  PiPButton,
  TheaterButton,
  SkipBackButton,
  SkipForwardButton,
} from "./control-buttons";

export { default as VolumeControl } from "./volume-control";
export { default as ProgressBar } from "./progress-bar";
export { default as SettingsMenu } from "./settings-menu";
export { default as TimeDisplay } from "./time-display";

export const ControlElements = {
  PlayButton,
  PauseButton,
  FullscreenButton,
  PiPButton,
  TheaterButton,
  SkipBackButton,
  SkipForwardButton,
  VolumeControl,
  ProgressBar,
  SettingsMenu,
  TimeDisplay,
};
