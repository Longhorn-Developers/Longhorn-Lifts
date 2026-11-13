import {
  Geist_100Thin,
  Geist_200ExtraLight,
  Geist_300Light,
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
  Geist_800ExtraBold,
  Geist_900Black,
  useFonts,
} from "@expo-google-fonts/geist";
import RideUpdateNotification from "@sure-walk/utils/types/ride-update-notification";
import * as Notifications from "expo-notifications";
import {
  Redirect,
  RelativePathString,
  router,
  SplashScreen,
  Stack,
} from "expo-router";
import { WifiXIcon } from "phosphor-react-native";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

import { UTBurntOrange } from "../utils/colors";
import { useCurrentRideSession } from "../utils/context/current-ride-context";
import { GroupRideProvider } from "../utils/context/group-ride-context";
import { MissedRideProvider } from "../utils/context/missed-ride-context";
import { usePushNotificationsContext } from "../utils/context/push-notifications-context";
import { RideProvider } from "../utils/context/ride-context";
import { RideDetailsProvider } from "../utils/context/ride-details-context";
import { useSession } from "../utils/context/user-context";
import FontText from "./font-text";
import LargeButton from "./large-button";

const TabScreens = () => {
  const { loadingState, user, guidelinesAccepted, fetchUserInfo } =
    useSession();
  const { loadingState: rideLoadingState, currentRide } =
    useCurrentRideSession();
  const {
    loadingState: notificationsLoadingState,
    registerForPushNotificationsAsync,
  } = usePushNotificationsContext();

  const lastNotificationResponse = Notifications.useLastNotificationResponse();

  const [loaded, error] = useFonts({
    Geist_100Thin,
    Geist_200ExtraLight,
    Geist_300Light,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    Geist_800ExtraBold,
    Geist_900Black,
  });

  const onNotificationResponseReceieved = (
    response: Notifications.NotificationResponse,
  ) => {
    const eventType = response.notification.request.content.data.eventType;
    if (eventType === "routeUpdate" || eventType === "vehicleInfo") {
      Notifications.clearLastNotificationResponseAsync();
      const data: RideUpdateNotification = response.notification.request.content
        .data as unknown as RideUpdateNotification;
      // @ts-ignore
      if (data.route) {
        router.navigate(data.route as unknown as RelativePathString);
      }
    }
    if (eventType === "rideFeedback") {
      Notifications.clearLastNotificationResponseAsync();
      const data = response.notification.request.content.data;
      router.navigate(data.route);
    }
  };

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    registerForPushNotificationsAsync();
    const responseListener =
      Notifications.addNotificationResponseReceivedListener(
        onNotificationResponseReceieved,
      );

    return () => {
      responseListener.remove();
    };
  }, []);

  useEffect(() => {
    if (
      lastNotificationResponse &&
      lastNotificationResponse.notification.request.content.data.url &&
      lastNotificationResponse.actionIdentifier ===
        Notifications.DEFAULT_ACTION_IDENTIFIER
    ) {
      onNotificationResponseReceieved(lastNotificationResponse);
    }
  }, [lastNotificationResponse]);

  useEffect(() => {
    if (
      loadingState !== "loading" &&
      rideLoadingState !== "loading" &&
      notificationsLoadingState !== "loading" &&
      (loaded || error)
    ) {
      if (currentRide) {
        router.navigate("/home/current-ride-info");
      } else {
        setTimeout(() => SplashScreen.hideAsync(), 200);
      }
    }
  }, [
    loadingState,
    rideLoadingState,
    notificationsLoadingState,
    loaded,
    error,
  ]);
  /* eslint-enable react-hooks/exhaustive-deps */

  if (
    loadingState === "loading" ||
    rideLoadingState === "loading" ||
    notificationsLoadingState === "loading" ||
    (!loaded && !error)
  ) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color={UTBurntOrange} />
      </View>
    );
  }

  if (loadingState === "error") {
    // network issues
    return (
      <View className="flex-1 items-center justify-center bg-white gap-5 p-5">
        <WifiXIcon color={UTBurntOrange} size={68} />
        <View className="flex-col gap-2 items-center">
          <FontText className="text-2xl font-medium">No internet</FontText>
          <FontText className="text-lg font-normal">
            Please check your connection.
          </FontText>
        </View>
        <View className="w-full">
          <LargeButton title="Reload" onPress={fetchUserInfo} />
        </View>
      </View>
    );
  }

  if (user === null) {
    return <Redirect href="/login" />;
  }

  if (!guidelinesAccepted) {
    return <Redirect href="/login/login-generic/guidelines" />;
  }

  return (
    <RideDetailsProvider>
      <MissedRideProvider>
        <RideProvider>
          <GroupRideProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </GroupRideProvider>
        </RideProvider>
      </MissedRideProvider>
    </RideDetailsProvider>
  );
};

export default TabScreens;
