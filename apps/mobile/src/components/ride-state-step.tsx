import InProgressRideState from "@sure-walk/utils/types/in-progress-ride-state";
import {
  CarIcon,
  CarProfileIcon,
  ConfettiIcon,
  HouseIcon,
  MapPinIcon,
  UserCheckIcon,
} from "phosphor-react-native";
import { Component, useEffect } from "react";
import { View } from "react-native";
import Animated, {
  DerivedValue,
  interpolate,
  interpolateColor,
  SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import {
  slate50,
  slate200,
  slate400,
  slate900,
  UTBurntOrange,
} from "../utils/colors";
import { useRideDetailsSession } from "../utils/context/ride-details-context";
import FontText from "./font-text";

const rideStateToStepNum = {
  received: 0,
  assigned: 1,
  "en route": 2,
  arrived: 3,
  "in progress": 4,
  "dropped off": 5,
  loading: NaN,
};

export function withAnimated<Props extends object>(
  WrappedComponent: React.FC<Props>,
) {
  const displayName =
    WrappedComponent.displayName || WrappedComponent.name || "Component";

  class WithAnimated extends Component<Props> {
    static displayName = `WithAnimated(${displayName})`;

    render() {
      return <WrappedComponent {...this.props} />;
    }
  }

  return Animated.createAnimatedComponent<Props>(WithAnimated);
}

const rideStateToIcon = {
  received: withAnimated(ConfettiIcon),
  assigned: withAnimated(UserCheckIcon),
  "en route": withAnimated(CarProfileIcon),
  arrived: withAnimated(MapPinIcon),
  "in progress": withAnimated(CarIcon),
  "dropped off": withAnimated(HouseIcon),
};

const AnimatedFontText = withAnimated(FontText);

const RideStateStep = ({
  rideState,
  width,
}: {
  rideState: InProgressRideState;
  width: number;
}) => {
  const { rideDetails } = useRideDetailsSession();

  const currentRideState = rideDetails?.rideState ?? "loading";
  const highlighted = useSharedValue<boolean>(
    rideStateToStepNum[currentRideState]! >= rideStateToStepNum[rideState]!,
  );

  let titleText = (rideState as string).replace(/\b\w/g, (char) =>
    char.toUpperCase(),
  );
  if (rideState === "assigned") {
    titleText = "Driver Assigned";
  }

  useEffect(() => {
    highlighted.value =
      rideStateToStepNum[currentRideState]! >= rideStateToStepNum[rideState]!;
  }, [rideDetails]); // eslint-disable-line react-hooks/exhaustive-deps

  const IconToRender = rideStateToIcon[rideState];

  /* eslint-disable react-hooks/rules-of-hooks */
  const animProgress: DerivedValue<0 | 1>[] = [];
  const altAnimProgress: DerivedValue<0 | 1>[] = [];
  const iconAnimProgress: DerivedValue<0 | 1>[] = [];
  const animatedIconColors: DerivedValue<string>[] = [];
  const animatedCircleColors: DerivedValue<string>[] = [];
  const animatedTextColors: DerivedValue<string>[] = [];
  const animatedIconSize: DerivedValue<number>[] = [];
  for (let i = 0; i < 6; i++) {
    animProgress[i] = useDerivedValue(() => {
      return highlighted.value
        ? withDelay(150 * i, withTiming(1, { duration: 300 }))
        : withDelay(150 * i, withTiming(0, { duration: 300 }));
    }, [highlighted]);
    altAnimProgress[i] = useDerivedValue(() => {
      return highlighted.value
        ? withDelay(150 * i, withTiming(1, { duration: 2300 }))
        : withDelay(150 * i, withTiming(0, { duration: 300 }));
    }, [highlighted]);
    iconAnimProgress[i] = useDerivedValue(() => {
      return highlighted.value
        ? withDelay(150 * i, withTiming(1, { duration: 1300 }))
        : withDelay(150 * i, withTiming(0, { duration: 300 }));
    }, [highlighted]);

    animatedIconColors[i] = useDerivedValue(() => {
      return interpolateColor(
        animProgress[i].value,
        [0, 1],
        [slate400, slate50],
      );
    }, [animProgress[i]]);
    animatedCircleColors[i] = useDerivedValue(() => {
      return interpolateColor(
        altAnimProgress[i].value,
        [0, 0.13, 0.87, 1],
        [slate200, UTBurntOrange, UTBurntOrange, slate900],
      );
    }, [animProgress[i]]);
    animatedTextColors[i] = useDerivedValue(() => {
      return interpolateColor(
        animProgress[i].value,
        [0, 1],
        [slate400, slate900],
      );
    }, [animProgress[i]]);
    animatedIconSize[i] = useDerivedValue(() => {
      return interpolate(
        iconAnimProgress[i].value,
        [0, 0.23, 0.4, 0.78, 1],
        [1, 0.6, 1.2, 1.2, 1],
      );
    });
  }
  /* eslint-enable react-hooks/rules-of-hooks */

  return (
    <View className={`w-[${width}px] z-10`}>
      <View className={`flex-col items-center gap-2`}>
        <View className="flex-row items-center">
          <Animated.View
            className={`rounded-full w-8 h-8 flex-col items-center justify-center`}
            style={{
              backgroundColor:
                animatedCircleColors[rideStateToStepNum[rideState]],
            }}
          >
            {
              <Animated.View
                style={{
                  transform: [
                    { scale: animatedIconSize[rideStateToStepNum[rideState]] },
                  ],
                }}
              >
                <IconToRender
                  weight="fill"
                  size={14}
                  color={
                    animatedIconColors[
                      rideStateToStepNum[rideState]!
                    ] as SharedValue<string | undefined>
                  }
                />
              </Animated.View>
            }
          </Animated.View>
        </View>
        <AnimatedFontText
          className={`text-lg font-medium mx-[-46px] text-center`}
          style={{
            color: animatedTextColors[rideStateToStepNum[rideState]],
          }}
        >
          {titleText}
        </AnimatedFontText>
      </View>
    </View>
  );
};

export const RideStateStepDivider = ({
  rideState,
  width,
}: {
  rideState: InProgressRideState;
  width: number;
}) => {
  const { rideDetails } = useRideDetailsSession();

  const currentRideState = rideDetails?.rideState ?? "received";
  const highlighted = useSharedValue<boolean>(
    rideStateToStepNum[currentRideState]! >= rideStateToStepNum[rideState]!,
  );

  useEffect(() => {
    highlighted.value =
      rideStateToStepNum[currentRideState]! >= rideStateToStepNum[rideState]!;
  }, [rideDetails]); // eslint-disable-line react-hooks/exhaustive-deps

  /* eslint-disable react-hooks/rules-of-hooks */
  const progresses: DerivedValue<0 | 1>[] = [];
  const altAnimProgress: DerivedValue<0 | 1>[] = [];
  const styles: { width: number }[] = [];
  const styles1: { width: number }[] = [];
  const animatedLineColors: DerivedValue<string>[] = [];
  for (let i = 0; i < 6; i++) {
    progresses[i] = useDerivedValue(() => {
      return highlighted.value === true
        ? withDelay(150 * (i - 1), withTiming(1, { duration: 150 }))
        : withDelay(150 * (i - 1), withTiming(0, { duration: 150 }));
    }, [highlighted]);
    altAnimProgress[i] = useDerivedValue(() => {
      return highlighted.value
        ? withDelay(150 * i, withTiming(1, { duration: 2300 }))
        : withDelay(150 * i, withTiming(0, { duration: 300 }));
    }, [highlighted]);
    styles[i] = useAnimatedStyle(
      () => ({
        width: (progresses[i].value as number) * width,
      }),
      [progresses[i]],
    );
    styles1[i] = useAnimatedStyle(
      () => ({
        width: ((1 - progresses[i].value) as number) * width,
      }),
      [progresses[i]],
    );
    animatedLineColors[i] = useDerivedValue(() => {
      return interpolateColor(
        altAnimProgress[i].value,
        [0, 0.13, 0.87, 1],
        [UTBurntOrange, UTBurntOrange, UTBurntOrange, slate900],
      );
    }, [altAnimProgress[i]]);
  }
  /* eslint-enable react-hooks/rules-of-hooks */

  return (
    <View style={{ width: width, marginHorizontal: -2 }}>
      <View className={`flex-col items-center gap-2`}>
        <View className="flex-row items-center justify-start h-8">
          <Animated.View
            className={`h-[2px]`}
            style={[
              styles[rideStateToStepNum[rideState]],
              {
                backgroundColor:
                  animatedLineColors[rideStateToStepNum[rideState]],
              },
            ]}
          />
          <Animated.View
            className={`bg-slate-200 h-[2px]`}
            style={styles1[rideStateToStepNum[rideState]]}
          />
        </View>
        <FontText className="text-lg font-medium text-center" />
      </View>
    </View>
  );
};

export default RideStateStep;
