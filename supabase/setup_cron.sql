-- Run this ONCE in the Supabase SQL Editor after deploying the `api` function.
-- Replace the two placeholder values first. The cron secret must match the CRON_SECRET
-- function secret you set with `npx supabase secrets set`.

select vault.create_secret('https://YOUR-PROJECT-REF.supabase.co', 'beseen_project_url');
select vault.create_secret('YOUR-CRON-SECRET', 'beseen_cron_secret');

-- Every 10 minutes: find phones that stopped reporting, send hourly attempt summaries.
select cron.schedule(
  'beseen-tick',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'beseen_project_url')
           || '/functions/v1/api/cron/tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'beseen_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- To check it's running:   select * from cron.job_run_details order by start_time desc limit 5;
-- To remove it:            select cron.unschedule('beseen-tick');
