import React from "react";
import { Box, InputAdornment, TextField, Typography } from "@mui/material";
import { Search } from "@mui/icons-material";
import UserList from "../components/UserList";
import { useUserState } from "../contexts";
import { useT } from "../i18n";

const UserListPage = () => {
  const { userList } = useUserState();
  const { t } = useT();
  const [query, setQuery] = React.useState("");
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
        <Typography color="textSecondary">
          {t("users.people", { count: userList.length })}
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
      </Box>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <UserList query={query} />
      </Box>
    </Box>
  );
};

export default UserListPage;
