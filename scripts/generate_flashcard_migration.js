#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read JSON files
const chainData = JSON.parse(fs.readFileSync(path.join(__dirname, '../karamazov_chain.json'), 'utf8'));
const chaptersData = JSON.parse(fs.readFileSync(path.join(__dirname, '../karamazov_chapters.json'), 'utf8'));

// Function to escape SQL strings
function escapeSql(str) {
    return str.replace(/'/g, "''");
}

// Generate SQL migration
let sql = `-- Populate flashcards from JSON data
-- This migration adds the actual flashcard content to the database

DO $$
DECLARE
    chain_set_id UUID;
    chapters_set_id UUID;
BEGIN
    -- Get the UUIDs for our flashcard sets
    SELECT id INTO chain_set_id FROM flashcard_sets WHERE set_id = 'chain';
    SELECT id INTO chapters_set_id FROM flashcard_sets WHERE set_id = 'chapters';
    
    -- Insert chain flashcards
`;

// Add chain flashcards
chainData.forEach((card, index) => {
    sql += `    INSERT INTO flashcards (set_id, card_index, front, back) VALUES (chain_set_id, ${index}, '${escapeSql(card.front)}', '${escapeSql(card.back)}');\n`;
});

sql += '\n    -- Insert chapter flashcards\n';

// Add chapter flashcards
chaptersData.forEach((card, index) => {
    sql += `    INSERT INTO flashcards (set_id, card_index, front, back) VALUES (chapters_set_id, ${index}, '${escapeSql(card.front)}', '${escapeSql(card.back)}');\n`;
});

sql += '\nEND $$;';

// Write to migration file
const migrationPath = path.join(__dirname, '../supabase/migrations/002_populate_flashcards.sql');
fs.writeFileSync(migrationPath, sql);

console.log(`Generated migration file: ${migrationPath}`);
console.log(`Chain cards: ${chainData.length}`);
console.log(`Chapter cards: ${chaptersData.length}`);
console.log(`Total cards: ${chainData.length + chaptersData.length}`);