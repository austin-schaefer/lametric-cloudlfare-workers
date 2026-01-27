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

    // Test endpoints for local development (only work on localhost)
    if (url.hostname === 'localhost' && path.startsWith('/test/')) {
      const appName = path.replace('/test/', '');
      const app = getAppByName(appName, env);

      if (!app) {
        return new Response(JSON.stringify({ error: 'App not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (!app.customScheduledHandler) {
        return new Response(JSON.stringify({ error: 'App has no scheduled handler' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      try {
        // Call handler without scheduledTime to skip throttling
        await app.customScheduledHandler(env);
        return new Response(JSON.stringify({ message: `${appName} handler executed successfully` }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error(`Test endpoint error for ${appName}:`, error);
        return new Response(JSON.stringify({ error: 'Handler execution failed' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // App endpoints: /apps/:appName
    const appMatch = path.match(/^\/apps\/([^/]+)$/);
    if (appMatch) {
      const appName = appMatch[1];
      const app = getAppByName(appName, env);

      if (!app) {
        return new Response(JSON.stringify({ error: 'App not found or disabled' }), {
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
          const mode = url.searchParams.get('mode') || 'allstats';
          const accountType = url.searchParams.get('accountType') || 'regular';

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

          // Validate mode
          if (!['allstats', 'top5', 'top10'].includes(mode)) {
            return new Response(JSON.stringify(
              createResponse([createFrame('Invalid mode', 'i72683')])
            ), {
              headers: { 'Content-Type': 'application/json' },
            });
          }

          // Validate accountType
          const validAccountTypes = ['regular', 'ironman', 'HCiron', 'UIM', 'GIM', 'HCGIM', 'URGIM'];
          if (!validAccountTypes.includes(accountType)) {
            return new Response(JSON.stringify(
              createResponse([createFrame('Invalid account type', 'i72683')])
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
          const response = app.formatResponse(data, username, period, mode, accountType);

          // Check if formatResponse returned an error frame
          // Error frames have single frame with specific error text patterns
          if (response.frames.length === 1) {
            const frameText = response.frames[0].text;
            const errorPatterns = ['No data', 'Invalid data', 'Invalid format', 'Incomplete data', 'Format error'];

            if (errorPatterns.some(pattern => frameText.includes(pattern))) {
              console.error('OSRS formatResponse returned error frame', {
                username,
                period,
                mode,
                accountType,
                errorText: frameText,
              });
            }
          }

          return new Response(JSON.stringify(response), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Scryfall app - custom request handling
        if (appName === 'scryfall') {
          const { VALID_CARD_TYPES } = await import('./apps/scryfall');
          const { createFrame, createResponse } = await import('./utils/lametric');

          // Extract and validate parameters
          const cardType = url.searchParams.get('cardType') || 'paper';
          const currency = url.searchParams.get('currency') || 'usd';

          // Validate cardType
          if (!VALID_CARD_TYPES.includes(cardType)) {
            return new Response(
              JSON.stringify(createResponse([createFrame('Invalid cardType', 'i3313')])),
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
          }

          // Validate currency
          const validCurrencies = ['usd', 'eur', 'tix', 'none'];
          if (!validCurrencies.includes(currency)) {
            return new Response(
              JSON.stringify(createResponse([createFrame('Invalid currency', 'i3313')])),
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
          }

          // Get data from KV for specific cardType
          const kvKey = `app:scryfall:${cardType}`;
          const cachedData = await env.CLOCK_DATA.get(kvKey);

          if (!cachedData) {
            return new Response(
              JSON.stringify(createResponse([createFrame('Loading...', 'i3313')])),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
          }

          const data = JSON.parse(cachedData);
          const response = app.formatResponse(data, cardType, currency);

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
