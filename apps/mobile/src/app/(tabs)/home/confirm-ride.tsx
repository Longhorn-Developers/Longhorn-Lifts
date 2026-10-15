import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { CrownSimpleIcon } from "phosphor-react-native";
import { useEffect, useState } from "react";
import { NativeScrollEvent, NativeSyntheticEvent, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";

import { getErrorMessage, handleNetworkFailure } from "@/src/client";
import { api, ok } from "@/src/client/session";
import BackButton from "@/src/components/back-button";
import FontText from "@/src/components/font-text";
import { GuidelinesListShort } from "@/src/components/guidelines-list";
import LargeButton from "@/src/components/large-button";
import OutlineButton from "@/src/components/outline-button";
import PickupDropoffLocationInfo from "@/src/components/pickup-dropoff-location-info";
import RiderCard from "@/src/components/rider-card";
import { useCurrentRideSession } from "@/src/utils/context/current-ride-context";
import { useGroupRideSession } from "@/src/utils/context/group-ride-context";
import { useRideSession } from "@/src/utils/context/ride-context";
import { useToastContext } from "@/src/utils/context/toast-context";
import { useSession } from "@/src/utils/context/user-context";

const ConfirmRide = () => {
  const { pickupLocation, dropoffLocation } = useRideSession();
  const { members, clearMembers, setLastRideMembers } = useGroupRideSession();
  const { user } = useSession();
  const { firstName, lastName, userType, eid, phoneNumber } = user!;
  const { setDropoffLocation, setPickupLocation } = useRideSession();
  const { setCurrentRide: setCurrentRideMini, setLoadingState } =
    useCurrentRideSession();
  const { setToast } = useToastContext();

  const [confirmEnabled, setConfirmEnabled] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [layoutHeight, setLayoutHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(5000);

  useEffect(() => {
    if (contentHeight < layoutHeight) {
      setConfirmEnabled(true);
    }
  }, [layoutHeight, contentHeight]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - 20;

    if (isCloseToBottom) {
      setConfirmEnabled(true);
    }
  };

  const submitRide = async () => {
    setSubmitting(true);
    try {
      if (members.length > 0) {
        await SecureStore.setItemAsync(
          "lastGroupRide",
          JSON.stringify(members),
        );
        setLastRideMembers(members);
      }

      const response = await api.post("/ride", {
        pickupLocation: pickupLocation!.id,
        dropoffLocation: dropoffLocation!.id,
        groupRide: members,
      });
      if (!ok(response)) {
        const errorMessage = getErrorMessage(
          response,
          "Failed to submit ride.",
        );
        setToast({
          title: "Unexpected error",
          description: errorMessage,
          onDismiss: () => setToast(null),
          isError: true,
        });
      } else {
        setCurrentRideMini({
          pickupLocation: pickupLocation!,
          dropoffLocation: dropoffLocation!,
          rideState: "received",
        });
        router.replace("/home/current-ride-info");
        setTimeout(() => {
          setDropoffLocation(null);
          setPickupLocation(null);
          clearMembers();
          setLoadingState("done");
        }, 1500);
      }
    } catch (err) {
      handleNetworkFailure(err, setToast);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="bg-white flex-1 p-5 flex-col gap-10 pb-safe">
      {/* header */}
      <View className="flex-row gap-4 items-center mt-safe">
        <BackButton />
        <FontText className="font-medium text-2xl">
          Confirm Your Booking
        </FontText>
      </View>

      {/* main content */}
      <View className="relative mt-[-16px] z-5 flex-1 mx-[-20px]">
        <LinearGradient
          colors={["#ffffffff", "#ffffff00"]}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 16,
            zIndex: 10,
          }}
        />
        <LinearGradient
          colors={["#ffffff00", "#ffffffff"]}
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 16,
            zIndex: 10,
          }}
        />
        <ScrollView
          className="flex-col py-4 pt-[-16px] px-5"
          onMomentumScrollEnd={handleScroll}
          onLayout={(e) => {
            setLayoutHeight(e.nativeEvent.layout.height);
          }}
          onContentSizeChange={(_, height) => {
            setContentHeight(height);
          }}
          overScrollMode="always"
        >
          <View className="flex-col gap-6 flex-1 mt-4">
            {/* location info */}
            <View className="flex-col gap-4">
              <View className="flex-row w-full justify-between items-center">
                <FontText className="text-xl font-medium">
                  Pick-up and drop-off
                </FontText>
                <OutlineButton
                  title="Edit"
                  onPress={() => router.back()}
                  small
                />
              </View>
              <PickupDropoffLocationInfo
                pickupLocation={pickupLocation}
                dropoffLocation={dropoffLocation}
              />
            </View>

            {/* ride members */}
            <View className="flex-col gap-4">
              <View className="flex-row w-full justify-between items-center">
                <FontText className="text-xl font-medium">People</FontText>
                <OutlineButton
                  title="Edit"
                  onPress={() => router.navigate("/home/group-ride")}
                  small
                />
              </View>
              <View className="flex-col gap-4">
                <RiderCard
                  member={{ firstName, lastName, userType, eid, phoneNumber }}
                  actionComponent={
                    <CrownSimpleIcon color="#FFD600" size={24} weight="fill" />
                  }
                />
                {members.map((member, index) => (
                  <RiderCard key={index} member={member} />
                ))}
              </View>
            </View>

            {/* guidelines */}
            <View className="flex-col gap-4 pb-4">
              <FontText className="text-xl font-medium">Guidelines</FontText>
              <GuidelinesListShort />
            </View>
          </View>
        </ScrollView>
      </View>
      <LargeButton
        title={
          submitting
            ? "Submitting..."
            : confirmEnabled
              ? "Confirm"
              : "Scroll down to confirm"
        }
        onPress={() => submitRide()}
        disabled={!confirmEnabled || submitting}
      />
    </View>
  );
};

export default ConfirmRide;
