import React, { useState, useEffect, FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Grid, Typography, Box } from "@mui/material";
import { useUserDispatch, login } from "../contexts";
import { LOCATOR_LOGIN_FORM, routes } from "../constants";
import { useSnackbar } from "notistack";
import { TextValidator, ValidatorForm } from "react-material-ui-form-validator";
import PasswordField from "../components/PasswordField";
import { usersService } from "../services";
import { OIDC_AUTO_REDIRECT } from "../_config/env.config";
import { useOidcEnabled } from "../_helpers/useOidcEnabled";
import { useT } from "../i18n";

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
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mb: 3 }}>
      <Button
        color="primary"
        variant="contained"
        size="large"
        fullWidth
        data-testid="oidcLoginBtn"
        onClick={() => usersService.startOidcLogin()}
      >
        {t("auth.sso")}
      </Button>
      <Typography
        variant="body2"
        color="textSecondary"
        sx={{ textAlign: "center" }}
      >
        {t("auth.orLocal")}
      </Typography>
    </Box>
  );

  return (
    <ValidatorForm onSubmit={handleSubmit} instantValidate>
      <Box id={LOCATOR_LOGIN_FORM}>
        {sso}
        <Grid container direction="column" spacing={2}>
          <Grid item>
            <TextValidator
              validators={["isEmail"]}
              errorMessages={[t("auth.validEmail")]}
              id="email"
              name="email"
              value={email}
              label={t("auth.email")}
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
          </Grid>

          <Grid item>
            <PasswordField password={password} setPassword={setPassword} />
          </Grid>
        </Grid>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 3 }}>
          <Button
            type="submit"
            color="primary"
            variant={oidcEnabled ? "outlined" : "contained"}
            size="large"
            fullWidth
            data-testid="loginBtn"
          >
            {t("auth.signIn")}
          </Button>
          <Typography
            variant="body2"
            color="textSecondary"
            sx={{ textAlign: "center" }}
          >
            {t("auth.noAccount")}
          </Typography>
        </Box>
      </Box>
    </ValidatorForm>
  );
};

export default LoginForm;
