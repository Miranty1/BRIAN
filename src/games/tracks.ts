export const TRACK_IDS = ['math', 'verbal', 'memory', 'focus'] as const

export type TrackId = (typeof TRACK_IDS)[number]

export type Track = {
  id: TrackId
  name: string
  /** CSS colour value for the track's bold hue. */
  colour: string
  /** Low-contrast tint of the hue for surfaces. */
  soft: string
}

export const TRACKS: Record<TrackId, Track> = Object.fromEntries(
  TRACK_IDS.map((id) => [
    id,
    {
      id,
      name: id[0]!.toUpperCase() + id.slice(1),
      colour: `var(--track-${id})`,
      soft: `var(--track-${id}-soft)`,
    },
  ]),
) as Record<TrackId, Track>
