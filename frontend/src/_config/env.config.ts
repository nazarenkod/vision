export const API_URL = window._env_?.REACT_APP_API_URL;
export const VISION_VERSION = window._env_?.VISION_VERSION;
// When the backend has OIDC enabled, the login page redirects straight to the
// SSO provider instead of showing the "Login with SSO" button.
export const OIDC_AUTO_REDIRECT =
  window._env_?.REACT_APP_OIDC_AUTO_REDIRECT === "true";

declare global {
  interface Window {
    _env_: {
      REACT_APP_API_URL: string;
      REACT_APP_OIDC_AUTO_REDIRECT?: string;
      VISION_VERSION: string;
    };
  }
}
