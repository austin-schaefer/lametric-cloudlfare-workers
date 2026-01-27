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

  // Check if we're at the top of the hour (X:00)
  const currentTime = new Date(event.scheduledTime);
  const isTopOfHour = currentTime.getMinutes() === 0;

  const results = await Promise.allSettled(
    apps.map(async (app) => {
      try {
        // Throttle counter app to once per hour at X:00
        if (app.name === 'counter' && !isTopOfHour) {
          console.log('Skipping counter update (not top of hour)');
          return { app: app.name, success: true, skipped: true };
        }

        // Check for custom handler
        if (app.customScheduledHandler) {
          console.log(`Using custom handler for ${app.name}`);
          await app.customScheduledHandler(env, event.scheduledTime);
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
