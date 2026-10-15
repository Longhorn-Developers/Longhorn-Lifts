import BottomSheet, {
  BottomSheetFlatList,
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetTextInput,
  BottomSheetView,
  TouchableOpacity as TO,
} from "@gorhom/bottom-sheet";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  dropoffBoundaryHoles,
  dropoffBoundaryPolygons,
  pickupBoundaryPolygons,
} from "@sure-walk/utils/boundary-info";
import { getMatchingDropoffLocations } from "@sure-walk/utils/dropoff-locations";
import {
  getMatchingPickupLocations,
  sortFavoriteLocations,
} from "@sure-walk/utils/pickup-locations";
import LocationType from "@sure-walk/utils/types/location";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { router, useFocusEffect } from "expo-router";
import {
  ArrowCircleRightIcon,
  CircleIcon,
  FadersHorizontalIcon,
  MapPinIcon,
  NavigationArrowIcon,
  StarIcon,
  UserCircleIcon,
  UserCirclePlusIcon,
} from "phosphor-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleProp,
  TextInput,
  TextStyle,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Polygon } from "react-native-maps";
import Animated, {
  Easing,
  FadeInDown,
  FadeInUp,
  FadeOutDown,
  FadeOutUp,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";

import { api } from "@/src/client/session";
import CheckButton from "@/src/components/check-button";
import FontText from "@/src/components/font-text";
import LargeButton from "@/src/components/large-button";
import LocationMarker from "@/src/components/location-marker";
import MissedRideModal from "@/src/components/missed-ride-modal";
import TertiaryButton from "@/src/components/tertiary-button";
import TextInputField from "@/src/components/text-input-field";
import {
  gray900,
  slate700,
  slate900,
  UTBluebonnet,
  UTBurntOrange,
  UTTangerine,
  UTTurquoise,
} from "@/src/utils/colors";
import { useCurrentRideSession } from "@/src/utils/context/current-ride-context";
import { useGroupRideSession } from "@/src/utils/context/group-ride-context";
import { useMissedRideSession } from "@/src/utils/context/missed-ride-context";
import { usePushNotificationsContext } from "@/src/utils/context/push-notifications-context";
import { useRideSession } from "@/src/utils/context/ride-context";
import { useToastContext } from "@/src/utils/context/toast-context";

const Home = () => {
  let _style: StyleProp<TextStyle> = { fontSize: 16 };
  if (Platform.OS === "ios") {
    _style.lineHeight = 0; // fix line height jitter bug on iOS
  }

  const { members } = useGroupRideSession();
  const {
    pickupLocation,
    setPickupLocation,
    dropoffLocation,
    setDropoffLocation,
  } = useRideSession();
  const { currentRide, setCurrentRide } = useCurrentRideSession();
  const { missedRide, setMissedRide, showModal, setShowModal } =
    useMissedRideSession();
  const { registerForPushNotificationsAsync } = usePushNotificationsContext();
  const { setToast } = useToastContext();

  const codeInputRef = useRef<TextInput>(null);
  const sheetRef = useRef<BottomSheet>(null);
  const mapRef = useRef<MapView>(null);
  const startLocationRef = useRef<TextInput>(null);
  const destinationRef = useRef<TextInput>(null);
  const rideCodeSheetRef = useRef<BottomSheetModal>(null);

  const snap0 = useSharedValue<number>(92); // minimum bottom sheet snapping height
  const snap1 = useSharedValue<number>(290); // medium bottom sheet snapping height
  const snapPoints = useDerivedValue(
    () => [
      snap0.value + 24, // compensate for screen safe area
      snap1.value + snap0.value,
      ...(!currentRide ? ["80.5%"] : []), // maximum sheet snapping height
    ],
    [snap0, snap1, currentRide],
  );

  const [code, setCode] = useState<string>("");
  const [viewRideDisabled, setViewRideDisabled] = useState<boolean>(false);
  const [snapIndex, setSnapIndex] = useState<number>(1);
  const [legendOpen, setLegendOpen] = useState<boolean>(false);
  const [showPickupBoundary, setPickupBoundary] = useState<boolean>(true);
  const [showDropoffBoundary, setDropoffBoundary] = useState<boolean>(true);
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null,
  );
  const [userLocationLabel, setUserLocationLabel] =
    useState<string>("Loading...");
  const [pickupLocationText, setPickupLocationText] = useState<string>(
    pickupLocation?.name ?? "",
  );
  const [dropoffText, setDropoffText] = useState<string>(
    dropoffLocation?.name ?? "",
  );
  const [focusedInput, setFocusedInput] = useState<"pickup" | "dropoff">(
    "pickup",
  );
  const [, setIsInputFocused] = useState<boolean>(false);
  const [pickupList, setPickupList] = useState<LocationType[]>([]);
  const [dropoffList, setDropoffList] = useState<LocationType[]>([]);
  const [startLocationAddress, setStartAddress] = useState<string>(
    pickupLocation?.address ?? "Select your pickup location",
  );
  const [dropoffAddress, setDropoffAddress] = useState<string>(
    dropoffLocation?.address ?? "Select your destination",
  );
  const [favoriteLocations, setFavoriteLocations] = useState<LocationType[]>(
    [],
  );

  const lastNotificationResponse = Notifications.useLastNotificationResponse();

  const centerMapOnLocation = (location: Location.LocationObject) => {
    setTimeout(() => {
      mapRef.current?.animateToRegion({
        latitude: location.coords.latitude - 0.0038,
        longitude: location.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    }, 1000);
  };

  const requestLocationPermissions = async () => {
    let { status: currentStatus } =
      await Location.getForegroundPermissionsAsync();
    let finalStatus = currentStatus;
    if (currentStatus !== "granted") {
      let { status } = await Location.requestForegroundPermissionsAsync();
      finalStatus = status;
    }

    mapRef.current?.animateToRegion(
      {
        latitude: 30.282962,
        longitude: -97.737224,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      0,
    );

    if (finalStatus !== "granted") {
      console.error("location denied");
      return;
    } else {
      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      setLocation(location);
      centerMapOnLocation(location);

      const userLat = location.coords.latitude;
      const userLon = location.coords.longitude;
      console.log("[Location] GPS coordinates:", userLat, userLon);

      const haversine = (
        lat1: number,
        lon1: number,
        lat2: number,
        lon2: number,
      ) => {
        const toRad = (v: number) => (v * Math.PI) / 180;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
        return Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      };

      const allPickupLocations = getMatchingPickupLocations("");
      if (allPickupLocations.length > 0) {
        const nearest = allPickupLocations.reduce((closest, loc) =>
          haversine(userLat, userLon, loc.lat, loc.lon) <
          haversine(userLat, userLon, closest.lat, closest.lon)
            ? loc
            : closest,
        );
        const { latitude, longitude } = location.coords;
        const dist = Math.hypot(
          latitude - nearest.lat,
          longitude - nearest.lon,
        );
        if (dist > 0.001) {
          setUserLocationLabel("Off-Campus");
          return;
        }
        console.log(
          "[Location] Selected nearest:",
          nearest.name,
          `(id=${nearest.id})`,
        );
        if (pickupLocationText === "") {
          // if the user has started editing ignore this
          setPickupLocationText(nearest.name);
          setStartAddress(nearest.address);
          setPickupLocation(nearest);
          setUserLocationLabel(nearest.name);
          setFocusedInput("dropoff");
        }
      }
    }
  };

  const fetchCurrentRide = async () => {
    try {
      const res = await api.get("/ride");
      if (res.status === 204) {
        setCurrentRide(null);
      } else if (res.status === 200) {
        setCurrentRide(res.data);
      } else {
        throw new Error("Could not fetch current ride details.");
      }
    } catch (err) {
      // ignore error, could be because app minimized
      console.log(err);
    }
  };

  const handleMissedRideNotificationResponse = (
    response: Notifications.NotificationResponse,
  ) => {
    const data = response.notification.request.content.data;
    if (data.eventType === "missedRide") {
      Notifications.clearLastNotificationResponseAsync();
      setCurrentRide(null);
      setMissedRide({
        pickupLocation: data.pickupLocation,
        dropoffLocation: data.dropoffLocation,
      });
      setTimeout(() => setShowModal(true), 300);
    }
  };

  const loadFavorites = async () => {
    const stored = await AsyncStorage.getItem("favoriteLocations");
    try {
      setFavoriteLocations(
        (JSON.parse(stored ?? "[]") as LocationType[]).sort(
          sortFavoriteLocations,
        ),
      );
    } catch {
      await AsyncStorage.removeItem("favoriteLocations");
    }
  };

  useEffect(() => {
    loadFavorites();
    registerForPushNotificationsAsync();
    requestLocationPermissions();
    const responseListener =
      Notifications.addNotificationResponseReceivedListener(
        handleMissedRideNotificationResponse,
      );
    const interval = setInterval(fetchCurrentRide, 30 * 1000);

    return () => {
      clearInterval(interval);
      responseListener.remove();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setPickupList(getMatchingPickupLocations(pickupLocationText));
  }, [pickupLocationText]);

  useEffect(() => {
    setDropoffList(getMatchingDropoffLocations(dropoffText));
  }, [dropoffText]);

  useFocusEffect(
    useCallback(() => {
      if (pickupLocation) {
        setPickupLocationText(pickupLocation.name);
        setStartAddress(pickupLocation.address);
      }
      if (dropoffLocation) {
        setDropoffText(dropoffLocation.name);
        setDropoffAddress(dropoffLocation.address);
      }
    }, [pickupLocation, dropoffLocation]),
  );

  useEffect(() => {
    if (!currentRide) {
      setPickupLocationText("");
      setDropoffText("");
      setStartAddress("Select your pickup location");
      setDropoffAddress("Select your destination");
    } else {
      // when a user submits a ride minimize the sheet
      sheetRef.current?.snapToIndex(1);
    }
  }, [currentRide]);

  useEffect(() => {
    if (
      lastNotificationResponse &&
      lastNotificationResponse.notification.request.content.data.eventType &&
      lastNotificationResponse.actionIdentifier ===
        Notifications.DEFAULT_ACTION_IDENTIFIER
    ) {
      handleMissedRideNotificationResponse(lastNotificationResponse);
    }
  }, [lastNotificationResponse]); // eslint-disable-line react-hooks/exhaustive-deps

  const calcMinimizedSheetHeight = (event: LayoutChangeEvent) => {
    let height = event.nativeEvent.layout.height;
    if (height === 0) {
      height = 92;
    }
    snap0.set(height);
  };

  const calcMediumSheetHeight = (event: LayoutChangeEvent) => {
    let height = event.nativeEvent.layout.height;
    if (height === 0) {
      height = 290;
    }
    if (!currentRide) {
      height -= 16; // compensate for list inner shadow negative margin
    }
    snap1.set(height);
  };

  const clickedPickupLocation = (location: LocationType) => () => {
    setPickupLocationText(location.name);
    setStartAddress(location.address);
    setPickupLocation(location);
    setFocusedInput("dropoff");
    if (dropoffLocation) {
      startLocationRef.current?.blur();
      router.navigate("/home/confirm-ride");
    } else if (startLocationRef.current?.isFocused()) {
      destinationRef.current?.focus();
    }
  };

  const clickedDropoffLocation = (location: LocationType) => () => {
    setDropoffText(location.name);
    setDropoffAddress(location.address);
    setDropoffLocation(location);
    destinationRef.current?.blur();
    if (pickupLocation) {
      router.navigate("/home/confirm-ride");
    }
  };

  const toggleFavorite = (location: LocationType) => {
    setFavoriteLocations((prev) => {
      const isAlreadyFavorited = prev.some((fav) => fav.id === location.id);
      const updated = isAlreadyFavorited
        ? prev.filter((fav) => fav.id !== location.id)
        : [...prev, location];
      updated.sort(sortFavoriteLocations);
      AsyncStorage.setItem("favoriteLocations", JSON.stringify(updated));
      return updated;
    });
  };

  const displayedList =
    focusedInput === "pickup" && pickupLocationText.trim().length >= 1
      ? pickupList
      : focusedInput === "dropoff" && dropoffText.trim().length >= 1
        ? dropoffList
        : focusedInput === "dropoff"
          ? favoriteLocations
          : favoriteLocations.filter((fav) => fav.type === "pickup");

  return (
    <View className="bg-white flex-1 flex-col items-center pt-safe">
      <View className="relative pt-3 pb-8 px-5 w-full">
        {/* current location display */}
        <View className="flex-col items-center justify-center gap-1">
          <View className="flex-row justify-center items-center gap-1">
            <NavigationArrowIcon
              color={UTBurntOrange}
              size="16"
              weight="fill"
              mirrored
            />
            <FontText className="font-medium text-3.5 text-slate-700">
              Your Location
            </FontText>
          </View>
          <FontText className="font-medium text-4 text-center">
            {userLocationLabel}
          </FontText>
        </View>

        {/* map legend and profile page buttons */}
        <TouchableOpacity
          className="absolute left-5 top-3 p-3 items-center justify-center rounded-2xl bg-slate-100"
          onPress={() => {
            if (snapIndex === 2) sheetRef.current?.snapToIndex(1);
            setLegendOpen(!legendOpen);
          }}
        >
          <FadersHorizontalIcon color={slate700} size="24" />
        </TouchableOpacity>
        <TouchableOpacity
          className="absolute right-5 top-3 p-3 items-center justify-center rounded-2xl bg-slate-100"
          onPress={() => {
            router.navigate("/profile");
          }}
        >
          <UserCircleIcon color={slate700} size="24" />
        </TouchableOpacity>
      </View>

      {/* map view */}
      <View className="relative flex-1 w-full">
        <View className="w-full h-full mt-[-10px] items-center justify-center">
          <MapView
            ref={mapRef}
            style={{ width: "100%", flex: 1, zIndex: 0 }}
            initialRegion={{
              latitude: 30.282962,
              longitude: -97.737224,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
            mapPadding={{
              bottom: 92,
              top: 20,
              left: 0,
              right: 0,
            }}
            tintColor={UTBurntOrange}
            userInterfaceStyle="light"
          >
            {pickupBoundaryPolygons.map((coords, index) => (
              <Polygon
                coordinates={coords}
                key={index}
                fillColor={
                  showPickupBoundary ? `${UTTangerine}30` : "#00000000"
                }
                strokeColor={
                  showPickupBoundary ? UTTangerine : "rgba(0, 0, 0, 0)"
                }
              />
            ))}
            {dropoffBoundaryPolygons.map((coords, index) => (
              <Polygon
                coordinates={coords}
                holes={dropoffBoundaryHoles[index]}
                key={index}
                fillColor={
                  showDropoffBoundary ? `${UTTurquoise}30` : "#00000000"
                }
                strokeColor={
                  showDropoffBoundary ? UTTurquoise : "rgba(0, 0, 0, 0)"
                }
              />
            ))}
            <LocationMarker location={location} />
          </MapView>
        </View>
        <LinearGradient
          colors={["#ffffffff", "#ffffff00"]}
          style={{
            position: "absolute",
            top: -10,
            left: 0,
            right: 0,
            height: 24,
          }}
        />
        {legendOpen && (
          <>
            {/* legend buttons */}
            <Animated.View
              className="absolute top-[28px] right-5 px-4 py-2 bg-white rounded-full border border-slate-200 flex-row justify-end"
              entering={FadeInUp.duration(150).easing(Easing.out(Easing.cubic))}
              exiting={FadeOutUp.duration(150).easing(Easing.in(Easing.cubic))}
            >
              <CheckButton
                label="Pickup & Drop-Off Boundary"
                onPress={() => setPickupBoundary(!showPickupBoundary)}
                isChecked={showPickupBoundary}
                color={UTTangerine}
              />
            </Animated.View>
            <Animated.View
              className="absolute top-[70px] right-5 mt-2.5 px-4 py-2 bg-white rounded-full border border-slate-200 flex-row"
              entering={FadeInUp.duration(150)
                .delay(50)
                .easing(Easing.out(Easing.cubic))}
              exiting={FadeOutUp.duration(150)
                .delay(50)
                .easing(Easing.in(Easing.cubic))}
            >
              <CheckButton
                label="Drop-Off Boundary"
                onPress={() => setDropoffBoundary(!showDropoffBoundary)}
                isChecked={showDropoffBoundary}
                color={UTTurquoise}
              />
            </Animated.View>
          </>
        )}
      </View>

      {/* main bottom sheet */}
      <BottomSheet
        ref={sheetRef}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        index={1}
        style={{
          borderRadius: 28,
          backgroundColor: "transparent",
          zIndex: 150,
        }}
        onChange={(index) => {
          if (index !== 2) {
            startLocationRef.current?.blur();
            destinationRef.current?.blur();
          }
          setSnapIndex(index);
        }}
        handleComponent={() => (
          <View
            className="relative flex-col rounded-t-[28px]"
            onLayout={calcMinimizedSheetHeight}
          >
            <View className="rounded-t-[28px] flex-col items-center py-4">
              <View className="bg-slate-300 rounded w-8 h-1" />
            </View>
            <View className="flex-col gap-5 px-5 pb-1">
              <View className="flex-row w-full justify-between items-center">
                <FontText className="text-2xl font-medium">
                  {currentRide ? "Ride in Progress" : "Book a ride"}
                </FontText>
                {!currentRide && (
                  <TertiaryButton
                    title={`${members.length === 0 ? "Add" : members.length + 1} Riders`}
                    icon={<UserCirclePlusIcon color={slate700} size="24" />}
                    onPress={() => router.navigate("/home/group-ride")}
                  />
                )}
              </View>
            </View>
          </View>
        )}
        containerStyle={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* continue button */}
        {pickupLocation && dropoffLocation && !currentRide && (
          <Animated.View
            className="absolute bottom-0 w-full z-10 px-5 mb-safe pb-[80px]"
            entering={FadeInDown.duration(300)
              .delay(300)
              .easing(Easing.out(Easing.cubic))}
            exiting={FadeOutDown.duration(300).easing(Easing.in(Easing.cubic))}
          >
            <LargeButton
              title="Continue"
              onPress={() => router.navigate("/home/confirm-ride")}
            />
          </Animated.View>
        )}

        {/* pickup / dropoff location selector or current ride details */}
        <View className="flex-col mb-[-24px]" onLayout={calcMediumSheetHeight}>
          <View className="flex-col bg-white pt-4 px-5">
            {/* location selector */}
            {!currentRide && (
              <View className="flex-col rounded-lg">
                <Pressable
                  className={`${focusedInput === "pickup" ? "bg-slate-100" : "bg-slate-50"} transition-colors flex-row p-4 gap-4 items-center rounded-t-2xl border border-slate-200`}
                  onPress={() => startLocationRef.current?.focus()}
                >
                  <View className="bg-[#BF570033] rounded-full items-center justify-center w-[32px] h-[32px]">
                    <CircleIcon color={UTBurntOrange} weight="fill" size="20" />
                  </View>
                  <View className="flex-1 flex-col gap-1">
                    <TextInput
                      ref={startLocationRef}
                      onFocus={() => {
                        setFocusedInput("pickup");
                        setIsInputFocused(true);
                        snapIndex !== 2 && sheetRef.current?.expand();
                      }}
                      onBlur={() => setIsInputFocused(false)}
                      className="font-medium text-lg"
                      placeholder="Where from?"
                      placeholderTextColor={gray900}
                      onChangeText={(text) => {
                        setPickupLocationText(text);
                        if (!startLocationAddress.startsWith("Select")) {
                          setStartAddress("Select your pickup location");
                          setPickupLocation(null);
                        }
                      }}
                      value={pickupLocationText}
                      style={_style}
                    />
                    <FontText className="text-lg color-[#333F48]">
                      {startLocationAddress}
                    </FontText>
                  </View>
                </Pressable>
                <Pressable
                  className={`${focusedInput === "dropoff" ? "bg-slate-100" : "bg-slate-50"} transition-colors flex-row p-4 gap-4 items-center rounded-b-2xl border border-slate-200 mt-[-1px] mb-4`}
                  onPress={() => destinationRef.current?.focus()}
                >
                  <View className="bg-[#005F8633] rounded-full items-center justify-center w-[32px] h-[32px]">
                    <MapPinIcon color={UTBluebonnet} size="20" weight="fill" />
                  </View>
                  <View className="flex-1 flex-col gap-1">
                    <TextInput
                      ref={destinationRef}
                      onFocus={() => {
                        setFocusedInput("dropoff");
                        setIsInputFocused(true);
                        snapIndex !== 2 && sheetRef.current?.expand();
                      }}
                      onBlur={() => setIsInputFocused(false)}
                      className="font-medium text-lg"
                      placeholder="Where to?"
                      placeholderTextColor={gray900}
                      onChangeText={(text) => {
                        setDropoffText(text);
                        if (!dropoffAddress.startsWith("Select")) {
                          setDropoffAddress("Select your destination");
                          setDropoffLocation(null);
                        }
                      }}
                      value={dropoffText}
                      style={_style}
                    />
                    <FontText className="text-lg color-[#333F48]">
                      {dropoffAddress}
                    </FontText>
                  </View>
                </Pressable>
                <View className="flex-row justify-between items-center pb-2 mb-safe">
                  <TO
                    onPress={() => {
                      rideCodeSheetRef.current?.present();
                      sheetRef.current?.close();
                    }}
                  >
                    <FontText className="text-lg color-ut-bluebonnet">
                      Have a ride code?
                    </FontText>
                  </TO>
                  {((focusedInput === "pickup" &&
                    pickupLocationText.trim().length >= 1) ||
                    (focusedInput === "dropoff" &&
                      dropoffText.trim().length >= 1)) && (
                    <TouchableOpacity
                      onPress={() =>
                        focusedInput === "pickup"
                          ? (setPickupLocationText(""),
                            setStartAddress("Select your pickup location"),
                            setPickupLocation(null))
                          : (setDropoffText(""),
                            setDropoffAddress("Select your destination"),
                            setDropoffLocation(null))
                      }
                    >
                      <FontText className="text-lg">
                        Clear {focusedInput} selection
                      </FontText>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* current ride details */}
            {currentRide && (
              <View className="flex-col gap-4 mb-safe">
                <View className="pb-4 bg-slate-50 rounded-2xl border border-slate-200 flex-col gap-2">
                  <View className="flex-row items-center gap-2 mb-2 px-5 py-1.5 bg-orange-100 rounded-t-2xl">
                    <FontText className="text-lg font-semibold color-ut-burntorange">
                      {currentRide.pickupLocation?.abbreviation}
                    </FontText>
                    <ArrowCircleRightIcon
                      weight="fill"
                      color={UTBurntOrange}
                      size={24}
                    />
                    <FontText className="text-lg font-semibold color-ut-burntorange">
                      {currentRide.dropoffLocation?.name}
                    </FontText>
                  </View>
                  {currentRide.eta && (
                    <FontText className="text-lg font-semibold px-5">
                      ETA:{" "}
                      <FontText className="text-lg font-regular">
                        {currentRide.eta ?? ""}
                      </FontText>
                    </FontText>
                  )}
                  <FontText className="text-lg font-semibold px-5">
                    Status:{" "}
                    <FontText className="text-lg font-regular">
                      {`${currentRide.rideState.at(0)?.toUpperCase()}${currentRide.rideState.slice(1)}`}
                    </FontText>
                  </FontText>
                </View>
                <LargeButton
                  title="View Live Tracking"
                  onPress={() => {
                    setViewRideDisabled(true);
                    setTimeout(
                      () => router.push("/home/current-ride-info"),
                      300,
                    );
                    setTimeout(() => setViewRideDisabled(false), 1000);
                  }}
                  disabled={viewRideDisabled}
                />
              </View>
            )}
          </View>
          {!currentRide && (
            <LinearGradient
              colors={["#ffffffff", "#ffffff00"]}
              style={{
                marginTop: -12,
                height: 24,
                zIndex: 50,
              }}
            />
          )}
        </View>

        {/* search results */}
        {!currentRide && (
          <BottomSheetFlatList
            overScrollMode={"always"}
            scrollEnabled={
              Platform.OS === "android" ? snapIndex === 2 : undefined
            }
            data={displayedList}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View className="flex-1 h-full w-full flex-col items-center gap-4 mt-2">
                {(((focusedInput === "pickup" &&
                  pickupLocationText.length === 0) ||
                  (focusedInput === "dropoff" && dropoffText.length === 0)) && (
                  <>
                    <FontText className="text-xl">
                      No favorite locations
                    </FontText>
                    <FontText className="text-lg">
                      Start typing a location name for results
                    </FontText>
                  </>
                )) || <FontText className="text-xl">No results</FontText>}
              </View>
            }
            renderItem={({ index, item }) => (
              <TouchableOpacity
                key={index}
                onPress={
                  focusedInput === "pickup"
                    ? clickedPickupLocation(item)
                    : clickedDropoffLocation(item)
                }
              >
                <View
                  key={index}
                  className={`flex-col ${index === displayedList.length - 1 ? "" : "border-b"} border-gray-200 pb-4 pt-2`}
                >
                  <View className="flex-row gap-2 items-center">
                    <MapPinIcon color={slate900} size="24" />
                    <View className="flex-1 flex-col gap-2 justify-around">
                      <FontText className="font-medium text-lg/1">
                        {item.name}
                      </FontText>
                      <FontText className="font-regular text-[14px]/1 text-gray-500">
                        {item.address}
                      </FontText>
                    </View>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        toggleFavorite(item);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <StarIcon
                        color={slate900}
                        size="24"
                        weight={
                          favoriteLocations.some((fav) => fav.id === item.id)
                            ? "fill"
                            : "regular"
                        }
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            )}
            contentContainerStyle={{
              paddingTop: 8,
              position: "relative",
              paddingHorizontal: 20,
              flexDirection: "column",
              gap: 4,
              justifyContent: "flex-start",
              flexGrow: 1,
            }}
            style={{
              flexGrow: 1,
            }}
          />
        )}
      </BottomSheet>

      {/* ride code bottom sheet modal */}
      <BottomSheetModalProvider>
        <BottomSheetModal
          ref={rideCodeSheetRef}
          handleComponent={() => (
            <View className="rounded-t-[28px] flex-col items-center py-4">
              <View className="bg-slate-300 rounded w-8 h-1" />
            </View>
          )}
          onDismiss={() => sheetRef.current?.snapToIndex(1)}
        >
          <BottomSheetView className="px-5 pb-safe">
            <FontText className="text-2xl font-medium">Join a Ride</FontText>
            <FontText className="text-lg font-normal mt-2 mb-6">
              Enter the ride code shared by your group leader.
            </FontText>
            <TextInputField
              placeholder="ABC1234"
              autoCapitalize={"characters"}
              value={code}
              onChangeText={(text) => setCode(text.toUpperCase())}
              inputRef={codeInputRef}
              returnKeyType="go"
              onSubmitEditing={() => {
                if (code.length !== 7) {
                  setToast({
                    title: "Invalid Code",
                    description: "Please enter a valid 7-digit ride code.",
                    onDismiss: () => setToast(null),
                    isError: true,
                  });
                  return;
                }
                router.push(`/home/current-ride-info?shareCode=${code}`);
              }}
              InputComponent={BottomSheetTextInput}
              styleProps={{ textTransform: "uppercase" }}
            />
          </BottomSheetView>
        </BottomSheetModal>
      </BottomSheetModalProvider>

      {/* missed ride modal */}
      <MissedRideModal {...{ showModal, setShowModal, missedRide }} />
    </View>
  );
};

export default Home;
