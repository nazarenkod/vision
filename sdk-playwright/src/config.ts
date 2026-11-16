// Ported from Visual Regression Tracker sdk-js 5.9.0 (src/helpers/config.helper.ts), Apache-2.0;
// see ../NOTICE. Vision names: VISION_* variables and vision.json, as in the Java SDK (ADR-0026).
// VRT_*, vrt.json and the deprecated baselineBranchName are not read.
import { existsSync, readFileSync } from 'fs';
import { Config } from './types';

const CONFIG_FILE_PATH = './vision.json';

export const readConfigFromFile = (config: Config): Config => {
  if (existsSync(CONFIG_FILE_PATH)) {
    const fileConfig = JSON.parse(readFileSync(CONFIG_FILE_PATH).toString());
    if (fileConfig.apiUrl) config.apiUrl = fileConfig.apiUrl;
    if (fileConfig.branchName) config.branchName = fileConfig.branchName;
    if (fileConfig.sourceBranch) config.sourceBranch = fileConfig.sourceBranch;
    if (fileConfig.project) config.project = fileConfig.project;
    if (fileConfig.apiKey) config.apiKey = fileConfig.apiKey;
    if (fileConfig.ciBuildId) config.ciBuildId = fileConfig.ciBuildId;
    if (fileConfig.enableSoftAssert !== undefined) config.enableSoftAssert = fileConfig.enableSoftAssert;
    if (fileConfig.httpTimeoutInSeconds !== undefined) config.httpTimeoutInSeconds = fileConfig.httpTimeoutInSeconds;
  }
  return config;
};

export const readConfigFromEnv = (config: Config): Config => {
  const env = process.env;
  if (env.VISION_APIURL) config.apiUrl = env.VISION_APIURL;
  if (env.VISION_BRANCHNAME) config.branchName = env.VISION_BRANCHNAME;
  if (env.VISION_SOURCEBRANCH) config.sourceBranch = env.VISION_SOURCEBRANCH;
  if (env.VISION_PROJECT) config.project = env.VISION_PROJECT;
  if (env.VISION_APIKEY) config.apiKey = env.VISION_APIKEY;
  if (env.VISION_CIBUILDID) config.ciBuildId = env.VISION_CIBUILDID;
  if (env.VISION_ENABLESOFTASSERT !== undefined) config.enableSoftAssert = env.VISION_ENABLESOFTASSERT === 'true';
  if (env.VISION_HTTPTIMEOUTINSECONDS) config.httpTimeoutInSeconds = Number(env.VISION_HTTPTIMEOUTINSECONDS);
  return config;
};

export const validateConfig = (config: Config): void => {
  if (!config.apiKey) throw new Error('apiKey is not specified');
  if (!config.branchName) throw new Error('branchName is not specified');
  if (!config.apiUrl) throw new Error('apiUrl is not specified');
  if (!config.project) throw new Error('project is not specified');
  const timeout = config.httpTimeoutInSeconds;
  if (timeout !== undefined && !(Number.isFinite(timeout) && timeout >= 0)) {
    throw new Error('httpTimeoutInSeconds must be a non-negative number of seconds, 0 for no limit');
  }
};
