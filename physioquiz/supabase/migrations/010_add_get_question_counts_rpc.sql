-- Migration 010: RPC function to get question counts grouped by topic
-- Used by the frontend to display question counts in the topic tree
-- without fetching all question rows.

CREATE OR REPLACE FUNCTION get_question_counts_by_topic()
RETURNS TABLE(topic_id uuid, question_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT q.topic_id, COUNT(*) AS question_count
  FROM questions q
  WHERE q.is_active = true
  GROUP BY q.topic_id;
$$;
