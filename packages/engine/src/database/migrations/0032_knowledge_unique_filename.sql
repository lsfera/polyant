-- Enforce unique filename per instance in knowledge_documents.
-- Needed for deterministic "load/write by name" operations exposed to agents
-- via getKnowledge / writeKnowledge tools.
ALTER TABLE "knowledge_documents"
  ADD CONSTRAINT "knowledge_docs_instance_filename_uniq"
  UNIQUE ("instance_id", "filename");
