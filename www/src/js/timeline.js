(function () {
  'use strict';

  var transcript = document.querySelector('[data-transcript]');
  if (!transcript) return;

  var tooltip = document.createElement('div');
  tooltip.className = 'timeline-tooltip';
  tooltip.hidden = true;
  document.body.appendChild(tooltip);

  function formatTime(seconds) {
    var hrs = Math.floor(seconds / 3600);
    var mins = Math.floor((seconds % 3600) / 60);
    var secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return hrs + ':' + String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
    }
    return mins + ':' + String(secs).padStart(2, '0');
  }

  transcript.addEventListener('mouseover', function (e) {
    var span = e.target.closest('span[data-start]');
    if (!span) return;
    tooltip.textContent = formatTime(parseFloat(span.dataset.start));
    tooltip.hidden = false;
  });

  transcript.addEventListener('mousemove', function (e) {
    if (tooltip.hidden) return;
    tooltip.style.left = e.clientX + 12 + 'px';
    tooltip.style.top = e.clientY - 28 + 'px';
  });

  transcript.addEventListener('mouseout', function (e) {
    var span = e.target.closest('span[data-start]');
    if (!span) return;
    tooltip.hidden = true;
  });
})();
