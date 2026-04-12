import { z } from 'zod';

export const MetadataFileSchema = z.object({
  title: z.string(),
  description: z.string(),
});

const SegmentSchema = z.object({
  id: z.number(),
  start: z.number(),
  end: z.number(),
  text: z.string(),
});

export const VadOutputSchema = z.object({
  duration: z.number(),
  speech: z.array(z.object({ start: z.number(), end: z.number() })),
});

export const TranscriptFileSchema = z.object({
  text: z.string().default(''),
  segments: z.array(SegmentSchema).optional(),
});

const ParagraphSegmentSchema = z.object({
  start: z.number(),
  end: z.number(),
  text: z.string(),
});

export const ParagraphFileSchema = z.object({
  text: z.array(z.string()),
  breaks: z.array(z.number().int().nonnegative()),
  segments: z.array(ParagraphSegmentSchema),
});

export const SummaryFileSchema = z.object({
  summary: z.string(),
  sections: z.array(z.object({ title: z.string(), sentences: z.string() })),
  places: z.array(z.string()),
  keywords: z.array(z.string()),
});
