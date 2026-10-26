ALTER TABLE drafts DROP CONSTRAINT IF EXISTS drafts_category_check;
ALTER TABLE drafts ADD CONSTRAINT drafts_category_check CHECK (category IN ('EMAIL', 'QUOTE', 'WHATSAPP', 'SMS', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'NOTE'))
