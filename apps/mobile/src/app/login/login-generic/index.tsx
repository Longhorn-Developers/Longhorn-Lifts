import { Link, router } from "expo-router";
import { useState } from "react";
import { Platform, View } from "react-native";

import { loginGeneric } from "@/src/client/auth";
import { ok } from "@/src/client/session";
import { getErrorMessage, handleNetworkFailure } from "@/src/client/utils";
import FontText from "@/src/components/font-text";
import LargeButton from "@/src/components/large-button";
import TextInputField from "@/src/components/text-input-field";
import { useLoginSession } from "@/src/utils/context/login-context";
import { useToastContext } from "@/src/utils/context/toast-context";

const Index = () => {
  const { setToast } = useToastContext();
  const { phoneNumber, setPhoneNumber } = useLoginSession();

  const checkValidity = (value: string) => {
    return value.replace(/\D/g, "").length >= 10;
  };

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [isValid, setIsValid] = useState(checkValidity(phoneNumber));

  const handlePhoneNumberChange = (value: string) => {
    setPhoneNumber(value);
    setIsValid(checkValidity(value));
  };

  const login = async () => {
    setSubmitting(true);
    try {
      const response = await loginGeneric(phoneNumber);

      if (!ok(response)) {
        const error = getErrorMessage(response, "Failed to log in");
        setToast({
          title: "Failed to log in.",
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

      router.navigate("/login/login-generic/confirm");
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
      <Link className="text-lg mb-12" replace href="/">
        Use the number you entered when signing up.
      </Link>
      <View className="flex-1 flex-col justify-start">
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
        title="Continue"
        onPress={login}
        disabled={!isValid || submitting}
      ></LargeButton>
    </View>
  );
};

export default Index;
