-- Create a simple mapping table for Bexio work packages
CREATE TABLE IF NOT EXISTS public.bexio_work_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bexio_project_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bexio_work_packages ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bexio_work_packages' AND policyname = 'Everyone can view bexio work packages'
  ) THEN
    CREATE POLICY "Everyone can view bexio work packages" ON public.bexio_work_packages FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bexio_work_packages' AND policyname = 'Only admins can insert bexio work packages'
  ) THEN
    CREATE POLICY "Only admins can insert bexio work packages" ON public.bexio_work_packages FOR INSERT WITH CHECK (is_admin(auth.uid()));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bexio_work_packages' AND policyname = 'Only admins can update bexio work packages'
  ) THEN
    CREATE POLICY "Only admins can update bexio work packages" ON public.bexio_work_packages FOR UPDATE USING (is_admin(auth.uid()));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bexio_work_packages' AND policyname = 'Only admins can delete bexio work packages'
  ) THEN
    CREATE POLICY "Only admins can delete bexio work packages" ON public.bexio_work_packages FOR DELETE USING (is_admin(auth.uid()));
  END IF;
END $$;

-- Trigger for updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_bexio_work_packages_updated_at'
  ) THEN
    CREATE TRIGGER trg_bexio_work_packages_updated_at
    BEFORE UPDATE ON public.bexio_work_packages
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bwp_bexio_project_id ON public.bexio_work_packages(bexio_project_id);
CREATE INDEX IF NOT EXISTS idx_bwp_active ON public.bexio_work_packages(is_active);

-- Seed a few sample rows for project id 1 (only if none exist)
INSERT INTO public.bexio_work_packages (bexio_project_id, name, description, color)
SELECT 1, 'Analysis', 'Analysis tasks', '#06b6d4'
WHERE NOT EXISTS (SELECT 1 FROM public.bexio_work_packages WHERE bexio_project_id = 1);
INSERT INTO public.bexio_work_packages (bexio_project_id, name, description, color)
SELECT 1, 'Development', 'Development tasks', '#3b82f6'
WHERE NOT EXISTS (SELECT 1 FROM public.bexio_work_packages WHERE bexio_project_id = 1 AND name = 'Development');
INSERT INTO public.bexio_work_packages (bexio_project_id, name, description, color)
SELECT 1, 'Testing', 'QA tasks', '#22c55e'
WHERE NOT EXISTS (SELECT 1 FROM public.bexio_work_packages WHERE bexio_project_id = 1 AND name = 'Testing');