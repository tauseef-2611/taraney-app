export type SectionType = 'refrain' | 'verse';
export interface Line { ur?: string; ro?: string; uncertain?: boolean }
export interface Section { id: string; type: SectionType; layout: 'couplet' | 'single'; lines: Line[] }
export interface SongDoc { sections: Section[]; structure: string[]; notes?: string[] }

/** Line-level timing only. `occ` indexes the sung structure. */
export interface TimedLine { occ: number; section: string; line: number; start_ms: number; end_ms?: number | null }

export interface Recording {
  id: string;
  kind: 'audio' | 'youtube';
  audio_url?: string | null;
  youtube_id?: string | null;
  label?: string | null;
  duration_ms?: number | null;
  sync_level: 0 | 1;
  lines: TimedLine[];
}

export interface Song {
  id: string;
  slug: string;
  title_ur?: string | null;
  title_ro?: string | null;
  genre?: string | null;
  themes?: string[];
  mood?: string | null;
  poet_ur?: string | null;
  poet_ro?: string | null;
  singer?: string | null;
  doc: SongDoc;
  recording?: Recording | null;
}
