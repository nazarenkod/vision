import React, { useState, FormEvent } from "react";
import { Button, Grid, Box, Typography, Link as MuiLink } from "@mui/material";
import { useUserDispatch, login } from "../contexts";
import { usersService } from "../services";
import { useSnackbar } from "notistack";
import { TextValidator, ValidatorForm } from "react-material-ui-form-validator";
import { useNavigate, Link } from "react-router-dom";
import { routes } from "../constants";
import PasswordField from "../components/PasswordField";
import { useT } from "../i18n";

const RegisterForm = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const dispatch = useUserDispatch();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    usersService
      .register(firstName, lastName, email, password)
      .then(() => {
        enqueueSnackbar(t("auth.created"), {
          variant: "success",
        });
        login(dispatch, email, password).then(() => navigate(routes.HOME));
      })
      .catch((err) =>
        enqueueSnackbar(err, {
          variant: "error",
        }),
      );
  };

  const errorForTwoChar = t("validation.twoCharacters");

  return (
    <ValidatorForm onSubmit={handleSubmit} instantValidate>
      <Box>
        <Grid container direction="column" spacing={2}>
          <Grid item>
            <TextValidator
              validators={["minStringLength:2"]}
              errorMessages={[errorForTwoChar]}
              id="firstName"
              name="firstName"
              value={firstName}
              label={t("auth.firstName")}
              type="text"
              variant="outlined"
              required
              fullWidth
              inputProps={{
                onChange: (event: React.FormEvent<HTMLInputElement>) =>
                  setFirstName(event.target.value),
                "data-testid": "firstName",
              }}
            />
          </Grid>
          <Grid item>
            <TextValidator
              validators={["minStringLength:2"]}
              errorMessages={[errorForTwoChar]}
              id="lastName"
              name="lastName"
              value={lastName}
              label={t("auth.lastName")}
              type="text"
              variant="outlined"
              required
              fullWidth
              inputProps={{
                onChange: (event: React.FormEvent<HTMLInputElement>) =>
                  setLastName(event.target.value),
                "data-testid": "lastName",
              }}
            />
          </Grid>
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
                onChange: (event: React.FormEvent<HTMLInputElement>) =>
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
            variant="contained"
            size="large"
            fullWidth
            data-testid="submit"
          >
            {t("auth.createAccount")}
          </Button>
          <Typography
            variant="body2"
            color="textSecondary"
            sx={{ textAlign: "center" }}
          >
            {t("auth.haveAccount")}{" "}
            <MuiLink component={Link} to={routes.LOGIN}>
              {t("auth.signIn")}
            </MuiLink>
          </Typography>
        </Box>
      </Box>
    </ValidatorForm>
  );
};

export default RegisterForm;
