import GroupRideMember from "@sure-walk/utils/types/group-ride-member";
import UserType from "@sure-walk/utils/types/user-type";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  ClockClockwiseIcon,
  UserCirclePlusIcon,
  XCircleIcon,
} from "phosphor-react-native";
import { useEffect, useMemo, useState } from "react";
import { Platform, TouchableOpacity, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import BackButton from "@/src/components/back-button";
import FontText from "@/src/components/font-text";
import LargeButton from "@/src/components/large-button";
import OutlineButton from "@/src/components/outline-button";
import RiderCard from "@/src/components/rider-card";
import TertiaryButton from "@/src/components/tertiary-button";
import TextInputField from "@/src/components/text-input-field";
import { slate700, slate900 } from "@/src/utils/colors";
import { useGroupRideSession } from "@/src/utils/context/group-ride-context";
import { useSession } from "@/src/utils/context/user-context";

const GroupRide = () => {
  const { user } = useSession();
  const { members, addMember, removeMember, lastRideMembers, setMembers } =
    useGroupRideSession();

  const [isAdding, setAdding] = useState<boolean>(false);
  const [addingUserType, setAddingUserType] =
    useState<UserType>("ut-affiliated");
  const [utEID, setUTEID] = useState<string>("");
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [isValid, setIsValid] = useState<boolean>(false);
  const [isFull, setIsFull] = useState<boolean>(false);

  const leaderGroupRideMember: GroupRideMember = useMemo(
    () => ({
      firstName: user?.firstName!.trim()!,
      lastName: user?.lastName!.trim()!,
      eid: user?.eid?.trim(),
      userType: user?.userType!,
      phoneNumber: user?.phoneNumber,
    }),
    [user],
  );

  useEffect(() => {
    if (addingUserType === "ut-affiliated" && utEID.trim().length < 4) {
      setIsValid(false);
      return;
    }
    if (phoneNumber.length > 0 && phoneNumber.trim().length < 10) {
      setIsValid(false);
      return;
    }
    setIsValid(firstName.trim().length > 0 && lastName.trim().length > 0);
  }, [addingUserType, utEID, firstName, lastName, phoneNumber]);

  useEffect(() => {
    setIsFull(members.length >= 4);
  }, [members]);

  const clearFields = () => {
    setFirstName("");
    setLastName("");
    setUTEID("");
    setPhoneNumber("");
  };

  const addRider = () => {
    if (!isValid) return;
    const trimmedPhone = phoneNumber.trim();
    addMember({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      userType: addingUserType,
      eid: addingUserType === "ut-affiliated" ? utEID : undefined,
      phoneNumber: trimmedPhone === "" ? undefined : trimmedPhone,
    });
    setAdding(false);
    clearFields();
  };

  const removeRider = (index: number) => {
    removeMember(index);
  };

  return (
    <View className="bg-white flex-1 p-5 flex-col gap-5 pb-safe">
      {/* header */}
      <View className="flex-row gap-4 items-center mt-safe">
        <BackButton />
        <FontText className="font-medium text-2xl">Your Group Ride</FontText>
      </View>

      {/* main content */}
      <View className="relative flex-1 mx-[-20px]">
        <LinearGradient
          colors={["#ffffffff", "#ffffff00"]}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 20,
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
            height: 20,
            zIndex: 10,
          }}
        />
        <KeyboardAwareScrollView
          className="flex-col px-5"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 20 }}
          bottomOffset={120}
        >
          {/* group leader */}
          <View className="flex-row justify-between items-center mt-5 mb-4">
            <FontText className="text-xl font-semibold transition-all">
              Primary Contact
            </FontText>
            <FontText className="text-xl font-semibold color-ut-bluebonnet">
              {`Riders (${members.length + 1}/5)`}
            </FontText>
          </View>
          <RiderCard member={leaderGroupRideMember} />

          {/* riders or add rider form */}
          <FontText className="text-xl font-semibold mt-6 mb-6">
            Group Members
          </FontText>
          {members.length > 0 && (
            <View className="flex-col gap-4 mb-6">
              {members.map((rideMember, index) => (
                <View key={index}>
                  <RiderCard
                    member={rideMember}
                    actionComponent={
                      <TouchableOpacity onPress={() => removeRider(index)}>
                        <XCircleIcon color={slate900} size={24} />
                      </TouchableOpacity>
                    }
                  />
                </View>
              ))}
            </View>
          )}

          {/* add rider form */}
          {isAdding && (
            <View className="flex-col gap-4">
              {addingUserType === "ut-affiliated" && (
                <TextInputField
                  fieldName="UT EID"
                  optionalPressableText="No UT EID?"
                  optionalPressableCallback={() => setAddingUserType("guest")}
                  value={utEID}
                  onChangeText={setUTEID}
                  maxLength={10}
                  placeholder="abc123"
                />
              )}
              <TextInputField
                fieldName="First Name"
                optionalPressableText={
                  addingUserType === "guest" ? "UT EID?" : undefined
                }
                optionalPressableCallback={
                  addingUserType === "guest"
                    ? () => setAddingUserType("ut-affiliated")
                    : undefined
                }
                value={firstName}
                onChangeText={setFirstName}
                maxLength={40}
                autoCapitalize="words"
                placeholder="Bevo"
              />
              <TextInputField
                fieldName="Last Name"
                value={lastName}
                onChangeText={setLastName}
                maxLength={40}
                autoCapitalize="words"
                placeholder="Longhorn"
              />
              <View className="flex-col gap-2 mb-2">
                <TextInputField
                  fieldName="Phone Number"
                  optionalPressableText="*Optional"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  maxLength={14}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  placeholder="(123)-456-7890"
                  returnKeyType={Platform.OS === "ios" ? "done" : undefined}
                />
                <FontText className="text-md color-slate-500">
                  For day-of-ride updates only
                </FontText>
              </View>
              <View className="flex-row gap-2 justify-end">
                <OutlineButton
                  title="Cancel"
                  onPress={() => {
                    setAdding(false);
                    clearFields();
                  }}
                  small
                  orange
                />
                <LargeButton
                  title="Save"
                  onPress={() => addRider()}
                  disabled={!isValid}
                  blue
                  small
                />
              </View>
            </View>
          )}

          {/* main buttons */}
          <View className="flex-col gap-4">
            {!isAdding && !isFull && (
              <TertiaryButton
                title="Add Riders"
                onPress={() => setAdding(true)}
                icon={<UserCirclePlusIcon size={24} color={slate700} />}
              />
            )}
            {!isAdding &&
              members.length === 0 &&
              lastRideMembers.length > 0 && (
                <TertiaryButton
                  title="Restore Last Group Ride"
                  onPress={() => setMembers(lastRideMembers)}
                  icon={<ClockClockwiseIcon size={24} color={slate700} />}
                />
              )}
          </View>
        </KeyboardAwareScrollView>
      </View>
      <LargeButton
        onPress={() => {
          router.back();
        }}
        title="Continue"
        disabled={members.length === 0 || isAdding}
      />
    </View>
  );
};

export default GroupRide;
