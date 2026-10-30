import { AllowedDevice, Project } from "../types";
import { handleResponse, authHeader } from "../_helpers/service.helpers";
import { API_URL } from "../_config/env.config";

const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
};

async function getAll(): Promise<Project[]> {
  const requestOptions = {
    method: "GET",
    headers: authHeader(),
  };

  const response = await fetch(`${API_URL}/projects`, requestOptions);
  return handleResponse(response);
}

/** Device and OS pairs the project's snapshots came from (REQ-029-11). */
async function getDevices(projectId: string): Promise<AllowedDevice[]> {
  const response = await fetch(`${API_URL}/projects/${projectId}/devices`, {
    method: "GET",
    headers: authHeader(),
  });
  return handleResponse(response);
}

async function remove(id: string): Promise<Project> {
  const requestOptions = {
    method: "DELETE",
    headers: authHeader(),
  };

  const response = await fetch(`${API_URL}/projects/${id}`, requestOptions);
  return handleResponse(response);
}

async function create(project: Partial<Project>): Promise<Project> {
  const requestOptions = {
    method: "POST",
    headers: {
      ...DEFAULT_HEADERS,
      ...authHeader(),
    },
    body: JSON.stringify(project),
  };

  const response = await fetch(`${API_URL}/projects`, requestOptions);
  return handleResponse(response);
}

async function update(project: Partial<Project>): Promise<Project> {
  const requestOptions = {
    method: "PUT",
    headers: {
      ...DEFAULT_HEADERS,
      ...authHeader(),
    },
    body: JSON.stringify(project),
  };

  const response = await fetch(`${API_URL}/projects`, requestOptions);
  return handleResponse(response);
}

/** Someone saved other settings after the page loaded them (REQ-018-53). */
export class SettingsConflict extends Error {
  constructor(
    message: string,
    public readonly fields: string[],
  ) {
    super(message);
  }
}

/**
 * Saves from the settings page: the settings as loaded go along, so a save
 * over someone else's is refused unless `force`.
 */
async function updateSettings(
  project: Partial<Project> & { jiraToken?: string },
  loadedSettings: Record<string, unknown>,
  force = false,
): Promise<Project> {
  const response = await fetch(`${API_URL}/projects`, {
    method: "PUT",
    headers: {
      ...DEFAULT_HEADERS,
      ...authHeader(),
    },
    body: JSON.stringify({ ...project, loadedSettings, force }),
  });
  if (response.status === 409) {
    const data = await response.json().catch(() => ({}));
    throw new SettingsConflict(
      data?.message ??
        "Someone changed these settings after you opened the page.",
      Array.isArray(data?.fields) ? data.fields : [],
    );
  }
  return handleResponse(response);
}

export const projectsService = {
  updateSettings,
  getAll,
  getDevices,
  remove,
  create,
  update,
};
