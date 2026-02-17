-- Security fix:
-- Re-enable RLS and define explicit policies instead of globally disabling RLS.

-- Keep Prisma migration metadata table outside RLS controls.
ALTER TABLE IF EXISTS public._prisma_migrations DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS for application tables.
ALTER TABLE IF EXISTS public.transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bunjins ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rule_trees ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rule_tree_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.published_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.weekly_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.swls_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audio_deletion_logs ENABLE ROW LEVEL SECURITY;

-- Drop previous versions of policies if present.
DROP POLICY IF EXISTS bunjins_owner_policy ON public.bunjins;
DROP POLICY IF EXISTS rule_trees_owner_policy ON public.rule_trees;
DROP POLICY IF EXISTS rule_tree_nodes_owner_policy ON public.rule_tree_nodes;
DROP POLICY IF EXISTS published_versions_owner_policy ON public.published_versions;
DROP POLICY IF EXISTS sessions_owner_policy ON public.sessions;
DROP POLICY IF EXISTS segments_owner_policy ON public.segments;
DROP POLICY IF EXISTS proposals_owner_policy ON public.proposals;
DROP POLICY IF EXISTS tasks_owner_policy ON public.tasks;
DROP POLICY IF EXISTS weekly_executions_owner_policy ON public.weekly_executions;
DROP POLICY IF EXISTS swls_responses_owner_policy ON public.swls_responses;
DROP POLICY IF EXISTS memories_owner_policy ON public.memories;
DROP POLICY IF EXISTS user_settings_owner_policy ON public.user_settings;
DROP POLICY IF EXISTS audio_deletion_logs_owner_policy ON public.audio_deletion_logs;
DROP POLICY IF EXISTS transcripts_service_policy ON public.transcripts;

DROP POLICY IF EXISTS bunjins_service_policy ON public.bunjins;
DROP POLICY IF EXISTS rule_trees_service_policy ON public.rule_trees;
DROP POLICY IF EXISTS rule_tree_nodes_service_policy ON public.rule_tree_nodes;
DROP POLICY IF EXISTS published_versions_service_policy ON public.published_versions;
DROP POLICY IF EXISTS sessions_service_policy ON public.sessions;
DROP POLICY IF EXISTS segments_service_policy ON public.segments;
DROP POLICY IF EXISTS proposals_service_policy ON public.proposals;
DROP POLICY IF EXISTS tasks_service_policy ON public.tasks;
DROP POLICY IF EXISTS weekly_executions_service_policy ON public.weekly_executions;
DROP POLICY IF EXISTS swls_responses_service_policy ON public.swls_responses;
DROP POLICY IF EXISTS memories_service_policy ON public.memories;
DROP POLICY IF EXISTS user_settings_service_policy ON public.user_settings;
DROP POLICY IF EXISTS audio_deletion_logs_service_policy ON public.audio_deletion_logs;
DROP POLICY IF EXISTS transcripts_postgres_policy ON public.transcripts;

DROP POLICY IF EXISTS bunjins_postgres_policy ON public.bunjins;
DROP POLICY IF EXISTS rule_trees_postgres_policy ON public.rule_trees;
DROP POLICY IF EXISTS rule_tree_nodes_postgres_policy ON public.rule_tree_nodes;
DROP POLICY IF EXISTS published_versions_postgres_policy ON public.published_versions;
DROP POLICY IF EXISTS sessions_postgres_policy ON public.sessions;
DROP POLICY IF EXISTS segments_postgres_policy ON public.segments;
DROP POLICY IF EXISTS proposals_postgres_policy ON public.proposals;
DROP POLICY IF EXISTS tasks_postgres_policy ON public.tasks;
DROP POLICY IF EXISTS weekly_executions_postgres_policy ON public.weekly_executions;
DROP POLICY IF EXISTS swls_responses_postgres_policy ON public.swls_responses;
DROP POLICY IF EXISTS memories_postgres_policy ON public.memories;
DROP POLICY IF EXISTS user_settings_postgres_policy ON public.user_settings;
DROP POLICY IF EXISTS audio_deletion_logs_postgres_policy ON public.audio_deletion_logs;

