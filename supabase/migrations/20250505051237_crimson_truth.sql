/*
  # Add KMS (Key Management System) tables

  1. New Tables
    - `user_pins`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `pin_hash` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `encrypted_secrets`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text)
      - `encrypted_data` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create user_pins table
CREATE TABLE IF NOT EXISTS user_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  pin_hash text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Create encrypted_secrets table
CREATE TABLE IF NOT EXISTS encrypted_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  encrypted_data text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE user_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE encrypted_secrets ENABLE ROW LEVEL SECURITY;

-- User pins policies
CREATE POLICY "Users can view their own pin"
  ON user_pins
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pin"
  ON user_pins
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pin"
  ON user_pins
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Encrypted secrets policies
CREATE POLICY "Users can view their own secrets"
  ON encrypted_secrets
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own secrets"
  ON encrypted_secrets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own secrets"
  ON encrypted_secrets
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own secrets"
  ON encrypted_secrets
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add updated_at triggers
CREATE TRIGGER user_pins_updated_at
  BEFORE UPDATE ON user_pins
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER encrypted_secrets_updated_at
  BEFORE UPDATE ON encrypted_secrets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();