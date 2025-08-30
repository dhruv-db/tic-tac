-- Fix security vulnerability: Restrict projects table access
-- Remove the overly permissive policy that allows everyone to view projects
DROP POLICY "Everyone can view projects" ON public.projects;

-- Create more secure policies for project access
-- 1. Admins can view all projects (consistent with existing admin permissions)
CREATE POLICY "Admins can view all projects" 
ON public.projects 
FOR SELECT 
USING (is_admin(auth.uid()));

-- 2. Users can view projects where they are listed as project owner or manager
CREATE POLICY "Users can view assigned projects" 
ON public.projects 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL AND (
    project_owner = (SELECT email FROM public.profiles WHERE user_id = auth.uid()) OR
    project_manager = (SELECT email FROM public.profiles WHERE user_id = auth.uid())
  )
);