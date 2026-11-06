import React, { useState, useEffect, FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Typography, Box } from "@mui/material";
import { LockOutlined } from "@mui/icons-material";
import { useUserDispatch, login } from "../contexts";
import { LOCATOR_LOGIN_FORM, routes } from "../constants";
import { useSnackbar } from "notistack";
import { TextValidator, ValidatorForm } from "react-material-ui-form-validator";
import PasswordField from "../components/PasswordField";
import { usersService } from "../services";
import { OIDC_AUTO_REDIRECT } from "../_config/env.config";
import { useOidcEnabled } from "../_helpers/useOidcEnabled";
import { useT } from "../i18n";
import { tokens, type } from "../theme";
import { FieldLabel } from "./FieldLabel";

const LoginForm = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const { enqueueSnackbar } = useSnackbar();
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const dispatch = useUserDispatch();
  const oidcEnabled = useOidcEnabled();
  // Captured during the first render: LoginPage clears the fragment in an
  // effect, before the async OIDC flag below has resolved.
  const [isOidcCallback] = useState(
    () =>
      window.location.hash.includes("token=") ||
      window.location.hash.includes("error="),
  );

  useEffect(() => {
    // Do not auto-redirect while a callback result (token/error) is being
    // processed by LoginPage, otherwise we would bounce back to the IdP.
    // /login?local keeps the form for a local account beside SSO (045)
    if (
      oidcEnabled &&
      OIDC_AUTO_REDIRECT &&
      !new URLSearchParams(location.search).has("local") &&
      !isOidcCallback &&
      !usersService.isOidcLoggedOut()
    ) {
      usersService.startOidcLogin();
    }
  }, [oidcEnabled, isOidcCallback, location.search]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    login(dispatch, email, password)
      .then(() => {
        const locationState = location.state as { from: string } | null;
        navigate(locationState?.from ?? routes.HOME);
      })
      .catch((err) =>
        enqueueSnackbar(err, {
          variant: "error",
        }),
      );
  };

  if (oidcEnabled === undefined) {
    return null;
  }

  // with SSO, its button first; the form below is for local accounts (045)
  const sso = oidcEnabled && (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mb: 2 }}>
      <Button
        color="primary"
        variant="contained"
        size="large"
        fullWidth
        startIcon={<LockOutlined />}
        data-testid="oidcLoginBtn"
        onClick={() => usersService.startOidcLogin()}
        sx={{ height: 44 }}
      >
        {t("auth.sso")}
      </Button>
      <Box
        role="separator"
        data-testid="localSeparator"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          fontSize: type.small,
          color: tokens.textMuted,
          "&::before, &::after": {
            content: '""',
            flex: 1,
            height: "1px",
            bgcolor: tokens.border,
          },
        }}
      >
        {t("auth.orLocal")}
      </Box>
    </Box>
  );

  return (
    <ValidatorForm onSubmit={handleSubmit} instantValidate>
      <Box id={LOCATOR_LOGIN_FORM}>
        {sso}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div>
            <FieldLabel htmlFor="email">{t("auth.email")}</FieldLabel>
            <TextValidator
              validators={["isEmail"]}
              errorMessages={[t("auth.validEmail")]}
              id="email"
              name="email"
              value={email}
              placeholder={t("auth.emailPlaceholder")}
              type="text"
              variant="outlined"
              required
              fullWidth
              inputProps={{
                onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                  setEmail(event.target.value),
                "data-testid": "email",
              }}
            />
          </div>
          <PasswordField
            labelAbove
            password={password}
            setPassword={setPassword}
          />
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
          {/* beside SSO the local sign-in is the second way in (REQ-046-51) */}
          <Button
            type="submit"
            color={oidcEnabled ? "inherit" : "primary"}
            variant={oidcEnabled ? "outlined" : "contained"}
            size="large"
            fullWidth
            data-testid="loginBtn"
            data-variant={oidcEnabled ? "secondary" : "primary"}
            sx={{
              height: 44,
              ...(oidcEnabled && {
                borderColor: tokens.borderStrong,
                bgcolor: tokens.surface,
                color: tokens.text,
              }),
            }}
          >
            {t("auth.signIn")}
          </Button>
          <Typography
            sx={{
              fontSize: type.small,
              color: tokens.textMuted,
              textAlign: "center",
            }}
          >
            {t("auth.noAccount")}
          </Typography>
        </Box>
      </Box>
    </ValidatorForm>
  );
};

export default LoginForm;
