/**
 * Shows a timestamp tooltip that follows the cursor while hovering transcript
 * words.
 */
(function() {
  'use strict';

  const transcript = document.querySelector<HTMLElement>('[data-transcript]');
  if (!transcript) return;

  const tooltip = document.createElement('div');
  tooltip.className = 'timeline-tooltip';
  tooltip.hidden = true;
  document.body.append(tooltip);

  /**
   * Formats seconds as `M:SS` or `H:MM:SS`.
   */
  function formatTime(seconds: number): string {
    const hrs = Math.floor(seconds / 3_600);
    const mins = Math.floor((seconds % 3_600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return hrs + ':' + String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
    }
    return mins + ':' + String(secs).padStart(2, '0');
  }

  transcript.addEventListener('mouseover', (evt: MouseEvent) => {
    if (!(evt.target instanceof Element)) return;
    const span = evt.target.closest('span[data-start]');
    if (!(span instanceof HTMLElement)) return;
    tooltip.textContent = formatTime(parseFloat(span.dataset['start'] ?? ''));
    tooltip.hidden = false;
  });

  transcript.addEventListener('mousemove', (evt: MouseEvent) => {
    if (tooltip.hidden !== false) return;
    tooltip.style.left = evt.clientX + 12 + 'px';
    tooltip.style.top = evt.clientY - 28 + 'px';
  });

  transcript.addEventListener('mouseout', (evt: MouseEvent) => {
    if (!(evt.target instanceof Element)) return;
    const span = evt.target.closest('span[data-start]');
    if (!span) return;
    tooltip.hidden = true;
  });
})();
