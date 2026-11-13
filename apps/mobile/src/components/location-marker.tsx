import * as Location from "expo-location";
import { useEffect } from "react";
import { View } from "react-native";
import { Marker } from "react-native-maps";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { UTBurntOrange } from "../utils/colors";

const LocationMarker = ({
  location,
}: {
  location: Location.LocationObject | null;
}) => {
  const pulseScale = useSharedValue(1);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(0.8, {
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Marker
      coordinate={{
        latitude: location?.coords.latitude ?? 0,
        longitude: location?.coords.longitude ?? 0,
      }}
      tracksViewChanges={true}
    >
      <Animated.View
        style={[
          {
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: "#BF570033",
            alignItems: "center",
            justifyContent: "center",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
            elevation: 4,
          },
          pulseStyle,
        ]}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: "white",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: UTBurntOrange,
            }}
          />
        </View>
      </Animated.View>
    </Marker>
  );
};

export default LocationMarker;
