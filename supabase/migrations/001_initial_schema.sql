-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create accounts table
CREATE TABLE accounts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create flashcard_sets table
CREATE TABLE flashcard_sets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    set_id VARCHAR(50) UNIQUE NOT NULL,
    set_name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create flashcards table
CREATE TABLE flashcards (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    set_id UUID REFERENCES flashcard_sets(id) ON DELETE CASCADE,
    card_index INTEGER NOT NULL,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_progress table
CREATE TABLE user_progress (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    set_id UUID REFERENCES flashcard_sets(id) ON DELETE CASCADE,
    card_id UUID REFERENCES flashcards(id) ON DELETE CASCADE,
    is_correct BOOLEAN DEFAULT FALSE,
    times_seen INTEGER DEFAULT 0,
    times_correct INTEGER DEFAULT 0,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, card_id)
);

-- Create study_sessions table
CREATE TABLE study_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    set_id UUID REFERENCES flashcard_sets(id) ON DELETE CASCADE,
    cards_seen INTEGER DEFAULT 0,
    cards_correct INTEGER DEFAULT 0,
    session_score DECIMAL(5,2) DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE
);

-- Insert initial flashcard sets
INSERT INTO flashcard_sets (set_id, set_name, description) VALUES
('chain', 'Brothers Karamazov - Chain', 'Character relationships and key plot points'),
('chapters', 'Brothers Karamazov - Chapters', 'Chapter-by-chapter key events and themes');

-- Flashcards will be populated from the JSON data in the application
-- The application should call a function to sync the JSON data with the database

-- Create indexes for better performance
CREATE INDEX idx_accounts_username ON accounts(username);
CREATE INDEX idx_flashcards_set_id ON flashcards(set_id);
CREATE INDEX idx_user_progress_user_set ON user_progress(user_id, set_id);
CREATE INDEX idx_study_sessions_user_id ON study_sessions(user_id);

-- Row Level Security (RLS) policies
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;

-- Flashcard sets and cards are public (read-only)
ALTER TABLE flashcard_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;

-- Allow public read access to flashcard sets and cards
CREATE POLICY "Public can read flashcard_sets" ON flashcard_sets FOR SELECT USING (true);
CREATE POLICY "Public can read flashcards" ON flashcards FOR SELECT USING (true);

-- Users can only access their own data
CREATE POLICY "Users can manage their own account" ON accounts FOR ALL USING (auth.uid()::text = id::text);
CREATE POLICY "Users can manage their own progress" ON user_progress FOR ALL USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can manage their own sessions" ON study_sessions FOR ALL USING (auth.uid()::text = user_id::text);