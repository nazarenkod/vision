import { createServer, IncomingMessage, Server } from 'http';
import { AddressInfo } from 'net';
import { JiraClient } from './jira.client';

// two real servers: fetch, not a mock, decides whether a redirect is followed
function listen(handle: (request: IncomingMessage) => { status: number; headers?: Record<string, string> }) {
  const seen: Array<{ url: string; authorization?: string }> = [];
  const server: Server = createServer((request, response) => {
    seen.push({ url: request.url ?? '', authorization: request.headers.authorization });
    const { status, headers } = handle(request);
    response.writeHead(status, { 'Content-Type': 'application/json', ...headers });
    response.end(status < 300 ? JSON.stringify({ key: 'MOB-1', fields: {} }) : '');
  });
  return new Promise<{ url: string; seen: typeof seen; close: () => Promise<void> }>((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({
        url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        seen,
        close: () => new Promise((done) => server.close(() => done())),
      })
    )
  );
}

describe('JiraClient and redirects (051)', () => {
  it('does not follow a redirect with the token', async () => {
    const elsewhere = await listen(() => ({ status: 200 }));
    const jira = await listen(() => ({
      status: 302,
      headers: { Location: `${elsewhere.url}/rest/api/2/issue/MOB-1` },
    }));
    try {
      const client = new JiraClient({ url: jira.url, token: 'personal-token' });

      await expect(client.getIssue('MOB-1')).rejects.toThrow(`redirected to ${elsewhere.url}/rest/api/2/issue/MOB-1`);
      expect(jira.seen).toHaveLength(1);
      expect(elsewhere.seen).toEqual([]);
    } finally {
      await Promise.all([jira.close(), elsewhere.close()]);
    }
  });

  it('reads an answer without a redirect as before', async () => {
    const jira = await listen(() => ({ status: 200 }));
    try {
      const issue = await new JiraClient({ url: jira.url, token: 'personal-token' }).getIssue('MOB-1');

      expect(issue.key).toBe('MOB-1');
      expect(jira.seen[0].authorization).toBe('Bearer personal-token');
    } finally {
      await jira.close();
    }
  });
});
