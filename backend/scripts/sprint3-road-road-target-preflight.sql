\set ON_ERROR_STOP on

-- Required values come from the owner-approved Supabase target record. The
-- PRODUCTION branch label and development/demo usage are separate facts.
\if :{?approved_project_name}
\else
  \echo 'approved_project_name is required'
  \quit 3
\endif
\if :{?approved_supabase_project_ref}
\else
  \echo 'approved_supabase_project_ref is required'
  \quit 3
\endif
\if :{?approved_endpoint_host}
\else
  \echo 'approved_endpoint_host is required'
  \quit 3
\endif
\if :{?approved_endpoint_port}
\else
  \echo 'approved_endpoint_port is required'
  \quit 3
\endif
\if :{?approved_branch_label}
\else
  \echo 'approved_branch_label is required'
  \quit 3
\endif
\if :{?approved_usage}
\else
  \echo 'approved_usage is required'
  \quit 3
\endif
\if :{?approved_database}
\else
  \echo 'approved_database is required'
  \quit 3
\endif
\if :{?approved_schema}
\else
  \echo 'approved_schema is required'
  \quit 3
\endif
\if :{?approved_connection_mode}
\else
  \echo 'approved_connection_mode is required'
  \quit 3
\endif
\if :{?approved_pooler_username}
\else
  \echo 'approved_pooler_username is required'
  \quit 3
\endif
\if :{?approved_tls_mode}
\else
  \echo 'approved_tls_mode is required'
  \quit 3
\endif

-- Pin the project reference and Shared Pooler Session Mode endpoint without
-- storing either value in this repository. The project-qualified username and
-- reconnect bind subsequent checks to the approved Supabase tenant; a backend
-- server IP is deliberately not treated as project identity behind the pooler.
SELECT :'approved_project_name' = 'horse-transport-system'
   AND :'approved_branch_label' = 'PRODUCTION'
   AND :'approved_usage' = 'OWNER_APPROVED_DEVELOPMENT_DEMO'
   AND :'approved_connection_mode' = 'SUPABASE_SHARED_POOLER_SESSION'
   AND :'approved_database' = 'postgres'
   AND :'approved_schema' = 'public'
   AND :'approved_endpoint_port' = '5432'
   AND :'approved_pooler_username' = 'postgres.' || :'approved_supabase_project_ref'
   AND :'approved_tls_mode' = 'require'
   AND md5(lower(:'approved_supabase_project_ref')) = '814cef875a841e006192296ac254dea7'
   AND md5(lower(:'approved_endpoint_host')) = '3b60ba7400f233a67f06bb00db897aa0'
  AS approved_target_identity \gset
\if :approved_target_identity
\else
  \echo 'Approved Supabase project, pooler mode, endpoint, username, TLS mode, branch label, usage, database, or schema does not match'
  \quit 3
\endif

SELECT format('postgresql://%s@%s:%s/%s?sslmode=%s',
              :'approved_pooler_username', :'approved_endpoint_host',
              :'approved_endpoint_port', :'approved_database', :'approved_tls_mode')
  AS approved_conninfo \gset
\set QUIET 1
\connect -reuse-previous=on :approved_conninfo
\unset QUIET
\unset approved_conninfo

BEGIN TRANSACTION READ ONLY;

SELECT set_config('hts.approved_project_name', :'approved_project_name', true) AS ignored \gset
SELECT set_config('hts.approved_branch_label', :'approved_branch_label', true) AS ignored \gset
SELECT set_config('hts.approved_usage', :'approved_usage', true) AS ignored \gset
SELECT set_config('hts.approved_connection_mode', :'approved_connection_mode', true) AS ignored \gset
SELECT set_config('hts.approved_tls_mode', :'approved_tls_mode', true) AS ignored \gset
SELECT set_config('hts.approved_database', :'approved_database', true) AS ignored \gset
SELECT set_config('hts.approved_schema', :'approved_schema', true) AS ignored \gset

DO $preflight$
DECLARE
  expected_schema text := current_setting('hts.approved_schema');
BEGIN
  IF current_setting('hts.approved_project_name') <> 'horse-transport-system'
      OR current_setting('hts.approved_branch_label') <> 'PRODUCTION'
      OR current_setting('hts.approved_usage') <> 'OWNER_APPROVED_DEVELOPMENT_DEMO'
      OR current_setting('hts.approved_connection_mode') <> 'SUPABASE_SHARED_POOLER_SESSION'
      OR current_setting('hts.approved_tls_mode') <> 'require' THEN
    RAISE EXCEPTION 'Owner-approved project identity, pooler mode, TLS mode, actual branch label, or QA usage does not match';
  END IF;
  IF current_database() <> current_setting('hts.approved_database') THEN
    RAISE EXCEPTION 'Connected database does not match the independently approved database';
  END IF;
  IF current_schema() <> expected_schema THEN
    RAISE EXCEPTION 'Connected schema does not match the independently approved schema';
  END IF;
  IF current_setting('transaction_read_only') <> 'on' THEN
    RAISE EXCEPTION 'Identity preflight must execute in a read-only transaction';
  END IF;
  IF to_regclass(format('%I.transport_orders', expected_schema)) IS NULL
      OR to_regclass(format('%I.route_plans', expected_schema)) IS NULL
      OR to_regclass(format('%I.route_legs', expected_schema)) IS NULL
      OR to_regclass(format('%I.road_vehicle_executions', expected_schema)) IS NULL
      OR to_regclass(format('%I.flyway_schema_history', expected_schema)) IS NULL THEN
    RAISE EXCEPTION 'Connected schema does not contain the expected application tables';
  END IF;
  IF (SELECT array_agg(version::text ORDER BY installed_rank)
      FROM flyway_schema_history
      WHERE type = 'SQL' AND success) IS DISTINCT FROM ARRAY['1', '2', '3', '5']::text[]
      OR EXISTS (SELECT 1 FROM flyway_schema_history WHERE type = 'SQL' AND NOT success) THEN
    RAISE EXCEPTION 'Connected schema does not have the expected successful Flyway history';
  END IF;
END
$preflight$;

SELECT current_database() AS database,
       current_schema() AS schema,
       :'approved_connection_mode' AS connection_mode,
       :'approved_pooler_username' = 'postgres.' || :'approved_supabase_project_ref'
         AS project_qualified_username_verified,
       :'approved_tls_mode' = 'require' AS client_pooler_tls_required,
       :'approved_branch_label' AS supabase_branch_label,
       :'approved_usage' AS owner_approved_usage,
       current_setting('transaction_read_only') AS transaction_read_only;

ROLLBACK;
