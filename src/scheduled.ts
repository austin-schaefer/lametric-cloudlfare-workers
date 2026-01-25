import { Env } from './types';
import { apps } from './apps';

export async function scheduled(
  event: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  console.log('Scheduled worker triggered at', new Date(event.scheduledTime).toISOString());

  const results = await Promise.allSettled(
    apps.map(async (app) => {
      try {
        console.log(`Fetching data for app: ${app.name}`);
        const data = await app.fetchData(env);
        await env.CLOCK_DATA.put(app.kvKey, JSON.stringify(data));
        console.log(`Successfully updated ${app.name}`);
        return { app: app.name, success: true };
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