-- Owner policies (authenticated user can only access own rows).
CREATE POLICY bunjins_owner_policy ON public.bunjins
  FOR ALL TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY rule_trees_owner_policy ON public.rule_trees
  FOR ALL TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY rule_tree_nodes_owner_policy ON public.rule_tree_nodes
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rule_trees rt
      WHERE rt.id = rule_tree_id
        AND rt.user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rule_trees rt
      WHERE rt.id = rule_tree_id
        AND rt.user_id = auth.uid()::text
    )
  );

CREATE POLICY published_versions_owner_policy ON public.published_versions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rule_trees rt
      WHERE rt.id = rule_tree_id
        AND rt.user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rule_trees rt
      WHERE rt.id = rule_tree_id
        AND rt.user_id = auth.uid()::text
    )
  );

CREATE POLICY sessions_owner_policy ON public.sessions
  FOR ALL TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY segments_owner_policy ON public.segments
  FOR ALL TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY proposals_owner_policy ON public.proposals
  FOR ALL TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY tasks_owner_policy ON public.tasks
  FOR ALL TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY weekly_executions_owner_policy ON public.weekly_executions
  FOR ALL TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY swls_responses_owner_policy ON public.swls_responses
  FOR ALL TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY memories_owner_policy ON public.memories
  FOR ALL TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY user_settings_owner_policy ON public.user_settings
  FOR ALL TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY audio_deletion_logs_owner_policy ON public.audio_deletion_logs
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.segments s
      WHERE s.id = segment_id
        AND s.user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.segments s
      WHERE s.id = segment_id
        AND s.user_id = auth.uid()::text
    )
  );

-- transcripts table has no user_id; keep it service-only.
CREATE POLICY transcripts_service_policy ON public.transcripts
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Service-role policies for backend jobs/Edge Functions.
CREATE POLICY bunjins_service_policy ON public.bunjins FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY rule_trees_service_policy ON public.rule_trees FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY rule_tree_nodes_service_policy ON public.rule_tree_nodes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY published_versions_service_policy ON public.published_versions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY sessions_service_policy ON public.sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY segments_service_policy ON public.segments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY proposals_service_policy ON public.proposals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY tasks_service_policy ON public.tasks FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY weekly_executions_service_policy ON public.weekly_executions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY swls_responses_service_policy ON public.swls_responses FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY memories_service_policy ON public.memories FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY user_settings_service_policy ON public.user_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY audio_deletion_logs_service_policy ON public.audio_deletion_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Prisma backend (DATABASE_URL user is typically postgres in Supabase).
CREATE POLICY transcripts_postgres_policy ON public.transcripts FOR ALL TO postgres USING (true) WITH CHECK (true);
CREATE POLICY bunjins_postgres_policy ON public.bunjins FOR ALL TO postgres USING (true) WITH CHECK (true);
CREATE POLICY rule_trees_postgres_policy ON public.rule_trees FOR ALL TO postgres USING (true) WITH CHECK (true);
CREATE POLICY rule_tree_nodes_postgres_policy ON public.rule_tree_nodes FOR ALL TO postgres USING (true) WITH CHECK (true);
CREATE POLICY published_versions_postgres_policy ON public.published_versions FOR ALL TO postgres USING (true) WITH CHECK (true);
CREATE POLICY sessions_postgres_policy ON public.sessions FOR ALL TO postgres USING (true) WITH CHECK (true);
CREATE POLICY segments_postgres_policy ON public.segments FOR ALL TO postgres USING (true) WITH CHECK (true);
CREATE POLICY proposals_postgres_policy ON public.proposals FOR ALL TO postgres USING (true) WITH CHECK (true);
CREATE POLICY tasks_postgres_policy ON public.tasks FOR ALL TO postgres USING (true) WITH CHECK (true);
CREATE POLICY weekly_executions_postgres_policy ON public.weekly_executions FOR ALL TO postgres USING (true) WITH CHECK (true);
CREATE POLICY swls_responses_postgres_policy ON public.swls_responses FOR ALL TO postgres USING (true) WITH CHECK (true);
CREATE POLICY memories_postgres_policy ON public.memories FOR ALL TO postgres USING (true) WITH CHECK (true);
CREATE POLICY user_settings_postgres_policy ON public.user_settings FOR ALL TO postgres USING (true) WITH CHECK (true);
CREATE POLICY audio_deletion_logs_postgres_policy ON public.audio_deletion_logs FOR ALL TO postgres USING (true) WITH CHECK (true);
