-- Create work packages mapping table
CREATE TABLE public.work_packages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  project_id integer NOT NULL, -- References Bexio project ID
  service_id integer, -- Optional Bexio service/task ID
  color text DEFAULT '#3b82f6', -- For UI display
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.work_packages ENABLE ROW LEVEL SECURITY;

-- Create policies - work packages are shared across users but only admins can manage them
CREATE POLICY "Everyone can view work packages" 
ON public.work_packages 
FOR SELECT 
USING (true);

CREATE POLICY "Only admins can create work packages" 
ON public.work_packages 
FOR INSERT 
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admins can update work packages" 
ON public.work_packages 
FOR UPDATE 
USING (is_admin(auth.uid()));

CREATE POLICY "Only admins can delete work packages" 
ON public.work_packages 
FOR DELETE 
USING (is_admin(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_work_packages_updated_at
BEFORE UPDATE ON public.work_packages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some sample work packages
INSERT INTO public.work_packages (name, description, project_id, color) VALUES
('Development', 'Core development tasks', 1, '#10b981'),
('Testing', 'Quality assurance and testing', 1, '#f59e0b'),
('Documentation', 'Technical documentation', 1, '#6366f1'),
('Meetings', 'Project meetings and coordination', 1, '#8b5cf6'),
('Analysis', 'Requirements analysis and planning', 1, '#ef4444');