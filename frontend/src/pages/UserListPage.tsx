import React from "react";
import {
  Box,
  Button,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import { Add, Search } from "@mui/icons-material";
import UserList from "../components/UserList";
import { NewUserDialog } from "../components/UserList/NewUserDialog";
import { Tooltip } from "../components/Tooltip";
import { usersService } from "../services";
import { useT } from "../i18n";

const UserListPage = () => {
  const { t } = useT();
  const [query, setQuery] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  // with LDAP or SSO, accounts come from the first sign-in (035)
  const [accountsEnabled, setAccountsEnabled] = React.useState<boolean>();
  React.useEffect(() => {
    let current = true;
    usersService
      .accountsEnabled()
      .then((enabled) => current && setAccountsEnabled(enabled));
    return () => {
      current = false;
    };
  }, []);
  return (
    <Box
      sx={{
        px: 4,
        py: 3,
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <Box
        className="v-enter"
        sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}
      >
        <Typography variant="h4" component="h1">
          {t("users.title")}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <TextField
          size="small"
          placeholder={t("users.search")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          inputProps={{
            "aria-label": t("users.search"),
            "data-testid": "userSearch",
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ width: 260 }}
        />
        <Tooltip title={accountsEnabled === false ? t("users.fromSso") : ""}>
          <span>
            <Button
              variant="contained"
              startIcon={<Add />}
              disabled={!accountsEnabled}
              onClick={() => setCreating(true)}
              data-testid="newUser"
            >
              {t("users.newUser")}
            </Button>
          </span>
        </Tooltip>
      </Box>
      <NewUserDialog open={creating} onClose={() => setCreating(false)} />
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <UserList query={query} />
      </Box>
    </Box>
  );
};

export default UserListPage;
