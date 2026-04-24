(function() {
  'use strict';

  const video = document.querySelector('.js-video');
  if (!video) return;

  initMiniPlayer(video);
  initPlayer(video);

  /**
   * Control mini-player. Observe a placeholder "sentinel" instead of the
   * <iframe> to avoid a feedback loop when `position:fixed` removes it from
   * flow.
   */
  function initMiniPlayer(video) {
    const sentinel = document.querySelector('.js-video-sentinel');

    const closeBtn = document.createElement('button');
    closeBtn.className = 'js-mini-player--close-btn';
    closeBtn.textContent = '\u00d7';
    closeBtn.hidden = true;

    let isDismissed = false;

    const observer = new IntersectionObserver(function(entries) {
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

    closeBtn.addEventListener('click', function() {
      video.classList.remove('js-video__is-mini');
      closeBtn.hidden = true;
      isDismissed = true;
    });

    video.parentElement.appendChild(closeBtn);
    observer.observe(sentinel);
  }

  /**
   * - Double-clicking a transcript segment seeks the video to that timecode and
   *   starts playback.
   * - Show active playback segment.
   */
  function initPlayer(video) {
    const transcript = document.querySelector('[data-transcript]');

    const apiScript = document.createElement('script');
    apiScript.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(apiScript);

    const spans = transcript
      ? Array.from(transcript.querySelectorAll('span[data-start]')).map(function(el) {
          return {
            el,
            start: parseFloat(el.dataset.start),
          };
        })
      : [];
    let currentIndex = -1;
    let intervalId = null;
    let player;

    window.onYouTubeIframeAPIReady = function() {
      player = new YT.Player(video, {
        events: {
          onReady: function() {
            if (transcript) {
              transcript.addEventListener('dblclick', function(evt) {
                const span = evt.target.closest('span[data-start]');
                if (!span) return;
                player.seekTo(parseFloat(span.dataset.start), true);
                player.playVideo();
                window.getSelection().removeAllRanges(); // Deselect text.
              });
            }
            initKeyboardControls();
          },
          onStateChange: function(evt) {
            if (evt.data === YT.PlayerState.PLAYING) {
              if (!intervalId) intervalId = setInterval(updateActiveSpan, 250);
            } else {
              if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
              }
              updateActiveSpan();
            }
          },
        },
      });
    };

    function updateActiveSpan() {
      if (!spans.length || !player) return;
      const t = player.getCurrentTime();

      let i = currentIndex;
      while (i + 1 < spans.length && spans[i + 1].start <= t) i++;
      while (i >= 0 && spans[i].start > t) i--;
      if (i === currentIndex) return;

      if (currentIndex >= 0) spans[currentIndex].el.classList.remove('is-active');
      if (i >= 0) {
        spans[i].el.classList.add('is-active');
        spans[i].el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      currentIndex = i;
    }

    function initKeyboardControls() {
      document.addEventListener('keydown', function(evt) {
        if (!player) return;
        if (evt.ctrlKey || evt.metaKey || evt.altKey) return;
        if (isEditableTarget(evt.target)) return;

        switch (evt.key) {
          case ' ':
          case 'k':
            if (player.getPlayerState() === YT.PlayerState.PLAYING) player.pauseVideo();
            else player.playVideo();
            animateKeyIcon('js-key-icon-space');
            break;
          case 'ArrowLeft':
          case 'j':
            player.seekTo(Math.max(0, player.getCurrentTime() - 5), true);
            animateKeyIcon('js-key-icon-left');
            break;
          case 'ArrowRight':
          case 'l':
            player.seekTo(player.getCurrentTime() + 5, true);
            animateKeyIcon('js-key-icon-right');
            break;
          case 'm':
            if (player.isMuted()) player.unMute();
            else player.mute();
            animateKeyIcon('js-key-icon-m');
            break;
          case 'ArrowUp':
            player.unMute();
            player.setVolume(Math.min(100, player.getVolume() + 5));
            animateKeyIcon('js-key-icon-up');
            break;
          case 'ArrowDown':
            player.unMute();
            player.setVolume(Math.max(0, player.getVolume() - 5));
            animateKeyIcon('js-key-icon-down');
            break;
          default:
            return;
        }
        evt.preventDefault();
      });
    }

    /**
     * Returns true if the event target is a form control or content-editable
     * element that should receive keyboard input instead of the player.
     */
    function isEditableTarget(target) {
      if (!target || !target.tagName) return false;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return true;
      return target.isContentEditable === true;
    }

    function animateKeyIcon(className) {
      const element = document.querySelector('.' + className);
      element.classList.add('js-key-icon-pressed');
      setTimeout(() => { element.classList.remove('js-key-icon-pressed'); }, 166);
    }
  }
})();
