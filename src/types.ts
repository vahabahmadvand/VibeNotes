export type NoteTheme = 'yellow' | 'green' | 'pink' | 'purple' | 'blue' | 'charcoal' | 'grey';

export interface Note {
  id: string;
  title: string;
  content_raw: string;
  content_json: string;
  color_theme: NoteTheme;
  is_always_on_top: boolean;
  is_open: boolean;
  is_pinned: boolean;
  is_archived: boolean;
  window_x: number;
  window_y: number;
  window_width: number;
  window_height: number;
  z_order: number;
  created_at: number;
  updated_at: number;
}

export interface UpdateNoteContentPayload {
  id: string;
  title?: string;
  content_raw: string;
  content_json: string;
  window_x?: number;
  window_y?: number;
  window_width?: number;
  window_height?: number;
}
