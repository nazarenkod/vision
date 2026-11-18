import { TestVariation, Build } from "../types";
import { InspectorTree } from "../types/insights";
import { handleResponse, authHeader } from "../_helpers/service.helpers";
import { API_URL } from "../_config/env.config";

const ENDPOINT_URL = "/test-variations";

function getList(projectId: string): Promise<TestVariation[]> {
  const requestOptions = {
    method: "GET",
    headers: authHeader(),
  };

  return fetch(
    `${API_URL}${ENDPOINT_URL}?projectId=${projectId}`,
    requestOptions,
  ).then(handleResponse);
}

/** One version's UI tree in the baseline history; null when it was accepted without one (079). */
function getBaselineUiTree(
  id: string,
  baselineId: string,
): Promise<InspectorTree | null> {
  return fetch(
    `${API_URL}${ENDPOINT_URL}/${id}/baselines/${baselineId}/ui-tree`,
    { method: "GET", headers: authHeader() },
  )
    .then(handleResponse)
    .then((tree) => tree || null);
}

function getDetails(id: string): Promise<TestVariation> {
  const requestOptions = {
    method: "GET",
    headers: authHeader(),
  };

  return fetch(`${API_URL}${ENDPOINT_URL}/details/${id}`, requestOptions).then(
    handleResponse,
  );
}

function merge(
  projectId: string,
  fromBranch: string,
  toBranch: string,
): Promise<Build> {
  const requestOptions = {
    method: "GET",
    headers: authHeader(),
  };

  return fetch(
    `${API_URL}${ENDPOINT_URL}/merge?projectId=${projectId}&fromBranch=${fromBranch}&toBranch=${toBranch}`,
    requestOptions,
  ).then(handleResponse);
}

function remove(id: string): Promise<TestVariation> {
  const requestOptions = {
    method: "DELETE",
    headers: authHeader(),
  };

  return fetch(`${API_URL}${ENDPOINT_URL}/${id}`, requestOptions).then(
    handleResponse,
  );
}

export const testVariationService = {
  getList,
  getDetails,
  getBaselineUiTree,
  merge,
  remove,
};
