import { Env } from './types';
import { getAppByName } from './apps';
import { scheduled } from './scheduled';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Health check endpoint
    if (path === '/health') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // App endpoints: /apps/:appName
    const appMatch = path.match(/^\/apps\/([^/]+)$/);
    if (appMatch) {
      const appName = appMatch[1];
      const app = getAppByName(appName);

      if (!app) {
        return new Response(JSON.stringify({ error: 'App not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      try {
        // OSRS app has custom request handling
        if (appName === 'osrs') {
          const { addCharacterToRegistry } = await import('./apps/osrs');
          const { createFrame, createResponse } = await import('./utils/lametric');

          // Parse query parameters
          const username = url.searchParams.get('username');
          const period = url.searchParams.get('period') || 'day';

          // Handle validation request (LaMetric calls without parameters)
          if (!username) {
            return new Response(JSON.stringify(
              createResponse([createFrame('Configure username', 'i72683')])
            ), {
              headers: { 'Content-Type': 'application/json' },
            });
          }

          if (!['day', 'week', 'month'].includes(period)) {
            return new Response(JSON.stringify(
              createResponse([createFrame('Invalid period', 'i72683')])
            ), {
              headers: { 'Content-Type': 'application/json' },
            });
          }

          // Add to registry (idempotent - only writes if new user)
          await addCharacterToRegistry(env, username);

          // Fetch cached data from aggregated storage
          const allDataRaw = await env.CLOCK_DATA.get('app:osrs:alldata');

          if (!allDataRaw) {
            return new Response(JSON.stringify(
              createResponse([createFrame('Loading data...', 'i3313')])
            ), {
              headers: { 'Content-Type': 'application/json' },
            });
          }

          // Parse aggregated data and extract specific user/period
          const allData = JSON.parse(allDataRaw);
          const userData = allData[username];

          if (!userData || !userData[period]) {
            return new Response(JSON.stringify(
              createResponse([createFrame('Loading data...', 'i3313')])
            ), {
              headers: { 'Content-Type': 'application/json' },
            });
          }

          // Format and return
          const data = userData[period];
          const response = app.formatResponse(data, username, period);

          return new Response(JSON.stringify(response), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Standard app handling
        const cachedData = await env.CLOCK_DATA.get(app.kvKey);

        if (!cachedData) {
          return new Response(JSON.stringify({ error: 'No data available yet' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const data = JSON.parse(cachedData);
        const response = app.formatResponse(data);

        return new Response(JSON.stringify(response), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error(`Error serving app ${appName}:`, error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  },

  scheduled,
};
