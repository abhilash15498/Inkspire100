-- Allow unnumbered chapters (e.g. Prologue, Epilogue, Author's Note)
ALTER TABLE chapters ALTER COLUMN chapter_number DROP NOT NULL;

-- Add sort_order column to control the reading order of chapters
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Backfill sort_order from existing chapter_number
UPDATE chapters SET sort_order = COALESCE(chapter_number, 0);

-- Index for ordering
CREATE INDEX IF NOT EXISTS chapters_sort_order_idx ON chapters (sort_order);

