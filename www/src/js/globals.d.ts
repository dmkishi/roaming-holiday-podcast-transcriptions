declare var onYouTubeIframeAPIReady: (() => void) | undefined;

interface Window {
  onYouTubeIframeAPIReady?: () => void;
}
