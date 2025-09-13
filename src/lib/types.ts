import { z } from 'zod';

// OpenAlex API Response Types
export const OpenAlexGroupSchema = z.object({
  key: z.string(),
  key_display_name: z.string().optional(),
  count: z.number(),
});

export const OpenAlexFunderSchema = z.object({
  id: z.string(),
  display_name: z.string(),
  country_code: z.string().nullable(),
  counts_by_year: z.array(z.object({
    year: z.number(),
    works_count: z.number(),
  })).optional(),
});

export const OpenAlexTopicSchema = z.object({
  id: z.string(),
  display_name: z.string(),
  score: z.number().optional(),
  hint: z.string().optional(),
  works_count: z.number().optional(),
  cited_by_count: z.number().optional(),
  entity_type: z.string().optional(),
  external_id: z.string().optional(),
});

export const OpenAlexAutocompleteSchema = z.object({
  id: z.string(),
  display_name: z.string(),
  hint: z.string().optional(),
  works_count: z.number().optional(),
  cited_by_count: z.number().optional(),
  entity_type: z.string().optional(),
  external_id: z.string().optional(),
});

export const OpenAlexTextResponseSchema = z.object({
  topics: z.array(OpenAlexTopicSchema),
  primary_topic: OpenAlexTopicSchema.optional(),
});

// Application Types
export const GraphNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  country: z.string().nullable(),
  count: z.number(),
  trend: z.array(z.object({
    year: z.number(),
    works_count: z.number(),
  })).optional(),
  topics: z.array(z.object({
    id: z.string(),
    name: z.string(),
    count: z.number(),
  })).optional(),
  countries: z.array(z.object({
    code: z.string(),
    count: z.number(),
  })).optional(),
});

export const GraphEdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  weight: z.number(),
});

export const GraphResponseSchema = z.object({
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
  meta: z.object({
    fromYear: z.number(),
    topicIds: z.array(z.string()),
  }),
});

// Request Types
export const AnnotateRequestSchema = z.object({
  title: z.string().optional(),
  abstract: z.string().optional(),
});

export const LeaderboardRequestSchema = z.object({
  topicIds: z.array(z.string()),
  years: z.number().optional(),
});

export const GraphRequestSchema = z.object({
  topicIds: z.array(z.string()),
  years: z.number().optional(),
});

// TypeScript Types
export type OpenAlexGroup = z.infer<typeof OpenAlexGroupSchema>;
export type OpenAlexFunder = z.infer<typeof OpenAlexFunderSchema>;
export type OpenAlexTopic = z.infer<typeof OpenAlexTopicSchema>;
export type OpenAlexAutocomplete = z.infer<typeof OpenAlexAutocompleteSchema>;
export type OpenAlexTextResponse = z.infer<typeof OpenAlexTextResponseSchema>;

export type GraphNode = z.infer<typeof GraphNodeSchema>;
export type GraphEdge = z.infer<typeof GraphEdgeSchema>;
export type GraphResponse = z.infer<typeof GraphResponseSchema>;

export type AnnotateRequest = z.infer<typeof AnnotateRequestSchema>;
export type LeaderboardRequest = z.infer<typeof LeaderboardRequestSchema>;
export type GraphRequest = z.infer<typeof GraphRequestSchema>;

// Helper types
export type FunderGroup = {
  key: string;
  count: number;
};

export type TopicMix = {
  id: string;
  name: string;
  count: number;
};

export type CountryMix = {
  code: string;
  count: number;
};
