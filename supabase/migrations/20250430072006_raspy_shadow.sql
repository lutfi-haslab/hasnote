/*
  # Initial database schema

  1. New Tables
    - `users`
      - `id` (uuid, primary key)
      - `email` (text, unique)
      - `name` (text, nullable)
      - `avatar_url` (text, nullable)
      - `created_at` (timestamp)
    - `pages`
      - `id` (uuid, primary key)
      - `title` (text)
      - `content` (jsonb)
      - `type` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
      - `parent_id` (uuid, nullable, references pages)
      - `is_pinned` (boolean)
      - `user_id` (uuid, references auth.users)
    - `todo_items`
      - `id` (uuid, primary key)
      - `text` (text)
      - `completed` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
      - `page_id` (uuid, references pages)
    - `page_links`
      - `id` (uuid, primary key)
      - `source_page_id` (uuid, references pages)
      - `target_page_id` (uuid, references pages)
      - `created_at` (timestamp)
  
  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid REFERENCES auth.users PRIMARY KEY,
  email text UNIQUE NOT NULL,
  name text,
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

-- Create pages table
CREATE TABLE IF NOT EXISTS pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content jsonb DEFAULT '{}'::jsonb,
  type text NOT NULL CHECK (type IN ('note', 'todo')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  parent_id uuid REFERENCES pages(id) ON DELETE SET NULL,
  is_pinned boolean DEFAULT false,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL
);

-- Create todo_items table
CREATE TABLE IF NOT EXISTS todo_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL,
  completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  page_id uuid REFERENCES pages(id) ON DELETE CASCADE NOT NULL
);

-- Create page_links table
CREATE TABLE IF NOT EXISTS page_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_page_id uuid REFERENCES pages(id) ON DELETE CASCADE NOT NULL,
  target_page_id uuid REFERENCES pages(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(source_page_id, target_page_id)
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_links ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "Users can view their own data" 
  ON users 
  FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own data" 
  ON users 
  FOR UPDATE 
  USING (auth.uid() = id);

-- Pages table policies
CREATE POLICY "Users can view their own pages" 
  ON pages 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pages" 
  ON pages 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pages" 
  ON pages 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pages" 
  ON pages 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Todo items policies
CREATE POLICY "Users can view todo items for their pages" 
  ON todo_items 
  FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM pages 
    WHERE pages.id = todo_items.page_id 
    AND pages.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert todo items for their pages" 
  ON todo_items 
  FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM pages 
    WHERE pages.id = todo_items.page_id 
    AND pages.user_id = auth.uid()
  ));

CREATE POLICY "Users can update todo items for their pages" 
  ON todo_items 
  FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM pages 
    WHERE pages.id = todo_items.page_id 
    AND pages.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete todo items for their pages" 
  ON todo_items 
  FOR DELETE 
  USING (EXISTS (
    SELECT 1 FROM pages 
    WHERE pages.id = todo_items.page_id 
    AND pages.user_id = auth.uid()
  ));

-- Page links policies
CREATE POLICY "Users can view page links for their pages" 
  ON page_links 
  FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM pages 
    WHERE pages.id = page_links.source_page_id 
    AND pages.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert page links for their pages" 
  ON page_links 
  FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM pages 
    WHERE pages.id = page_links.source_page_id 
    AND pages.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete page links for their pages" 
  ON page_links 
  FOR DELETE 
  USING (EXISTS (
    SELECT 1 FROM pages 
    WHERE pages.id = page_links.source_page_id 
    AND pages.user_id = auth.uid()
  ));

-- Create a trigger to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pages_updated_at
BEFORE UPDATE ON pages
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER todo_items_updated_at
BEFORE UPDATE ON todo_items
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Create a trigger to create a user profile after signup
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at)
  VALUES (NEW.id, NEW.email, NEW.created_at);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();