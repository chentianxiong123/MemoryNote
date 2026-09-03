-- Add CHECK constraints on Conversation.source and Document.source
-- to prevent v1-era untyped values (e.g. '对话', '对话文档', 'unknown')
-- from being written again. Allowed values are enumerated below.
--
-- This migration also drops the v1 document_fts view, which used
-- to_tsvector('simple', ...) — that tokenizer splits on whitespace only
-- and is useless for CJK. v2 now does ILIKE-based search via @core/core.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversation_source_check') THEN
    ALTER TABLE "Conversation" ADD CONSTRAINT conversation_source_check
      CHECK (source IN ('upload','deepseek-export','core','simple-chat',
                        'persona','skill','import','whatsapp','task','onboarding'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_source_check') THEN
    ALTER TABLE "Document" ADD CONSTRAINT document_source_check
      CHECK (source IN ('upload','deepseek-export','core','simple-chat',
                        'persona','skill','import','whatsapp','task','onboarding'));
  END IF;
END
$$;

DROP VIEW IF EXISTS document_fts;
