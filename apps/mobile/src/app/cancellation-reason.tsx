import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSearchParams } from "expo-router/build/hooks";
import { useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import FontText from "@/src/components/font-text";
import LargeButton from "@/src/components/large-button";
import RadioButton from "@/src/components/radio-button";

import { api, ok } from "../client/session";
import { getErrorMessage, handleNetworkFailure } from "../client/utils";
import TextInputField from "../components/text-input-field";
import { useToastContext } from "../utils/context/toast-context";

const CancellationReason = () => {
  const { setToast } = useToastContext();

  const params = useSearchParams();
  const rideID = params.get("rideID");

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [extraText, setExtraText] = useState<string>("");

  const cancellationReasons: [string, ...string[]] = [
    "I didn't need the ride anymore",
    "My ride never came",
    "The estimated wait was too long",
    "Weather improved",
    "Got a different ride",
    "I didn't receive a call",
    "Other",
  ];

  const submit = async () => {
    setSubmitting(true);
    try {
      const data = {
        rideID,
        cancellationReason: selectedOption,
        cancellationExtra: selectedOption === "Other" ? extraText : undefined,
      };
      const res = await api.post("/ride/cancellation-reason", data);
      if (!ok(res)) {
        const error = getErrorMessage(res);
        setToast({
          title: "Unexpected Error",
          description: error,
          onDismiss: () => setToast(null),
          isError: true,
        });
      } else {
        setToast({
          title: "Feedback Received",
          description: "Thank you for your feedback!",
          onDismiss: () => setToast(null),
          isError: false,
        });
        router.back();
      }
    } catch (err) {
      handleNetworkFailure(err, setToast);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="bg-white flex-col h-full p-5 pb-safe">
      <View className="flex-row gap-4 items-center mt-safe mb-8">
        <FontText className="font-medium text-2xl">
          Reason for cancelling?
        </FontText>
      </View>
      <View className="relative mt-[-16px] z-5 flex-1 mx-[-20px] mb-4 flex-1">
        <LinearGradient
          colors={["#ffffffff", "#ffffff00"]}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 16,
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
            height: 16,
            zIndex: 10,
          }}
        />
        <KeyboardAwareScrollView
          className="flex-col pb-4 pt-[-16px] px-5 gap-4"
          bottomOffset={40}
        >
          <View className="flex-col gap-4 flex-1 pt-4 pb-4">
            {cancellationReasons.map((option, index) => (
              <RadioButton
                label={option}
                key={index}
                onPress={() => setSelectedOption(option)}
                selected={selectedOption === option}
              />
            ))}
            {selectedOption === "Other" && (
              <TextInputField
                fieldName="Reason"
                value={extraText}
                onChangeText={(text) => setExtraText(text)}
              />
            )}
          </View>
        </KeyboardAwareScrollView>
      </View>
      <LargeButton
        title={submitting ? "Submitting..." : "Back to Home"}
        onPress={submit}
        disabled={
          selectedOption === null ||
          (selectedOption === "Other" && extraText.length < 1) ||
          submitting
        }
      />
    </View>
  );
};

export default CancellationReason;
