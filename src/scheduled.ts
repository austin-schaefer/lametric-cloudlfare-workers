import { Env } from './types';
import { getEnabledApps } from './apps';

export async function scheduled(
  event: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  console.log('Scheduled worker triggered at', new Date(event.scheduledTime).toISOString());

  const apps = getEnabledApps(env);
  console.log('Enabled apps:', apps.map(app => app.name).join(', '));

  // Calculate which hourly interval we're in (for throttling)
  const runCount = Math.floor(event.scheduledTime / 300000); // 5-min intervals since epoch

  const results = await Promise.allSettled(
    apps.map(async (app) => {
      try {
        // Throttle counter app to once per hour (every 12th run)
        if (app.name === 'counter' && runCount % 12 !== 0) {
          console.log('Skipping counter update (not hourly interval)');
          return { app: app.name, success: true, skipped: true };
        }

        // Check for custom handler
        if (app.customScheduledHandler) {
          console.log(`Using custom handler for ${app.name}`);
          await app.customScheduledHandler(env);
          console.log(`Successfully updated ${app.name}`);
          return { app: app.name, success: true };
        } else {
          // Standard pattern with smart caching
          console.log(`Fetching data for app: ${app.name}`);
          const data = await app.fetchData(env);
          const newValue = JSON.stringify(data);

          // Smart caching: only write if data changed
          const existingValue = await env.CLOCK_DATA.get(app.kvKey);
          if (existingValue !== newValue) {
            await env.CLOCK_DATA.put(app.kvKey, newValue);
            console.log(`Successfully updated ${app.name} (data changed)`);
          } else {
            console.log(`Skipped ${app.name} update (no changes)`);
          }

          return { app: app.name, success: true };
        }
      } catch (error) {
        console.error(`Failed to update ${app.name}:`, error);
        return { app: app.name, success: false, error };
      }
    })
  );

  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  console.log(`Scheduled worker completed: ${successful} successful, ${failed} failed`);
}
