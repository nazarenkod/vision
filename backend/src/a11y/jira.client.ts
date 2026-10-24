export interface JiraConfig {
  url: string;
  token: string;
  // Jira Cloud authenticates with email + API token; Server/Data Center with a personal access token
  email?: string | null;
  issueType?: string | null;
  linkType?: string | null;
}

export interface JiraIssueDraft {
  summary: string;
  description: string;
  labels: string[];
  attachment?: { fileName: string; content: Buffer; contentType: string };
}

export class JiraError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
  }
}

const DEFAULT_ISSUE_TYPE = 'Bug';
const DEFAULT_LINK_TYPE = 'Relates';

/**
 * The few Jira REST v2 calls needed to file a bug next to an existing task.
 * v2 takes wiki markup in descriptions and is served by Cloud, Server and Data
 * Center alike.
 */
export class JiraClient {
  private readonly base: string;

  constructor(
    private readonly config: JiraConfig,
    private readonly fetchImpl: typeof fetch = fetch
  ) {
    this.base = config.url.replace(/\/+$/, '');
  }

  private authHeader(): string {
    return this.config.email
      ? `Basic ${Buffer.from(`${this.config.email}:${this.config.token}`).toString('base64')}`
      : `Bearer ${this.config.token}`;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.fetchImpl(`${this.base}${path}`, {
      ...init,
      headers: { Accept: 'application/json', Authorization: this.authHeader(), ...(init.headers ?? {}) },
    });
    const text = await response.text();
    if (!response.ok) {
      let detail = text.slice(0, 300);
      try {
        const body = JSON.parse(text);
        detail = [...(body.errorMessages ?? []), ...Object.values(body.errors ?? {})].join('; ') || detail;
      } catch {
        // not JSON: keep the raw text
      }
      throw new JiraError(
        `Jira ${init.method ?? 'GET'} ${path} failed (${response.status}): ${detail}`,
        response.status
      );
    }
    return (text ? JSON.parse(text) : undefined) as T;
  }

  browseUrl(key: string): string {
    return `${this.base}/browse/${key}`;
  }

  async getIssue(key: string): Promise<{ key: string; projectKey: string; summary: string }> {
    const issue = await this.request<{ key: string; fields: { project: { key: string }; summary: string } }>(
      `/rest/api/2/issue/${encodeURIComponent(key)}?fields=project,summary`
    );
    return { key: issue.key, projectKey: issue.fields.project.key, summary: issue.fields.summary };
  }

  /**
   * Files a bug in the project of `parentKey` and links it to that task. The
   * link and the attachment are best effort: a bug without them is still
   * better than no bug, so their failures come back as warnings.
   */
  async createLinkedIssue(
    parentKey: string,
    draft: JiraIssueDraft
  ): Promise<{ key: string; url: string; warnings: string[] }> {
    const parent = await this.getIssue(parentKey);
    const created = await this.request<{ key: string }>('/rest/api/2/issue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          project: { key: parent.projectKey },
          issuetype: { name: this.config.issueType || DEFAULT_ISSUE_TYPE },
          summary: draft.summary,
          description: draft.description,
          labels: draft.labels,
        },
      }),
    });

    const warnings: string[] = [];
    try {
      await this.request('/rest/api/2/issueLink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: { name: this.config.linkType || DEFAULT_LINK_TYPE },
          inwardIssue: { key: created.key },
          outwardIssue: { key: parent.key },
        }),
      });
    } catch (error) {
      warnings.push(`Not linked to ${parent.key}: ${error.message}`);
    }

    if (draft.attachment) {
      try {
        const form = new FormData();
        form.append(
          'file',
          new Blob([new Uint8Array(draft.attachment.content)], { type: draft.attachment.contentType }),
          draft.attachment.fileName
        );
        await this.request(`/rest/api/2/issue/${created.key}/attachments`, {
          method: 'POST',
          headers: { 'X-Atlassian-Token': 'no-check' },
          body: form,
        });
      } catch (error) {
        warnings.push(`Screenshot not attached: ${error.message}`);
      }
    }

    return { key: created.key, url: this.browseUrl(created.key), warnings };
  }
}
