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

export const VadFileSchema = z.object({
  duration: z.number(),
  gaps: z.array(z.object({ start: z.number(), end: z.number(), duration: z.number() })),
});

const FadeSchema = z.object({
  start: z.number(),
  end: z.number(),
  type: z.enum(['in', 'out']),
});
export type Fade = z.infer<typeof FadeSchema>;

export const FadesSchema = z.array(FadeSchema);

const FadePairSchema = z.object({
  outStart: z.number(),
  outEnd: z.number(),
  inStart: z.number(),
  inEnd: z.number(),
});
export type FadePair = z.infer<typeof FadePairSchema>;

export const FadeFileSchema = z.object({
  fades: z.array(FadePairSchema),
});

const SegmentSchema = z.object({
  id: z.number(),
  start: z.number(),
  end: z.number(),
  text: z.string(),
  words: z.array(
    z.object({
      text: z.string(),
      start: z.number(),
      end: z.number(),
      confidence: z.number().optional(),
    }),
  ),
});

export type Segment = z.infer<typeof SegmentSchema>;

export const TranscriptFileSchema = z.object({
  text: z.string().default(''),
  segments: z.array(SegmentSchema).optional(),
});

const ParagraphSegmentSchema = SegmentSchema.omit({ id: true });
const ParagraphSchema = z.array(ParagraphSegmentSchema);
const ParagraphGroupSchema = z.array(ParagraphSchema);

export type Paragraph = z.infer<typeof ParagraphSchema>;
export type ParagraphGroup = z.infer<typeof ParagraphGroupSchema>;

export const ParagraphFileSchema = z.object({
  paragraphGroups: z.array(ParagraphGroupSchema),
});
