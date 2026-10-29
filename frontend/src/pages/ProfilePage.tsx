import React, { useState, FormEvent } from "react";
import {
  Grid,
  Card,
  CardContent,
  TextField,
  CardActions,
  Button,
  Typography,
  Box,
  CardHeader,
  Tabs,
  Tab,
  Select,
  MenuItem,
} from "@mui/material";
import {
  useUserDispatch,
  useUserState,
  update,
  selectProject,
  useProjectDispatch,
  useProjectState,
} from "../contexts";
import { usersService } from "../services";
import { useSnackbar } from "notistack";
import ProjectSelect from "../components/ProjectSelect";
import { TextValidator, ValidatorForm } from "react-material-ui-form-validator";
import { Role } from "../types";
import PasswordField from "../components/PasswordField";
import { useOidcEnabled } from "../_helpers/useOidcEnabled";
import { JiraTokenCard } from "../components/JiraTokenCard";
import { GeminiKeyCard } from "../components/GeminiKeyCard";
import { ApiKeyCard, maskKey } from "../components/ApiKeyCard";
import { AppearanceCard } from "../components/AppearanceCard";
import { labelOf, useT } from "../i18n";

const ProfilePage = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useT();
  const { user } = useUserState();
  const authDispatch = useUserDispatch();
  const projectDispatch = useProjectDispatch();
  const { selectedProjectId } = useProjectState();
  const [email, setEmail] = useState(user?.email);
  const [firstName, setFirstName] = useState(user?.firstName);
  const [lastName, setLastName] = useState(user?.lastName);
  const [password, setPassword] = useState("");
  const [tabIndex, setTabIndex] = React.useState(0);
  // the key stays hidden, in the examples too, until someone asks for it
  const [keyRevealed, setKeyRevealed] = React.useState(false);
  const shownKey = keyRevealed ? user?.apiKey : maskKey(user?.apiKey);
  const oidcEnabled = useOidcEnabled();

  const handleUserUpdateSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (user && firstName && lastName && email) {
      update(authDispatch, {
        firstName,
        lastName,
        email,
      })
        .then(() =>
          enqueueSnackbar(t("profile.userUpdated"), {
            variant: "success",
          }),
        )
        .catch((err) =>
          enqueueSnackbar(err, {
            variant: "error",
          }),
        );
    }
  };

  const handlePasswordUpdateSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (user && password) {
      usersService
        .changePassword(password)
        .then(() => {
          setPassword("");
        })
        .then(() =>
          enqueueSnackbar(t("profile.passwordUpdated"), {
            variant: "success",
          }),
        )
        .catch((err) =>
          enqueueSnackbar(err, {
            variant: "error",
          }),
        );
    }
  };

  const errorForTwoChar = t("validation.twoCharacters");

  return (
    <Box sx={{ px: 4, py: 3, maxWidth: 1280 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 2 }}>
        {t("profile.title")}
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <Grid container spacing={1}>
            <Grid item xs={12}>
              <ValidatorForm onSubmit={handleUserUpdateSubmit} instantValidate>
                <Card variant="outlined">
                  <CardHeader title={t("profile.details")} />
                  <CardContent>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <TextValidator
                          validators={["minStringLength:2"]}
                          errorMessages={[errorForTwoChar]}
                          id="firstName"
                          name="firstName"
                          value={firstName}
                          label={t("profile.firstName")}
                          type="text"
                          variant="outlined"
                          required
                          fullWidth
                          inputProps={{
                            onChange: (
                              event: React.ChangeEvent<HTMLInputElement>,
                            ) => setFirstName(event.target.value),
                            "data-testid": "firstName",
                          }}
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextValidator
                          validators={["minStringLength:2"]}
                          errorMessages={[errorForTwoChar]}
                          id="lastName"
                          name="lastName"
                          value={lastName}
                          label={t("profile.lastName")}
                          type="text"
                          variant="outlined"
                          required
                          fullWidth
                          inputProps={{
                            onChange: (
                              event: React.ChangeEvent<HTMLInputElement>,
                            ) => setLastName(event.target.value),
                            "data-testid": "lastName",
                          }}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextValidator
                          validators={["isEmail"]}
                          errorMessages={[t("profile.validEmail")]}
                          id="email"
                          name="email"
                          value={email}
                          label={t("profile.email")}
                          type="text"
                          variant="outlined"
                          required
                          fullWidth
                          // The identity provider owns the email of SSO users.
                          disabled={oidcEnabled !== false}
                          inputProps={{
                            onChange: (
                              event: React.ChangeEvent<HTMLInputElement>,
                            ) => setEmail(event.target.value),
                            "data-testid": "email",
                          }}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <Select
                          variant="standard"
                          id="role"
                          labelId="role"
                          displayEmpty
                          fullWidth
                          disabled
                          value={user?.role}
                        >
                          {Object.entries(Role).map(([key, value]) => (
                            <MenuItem key={key} value={key}>
                              {labelOf(t, "role", key) || value}
                            </MenuItem>
                          ))}
                        </Select>
                      </Grid>
                    </Grid>
                  </CardContent>
                  <CardActions>
                    <Grid container justifyContent="center">
                      <Grid item>
                        <Button
                          type="submit"
                          color="primary"
                          variant="outlined"
                          data-testid="submit"
                        >
                          {t("profile.update")}
                        </Button>
                      </Grid>
                    </Grid>
                  </CardActions>
                </Card>
              </ValidatorForm>
            </Grid>
            {oidcEnabled === false && (
              <Grid item xs={12}>
                <ValidatorForm
                  onSubmit={handlePasswordUpdateSubmit}
                  instantValidate
                >
                  <Card variant="outlined">
                    <CardHeader title={t("profile.changePassword")} />
                    <CardContent>
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <PasswordField
                            password={password}
                            setPassword={setPassword}
                            label={t("profile.newPassword")}
                          />
                        </Grid>
                      </Grid>
                    </CardContent>
                    <CardActions>
                      <Grid container justifyContent="center">
                        <Grid item>
                          <Button
                            type="submit"
                            color="primary"
                            variant="outlined"
                            data-testid="submit"
                          >
                            {t("profile.update")}
                          </Button>
                        </Grid>
                      </Grid>
                    </CardActions>
                  </Card>
                </ValidatorForm>
              </Grid>
            )}
            <Grid item xs={12}>
              <AppearanceCard />
            </Grid>
          </Grid>
        </Grid>
        <Grid item xs={6}>
          <Grid container spacing={1}>
            <Grid item xs={12}>
              <JiraTokenCard />
            </Grid>
            <Grid item xs={12}>
              <GeminiKeyCard />
            </Grid>
            <Grid item xs={12}>
              <ApiKeyCard
                apiKey={user?.apiKey}
                revealed={keyRevealed}
                onReveal={setKeyRevealed}
              />
            </Grid>
            <Grid item xs={12}>
              <Card variant="outlined">
                <CardHeader title={t("profile.examples")} />
                <CardContent>
                  <ProjectSelect
                    onProjectSelect={(id) => selectProject(projectDispatch, id)}
                  />
                  <Tabs
                    variant="fullWidth"
                    value={tabIndex}
                    indicatorColor="primary"
                    textColor="primary"
                    onChange={(
                      event: React.ChangeEvent<unknown>,
                      newValue: number,
                    ) => {
                      setTabIndex(newValue);
                    }}
                  >
                    <Tab label={t("profile.configFile")} />
                    <Tab label={t("profile.env")} />
                  </Tabs>
                  <div role="tabpanel" hidden={tabIndex !== 0}>
                    {tabIndex === 0 && (
                      <Box p={3}>
                        <TextField
                          id="configFile"
                          name="configFile"
                          variant="outlined"
                          disabled
                          value={`{
    "apiUrl": "${window._env_.REACT_APP_API_URL}",
    "apiKey": "${shownKey}",
    "project": "${selectedProjectId ?? "Default project"}",
    "branchName": "master",
    "ciBuildId": "commit_sha",
    "enableSoftAssert": false
}`}
                          multiline
                          rows={8}
                          fullWidth
                          helperText={t("profile.configHelp")}
                        />
                      </Box>
                    )}
                  </div>
                  <div role="tabpanel" hidden={tabIndex !== 1}>
                    {tabIndex === 1 && (
                      <Box p={3}>
                        <TextField
                          id="envVariables"
                          name="envVariables"
                          variant="outlined"
                          disabled
                          value={`
  VRT_APIURL="${window._env_.REACT_APP_API_URL}"
  VRT_APIKEY="${shownKey}"
  VRT_PROJECT="${selectedProjectId ?? "Default project"} "
  VRT_BRANCHNAME="master"
  VRT_CIBUILDID="commit_sha"
  VRT_ENABLESOFTASSERT=false
  `}
                          multiline
                          rows={8}
                          fullWidth
                          helperText={t("profile.envHelp")}
                        />
                      </Box>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ProfilePage;
