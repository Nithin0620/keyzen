import { sql } from './db';

export async function dispatchWebhooks(
  projectId: string,
  event: string,
  data: Record<string, any>
) {
  try {
    const webhooks = await sql`
      SELECT id, url, platform, events
      FROM webhooks
      WHERE project_id = ${projectId} AND is_active = true;
    `;

    if (webhooks.length === 0) return;

    for (const wh of webhooks) {
      if (wh.events && !wh.events.includes(event)) continue;

      let body: any;

      if (wh.platform === 'SLACK') {
        body = {
          text: `🔐 *Keyzen Security Alert* [${event}]\n*Project:* \`${projectId}\`\n*Details:* ${JSON.stringify(data, null, 2)}`,
        };
      } else if (wh.platform === 'DISCORD') {
        body = {
          content: `🔐 **Keyzen Security Alert** \`[${event}]\``,
          embeds: [
            {
              title: `Event: ${event}`,
              description: Object.entries(data)
                .map(([k, v]) => `**${k}:** ${v}`)
                .join('\n'),
              color: 2276958, // Green
              timestamp: new Date().toISOString(),
            },
          ],
        };
      } else {
        body = {
          event,
          projectId,
          timestamp: new Date().toISOString(),
          data,
        };
      }

      // Fire HTTP request with timeout
      fetch(wh.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      }).catch((err) => {
        console.error(`Webhook delivery failed to ${wh.url}:`, err.message);
      });
    }
  } catch (err: any) {
    console.error('Error in dispatchWebhooks:', err.message);
  }
}
