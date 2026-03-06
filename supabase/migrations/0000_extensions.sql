-- Extensions required by the app
create extension if not exists "pg_graphql" with schema extensions;
create extension if not exists "pg_stat_statements" with schema extensions;
create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "plpgsql" with schema extensions;
create extension if not exists "supabase_vault" with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
