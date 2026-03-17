-- Learning materials: résumés de cours, vidéos, fiches de révision
-- Displayed inline to students on the Apprendre page

CREATE TABLE IF NOT EXISTS learning_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
  material_type TEXT NOT NULL CHECK (material_type IN ('resume', 'video', 'fiche')),
  title TEXT NOT NULL,
  description TEXT,
  -- For résumés & fiches: HTML content (converted from Word via mammoth.js)
  content_html TEXT,
  -- For vidéos: YouTube/external URL
  video_url TEXT,
  -- For vidéos: uploaded file path in storage
  video_storage_path TEXT,
  -- Original uploaded file (kept as backup)
  storage_path TEXT,
  file_name TEXT,
  file_size INTEGER,
  -- Metadata
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE learning_materials ENABLE ROW LEVEL SECURITY;

-- Students can read active materials
CREATE POLICY "Students can read active learning materials"
  ON learning_materials FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Admins can do everything
CREATE POLICY "Admins can manage learning materials"
  ON learning_materials FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Storage bucket for learning materials (videos, PDFs as backup)
INSERT INTO storage.buckets (id, name, public)
VALUES ('learning-materials', 'learning-materials', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Public read access for learning materials"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'learning-materials');

CREATE POLICY "Admin upload learning materials"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'learning-materials'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin delete learning materials"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'learning-materials'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
