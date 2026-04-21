(function() {
  'use strict';

  const video = document.querySelector('.js-video');
  if (!video) return;

  initMiniPlayer(video);
  initTranscriptSync(video);

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
  function initTranscriptSync(video) {
    const transcript = document.querySelector('[data-transcript]');
    if (!transcript) return;

    const apiScript = document.createElement('script');
    apiScript.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(apiScript);

    const spans = Array.from(transcript.querySelectorAll('span[data-start]'))
      .map(function(el) {
        return {
          el,
          start: parseFloat(el.dataset.start),
        };
      });
    let currentIndex = -1;
    let intervalId = null;
    let player;

    window.onYouTubeIframeAPIReady = function() {
      player = new YT.Player(video, {
        events: {
          onReady: function() {
            transcript.addEventListener('dblclick', function(evt) {
              const span = evt.target.closest('span[data-start]');
              if (!span) return;
              player.seekTo(parseFloat(span.dataset.start), true);
              player.playVideo();
              window.getSelection().removeAllRanges(); // Deselect text.
            });
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
  }
})();
