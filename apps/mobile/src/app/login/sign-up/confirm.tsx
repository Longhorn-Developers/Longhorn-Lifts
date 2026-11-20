import { router, usePathname } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { CircleIcon } from "phosphor-react-native";
import { useRef, useState } from "react";
import {
  Platform,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";

import { confirmGeneric } from "@/src/client/auth";
import { ok } from "@/src/client/session";
import { getErrorMessage, handleNetworkFailure } from "@/src/client/utils";
import FontText from "@/src/components/font-text";
import LargeButton from "@/src/components/large-button";
import { gray500 } from "@/src/utils/colors";
import { useLoginSession } from "@/src/utils/context/login-context";
import { useToastContext } from "@/src/utils/context/toast-context";
import { useSession } from "@/src/utils/context/user-context";

const Confirm = () => {
  const { phoneNumber } = useLoginSession();
  const { setUser } = useSession();
  const { setToast } = useToastContext();
  const pathname = usePathname();

  const [code, setCode] = useState("");
  const [focused, setFocus] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const textInputRef = useRef<TextInput | null>(null);

  const confirmCode = async () => {
    setSubmitting(true);
    try {
      const response = await confirmGeneric(code);

      if (!ok(response)) {
        const error = getErrorMessage(response, "Failed to confirm code.");
        setToast({
          title: "Error",
          description: error,
          onDismiss: () => setToast(null),
          isError: true,
        });
        return;
      }

      const { accessToken, refreshToken, user } = response.data;
      setUser(user);
      await SecureStore.setItemAsync("accessToken", accessToken);
      await SecureStore.setItemAsync("refreshToken", refreshToken);
      router.dismissAll();
      const path = pathname.includes("login-generic")
        ? "/login/login-generic/guidelines"
        : "/login/sign-up/guidelines";
      router.replace(path);
    } catch (error) {
      handleNetworkFailure(error, setToast);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-white px-5 pt-8">
      <FontText className="text-2xl font-medium mb-2">
        Verify your phone number
      </FontText>
      <FontText className="text-lg mb-12">
        Enter the code sent to {phoneNumber}.
      </FontText>
      <View className="flex-1 flex-col gap-2">
        <FontText className="text-lg font-semibold text-gray-900">
          Code
        </FontText>
        <TouchableWithoutFeedback
          onPress={() => {
            textInputRef.current?.focus();
            setFocus(true);
          }}
          className="w-full"
        >
          <View className="flex-row w-full justify-between h-[64px]">
            {[...Array(6).keys()].map((_, index) => (
              <View
                key={index}
                className={`py-4 px-3 border transition-colors ${focused ? "border-ut-bluebonnet" : "border-gray-200"} rounded-lg bg-gray-50 items-center justify-center`}
              >
                {code[index] ? (
                  <FontText
                    className={`flex-row items-center justify-center w-6 text-3xl font-medium text-center ${code[index] ? "text-gray-900" : "text-gray-500"}`}
                  >
                    {code[index] || "•"}
                  </FontText>
                ) : (
                  <View className="w-6 items-center justify-center">
                    <CircleIcon size={8} color={gray500} weight="fill" />
                  </View>
                )}
              </View>
            ))}
          </View>
        </TouchableWithoutFeedback>
        <TextInput
          ref={textInputRef}
          value={code}
          onChangeText={setCode}
          onBlur={() => setFocus(false)}
          className="display-none visible-hidden opacity-0"
          keyboardType="numeric"
          maxLength={6}
          returnKeyType={Platform.OS === "ios" ? "done" : undefined}
        />
      </View>
      <LargeButton
        title={submitting ? "Submitting..." : "Confirm"}
        onPress={() => {
          confirmCode();
        }}
        disabled={code.length !== 6 || submitting}
      />
    </View>
  );
};

export default Confirm;
