
-- Add attachments column to complaints
ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Storage RLS on the private bucket "complaint-attachments"
-- Paths are stored as: {user_id}/{uuid}-{filename}
-- So the first path segment must equal auth.uid()::text.

-- Patient can upload their own files
CREATE POLICY "complaint_attach_owner_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'complaint-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Patient can read their own files
CREATE POLICY "complaint_attach_owner_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'complaint-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Patient can delete their own files
CREATE POLICY "complaint_attach_owner_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'complaint-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Staff (admin/reception) can read all complaint attachments
CREATE POLICY "complaint_attach_staff_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'complaint-attachments'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'reception')
  )
);
