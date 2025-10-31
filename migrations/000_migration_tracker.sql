-- Migration Tracker Table
-- This table tracks which migrations have been applied to the database

CREATE TABLE IF NOT EXISTS public.migrations (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    checksum TEXT,
    execution_time_ms INTEGER,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_migrations_name ON public.migrations(name);
CREATE INDEX IF NOT EXISTS idx_migrations_applied_at ON public.migrations(applied_at DESC);

-- RLS Policies (migrations should only be managed by admins)
ALTER TABLE public.migrations ENABLE ROW LEVEL SECURITY;

-- Only admins can view migrations
CREATE POLICY "Admins can view migrations" ON public.migrations
    FOR SELECT
    USING (is_claims_admin());

-- Only admins can insert migrations (via migration runner)
CREATE POLICY "Admins can insert migrations" ON public.migrations
    FOR INSERT
    WITH CHECK (is_claims_admin());

-- Helper function to check if a migration has been applied
CREATE OR REPLACE FUNCTION public.is_migration_applied(migration_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.migrations
        WHERE name = migration_name AND success = TRUE
    );
END;
$$;

-- Helper function to record a migration
CREATE OR REPLACE FUNCTION public.record_migration(
    migration_name TEXT,
    checksum_val TEXT DEFAULT NULL,
    exec_time INTEGER DEFAULT NULL,
    success_val BOOLEAN DEFAULT TRUE,
    error_msg TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.migrations (name, checksum, execution_time_ms, success, error_message)
    VALUES (migration_name, checksum_val, exec_time, success_val, error_msg)
    ON CONFLICT (name) DO UPDATE
    SET
        applied_at = NOW(),
        checksum = COALESCE(EXCLUDED.checksum, migrations.checksum),
        execution_time_ms = COALESCE(EXCLUDED.execution_time_ms, migrations.execution_time_ms),
        success = EXCLUDED.success,
        error_message = EXCLUDED.error_message;
END;
$$;

COMMENT ON TABLE public.migrations IS 'Tracks applied database migrations';
COMMENT ON FUNCTION public.is_migration_applied IS 'Checks if a migration has been successfully applied';
COMMENT ON FUNCTION public.record_migration IS 'Records a migration execution in the tracker';



