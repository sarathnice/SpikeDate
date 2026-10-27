CREATE TABLE message_reactions (
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL CONSTRAINT message_reactions_emoji_check CHECK (emoji IN ('❤️', '😂', '👍', '😊', '🔥')),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (message_id, user_id)
);
