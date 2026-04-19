-- Allow the owner to mark their own messages as read directly from the client.
-- Without this, messagesService.markAllRead() silently no-ops because RLS blocks
-- writes by default.

BEGIN;

DROP POLICY IF EXISTS "messages_update_own" ON "messages";

CREATE POLICY "messages_update_own"
  ON "messages" FOR UPDATE
  TO authenticated
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMIT;
