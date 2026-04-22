-- Allow users to delete their own messages
CREATE POLICY "messages_delete_own" ON messages
  FOR DELETE USING ((select auth.uid()) = user_id);
