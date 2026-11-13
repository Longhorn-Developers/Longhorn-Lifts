import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { createContext, PropsWithChildren, useContext, useState } from "react";
import { Platform } from "react-native";

import LoadingState from "../types/loading-state";

interface PushNotificationsContextType {
  pushToken: string | null;
  registrationError: unknown | null;
  loadingState: LoadingState;
  registerForPushNotificationsAsync: () => Promise<void>;
}

const PushNotificationsContext = createContext<
  PushNotificationsContextType | undefined
>(undefined);

export const usePushNotificationsContext = () => {
  const value = useContext(PushNotificationsContext);
  if (!value) {
    throw new Error(
      "usePushNotificationsContext must be used within a PushNotificationsProvider",
    );
  }
  return value;
};

export const PushNotificationsProvider = ({ children }: PropsWithChildren) => {
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [registrationError, setRegistrationError] = useState<unknown | null>(
    null,
  );
  const [loadingState, setLoadingState] = useState<LoadingState>("loading");

  const requestPermissions =
    async (): Promise<Notifications.PermissionStatus> => {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      return finalStatus;
    };

  const handleRegistrationError = (errorMessage: string) => {
    return Error(errorMessage);
  };

  const registerForPushNotificationsAsync = async () => {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    }

    if ((await requestPermissions()) !== "granted") {
      setRegistrationError(
        handleRegistrationError(
          "Permission not granted to get push token for push notification!",
        ),
      );
      setPushToken(null);
      setLoadingState("error");
      return;
    }
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;
    if (!projectId) {
      setRegistrationError(handleRegistrationError("Project ID not found"));
      setPushToken(null);
      setLoadingState("error");
      return;
    }
    try {
      const pushTokenString = (
        await Notifications.getExpoPushTokenAsync({
          projectId,
        })
      ).data;
      setPushToken(pushTokenString);
      setRegistrationError(null);
      setLoadingState("done");
    } catch (e: unknown) {
      setRegistrationError(handleRegistrationError(`${e}`));
      setPushToken(null);
      setLoadingState("error");
    }
  };

  return (
    <PushNotificationsContext.Provider
      value={{
        pushToken,
        registrationError,
        loadingState,
        registerForPushNotificationsAsync,
      }}
    >
      {children}
    </PushNotificationsContext.Provider>
  );
};
