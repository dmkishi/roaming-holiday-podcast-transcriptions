import { z } from 'zod';

export const MetadataFileSchema = z.object({
  episodeNumber: z.number().int().positive(),
  title: z.string(),
  description: z.string(),
  pubDate: z.string(),
  duration: z.object({
    seconds: z.number(),
    timestamp: z.string(),
    human: z.string(),
  }),
  imageUrl: z.string(),
  mp3Url: z.string(),
});

export const VadOutputSchema = z.object({
  duration: z.number(),
  speech: z.array(z.object({ start: z.number(), end: z.number() })),
});

export const VadFileSchema = VadOutputSchema.extend({
  gaps: z.array(z.object({ start: z.number(), end: z.number(), duration: z.number() })),
});

const FadeSpanSchema = z.object({
  start: z.number(),
  end: z.number(),
  type: z.enum(['in', 'out']),
});

export const FadeOutputSchema = z.object({
  duration: z.number(),
  fades: z.array(FadeSpanSchema),
});

export const FadeFileSchema = FadeOutputSchema;

const SegmentSchema = z.object({
  id: z.number(),
  start: z.number(),
  end: z.number(),
  text: z.string(),
});

export const TranscriptFileSchema = z.object({
  text: z.string().default(''),
  segments: z.array(SegmentSchema).optional(),
});

const ParagraphSegmentSchema = SegmentSchema.omit({ id: true });

export const ParagraphFileSchema = z.object({
  segments: z.array(z.array(ParagraphSegmentSchema)),
});

export const ParagraphGroupFileSchema = z.object({
  groupStarts: z.array(z.number().int().nonnegative()),
  fades: z.array(FadeSpanSchema),
});
