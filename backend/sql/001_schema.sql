-- Database schema for the novel review site (PostgreSQL / Neon).
-- Applied automatically by `npm run migrate` (and when the server starts).
-- Each .sql file in this folder runs once; applied files are tracked in schema_migrations.

-- ---------- Users ----------
-- Only people who sign in successfully are stored. We keep the minimum:
-- Google's stable id, email and display name. No passwords, no photos.
CREATE TABLE users (
  id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  google_sub    text NOT NULL UNIQUE,
  email         text NOT NULL,
  display_name  text NOT NULL DEFAULT '',
  role          text NOT NULL DEFAULT 'reviewer' CHECK (role IN ('author', 'reviewer')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_lower_idx ON users (lower(email));

-- ---------- Reviewer invitations ----------
-- The author's allow-list. A Google account can only sign in if its email is
-- listed here (not revoked) or is one of the AUTHOR_EMAILS in the server config.
CREATE TABLE reviewer_access (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email       text NOT NULL CHECK (email = lower(email) AND char_length(email) <= 254),
  note        text NOT NULL DEFAULT '' CHECK (char_length(note) <= 200),
  invited_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz,
  user_id     integer REFERENCES users (id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX reviewer_access_email_idx ON reviewer_access (email);

-- ---------- Book details (single row) ----------
CREATE TABLE book_details (
  id            smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  title         text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  author_name   text NOT NULL DEFAULT '' CHECK (char_length(author_name) <= 200),
  tagline       text NOT NULL DEFAULT '' CHECK (char_length(tagline) <= 300),
  synopsis      text NOT NULL DEFAULT '' CHECK (char_length(synopsis) <= 5000),
  reviewer_note text NOT NULL DEFAULT '' CHECK (char_length(reviewer_note) <= 5000),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
INSERT INTO book_details (id, title) VALUES (1, 'Is It Me or You as Well?');

-- ---------- Chapters ----------
-- A chapter row holds the author's WORKING COPY (title + content).
-- What reviewers see is the immutable snapshot in chapter_versions that
-- published_version points at. Saving a draft never changes what reviewers see.
CREATE TABLE chapters (
  id                integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chapter_number    integer NOT NULL UNIQUE CHECK (chapter_number BETWEEN 0 AND 9999),
  title             text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  content           text NOT NULL DEFAULT '' CHECK (char_length(content) <= 1000000),
  is_published      boolean NOT NULL DEFAULT false,
  published_version integer,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Every publish creates a new, permanent version.
CREATE TABLE chapter_versions (
  id             integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chapter_id     integer NOT NULL REFERENCES chapters (id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK (version_number >= 1),
  title          text NOT NULL,
  content        text NOT NULL,
  word_count     integer NOT NULL DEFAULT 0,
  change_note    text NOT NULL DEFAULT '' CHECK (char_length(change_note) <= 500),
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     integer REFERENCES users (id) ON DELETE SET NULL,
  UNIQUE (chapter_id, version_number)
);
CREATE INDEX chapter_versions_chapter_idx ON chapter_versions (chapter_id, version_number DESC);

-- The published pointer must refer to a real version of the same chapter.
ALTER TABLE chapters
  ADD CONSTRAINT chapters_published_version_fk
  FOREIGN KEY (id, published_version)
  REFERENCES chapter_versions (chapter_id, version_number);

-- Published versions can never be edited (only created, or removed with their chapter).
CREATE FUNCTION chapter_versions_immutable() RETURNS trigger AS $$
BEGIN
  IF NEW.chapter_id IS DISTINCT FROM OLD.chapter_id
     OR NEW.version_number IS DISTINCT FROM OLD.version_number
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.content IS DISTINCT FROM OLD.content THEN
    RAISE EXCEPTION 'chapter_versions rows are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chapter_versions_no_update
  BEFORE UPDATE ON chapter_versions
  FOR EACH ROW EXECUTE FUNCTION chapter_versions_immutable();

-- ---------- Retained uploads (Word / PDF files the author imported) ----------
-- The file bytes live in file storage; only metadata is stored here.
CREATE TABLE chapter_files (
  id                    integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chapter_id            integer NOT NULL REFERENCES chapters (id) ON DELETE CASCADE,
  original_name         text NOT NULL,
  file_type             text NOT NULL CHECK (file_type IN ('docx', 'pdf')),
  size_bytes            integer NOT NULL CHECK (size_bytes >= 0),
  sha256                text NOT NULL,
  storage_key           text NOT NULL UNIQUE,
  shared_with_reviewers boolean NOT NULL DEFAULT false,
  uploaded_at           timestamptz NOT NULL DEFAULT now(),
  uploaded_by           integer REFERENCES users (id) ON DELETE SET NULL,
  CHECK (NOT shared_with_reviewers OR file_type = 'pdf')
);
CREATE INDEX chapter_files_chapter_idx ON chapter_files (chapter_id);

-- ---------- Reviewer feedback ----------
CREATE TABLE feedback (
  id             integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chapter_id     integer NOT NULL REFERENCES chapters (id) ON DELETE CASCADE,
  user_id        integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK (version_number >= 1),
  category       text NOT NULL DEFAULT 'general'
                 CHECK (category IN ('general', 'plot', 'character', 'pacing', 'writing')),
  comment        text NOT NULL CHECK (char_length(comment) BETWEEN 1 AND 5000),
  is_read        boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX feedback_chapter_idx ON feedback (chapter_id, created_at);
CREATE INDEX feedback_user_idx ON feedback (user_id, created_at);
CREATE INDEX feedback_unread_idx ON feedback (created_at) WHERE NOT is_read;
