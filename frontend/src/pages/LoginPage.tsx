import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSnackbar } from "notistack";
import LoginForm from "../components/LoginForm";
import { AuthLayout } from "../components/AuthLayout";
import { setHelpSteps, useHelpDispatch, useUserDispatch } from "../contexts";
import { LOGIN_PAGE_STEPS, routes } from "../constants";
import { usersService } from "../services";
import { useT } from "../i18n";
import { useOidcEnabled } from "../_helpers/useOidcEnabled";

const LoginPage = () => {
  const helpDispatch = useHelpDispatch();
  const userDispatch = useUserDispatch();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useT();
  const oidcEnabled = useOidcEnabled();

  useEffect(() => {
    setHelpSteps(helpDispatch, LOGIN_PAGE_STEPS);
  });

  // Handle the redirect back from the OIDC provider. The token arrives in the
  // url fragment (see backend buildFrontendRedirect), so it never reaches the
  // server logs.
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = params.get("token");
    const error = params.get("error");

    if (!token && !error) {
      return;
    }

    // Drop the fragment so the token is not kept in history or bookmarked.
    window.history.replaceState(null, "", window.location.pathname);

    // a link with someone's token signs in nobody: only the tab that started the sign-in (REQ-052-07)
    if (token && !usersService.takesOidcToken(params.get("nonce"))) {
      enqueueSnackbar(t("auth.ssoNotStartedHere"), { variant: "warning" });
      return;
    }

    if (token) {
      usersService
        .completeOidcLogin(token)
        .then((user) => {
          userDispatch({ type: "success", payload: user });
          navigate(routes.HOME);
        })
        .catch((err) => enqueueSnackbar(err, { variant: "error" }));
    } else {
      enqueueSnackbar("SSO login failed.", { variant: "error" });
    }
  }, [enqueueSnackbar, navigate, userDispatch, t]);

  return (
    <AuthLayout
      title={t("auth.signIn")}
      subtitle={oidcEnabled ? t("auth.subtitleSso") : undefined}
    >
      <LoginForm />
    </AuthLayout>
  );
};

export default LoginPage;
