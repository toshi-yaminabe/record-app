-- CreateTable
CREATE TABLE "transcripts" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "segment_no" INTEGER NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transcripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bunjins" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "icon" TEXT NOT NULL DEFAULT 'person',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bunjins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_trees" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'default',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rule_trees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_tree_nodes" (
    "id" TEXT NOT NULL,
    "rule_tree_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "type" TEXT NOT NULL DEFAULT 'condition',
    "label" TEXT NOT NULL DEFAULT '',
    "condition" TEXT,
    "bunjin_slug" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "rule_tree_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "published_versions" (
    "id" TEXT NOT NULL,
    "rule_tree_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "tree_json" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "published_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "rule_version_id" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "segments" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "segment_no" INTEGER NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "text" TEXT,
    "stt_status" TEXT NOT NULL DEFAULT 'PENDING',
    "stt_attempt_count" INTEGER NOT NULL DEFAULT 0,
    "bunjin_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date_key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "bunjin_id" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_executions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "week_key" TEXT NOT NULL,
    "proposal_id" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "swls_responses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date_key" TEXT NOT NULL,
    "q1" TEXT,
    "q2" TEXT,
    "q3" TEXT,
    "q4" TEXT,
    "q5" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "swls_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memories" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "bunjin_id" TEXT,
    "text" TEXT NOT NULL,
    "source_refs" TEXT NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audio_deletion_logs" (
    "id" TEXT NOT NULL,
    "segment_id" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL DEFAULT 'stt_complete',

    CONSTRAINT "audio_deletion_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transcripts_device_id_idx" ON "transcripts"("device_id");

-- CreateIndex
CREATE INDEX "transcripts_session_id_idx" ON "transcripts"("session_id");

-- CreateIndex
CREATE INDEX "bunjins_user_id_idx" ON "bunjins"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "bunjins_user_id_slug_key" ON "bunjins"("user_id", "slug");

-- CreateIndex
CREATE INDEX "rule_trees_user_id_idx" ON "rule_trees"("user_id");

-- CreateIndex
CREATE INDEX "rule_tree_nodes_rule_tree_id_idx" ON "rule_tree_nodes"("rule_tree_id");

-- CreateIndex
CREATE INDEX "rule_tree_nodes_parent_id_idx" ON "rule_tree_nodes"("parent_id");

-- CreateIndex
CREATE INDEX "published_versions_rule_tree_id_idx" ON "published_versions"("rule_tree_id");

-- CreateIndex
CREATE UNIQUE INDEX "published_versions_rule_tree_id_version_key" ON "published_versions"("rule_tree_id", "version");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_device_id_idx" ON "sessions"("device_id");

-- CreateIndex
CREATE INDEX "segments_session_id_idx" ON "segments"("session_id");

-- CreateIndex
CREATE INDEX "segments_user_id_idx" ON "segments"("user_id");

-- CreateIndex
CREATE INDEX "proposals_user_id_idx" ON "proposals"("user_id");

-- CreateIndex
CREATE INDEX "proposals_date_key_idx" ON "proposals"("date_key");

-- CreateIndex
CREATE INDEX "tasks_user_id_idx" ON "tasks"("user_id");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "weekly_executions_user_id_idx" ON "weekly_executions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_executions_user_id_week_key_proposal_id_key" ON "weekly_executions"("user_id", "week_key", "proposal_id");

-- CreateIndex
CREATE INDEX "swls_responses_user_id_idx" ON "swls_responses"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "swls_responses_user_id_date_key_key" ON "swls_responses"("user_id", "date_key");

-- CreateIndex
CREATE INDEX "memories_user_id_idx" ON "memories"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "audio_deletion_logs_segment_id_key" ON "audio_deletion_logs"("segment_id");

-- AddForeignKey
ALTER TABLE "rule_tree_nodes" ADD CONSTRAINT "rule_tree_nodes_rule_tree_id_fkey" FOREIGN KEY ("rule_tree_id") REFERENCES "rule_trees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_tree_nodes" ADD CONSTRAINT "rule_tree_nodes_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "rule_tree_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "published_versions" ADD CONSTRAINT "published_versions_rule_tree_id_fkey" FOREIGN KEY ("rule_tree_id") REFERENCES "rule_trees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_rule_version_id_fkey" FOREIGN KEY ("rule_version_id") REFERENCES "published_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "segments" ADD CONSTRAINT "segments_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "segments" ADD CONSTRAINT "segments_bunjin_id_fkey" FOREIGN KEY ("bunjin_id") REFERENCES "bunjins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_bunjin_id_fkey" FOREIGN KEY ("bunjin_id") REFERENCES "bunjins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_executions" ADD CONSTRAINT "weekly_executions_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_bunjin_id_fkey" FOREIGN KEY ("bunjin_id") REFERENCES "bunjins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_deletion_logs" ADD CONSTRAINT "audio_deletion_logs_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
