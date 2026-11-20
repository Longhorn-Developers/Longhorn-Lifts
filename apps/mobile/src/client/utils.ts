import axios, { AxiosResponse } from "axios";

import { ToastProps } from "../components/toast";

export const getErrorMessage = (
  response: AxiosResponse,
  fallback?: string,
): string => {
  try {
    return response.data.message || fallback || "An error occurred.";
  } catch {
    return fallback || "An error occurred.";
  }
};

export const handleNetworkFailure = (
  error: unknown,
  setToast: (toast: ToastProps | null) => void,
) => {
  if (axios.isAxiosError(error)) {
    if (error.code === "ECONNABORTED") {
      setToast({
        title: "Request Timeout",
        description:
          "The request took too long to complete. Please check your connection and try again.",
        onDismiss: () => setToast(null),
        isError: true,
      });
      return;
    } else if (error.code === "ERR_NETWORK") {
      setToast({
        title: "Network Error",
        description:
          "There was a network error. Please check your connection and try again.",
        onDismiss: () => setToast(null),
        isError: true,
      });
      return;
    }
  } else {
    setToast({
      title: "Unexpected Error",
      description: "An unexpected error occurred. Please try again.",
      onDismiss: () => setToast(null),
      isError: true,
    });
  }
};
