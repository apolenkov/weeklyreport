\set ON_ERROR_STOP on

SELECT 'CREATE DATABASE customreport_e2e'
WHERE NOT EXISTS (
  SELECT 1
  FROM pg_database
  WHERE datname = 'customreport_e2e'
)
\gexec
