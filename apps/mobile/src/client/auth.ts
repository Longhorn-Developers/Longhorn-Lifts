import UserType from "@sure-walk/utils/types/user-type";
import axios from "axios";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

const apiEnvironmentOverride:
  | "development"
  | "preview"
  | "production"
  | undefined = "development";

const DEV_API_URL = `http://${Constants.expoConfig?.hostUri?.split(":").shift()}:3000/api`;
const PREVIEW_API_URL =
  "https://preview-lifts-web.longhorn-developers.workers.dev/api";
const PROD_API_URL = "https://lifts-web.longhorn-developers.workers.dev/api";

export const environment =
  apiEnvironmentOverride ?? process.env.EXPO_PUBLIC_APP_ENV;

let API_URL: string;
API_URL =
  environment === "production"
    ? PROD_API_URL
    : environment === "preview"
      ? PREVIEW_API_URL
      : DEV_API_URL;

export const registerGeneric = async ({
  firstName,
  lastName,
  eid = undefined,
  phoneNumber,
  requiresAssistance,
  userType,
}: {
  firstName: string;
  lastName: string;
  eid?: string;
  phoneNumber: string;
  requiresAssistance: boolean;
  userType: UserType;
}) => {
  const response = await axios.post(
    `${API_URL}/auth/register-generic`,
    {
      firstName,
      lastName,
      eid,
      phoneNumber,
      requiresAssistance,
      userType,
    },
    { validateStatus: () => true },
  );
  return response;
};

export const loginGeneric = async (phoneNumber: string) => {
  const response = await axios.post(
    `${API_URL}/auth/login-generic`,
    {
      phoneNumber,
    },
    { validateStatus: () => true },
  );
  return response;
};

export const confirmGeneric = async (code: string) => {
  const response = await axios.post(
    `${API_URL}/auth/confirm-generic`,
    {
      code,
    },
    { validateStatus: () => true },
  );
  return response;
};

export const logout = async (pushToken: string | undefined) => {
  const refreshToken = await SecureStore.getItemAsync("refreshToken");

  const response = await axios.post(
    `${API_URL}/auth/logout`,
    { refreshToken, pushToken },
    { validateStatus: () => true },
  );
  return response;
};

export { API_URL };
