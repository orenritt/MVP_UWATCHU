-- Add timezone column to commitments table
-- Stores IANA timezone identifier (e.g., 'America/New_York')
-- Set at intake time, used for all reminder scheduling

ALTER TABLE commitments ADD COLUMN timezone text DEFAULT 'America/New_York';
