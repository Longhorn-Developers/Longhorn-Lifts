import Location from "@sure-walk/utils/types/location";
import { CircleIcon, MapPinIcon } from "phosphor-react-native";
import { View } from "react-native";

import { UTBluebonnet, UTBurntOrange } from "../utils/colors";
import FontText from "./font-text";

const PickupDropoffLocationInfo = ({
  pickupLocation,
  dropoffLocation,
}: {
  pickupLocation: Location | null;
  dropoffLocation: Location | null;
}) => {
  return (
    <View
      className="flex-col rounded-2xl bg-slate-50"
      style={{ boxShadow: "0 2px 8px 0 rgba(214, 210, 196, 0.20)" }}
    >
      <View className="bg-slate-50 flex-row p-4 gap-4 items-center rounded-t-2xl border border-slate-200">
        <View className="bg-white border border-slate-200 rounded-full items-center justify-center w-[44px] h-[44px]">
          <View className="bg-[#BF570033] rounded-full items-center justify-center w-[36px] h-[36px]">
            <CircleIcon color={UTBurntOrange} weight="fill" size="20" />
          </View>
        </View>
        <View className="flex-1 flex-col gap-1">
          <FontText className="font-medium text-base">
            {pickupLocation?.name}
          </FontText>
          <FontText className="text-lg color-[#333F48]">
            {pickupLocation?.address}
          </FontText>
        </View>
      </View>
      <View className="bg-slate-50 flex-row p-4 gap-4 items-center rounded-b-2xl border border-slate-200 mt-[-1px]">
        <View className="bg-white border border-slate-200 rounded-full items-center justify-center w-[44px] h-[44px]">
          <View className="bg-[#005F8633] rounded-full items-center justify-center w-[36px] h-[36px]">
            <MapPinIcon color={UTBluebonnet} size="20" weight="fill" />
          </View>
        </View>
        <View className="flex-1 flex-col gap-1">
          <FontText className="font-medium text-base">
            {dropoffLocation?.name}
          </FontText>
          <FontText className="text-lg color-[#333F48]">
            {dropoffLocation?.address}
          </FontText>
        </View>
      </View>
    </View>
  );
};

export default PickupDropoffLocationInfo;
