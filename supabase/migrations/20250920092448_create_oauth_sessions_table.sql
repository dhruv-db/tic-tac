-- Create OAuth sessions table for mobile authentication
CREATE TABLE IF NOT EXISTS public.oauth_sessions (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending',
  platform TEXT DEFAULT 'web',
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '5 minutes')
);

-- Enable RLS
ALTER TABLE public.oauth_sessions ENABLE ROW LEVEL SECURITY;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_status ON public.oauth_sessions(status);
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_expires_at ON public.oauth_sessions(expires_at);

-- Policies (allow all operations for now, can be restricted later)
CREATE POLICY "Allow all operations on oauth_sessions" ON public.oauth_sessions FOR ALL USING (true);

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_sessions()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.oauth_sessions
  WHERE expires_at < now();
END;
$$;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_oauth_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_oauth_sessions_updated_at
  BEFORE UPDATE ON public.oauth_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_oauth_sessions_updated_at();