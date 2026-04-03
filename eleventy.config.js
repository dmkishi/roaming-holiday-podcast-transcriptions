export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy('site/css');
  eleventyConfig.addPassthroughCopy('site/js');

  eleventyConfig.addFilter('formatTimestamp', (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${mins}:${String(secs).padStart(2, '0')}`;
  });

  eleventyConfig.addFilter('formatDate', (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  });

  return {
    dir: {
      input: 'site',
      output: 'dist',
    },
  };
}
