export type NoteTheme =
  | 'yellow'
  | 'green'
  | 'pink'
  | 'purple'
  | 'blue'
  | 'charcoal'
  | 'grey';

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

export interface NoteSummary {
  id: string;
  title: string;
  color_theme: NoteTheme;
  is_pinned: boolean;
  is_open: boolean;
  is_archived: boolean;
  preview: string;
  task_summary?: {
    total: number;
    completed: number;
    pending: number;
  };
  created_at: number;
  updated_at: number;
}

export interface ChecklistItem {
  index: number;
  text: string;
  checked: boolean;
  line_number: number;
}

export interface TipTapNode {
  type: string;
  attrs?: Record<string, any>;
  content?: TipTapNode[];
  marks?: Array<{ type: string; attrs?: Record<string, any> }>;
  text?: string;
}

export interface TipTapDoc {
  type: 'doc';
  content?: TipTapNode[];
}
