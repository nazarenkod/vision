import React, { useState, FormEvent } from "react";
import { TextField, Button, Typography, Box, Tabs, Tab } from "@mui/material";
import {
  newApiKey,
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
import PasswordField from "../components/PasswordField";
import { useOidcEnabled } from "../_helpers/useOidcEnabled";
import { JiraTokenCard } from "../components/JiraTokenCard";
import { GeminiKeyCard } from "../components/GeminiKeyCard";
import { ApiKeyCard } from "../components/ApiKeyCard";
import { AppearanceCard } from "../components/AppearanceCard";
import { labelOf, useT } from "../i18n";
import { FormCard } from "../components/FormCard";
import { FieldLabel } from "../components/FieldLabel";
import { tokens, type } from "../theme";
import { MIN_PASSWORD_LENGTH } from "../_helpers/users.helper";

const ProfilePage = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { t, tx } = useT();
  const { user } = useUserState();
  const authDispatch = useUserDispatch();
  const projectDispatch = useProjectDispatch();
  const { selectedProjectId } = useProjectState();
  const [email, setEmail] = useState(user?.email);
  const [firstName, setFirstName] = useState(user?.firstName);
  const [lastName, setLastName] = useState(user?.lastName);
  const [password, setPassword] = useState("");
  const [tabIndex, setTabIndex] = React.useState(0);
  // a new key is on this page until it is left; the server cannot show it again (044)
  const [newKey, setNewKey] = React.useState<string>();
  const shownKey = newKey ?? "YOUR_API_KEY";
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

  const configFile = `{
    "apiUrl": "${window._env_.REACT_APP_API_URL}",
    "apiKey": "${shownKey}",
    "project": "${selectedProjectId ?? "Default project"}",
    "branchName": "master",
    "ciBuildId": "commit_sha",
    "enableSoftAssert": false
}`;
  const envVariables = `
  VISION_APIURL="${window._env_.REACT_APP_API_URL}"
  VISION_APIKEY="${shownKey}"
  VISION_PROJECT="${selectedProjectId ?? "Default project"} "
  VISION_BRANCHNAME="master"
  VISION_CIBUILDID="commit_sha"
  VISION_ENABLESOFTASSERT=false
  `;

  const copySettings = () =>
    navigator.clipboard
      ?.writeText(tabIndex === 0 ? configFile : envVariables)
      .then(() => enqueueSnackbar(t("profile.copied"), { variant: "success" }))
      .catch(() => undefined);

  const downloadConfig = () => {
    const url = URL.createObjectURL(
      new Blob([configFile], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "vision.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const saveButton = (
    <Button type="submit" variant="outlined" data-testid="submit">
      {t("profile.save")}
    </Button>
  );

  const settingsField = (id: string, value: string, help: string) => (
    <TextField
      id={id}
      name={id}
      variant="outlined"
      disabled
      value={value}
      multiline
      rows={8}
      fullWidth
      helperText={help}
      sx={{
        "& textarea": {
          fontFamily: tokens.mono,
          fontSize: type.caption,
          lineHeight: 1.5,
        },
      }}
    />
  );

  return (
    <Box sx={{ px: { xs: 2, md: 5 }, py: 4 }}>
      {/* one column: a person reads their profile top to bottom (REQ-046-52) */}
      <Box
        data-testid="profileColumn"
        sx={{
          maxWidth: 760,
          mx: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <Typography variant="h4" component="h1" sx={{ mb: 0.5 }}>
          {t("profile.title")}
        </Typography>
        <ValidatorForm onSubmit={handleUserUpdateSubmit} instantValidate>
          <FormCard
            data-testid="accountCard"
            title={t("profile.account")}
            // only an admin changes a role, on the Users page
            aside={tx("profile.roleSetBy", {
              role: (
                <Box
                  component="b"
                  data-testid="profileRole"
                  sx={{ color: tokens.text, fontWeight: 600 }}
                >
                  {labelOf(t, "role", user?.role ?? "") || user?.role}
                </Box>
              ),
            })}
            footer={saveButton}
          >
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, minmax(0, 1fr))",
                },
                gap: 2,
              }}
            >
              <div>
                <FieldLabel htmlFor="firstName">
                  {t("profile.firstName")}
                </FieldLabel>
                <TextValidator
                  validators={["minStringLength:2"]}
                  errorMessages={[errorForTwoChar]}
                  id="firstName"
                  name="firstName"
                  value={firstName}
                  type="text"
                  variant="outlined"
                  size="small"
                  required
                  fullWidth
                  inputProps={{
                    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                      setFirstName(event.target.value),
                    "data-testid": "firstName",
                  }}
                />
              </div>
              <div>
                <FieldLabel htmlFor="lastName">
                  {t("profile.lastName")}
                </FieldLabel>
                <TextValidator
                  validators={["minStringLength:2"]}
                  errorMessages={[errorForTwoChar]}
                  id="lastName"
                  name="lastName"
                  value={lastName}
                  type="text"
                  variant="outlined"
                  size="small"
                  required
                  fullWidth
                  inputProps={{
                    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                      setLastName(event.target.value),
                    "data-testid": "lastName",
                  }}
                />
              </div>
            </Box>
            <div>
              <FieldLabel htmlFor="email">{t("profile.email")}</FieldLabel>
              <TextValidator
                validators={["isEmail"]}
                errorMessages={[t("profile.validEmail")]}
                id="email"
                name="email"
                value={email}
                type="text"
                variant="outlined"
                size="small"
                required
                fullWidth
                // The identity provider owns the email of SSO users.
                disabled={oidcEnabled !== false}
                inputProps={{
                  onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                    setEmail(event.target.value),
                  "data-testid": "email",
                }}
              />
            </div>
          </FormCard>
        </ValidatorForm>
        {oidcEnabled === false && (
          <ValidatorForm onSubmit={handlePasswordUpdateSubmit} instantValidate>
            <FormCard
              data-testid="passwordCard"
              title={t("profile.password")}
              footer={saveButton}
            >
              <Box sx={{ maxWidth: 356 }}>
                <PasswordField
                  isNew
                  labelAbove
                  size="small"
                  password={password}
                  setPassword={setPassword}
                  label={t("profile.newPassword")}
                  helperText={t("profile.passwordHint", {
                    count: MIN_PASSWORD_LENGTH,
                  })}
                />
              </Box>
            </FormCard>
          </ValidatorForm>
        )}
        <JiraTokenCard />
        <GeminiKeyCard />
        <ApiKeyCard
          ending={user?.apiKeyEnding}
          newKey={newKey}
          onNewKey={() =>
            user &&
            newApiKey(authDispatch, user)
              .then(setNewKey)
              .catch((err) => enqueueSnackbar(err, { variant: "error" }))
          }
          footer={
            <>
              <Button
                color="inherit"
                onClick={copySettings}
                data-testid="copySdkSettings"
              >
                {t("profile.copy")}
              </Button>
              <Button
                variant="outlined"
                onClick={downloadConfig}
                data-testid="downloadConfig"
              >
                {t("profile.downloadConfig")}
              </Button>
            </>
          }
        >
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Typography sx={{ fontSize: type.small, fontWeight: 600 }}>
              {t("profile.sdkSettings")}
            </Typography>
            <ProjectSelect
              onProjectSelect={(id) => selectProject(projectDispatch, id)}
            />
            <Tabs
              value={tabIndex}
              indicatorColor="primary"
              textColor="primary"
              onChange={(event: React.ChangeEvent<unknown>, value: number) =>
                setTabIndex(value)
              }
            >
              <Tab label={t("profile.configFile")} />
              <Tab label={t("profile.env")} />
            </Tabs>
            <div role="tabpanel" hidden={tabIndex !== 0}>
              {tabIndex === 0 &&
                settingsField(
                  "configFile",
                  configFile,
                  t("profile.configHelp"),
                )}
            </div>
            <div role="tabpanel" hidden={tabIndex !== 1}>
              {tabIndex === 1 &&
                settingsField(
                  "envVariables",
                  envVariables,
                  t("profile.envHelp"),
                )}
            </div>
          </Box>
        </ApiKeyCard>
        <AppearanceCard />
      </Box>
    </Box>
  );
};

export default ProfilePage;
