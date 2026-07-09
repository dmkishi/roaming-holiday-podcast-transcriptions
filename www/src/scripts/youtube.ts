/**
 * Fire an Umami event, or silently no-op if `umami` isn't available (ad-blocked
 * or not yet loaded.)
 */
function track(name: string, data?: Record<string, unknown>): void {
  globalThis.umami?.track(name, data);
}

(function initYouTube() {
  'use strict';

  const videoElement = document.querySelector('.js-video');
  if (!(videoElement instanceof HTMLElement)) return;

  // eslint-disable-next-line unicorn/consistent-function-scoping
  let enableMiniPlayerToggling = (): void => {};
  initMiniPlayer(videoElement);
  initPlayer(videoElement);

  /**
   * Control mini-player. Observe a placeholder "sentinel" instead of the
   * <iframe> directly to avoid a feedback loop when `position:fixed` removes it
   * from flow.
   *
   * Toggling is gated behind `isReady` (flipped by `enableMiniPlayerToggling`.)
   * Until the embedded player is ready, the iframe stays at full size, so that
   * YouTube loads a full-resolution poster that remains crisp when the mini-
   * player later expands back to full size.
   */
  function initMiniPlayer(videoEl: HTMLElement): void {
    let isReady = false;
    let isOffscreen = false;
    let isDismissed = false;
    const sentinel = document.querySelector('.js-video-sentinel')!;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'js-mini-player--close-btn';
    closeBtn.textContent = '×';
    closeBtn.hidden = true;

    const updateMiniPlayer = (): void => {
      const isMini = isReady && !isDismissed && isOffscreen;
      videoEl.classList.toggle('js-video__is-mini', isMini);
      closeBtn.hidden = !isMini;
    };

    enableMiniPlayerToggling = () => {
      isReady = true;
      updateMiniPlayer();
    };

    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (!entry) return;
      isOffscreen = !entry.isIntersecting;
      updateMiniPlayer();
    }, { threshold: 0 });

    closeBtn.addEventListener('click', () => {
      isDismissed = true;
      updateMiniPlayer();
      track('mini-player-dismiss');
    });

    videoEl.parentElement!.append(closeBtn);
    observer.observe(sentinel);
  }

  /**
   * - Double-clicking a transcript segment seeks the video to that timecode and
   *   starts playback.
   * - Show active playback segment.
   */
  function initPlayer(videoEl: HTMLElement): void {
    const apiScript = document.createElement('script');
    apiScript.src = 'https://www.youtube.com/iframe_api';
    document.head.append(apiScript);

    const transcript = document.querySelector('[data-transcript]');
    const wordSpans = transcript
      ? [...transcript.querySelectorAll<HTMLElement>('.word')].map((el) => (
          {
            el,
            start: Number(el.dataset['start'] ?? ''),
          }
        ))
      : [];

    let player: YT.Player | undefined;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    let currentWordIndex = -1;
    let lastPlaybackState: number | undefined;

    globalThis.onYouTubeIframeAPIReady = () => {
      player = new YT.Player(videoEl, {
        events: {
          onApiChange: () => {
            // Force captions off, ignoring the viewer's account preference.
            // (The user can still re-enable it.)
            if (!player) return;
            if (player.getOptions().includes('captions')) {
              player.setOption('captions', 'track', {});
            }
          },
          onReady: () => {
            enableMiniPlayerToggling();
            if (transcript) {
              transcript.addEventListener('dblclick', (evt) => {
                if (!player) return;
                if (!(evt.target instanceof Element)) return;
                const span = evt.target.closest('.word, .segment');
                if (!(span instanceof HTMLElement)) return;
                player.seekTo(Number(span.dataset['start'] ?? ''), true);
                player.playVideo();
                globalThis.getSelection()?.removeAllRanges(); // Deselect text.
                track('transcript-seek');
              });
            }
            initKeyboardControls();
          },
          onStateChange: (evt) => {
            // Track video play/pause/complete, deduped against the previous
            // *meaningful* state. Transient BUFFERING/CUED states are ignored
            // so an in-playback seek (PLAYING → BUFFERING → PLAYING) doesn't
            // re-fire `video-play`.
            const state = evt.data;
            if (state === YT.PlayerState.PLAYING && lastPlaybackState !== YT.PlayerState.PLAYING) track('video-play');
            else if (state === YT.PlayerState.PAUSED && lastPlaybackState !== YT.PlayerState.PAUSED) track('video-pause');
            else if (state === YT.PlayerState.ENDED) track('video-complete');
            if (state === YT.PlayerState.PLAYING || state === YT.PlayerState.PAUSED || state === YT.PlayerState.ENDED) {
              lastPlaybackState = state;
            }

            if (evt.data === YT.PlayerState.PLAYING) {
              updateActiveWord();
              intervalId ??= setInterval(updateActiveWord, 250);
            } else {
              if (intervalId !== undefined) {
                clearInterval(intervalId);
                intervalId = undefined;
              }
              updateActiveWord();
            }
          },
        },
      });
    };

    /**
     * Highlight the word matching the current playback time.
     */
    function updateActiveWord(): void {
      if (!player) return;

      const time = player.getCurrentTime();
      if (wordSpans.length > 0) {
        let j = currentWordIndex;
        while (j + 1 < wordSpans.length && wordSpans[j + 1]!.start <= time) j++;
        while (j >= 0 && wordSpans[j]!.start > time) j--;
        if (j !== currentWordIndex) {
          if (currentWordIndex >= 0) wordSpans[currentWordIndex]!.el.classList.remove('is-active');
          if (j >= 0) wordSpans[j]!.el.classList.add('is-active');
          currentWordIndex = j;
        }
      }
    }

    /**
     * Attaches a keydown listener that maps keyboard shortcuts to player
     * actions. Shortcuts are suppressed when the YouTube player is not yet
     * initialized, a modifier key is held, or the focus is on an editable
     * element.
     */
    function initKeyboardControls(): void {
      document.addEventListener('keydown', (evt) => {
        if (!player) return;
        if (evt.ctrlKey || evt.metaKey || evt.altKey) return;
        if (isEditableTarget(evt.target)) return;

        let action: string | undefined;
        switch (evt.key) {
          case ' ':
          case 'k': {
            if (player.getPlayerState() === YT.PlayerState.PLAYING) player.pauseVideo();
            else player.playVideo();
            animateKeyIcon('js-key-icon-space');
            action = 'play-pause';
            break;
          }
          case 'ArrowLeft':
          case 'j': {
            player.seekTo(Math.max(0, player.getCurrentTime() - 5), true);
            animateKeyIcon('js-key-icon-left');
            action = 'seek-back';
            break;
          }
          case 'ArrowRight':
          case 'l': {
            player.seekTo(player.getCurrentTime() + 5, true);
            animateKeyIcon('js-key-icon-right');
            action = 'seek-forward';
            break;
          }
          case 'm': {
            if (player.isMuted()) player.unMute();
            else player.mute();
            animateKeyIcon('js-key-icon-m');
            action = 'mute';
            break;
          }
          case 'ArrowUp': {
            player.unMute();
            player.setVolume(Math.min(100, player.getVolume() + 5));
            animateKeyIcon('js-key-icon-up');
            action = 'volume-up';
            break;
          }
          case 'ArrowDown': {
            player.unMute();
            player.setVolume(Math.max(0, player.getVolume() - 5));
            animateKeyIcon('js-key-icon-down');
            action = 'volume-down';
            break;
          }
          default: {
            return;
          }
        }
        evt.preventDefault();
        if (action) track('keyboard-shortcut', { action });
      });
    }
  }

  /**
   * Returns true if the event target is a form control or content-editable
   * element that should receive keyboard input instead of the player.
   */
  function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return true;
    return target.isContentEditable;
  }

  function animateKeyIcon(className: string): void {
    const element = document.querySelector('.' + className)!;
    element.classList.add('js-key-icon-pressed');
    setTimeout(() => { element.classList.remove('js-key-icon-pressed'); }, 166);
  }
})();
