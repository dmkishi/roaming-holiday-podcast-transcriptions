import { discoverArtifactsOnce } from '#lib/eleventy/discover.ts';
import { episodeImagePath } from '#lib/eleventy/images.ts';
import { episodeLd, breadcrumbLd } from '#lib/eleventy/jsonLd.ts';
import { addTimelineMarkers } from '#lib/eleventy/timeline.ts';
import type { SiteEpisode } from '#lib/eleventy/types.ts';
import { episodeUrl } from '#lib/shared/paths.ts';
import { loadSupplements } from '#lib/shared/supplements.ts';

/**
 * Assemble every complete episode into `SiteEpisode[]` that Eleventy's
 * `episodes` global consumes.
 *
 * Console-silent and synchronous (no network): incomplete episodes (missing or
 * empty transcript) are skipped silently by `discoverArtifactsOnce`.
 */
export function buildEpisodes(): SiteEpisode[] {
  const supplements = loadSupplements();
  const episodes: SiteEpisode[] = [];

  for (const { rss, transcript } of discoverArtifactsOnce()) {
    const episodeNumber = rss.episodeNumber;
    const supplement = supplements.get(episodeNumber);

    const fields = {
      episodeNumber,
      url: episodeUrl(episodeNumber),
      imagePath: episodeImagePath(episodeNumber),
      supplement: {
        isInterlude: supplement?.isInterlude,
        location: supplement?.location,
        youtubeUrl: supplement?.youtube,
      },
      rss: {
        title: rss.title,
        description: rss.description,
        mp3Url: rss.mp3Url,
        duration: rss.duration,
        pubDate: rss.pubDate,
        imageUrl: rss.imageUrl,
      },
      paragraphGroups: addTimelineMarkers(transcript.paragraphGroups),
    };
    const jsonLd = [episodeLd(fields), breadcrumbLd(fields)];
    episodes.push({ ...fields, jsonLd });
  }

  return episodes.toSorted((a, b) => a.episodeNumber - b.episodeNumber);
}
