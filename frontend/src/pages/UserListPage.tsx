import React from "react";
import { Box, InputAdornment, TextField, Typography } from "@mui/material";
import { Search } from "@mui/icons-material";
import UserList from "../components/UserList";
import { useUserState } from "../contexts";

const UserListPage = () => {
  const { userList } = useUserState();
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
          Users
        </Typography>
        <Typography color="textSecondary">
          {userList.length} {userList.length === 1 ? "person" : "people"}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <TextField
          size="small"
          placeholder="Search people"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          inputProps={{
            "aria-label": "Search people",
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
