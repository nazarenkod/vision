import { routes } from "../constants";
import { usersService } from "../services";
import { User } from "../types";

// the jwt of the signed-in user, read fresh so a new login is picked up
export function storedToken(): string | undefined {
  const userString = localStorage.getItem("user");
  if (!userString) {
    return undefined;
  }
  const user: User = JSON.parse(userString);
  return user?.token || undefined;
}

export function authHeader() {
  // return authorization header with jwt token
  const token = storedToken();

  if (token) {
    return {
      Authorization: "Bearer " + token,
    };
  }

  return [];
}

// What a 401 from the API, or a rejected events socket, leads to.
export function logoutAndReload() {
  usersService.logout();
  // reload if not on login page
  if (window.location.pathname !== routes.LOGIN) {
    window.location.reload();
  }
}

export function handleResponse(response: Response) {
  return response.text().then((text: string) => {
    const data = text && JSON.parse(text);

    if (!response.ok) {
      if (response.status === 401) {
        // auto logout if 401 response returned from api
        logoutAndReload();
      }

      const error = data?.message || response.statusText;

      return Promise.reject(error);
    }

    return data;
  });
}
