/**
 * Shows a timestamp tooltip that follows the cursor while hovering transcript
 * words.
 */
(function initTimeline() {
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

  transcript.addEventListener('mousemove', (evt: MouseEvent) => {
    const segment = evt.target instanceof Element
      ? evt.target.closest<HTMLElement>('.segment')
      : undefined;
    if (!segment) {
      tooltip.hidden = true;
      return;
    }
    tooltip.textContent = formatTime(Number(segment.dataset['start'] ?? ''));
    tooltip.hidden = false;
    tooltip.style.left = evt.clientX + 12 + 'px';
    tooltip.style.top = evt.clientY - 28 + 'px';
  });

  transcript.addEventListener('mouseleave', () => {
    tooltip.hidden = true;
  });
})();
