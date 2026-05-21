(function() {
  'use strict';

  const video = document.querySelector('.js-video');
  if (!(video instanceof HTMLElement)) return;

  initMiniPlayer(video);
  initPlayer();

  /**
   * Control mini-player. Observe a placeholder "sentinel" instead of the
   * <iframe> to avoid a feedback loop when `position:fixed` removes it from
   * flow.
   * @returns {void}
   */
  function initMiniPlayer() {
    const sentinel = document.querySelector('.js-video-sentinel');

    const closeBtn = document.createElement('button');
    closeBtn.className = 'js-mini-player--close-btn';
    closeBtn.textContent = 'U00D7';
    closeBtn.hidden = true;

    let isDismissed = false;

    const observer = new IntersectionObserver((entries) => {
      const isOffscreen = !entries[0].isIntersecting;

      if (isDismissed) {
        video.classList.remove('js-video__is-mini');
        closeBtn.hidden = true;
        return;
      }

      video.classList.toggle('js-video__is-mini', isOffscreen);
      closeBtn.hidden = !isOffscreen;

      if (!isOffscreen) {
        isDismissed = false;
      }
    }, { threshold: 0 });

    closeBtn.addEventListener('click', () => {
      video.classList.remove('js-video__is-mini');
      closeBtn.hidden = true;
      isDismissed = true;
    });

    video.parentElement.append(closeBtn);
    observer.observe(sentinel);
  }

  /**
   * - Double-clicking a transcript segment seeks the video to that timecode and
   *   starts playback.
   * - Show active playback segment.
   * @returns {void}
   */
  function initPlayer() {
    const transcript = document.querySelector('[data-transcript]');

    const apiScript = document.createElement('script');
    apiScript.src = 'https://www.youtube.com/iframe_api';
    document.head.append(apiScript);

    /**
     * Collect transcript <span>s matching `selector`, pairing each element with
     * its parsed `data-start` timestamp for monotonic-walk lookup.
     * @param {string} selector
     * @returns {{ el: Element, start: number }[]}
     */
    function collectSpans(selector) {
      if (!transcript) return [];
      return [...transcript.querySelectorAll(selector)].map((el) => ({
        el,
        start: parseFloat(el.dataset.start ?? ''),
      }));
    }

    // Segment-level spans (both `.segment` wrappers and fallback segment spans)
    // and word-level spans live interleaved with duplicate start times — track
    // them separately so each gets its own monotonic-walk pointer and class.
    const segmentSpans = collectSpans('p > span[data-start]');
    const wordSpans = collectSpans('.segment > span[data-start]');
    let currentSegmentIndex = -1;
    let currentWordIndex = -1;

    /** @type {ReturnType<typeof setInterval> | undefined} */
    let intervalId;

    /** @type {YT.Player | undefined} */
    let player;

    globalThis.onYouTubeIframeAPIReady = () => {
      player = /** @type {YT.Player} */ new YT.Player(video, {
        events: {
          onReady: () => {
            if (transcript) {
              transcript.addEventListener('dblclick', (evt) => {
                if (!(evt.target instanceof Element)) return;
                const span = evt.target.closest('span[data-start]');
                if (!(span instanceof HTMLElement)) return;
                player.seekTo(parseFloat(span.dataset.start), true);
                player.playVideo();
                globalThis.getSelection().removeAllRanges(); // Deselect text.
              });
            }
            initKeyboardControls();
          },
          onStateChange: (evt) => {
            if (evt.data === YT.PlayerState.PLAYING) {
              intervalId ??= setInterval(updateActiveSpan, 250);
            } else {
              if (intervalId !== undefined) {
                clearInterval(intervalId);
                intervalId = undefined;
              }
              updateActiveSpan();
            }
          },
        },
      });
    };

    /**
     * Highlight the segment and word matching the current playback time.
     * Segment changes also scroll the transcript (word changes only toggle the
     * class to avoid jitter from the ~3×/s update cadence.)
     * @returns {void}
     */
    function updateActiveSpan() {
      if (!player) return;
      const time = player.getCurrentTime();

      if (segmentSpans.length > 0) {
        let i = currentSegmentIndex;
        while (i + 1 < segmentSpans.length && segmentSpans[i + 1].start <= time) i++;
        while (i >= 0 && segmentSpans[i].start > time) i--;
        if (i !== currentSegmentIndex) {
          if (currentSegmentIndex >= 0) {
            segmentSpans[currentSegmentIndex].el.classList.remove('is-active-segment');
          }
          if (i >= 0) {
            segmentSpans[i].el.classList.add('is-active-segment');
            // Scroll only on segment change — word transitions fire ~3×/s and
            // would jitter the page.
            segmentSpans[i].el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }
          currentSegmentIndex = i;
        }
      }

      if (wordSpans.length > 0) {
        let j = currentWordIndex;
        while (j + 1 < wordSpans.length && wordSpans[j + 1].start <= time) j++;
        while (j >= 0 && wordSpans[j].start > time) j--;
        if (j !== currentWordIndex) {
          if (currentWordIndex >= 0) wordSpans[currentWordIndex].el.classList.remove('is-active');
          if (j >= 0) wordSpans[j].el.classList.add('is-active');
          currentWordIndex = j;
        }
      }
    }

    /**
     * Attaches a keydown listener that maps keyboard shortcuts to player
     * actions. Shortcuts are suppressed when the YouTube player is not yet
     * initialized, a modifier key is held, or the focus is on an editable
     * element.
     * @returns {void}
     */
    function initKeyboardControls() {
      document.addEventListener('keydown', (evt) => {
        if (!player) return;
        if (evt.ctrlKey || evt.metaKey || evt.altKey) return;
        if (isEditableTarget(evt.target)) return;

        switch (evt.key) {
          case ' ':
          case 'k': {
            if (player.getPlayerState() === YT.PlayerState.PLAYING) player.pauseVideo();
            else player.playVideo();
            animateKeyIcon('js-key-icon-space');
            break;
          }
          case 'ArrowLeft':
          case 'j': {
            player.seekTo(Math.max(0, player.getCurrentTime() - 5), true);
            animateKeyIcon('js-key-icon-left');
            break;
          }
          case 'ArrowRight':
          case 'l': {
            player.seekTo(player.getCurrentTime() + 5, true);
            animateKeyIcon('js-key-icon-right');
            break;
          }
          case 'm': {
            if (player.isMuted()) player.unMute();
            else player.mute();
            animateKeyIcon('js-key-icon-m');
            break;
          }
          case 'ArrowUp': {
            player.unMute();
            player.setVolume(Math.min(100, player.getVolume() + 5));
            animateKeyIcon('js-key-icon-up');
            break;
          }
          case 'ArrowDown': {
            player.unMute();
            player.setVolume(Math.max(0, player.getVolume() - 5));
            animateKeyIcon('js-key-icon-down');
            break;
          }
          default: {
            return;
          }
        }
        evt.preventDefault();
      });
    }
  }

  /**
   * Returns true if the event target is a form control or content-editable
   * element that should receive keyboard input instead of the player.
   * @param {EventTarget | null} target
   * @return {boolean}
   */
  function isEditableTarget(target) {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return true;
    return target.isContentEditable;
  }

  /**
   * @param {string} className
   * @return {void}
   */
  function animateKeyIcon(className) {
    const element = document.querySelector('.' + className);
    element.classList.add('js-key-icon-pressed');
    setTimeout(() => { element.classList.remove('js-key-icon-pressed'); }, 166);
  }
})();
