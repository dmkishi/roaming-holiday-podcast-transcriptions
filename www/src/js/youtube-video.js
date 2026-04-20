(function () {
  'use strict';

  const video = document.querySelector('.js-video');
  if (!video) return;

  initMiniPlayer(video);
  initSeekOnDoubleClick(video);

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

    const observer = new IntersectionObserver(function (entries) {
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

    closeBtn.addEventListener('click', function () {
      video.classList.remove('js-video__is-mini');
      closeBtn.hidden = true;
      isDismissed = true;
    });

    video.parentElement.appendChild(closeBtn);
    observer.observe(sentinel);
  }

  /**
   * Double-clicking a transcript segment seeks the video to that timecode
   * and starts playback.
   */
  function initSeekOnDoubleClick(video) {
    const transcript = document.querySelector('[data-transcript]');
    if (!transcript) return;

    const apiScript = document.createElement('script');
    apiScript.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(apiScript);

    window.onYouTubeIframeAPIReady = function () {
      const player = new YT.Player(video, {
        events: {
          onReady: function () {
            transcript.addEventListener('dblclick', function (e) {
              const span = e.target.closest('span[data-start]');
              if (!span) return;
              player.seekTo(parseFloat(span.dataset.start), true);
              player.playVideo();
            });
          },
        },
      });
    };
  }
})();
