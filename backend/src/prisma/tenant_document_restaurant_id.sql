ALTER TABLE platform_tracker_documents
ADD COLUMN IF NOT EXISTS restaurant_id TEXT;

CREATE INDEX IF NOT EXISTS platform_tracker_documents_restaurant_id_idx
ON platform_tracker_documents (restaurant_id);

UPDATE platform_tracker_documents
SET restaurant_id = split_part(key, ':', 2)
WHERE restaurant_id IS NULL
  AND key LIKE '%:%';
