import { Modal, Pressable, View } from "react-native";

import { MissedRide } from "../utils/context/missed-ride-context";
import FontText from "./font-text";
import OutlineButton from "./outline-button";
import PickupDropoffLocationInfo from "./pickup-dropoff-location-info";

const MissedRideModal = ({
  showModal,
  setShowModal,
  missedRide,
}: {
  showModal: boolean;
  setShowModal: (value: boolean) => void;
  missedRide: MissedRide | null;
}) => {
  return (
    <View className="absolute inset-0 flex-1">
      <Modal
        animationType="fade"
        transparent
        visible={showModal}
        statusBarTranslucent={true}
        onRequestClose={() => setShowModal(false)}
        className="z-1000"
      >
        <Pressable
          className="flex-1 bg-[#00000080] items-center justify-center p-5"
          onPress={() => setShowModal(false)}
        >
          <Pressable className="py-6 px-7 bg-white flex-col gap-4 rounded-3xl w-full">
            <FontText className="text-2xl font-medium">Missed Ride</FontText>
            <View className="flex-col gap-3">
              <FontText className="text-lg">
                You have missed the following ride:
              </FontText>
              <View className="mb-3">
                <PickupDropoffLocationInfo
                  pickupLocation={missedRide?.pickupLocation ?? null}
                  dropoffLocation={missedRide?.dropoffLocation ?? null}
                />
              </View>
              <OutlineButton
                title="Request a New Ride"
                onPress={() => setShowModal(false)}
                medium
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

export default MissedRideModal;
