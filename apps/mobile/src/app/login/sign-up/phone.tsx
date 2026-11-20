import { router } from "expo-router";
import { useState } from "react";
import { Platform, View } from "react-native";

import { registerGeneric } from "@/src/client/auth";
import { ok } from "@/src/client/session";
import { getErrorMessage, handleNetworkFailure } from "@/src/client/utils";
import FontText from "@/src/components/font-text";
import LargeButton from "@/src/components/large-button";
import TextInputField from "@/src/components/text-input-field";
import { useLoginSession } from "@/src/utils/context/login-context";
import { useToastContext } from "@/src/utils/context/toast-context";

const Phone = () => {
  const {
    firstName,
    lastName,
    eid,
    userType,
    requiresAssistance,
    phoneNumber,
    setPhoneNumber,
  } = useLoginSession();
  const { setToast } = useToastContext();

  const checkValidity = (value: string) => {
    return value.replace(/\D/g, "").length >= 10;
  };

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [isValid, setIsValid] = useState(checkValidity(phoneNumber));

  const handlePhoneNumberChange = (value: string) => {
    setPhoneNumber(value);
    setIsValid(checkValidity(value));
  };

  const registerAccount = async () => {
    setSubmitting(true);
    try {
      const response = await registerGeneric({
        firstName,
        lastName,
        eid,
        phoneNumber,
        requiresAssistance: requiresAssistance!,
        userType: userType!,
      });

      if (!ok(response)) {
        const error = getErrorMessage(response, "Failed to register account");
        setToast({
          title: "Failed to register account.",
          description: error,
          onDismiss: () => setToast(null),
          isError: true,
        });
        return;
      }

      setToast({
        title: "Code",
        description: response.data.code ?? "code",
        onDismiss: () => setToast(null),
      });

      router.navigate("/login/sign-up/confirm");
    } catch (error) {
      handleNetworkFailure(error, setToast);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-white px-5 pt-8">
      <FontText className="text-2xl font-medium mb-2">
        Enter your phone number
      </FontText>
      <FontText className="text-lg mb-12">
        We'll call as we approach your location.
      </FontText>
      <View className="flex-1 gap-4 flex-col justify-start">
        <TextInputField
          fieldName="Phone Number"
          value={phoneNumber}
          onChangeText={handlePhoneNumberChange}
          keyboardType="phone-pad"
          autoComplete="tel"
          maxLength={14}
          placeholder="(123) 456-7890"
          returnKeyType={Platform.OS === "ios" ? "done" : undefined}
        />
      </View>
      <LargeButton
        title={submitting ? "Submitting..." : "Continue"}
        disabled={!isValid || submitting}
        onPress={registerAccount}
      />
    </View>
  );
};

export default Phone;
