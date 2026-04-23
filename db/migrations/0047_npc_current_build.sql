-- NPC deferred task tracking (effort system)
-- When a build/train takes > 60s, resources are consumed immediately but the
-- level/quantity is applied only when current_task->>'finishAt' is reached.
-- Shape: { type: 'building'|'unit', targetId, targetLevel|quantity, finishAt }
ALTER TABLE npc_state ADD COLUMN IF NOT EXISTS current_task jsonb;
