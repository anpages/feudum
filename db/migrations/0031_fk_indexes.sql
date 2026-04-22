-- Add missing indexes on foreign key columns (Supabase unindexed_foreign_keys advisor)
CREATE INDEX IF NOT EXISTS idx_ether_transactions_user_id    ON ether_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_lf_building_queue_kingdom_id  ON lf_building_queue  (kingdom_id);
CREATE INDEX IF NOT EXISTS idx_lf_research_queue_kingdom_id  ON lf_research_queue  (kingdom_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id    ON push_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_research_queue_kingdom_id     ON research_queue     (kingdom_id);
