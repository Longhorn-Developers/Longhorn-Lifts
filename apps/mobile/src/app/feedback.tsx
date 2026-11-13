import Slider from "@react-native-community/slider";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSearchParams } from "expo-router/build/hooks";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import FontText from "@/src/components/font-text";
import LargeButton from "@/src/components/large-button";

import { getErrorMessage, handleNetworkFailure } from "../client";
import { api, ok } from "../client/session";
import TextInputField from "../components/text-input-field";
import { slate200, UTBurntOrange } from "../utils/colors";
import { useToastContext } from "../utils/context/toast-context";
import LoadingState from "../utils/types/loading-state";

const Feedback = () => {
  const { setToast } = useToastContext();

  const params = useSearchParams();
  const rideID = params.get("rideID") ?? "";

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [disabled, setDisabled] = useState<boolean>(false);
  const [loadingState, setLoadingState] = useState<LoadingState>("loading");
  const [pickupLocation, setPickupLocation] = useState<string>("");
  const [dropoffLocation, setDropoffLocation] = useState<string>("");
  const [submittedAt, setSubmittedAt] = useState<string>("");
  const [feedback, setFeedback] = useState<string>("");
  const [rating, setRating] = useState<number>(3);

  useEffect(() => {
    const fetchFeedback = async () => {
      try {
        const res = await api.get(`/ride/feedback?rideID=${rideID}`);
        const data = res.data;
        if (!ok(res)) {
          const error = getErrorMessage(
            res,
            "Can't submit feedback for this ride.",
          );
          setToast({
            title: "Can't submit feedback",
            description: error,
            onDismiss: () => setToast(null),
            isError: true,
          });
          setLoadingState("error");
        } else {
          setSubmittedAt(data.submittedAt);
          setPickupLocation(data.pickupLocation?.name ?? "");
          setDropoffLocation(data.dropoffLocation?.name ?? "");
          setLoadingState("done");
        }
      } catch (err) {
        handleNetworkFailure(err, setToast);
        setLoadingState("error");
      }
    };

    fetchFeedback();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setDisabled(feedback.trim().length > 0 && feedback.trim().length <= 5);
  }, [feedback]);

  const submit = async () => {
    if (loadingState === "error") {
      router.back();
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post("/ride/feedback", {
        rideID,
        howLikely: rating,
        extraFeedback: feedback.trim().length > 0 ? feedback : undefined,
      });
      if (!ok(res)) {
        const error = getErrorMessage(res, "Could not submit feedback.");
        setToast({
          title: "Unexpected error",
          description: error,
          onDismiss: () => setToast(null),
          isError: true,
        });
      } else {
        setToast({
          title: "Feedback received",
          description: "Thank you for your feedback!",
          onDismiss: () => setToast(null),
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
      <View className="flex-col gap-4 mt-safe mb-8">
        <FontText className="font-medium text-2xl">Ride Completed</FontText>
        <FontText className="text-lg">Thank you for using Sure Walk!</FontText>
        <View className="mt-2 h-[1px] w-full bg-slate-200" />
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
          className="flex-col pb-4 pt-[-16px] px-5 gap-4 h-full"
          bottomOffset={40}
        >
          {loadingState === "loading" && <ActivityIndicator />}
          {loadingState === "done" && (
            <>
              <FontText className="text-xl font-semibold mb-4 mt-4">
                Ride details
              </FontText>
              <View className="flex-col gap-2">
                <FontText className="text-lg">{`${new Date(submittedAt).toLocaleDateString("en-US", { timeZone: "America/Chicago" })} • ${new Date(submittedAt).toLocaleTimeString("en-US", { timeZone: "America/Chicago" })}`}</FontText>
                <FontText className="text-lg">
                  <FontText className="font-semibold text-lg">
                    Pick up:{" "}
                  </FontText>
                  {pickupLocation}
                </FontText>
                <FontText className="text-lg">
                  <FontText className="font-semibold text-lg">
                    Drop off:{" "}
                  </FontText>
                  {dropoffLocation}
                </FontText>
              </View>
              <View className="my-6 h-[1px] w-full bg-slate-200" />
              <View className="flex-col gap-4">
                <FontText className="text-xl font-semibold">
                  How did we do?
                </FontText>
                <FontText className="text-lg">
                  Help us improve Sure Walk by sharing your experience.
                </FontText>
                <View className="mb-4">
                  <FontText className="text-lg font-semibold mt-2 mb-1">
                    How likely are you to use Sure Walk again?
                  </FontText>
                  <Slider
                    minimumValue={1}
                    maximumValue={5}
                    step={1}
                    value={5}
                    onValueChange={setRating}
                    minimumTrackTintColor={UTBurntOrange}
                    maximumTrackTintColor={slate200}
                    thumbSize={Platform.OS === "android" ? 20 : undefined}
                  />
                  <View className="mt-1 flex-row justify-between">
                    {Array.from({ length: 5 }, (_, i) => i + 1).map((i) => (
                      <FontText className="text-lg font-semibold" key={i}>
                        {i}
                      </FontText>
                    ))}
                  </View>
                  <View className="mt-2 flex-row justify-between">
                    <FontText className="text-md color-slate-400">
                      Poor
                    </FontText>
                    <FontText className="text-md color-slate-400">
                      Excellent
                    </FontText>
                  </View>
                </View>
                <TextInputField
                  fieldName="Anything else you'd like us to know?"
                  placeholder="Share your feedback..."
                  value={feedback}
                  onChangeText={setFeedback}
                  maxLength={2000}
                  textAlignVertical="top"
                  styleProps={{ marginTop: 8 }}
                />
              </View>
            </>
          )}
        </KeyboardAwareScrollView>
      </View>
      <LargeButton
        title={submitting ? "Submitting..." : "Return Home"}
        onPress={submit}
        disabled={submitting || disabled}
      />
    </View>
  );
};

export default Feedback;
