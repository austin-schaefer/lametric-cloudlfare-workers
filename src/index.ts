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
