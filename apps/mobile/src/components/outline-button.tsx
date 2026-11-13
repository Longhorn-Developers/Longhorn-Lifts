import { TouchableOpacity } from "react-native";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import FontText from "./font-text";

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const OutlineButton = ({
  title,
  onPress,
  icon,
  disabled = false,
  small = false,
  medium = false,
  red = false,
  orange = false,
}: {
  title: string;
  onPress: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  small?: boolean;
  medium?: boolean;
  red?: boolean;
  orange?: boolean;
}) => {
  const borderColor = red
    ? "border-red-700"
    : orange
      ? "border-ut-burntorange"
      : "border-ut-bluebonnet";
  const textColor = disabled
    ? "color-slate-500"
    : red
      ? "color-red-700"
      : orange
        ? "color-ut-burntorange"
        : "color-ut-bluebonnet";

  return (
    <AnimatedTouchable
      className={`border-[2px] ${borderColor} disabled:border-slate-500 disabled:bg-slate-100 transition-colors rounded-full ${small ? "h-[40px]" : medium ? "h-[48px]" : "py-3"} px-5 flex-row gap-2 items-center justify-center`}
      onPress={() => onPress()}
      disabled={disabled}
    >
      {icon && <View className="items-center justify-center">{icon}</View>}
      <View className={`items-center justify-center`}>
        <FontText
          className={`${small ? "text-lg" : "text-xl/10"} font-medium ${textColor}`}
        >
          {title}
        </FontText>
      </View>
    </AnimatedTouchable>
  );
};

export default OutlineButton;
