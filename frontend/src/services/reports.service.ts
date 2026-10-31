import { handleResponse, authHeader } from "../_helpers/service.helpers";
import { API_URL } from "../_config/env.config";
import {
  PublicReport,
  ReportLink,
  ReportSection,
} from "../types/buildOverview";

const JSON_HEADERS = { "Content-Type": "application/json" };

/** A build's report and its public links (031, ADR-0022). */
export const reportsService = {
  // the whole report for a signed-in person: the dialog's preview and its print
  get: (buildId: string): Promise<PublicReport> =>
    fetch(`${API_URL}/builds/${buildId}/report`, {
      headers: authHeader(),
    }).then(handleResponse),
  links: (buildId: string): Promise<ReportLink[]> =>
    fetch(`${API_URL}/builds/${buildId}/report-links`, {
      headers: authHeader(),
    }).then(handleResponse),
  createLink: (
    buildId: string,
    body: { sections: ReportSection[]; language: "en" | "uk"; days: number },
  ): Promise<ReportLink> =>
    fetch(`${API_URL}/builds/${buildId}/report-links`, {
      method: "POST",
      headers: { ...JSON_HEADERS, ...authHeader() },
      body: JSON.stringify(body),
    }).then(handleResponse),
  revokeLink: (id: string): Promise<void> =>
    fetch(`${API_URL}/report-links/${id}`, {
      method: "DELETE",
      headers: authHeader(),
    }).then(handleResponse),
  /**
   * The public report, without signing in. With the ETag of the last answer an
   * unchanged report comes back as 304: then this resolves to null.
   */
  getPublic: async (
    token: string,
    etag?: string,
  ): Promise<{ report: PublicReport; etag?: string } | null> => {
    const response = await fetch(
      `${API_URL}/public/reports/${encodeURIComponent(token)}`,
      { headers: etag ? { "If-None-Match": etag } : {} },
    );
    if (response.status === 304) return null;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return {
      report: await response.json(),
      etag: response.headers.get("ETag") ?? undefined,
    };
  },
};
