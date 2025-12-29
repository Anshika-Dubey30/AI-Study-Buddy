import Constants from "expo-constants";
import { Platform } from "react-native";

const getBackendURL = () => {
    // 1. Web
    if (Platform.OS === 'web') return 'http://127.0.0.1:5000';

    // 2. Physical Phone (Expo Go)
    const debuggerHost = Constants.expoConfig?.hostUri;
    if (debuggerHost) {
        const localhost = debuggerHost.split(':')[0];
        return `http://${localhost}:5000`;
    }

    // 3. Android Emulator
    if (Platform.OS === 'android') return 'http://10.0.2.2:5000';

    // 4. iOS / Default
    return 'http://127.0.0.1:5000';
};

export const BASE_URL = getBackendURL();