import { z } from 'zod';

export const connectionOptions = {
  relationshipStyle: [
    'Monogamy',
    'Ethical non-monogamy',
    'Open relationship',
    'Figuring it out',
  ],
  datingPace: ['Chat first', 'Meet when comfortable', 'Take it slowly'],
  communicationPreference: ['Texting', 'Calls', 'In-person conversation'],
  values: [
    'Kindness',
    'Honesty',
    'Family',
    'Curiosity',
    'Independence',
    'Communication',
    'Growth',
    'Humor',
    'Adventure',
    'Stability',
  ],
  rhythm: [
    'Early bird',
    'Night owl',
    'Quiet weekends',
    'Social weekends',
    'A mix of both',
  ],
} as const;

export const connectionSchema = z.object({
  relationshipStyle: z
    .enum(connectionOptions.relationshipStyle)
    .or(z.literal(''))
    .default(''),
  datingPace: z
    .enum(connectionOptions.datingPace)
    .or(z.literal(''))
    .default(''),
  communicationPreference: z
    .enum(connectionOptions.communicationPreference)
    .or(z.literal(''))
    .default(''),
  values: z
    .array(z.enum(connectionOptions.values))
    .max(3)
    .refine((v) => new Set(v).size === v.length)
    .default([]),
  rhythm: z
    .array(z.enum(connectionOptions.rhythm))
    .max(2)
    .refine(
      (v) =>
        new Set(v).size === v.length &&
        !(v.includes('Early bird') && v.includes('Night owl')) &&
        v.filter((x) =>
          ['Quiet weekends', 'Social weekends', 'A mix of both'].includes(x),
        ).length <= 1,
    )
    .default([]),
  languages: z
    .array(z.string().trim().min(1).max(40))
    .max(10)
    .refine((v) => new Set(v.map((x) => x.toLowerCase())).size === v.length)
    .default([]),
});
export type ProfileConnection = z.infer<typeof connectionSchema>;
export const emptyConnection: ProfileConnection = connectionSchema.parse({});
export function connectionFromRow(
  row: Record<string, unknown> | null | undefined,
): ProfileConnection {
  try {
    const result = connectionSchema.safeParse({
      relationshipStyle: row?.relationship_style || '',
      datingPace: row?.dating_pace || '',
      communicationPreference: row?.communication_preference || '',
      values: JSON.parse(
        typeof row?.values_json === 'string' ? row.values_json : '[]',
      ),
      rhythm: JSON.parse(
        typeof row?.rhythm_json === 'string' ? row.rhythm_json : '[]',
      ),
      languages: JSON.parse(
        typeof row?.languages_json === 'string' ? row.languages_json : '[]',
      ),
    });
    return result.success ? result.data : emptyConnection;
  } catch {
    return emptyConnection;
  }
}
