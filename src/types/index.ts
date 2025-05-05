export type User = {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
};

export type PageType = 'note' | 'todo';

export type Page = {
  id: string;
  title: string;
  content: any; // EditorJS data
  type: PageType;
  created_at: string;
  updated_at: string;
  parent_id: string | null;
  is_pinned: boolean;
  user_id: string;
};

export type TodoItem = {
  id: string;
  text: string;
  content: any;
  completed: boolean;
  created_at: string;
  updated_at: string;
  page_id: string;
};

export type PageLink = {
  id: string;
  source_page_id: string;
  target_page_id: string;
  created_at: string;
};
