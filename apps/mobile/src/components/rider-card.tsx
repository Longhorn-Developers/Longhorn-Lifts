import GroupRideMember from "@sure-walk/utils/types/group-ride-member";
import { PhoneIcon } from "phosphor-react-native";
import { View } from "react-native";

import { UTBluebonnet } from "../utils/colors";
import FontText from "./font-text";

const RiderCard = ({
  member,
  actionComponent = <View />,
  showContactBanner = false,
}: {
  member: GroupRideMember;
  actionComponent?: React.ReactNode;
  showContactBanner?: boolean;
}) => {
  return (
    <View className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
      <View className="p-4 flex-row align-center gap-4">
        <View className="w-14 h-14 rounded-full bg-white border border-slate-200 items-center justify-center">
          <View
            className={`w-12 h-12 items-center justify-center ${member.userType === "ut-affiliated" ? "bg-ut-turquoise" : "bg-ut-bluebonnet"} rounded-full`}
          >
            <FontText className="font-semibold text-xl color-slate-50">
              {member.firstName.at(0)! + member.lastName.at(0)!}
            </FontText>
          </View>
        </View>
        <View className="flex-col flex-1 gap-0.5 justify-center">
          <FontText className="text-lg/5 font-medium">{`${member.firstName} ${member.lastName}`}</FontText>
          <FontText className="color-slate-700 text-lg/5 font-normal">
            {`${member.eid ?? "Guest"}${member.phoneNumber ? ` • ${member.phoneNumber}` : ""}`}
          </FontText>
        </View>
        <View className="align-center justify-center">{actionComponent}</View>
      </View>
      {showContactBanner && (
        <View className="flex-row items-center gap-2 px-4 py-2.5 bg-blue-50 border-t border-slate-200">
          <PhoneIcon size={16} color={UTBluebonnet} />
          <FontText className="text-lg color-ut-bluebonnet">
            Sure Walk will contact you
          </FontText>
        </View>
      )}
    </View>
  );
};

export default RiderCard;
