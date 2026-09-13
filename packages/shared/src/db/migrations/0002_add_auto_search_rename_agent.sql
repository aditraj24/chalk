-- Chalk migration: Add auto_search column to chats and migrate explore -> agent mode
ALTER TABLE chats ADD COLUMN IF NOT EXISTS auto_search BOOLEAN NOT NULL DEFAULT true;

-- Update existing explore chats to agent
UPDATE chats SET mode = 'agent' WHERE mode = 'explore';
