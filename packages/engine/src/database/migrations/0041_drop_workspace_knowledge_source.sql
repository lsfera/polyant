-- Normalize legacy knowledge_documents rows from the now-removed workspace sync.
-- Pre-deploy OSS: this affects only dev DBs that exercised the old sync endpoint.
UPDATE knowledge_documents SET source = 'upload' WHERE source = 'workspace';
