import { router } from "expo-router";
import { WarningIcon } from "phosphor-react-native";
import { Modal, Pressable, View } from "react-native";

import { getErrorMessage, handleNetworkFailure } from "../client";
import { api, ok } from "../client/session";
import { UTTangerine } from "../utils/colors";
import { useCurrentRideSession } from "../utils/context/current-ride-context";
import { useToastContext } from "../utils/context/toast-context";
import FontText from "./font-text";
import LargeButton from "./large-button";
import OutlineButton from "./outline-button";
import PickupDropoffLocationInfo from "./pickup-dropoff-location-info";

const CancelRideModal = ({
  modalVisible,
  setModalVisible,
  isGroupRide,
}: {
  modalVisible: boolean;
  setModalVisible: (state: boolean) => void;
  isGroupRide: boolean;
}) => {
  const { currentRide, setCurrentRide } = useCurrentRideSession();
  const { setToast } = useToastContext();

  const cancelRide = async () => {
    try {
      setModalVisible(false);
      setToast({
        title: "Cancelling...",
        description: "Your ride is being cancelled, hold on...",
        onDismiss: () => setToast(null),
      });
      const res = await api.delete("/ride");
      if (ok(res)) {
        setCurrentRide(null);
        const data = res.data;
        setTimeout(() => {
          setToast(null);
          router.push(`/cancellation-reason?rideID=${data.rideIDForFeedback}`);
        }, 100);
      } else {
        const error = getErrorMessage(res, "Failed to cancel ride.");
        setToast({
          title: "Unexpected Error",
          description: error,
          onDismiss: () => setToast(null),
          isError: true,
        });
      }
    } catch (err) {
      handleNetworkFailure(err, setToast);
    }
  };

  return (
    <View className="absolute inset-0 flex-1">
      <Modal
        animationType="fade"
        transparent
        visible={modalVisible}
        statusBarTranslucent={true}
        onRequestClose={() => setModalVisible(false)}
        className="z-1000 flex-1"
      >
        <Pressable
          className="flex-1 bg-[#00000080] items-center justify-center p-5"
          onPress={() => setModalVisible(false)}
        >
          <Pressable className="py-6 px-7 bg-white flex-col gap-6 rounded-2xl w-full">
            <View className="flex-col gap-3">
              <View className="flex-row items-center gap-2">
                <WarningIcon color={UTTangerine} size={28} />
                <FontText className="text-2xl font-medium">
                  Cancel Ride
                </FontText>
              </View>
              <FontText className="text-lg">
                {isGroupRide ? (
                  <>
                    This will cancel the following ride for{" "}
                    <FontText className="font-semibold text-lg">
                      everyone
                    </FontText>{" "}
                    in the ride. Are you sure?
                  </>
                ) : (
                  <>
                    Are you sure you want to cancel the following ride request:
                  </>
                )}
              </FontText>
            </View>
            <View className="my-[-4px]">
              <PickupDropoffLocationInfo
                pickupLocation={currentRide?.pickupLocation ?? null}
                dropoffLocation={currentRide?.dropoffLocation ?? null}
              />
            </View>
            <View className="flex-col gap-3">
              <OutlineButton
                title="Yes, cancel"
                red
                onPress={cancelRide}
                medium
              />
              <LargeButton
                title="No, never mind"
                onPress={() => setModalVisible(false)}
                medium
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

export default CancelRideModal;
