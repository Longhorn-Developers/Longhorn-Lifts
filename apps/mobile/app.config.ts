import "tsx/cjs";

import { ExpoConfig } from "expo/config";

const config = ({ _config }: { _config: ExpoConfig }) => ({
  name: "Sure Walk",
  slug: "longhorn-lifts",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/ios-light.png",
  scheme: "surewalk",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: "org.longhorndevelopers.longhornlifts",
    config: {
      usesNonExemptEncryption: false,
    },
    icon: {
      dark: "./assets/images/ios-dark.png",
      light: "./assets/images/ios-light.png",
      tinted: "./assets/images/ios-tinted.png",
    },
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        "Sure Walk needs your location to determine the pickup location, and display where you are relative to your driver.",
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      monochromeImage: "./assets/images/adaptive-icon-monochrome.png",
      backgroundColor: "#ffffff",
    },
    package: "org.longhorndevelopers.longhornlifts",
    permissions: [
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.ACCESS_COARSE_LOCATION",
    ],
    googleServicesFile: "./google-services.json",
  },
  androidNavigationBar: {
    backgroundColor: "#00000000",
    barStyle: "light-content",
  },
  androidStatusBar: {
    backgroundColor: "#00000000",
    barStyle: "light-content",
    translucent: true,
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/adaptive-icon.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        ios: {
          image: "./assets/images/splash-icon.png",
          imageWidth: 300,
          resizeMode: "cover",
          backgroundColor: "#BF5700",
        },
        android: {
          image: "./assets/images/splash-icon-android.png",
          imageWidth: 300,
          resizeMode: "cover",
          backgroundColor: "#BF5700",
        },
      },
    ],
    [
      "expo-secure-store",
      {
        configureAndroidBackup: true,
      },
    ],
    [
      "expo-font",
      {
        fonts: [
          "node_modules/@expo-google-fonts/geist/100Thin/Geist_100Thin.ttf",
          "node_modules/@expo-google-fonts/geist/200ExtraLight/Geist_200ExtraLight.ttf",
          "node_modules/@expo-google-fonts/geist/300Light/Geist_300Light.ttf",
          "node_modules/@expo-google-fonts/geist/400Regular/Geist_400Regular.ttf",
          "node_modules/@expo-google-fonts/geist/500Medium/Geist_500Medium.ttf",
          "node_modules/@expo-google-fonts/geist/600SemiBold/Geist_600SemiBold.ttf",
          "node_modules/@expo-google-fonts/geist/700Bold/Geist_700Bold.ttf",
          "node_modules/@expo-google-fonts/geist/800ExtraBold/Geist_800ExtraBold.ttf",
          "node_modules/@expo-google-fonts/geist/900Black/Geist_900Black.ttf",
        ],
      },
    ],
    [
      "react-native-permissions",
      {
        iosPermissions: ["LocationWhenInUse"],
      },
    ],
    "react-native-edge-to-edge",
    "expo-notifications",
    "./plugins/withMapsSDKSecretsPlugin.ts",
    "./plugins/withSecretsManifest.ts",
  ],
  experiments: {
    typedRoutes: true,
  },
  owner: "longhorn-lifts",
  extra: {
    eas: {
      projectId: "ba38d70d-e9a3-4170-868c-36a0393aa6bc",
    },
  },
});

export default config;
