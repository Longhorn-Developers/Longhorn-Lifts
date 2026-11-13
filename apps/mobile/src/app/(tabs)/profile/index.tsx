import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  ArrowSquareOutIcon,
  BugIcon,
  CaretLeftIcon,
  CaretRightIcon,
  ClipboardTextIcon,
  MoonIcon,
  PencilSimpleIcon,
  QuestionIcon,
} from "phosphor-react-native";
import { useEffect, useState } from "react";
import { Linking, ScrollView, TouchableOpacity, View } from "react-native";

import { getErrorMessage } from "@/src/client";
import { api, ok } from "@/src/client/session";
import DropdownSelect from "@/src/components/dropdown-select";
import EditProfileTextInput from "@/src/components/edit-profile-text-input";
import FontText from "@/src/components/font-text";
import LargeButton from "@/src/components/large-button";
import OutlineButton from "@/src/components/outline-button";
import { slate700, UTBurntOrange } from "@/src/utils/colors";
import { usePushNotificationsContext } from "@/src/utils/context/push-notifications-context";
import { useToastContext } from "@/src/utils/context/toast-context";
import { useSession } from "@/src/utils/context/user-context";

const Profile = () => {
  const { user, logOut, setUser } = useSession();
  const { pushToken } = usePushNotificationsContext();
  const { setToast } = useToastContext();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [eid, setEid] = useState("");
  const [phoneNumber] = useState(user?.phoneNumber);
  const [requiresAssistance, setRequiresAssistance] = useState<boolean | null>(
    null,
  );

  useEffect(() => {
    if (!user) {
      return;
    }

    setFirstName(user?.firstName);
    setLastName(user?.lastName);
    setEid(user?.eid ?? "");
    setRequiresAssistance(user?.requiresAssistance);
  }, [user]);

  const resetForm = () => {
    if (!user) {
      return;
    }

    setFirstName(user.firstName);
    setLastName(user.lastName);
    setEid(user.eid ?? "");
    setRequiresAssistance(user.requiresAssistance);
  };

  const saveProfile = async () => {
    if (!user || requiresAssistance === null) {
      return;
    }

    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedEid = eid.trim();

    const showError = (description: string) =>
      setToast({
        title: "Error",
        description,
        onDismiss: () => setToast(null),
        isError: true,
      });

    if (!trimmedFirstName || !trimmedLastName) {
      showError("First and last name are required.");
      return;
    }

    if (trimmedEid && trimmedEid.length < 4) {
      showError("UT EID must be at least 4 characters.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await api.patch("/me", {
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        requiresAssistance,
        eid: trimmedEid || undefined,
      });

      if (!ok(response)) {
        showError(getErrorMessage(response));
        return;
      }

      const updatedUser = response.data;
      setUser(updatedUser);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update profile:", error);
      showError("Unable to update your profile right now.");
    } finally {
      setIsSaving(false);
    }
  };

  const formatPhoneNumber = (phone: any): string => {
    if (!phone) return phone;
    const hasPlus = phone.startsWith("+");
    const digits = phone.replace(/\D/g, "");
    if (hasPlus && digits.length > 10) {
      const countryCode = digits.slice(0, digits.length - 10);
      const local = digits.slice(-10);
      return `+${countryCode} (${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
    }
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  return (
    <View className="bg-white flex-1">
      {user && (
        <View className="flex-1">
          <TouchableOpacity
            className="absolute left-0 top-safe w-12 h-12 rounded-2xl items-center justify-center ms-5 z-10"
            onPress={() => {
              router.back();
            }}
          >
            <CaretLeftIcon size={24} color={slate700} />
          </TouchableOpacity>
          <View className="w-full bg-[#EFF6FF] pt-safe-offset-[54px]" />
          <View className="w-24 h-24 rounded-full bg-slate-50 border border-slate-200 items-center justify-center self-center -mt-11">
            <View className="w-20 h-20 rounded-full bg-ut-burntorange items-center justify-center">
              <FontText className="text-center text-white text-[24px] font-medium">
                {user.firstName[0]}
                {user.lastName[0]}
              </FontText>
            </View>
          </View>
          <FontText className="text-[24px] tracking-[-0.24px] text-center mt-4">
            {user.firstName} {user.lastName}
          </FontText>
          <View className="flex-1 px-5 pt-2">
            {!isEditing && (
              <View className="gap-[12px] pb-4">
                <TouchableOpacity
                  className="flex-row gap-1 items-center text-center px-3 py-2 rounded-full border border-[#E5E7EB] bg-[#F9FAFB] self-center"
                  onPress={() => {
                    resetForm();
                    setIsEditing(true);
                  }}
                >
                  <PencilSimpleIcon size={20} />
                  <FontText className="text-center text-[16px] tracking-[-0.16px]">
                    Edit Profile
                  </FontText>
                </TouchableOpacity>
              </View>
            )}
            <View className="relative flex-1 flex-col justify-start mx-[-20px]">
              <LinearGradient
                colors={["#ffffffff", "#ffffff00"]}
                style={{
                  position: "absolute",
                  top: 0,
                  left: -20,
                  right: 20,
                  height: 16,
                  zIndex: 10,
                }}
              />
              <LinearGradient
                colors={["#ffffff00", "#ffffffff"]}
                style={{
                  position: "absolute",
                  bottom: -1,
                  left: -20,
                  right: 20,
                  height: 32,
                  zIndex: 10,
                }}
              />
              <ScrollView>
                {!isEditing && (
                  <View className="flex-1 flex-col items-start gap-10 mt-4 px-5">
                    <View className="flex flex-col items-start self-stretch h-[55px]">
                      <FontText className="font-medium text-lg">
                        First Name
                      </FontText>
                      <FontText className="mt-4 mb-1 text-lg">
                        {user.firstName}
                      </FontText>
                      <View className="border-b border-b-[#e5e7eb] w-full" />
                    </View>
                    <View className="flex flex-col items-start self-stretch h-[55px]">
                      <FontText className="font-medium text-lg">
                        Last Name
                      </FontText>
                      <FontText className="mt-4 mb-1 text-lg">
                        {user.lastName}
                      </FontText>
                      <View className="border-b border-b-[#e5e7eb] w-full" />
                    </View>
                    <View className="flex flex-col items-start self-stretch h-[55px]">
                      <FontText className="font-medium text-lg">
                        UT EID
                      </FontText>
                      <FontText className="mt-4 mb-1 text-lg">
                        {user.eid || "Not provided"}
                      </FontText>
                      <View className="border-b border-b-[#e5e7eb] w-full" />
                    </View>
                    <View className="flex flex-col items-start self-stretch h-[55px]">
                      <FontText className="font-medium text-lg">
                        Phone Number
                      </FontText>
                      <FontText className="mt-4 mb-1 text-lg">
                        {formatPhoneNumber(user.phoneNumber)}
                      </FontText>
                      <View className="border-b border-b-[#e5e7eb] w-full" />
                    </View>
                    <View className="flex flex-col items-start self-stretch h-[55px] mb-5">
                      <FontText className="font-medium text-lg">
                        Americans with Disabilities Act (ADA)
                      </FontText>
                      <FontText className="mt-4 mb-1 text-lg">
                        {user.requiresAssistance ? "Yes" : "No"}
                      </FontText>
                      <View className="border-b border-b-[#e5e7eb] w-full" />
                    </View>
                    <View className="flex flex-col self-stretch gap-6">
                      <View className="flex flex-col self-stretch">
                        <FontText className="font-semibold text-2xl text-slate-900">
                          Resources
                        </FontText>
                        <View className="border-b border-slate-200 w-full mt-4" />
                      </View>
                      <TouchableOpacity
                        className="flex-row items-center justify-between w-full"
                        onPress={() => router.push("/profile/guidelines")}
                      >
                        <View className="flex-row items-center gap-2">
                          <ClipboardTextIcon size={24} color={UTBurntOrange} />
                          <FontText className="font-semibold text-lg text-slate-900">
                            Guidelines
                          </FontText>
                        </View>
                        <CaretRightIcon size={24} color={slate700} />
                      </TouchableOpacity>
                      <View className="border-b border-slate-200 w-full" />
                      <TouchableOpacity
                        className="flex-row items-center justify-between w-full"
                        onPress={() => router.push("/profile/faqs")}
                      >
                        <View className="flex-row items-center gap-2">
                          <QuestionIcon size={24} color={UTBurntOrange} />
                          <FontText className="font-semibold text-lg text-slate-900">
                            FAQs
                          </FontText>
                        </View>
                        <CaretRightIcon size={24} color={slate700} />
                      </TouchableOpacity>
                      <View className="border-b border-slate-200 w-full" />
                      <TouchableOpacity
                        className="flex-row items-center justify-between w-full"
                        onPress={() => {}}
                      >
                        <View className="flex-row items-center gap-2">
                          <BugIcon size={24} color={UTBurntOrange} />
                          <FontText className="font-semibold text-lg text-slate-900">
                            Report A Bug
                          </FontText>
                        </View>
                        <CaretRightIcon size={24} color={slate700} />
                      </TouchableOpacity>
                      <View className="border-b border-slate-200 w-full" />
                      <TouchableOpacity
                        className="flex-row items-center justify-between w-full"
                        onPress={() =>
                          Linking.openURL(
                            "https://parking.utexas.edu/transportation/ut-night-rides",
                          )
                        }
                      >
                        <View className="flex-row items-center gap-2">
                          <MoonIcon size={24} color={UTBurntOrange} />
                          <FontText className="font-semibold text-lg text-slate-900">
                            UT Night Rides
                          </FontText>
                        </View>
                        <ArrowSquareOutIcon size={24} color={slate700} />
                      </TouchableOpacity>
                      <View className="border-b border-slate-200 w-full" />
                    </View>
                    <View className="pb-2 pt-6 w-full mb-safe">
                      <OutlineButton
                        title="Log Out"
                        onPress={() => logOut(pushToken ?? undefined)}
                      />
                    </View>
                  </View>
                )}
                {isEditing && (
                  <View className="flex-1 flex-col pt-4 px-5">
                    <View className="flex flex-col items-start gap-10 mb-5">
                      <EditProfileTextInput
                        fieldName="First Name"
                        value={firstName}
                        onChangeText={setFirstName}
                        autoCapitalize="words"
                        autoComplete="given-name"
                        maxLength={30}
                        placeholder="Longhorn"
                      />
                      <EditProfileTextInput
                        fieldName="Last Name"
                        value={lastName}
                        onChangeText={setLastName}
                        autoCapitalize="words"
                        autoComplete="family-name"
                        maxLength={30}
                        placeholder="Bevo"
                      />
                      <EditProfileTextInput
                        fieldName="UT EID"
                        value={eid}
                        onChangeText={setEid}
                        autoCapitalize="none"
                        maxLength={20}
                        placeholder="abc1234"
                      />
                      <EditProfileTextInput
                        fieldName="Phone Number"
                        value={formatPhoneNumber(phoneNumber)}
                        keyboardType="phone-pad"
                        autoComplete="tel"
                        maxLength={20}
                        placeholder="1234567890"
                        editable={false}
                        className="color-slate-500 text-lg mb-1 mt-4 font-regular"
                      />
                      <DropdownSelect
                        label="Americans with Disabilities Act (ADA)"
                        value={requiresAssistance}
                        onSelect={setRequiresAssistance}
                        options={[
                          { label: "Yes", value: true },
                          { label: "No", value: false },
                        ]}
                      />
                    </View>
                  </View>
                )}
              </ScrollView>
            </View>
            {isEditing && (
              <View className="flex-row gap-2 mt-4 mb-safe justify-end">
                <View className="pb-2">
                  <OutlineButton
                    title="Cancel"
                    onPress={() => {
                      resetForm();
                      setIsEditing(false);
                    }}
                    small
                    red
                  />
                </View>
                <View className="pb-2">
                  <LargeButton
                    title={isSaving ? "Saving..." : "Save"}
                    onPress={saveProfile}
                    disabled={isSaving || requiresAssistance === null}
                    small
                    blue
                  />
                </View>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

export default Profile;
