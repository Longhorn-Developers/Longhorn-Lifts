import { TouchableOpacity, View } from "react-native";

import FontText from "./font-text";

const TertiaryButton = ({
  title,
  icon,
  onPress,
  disabled = false,
}: {
  title: string;
  icon: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
}) => {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled}>
      <View
        className={`flex-row gap-1 p-3 items-center justify-center rounded-[32px] border ${disabled ? "border-slate-400 bg-slate-200" : "border-slate-200 bg-slate-50"}`}
      >
        {icon}
        <FontText className={`font-medium ${disabled ? "text-slate-400" : ""}`}>
          {title}
        </FontText>
      </View>
    </TouchableOpacity>
  );
};

export default TertiaryButton;
