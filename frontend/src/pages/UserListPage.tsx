import React from "react";
import { Box, Typography } from "@mui/material";
import UserList from "../components/UserList";

const UserListPage = () => (
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
    <Typography variant="h4" component="h1">
      Users
    </Typography>
    <Box sx={{ flex: 1, minHeight: 0 }}>
      <UserList />
    </Box>
  </Box>
);

export default UserListPage;
