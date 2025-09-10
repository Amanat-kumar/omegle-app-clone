export interface Environment {
    production: boolean;
    apiBaseUrl: string;
    signalingUrl: string;
    stunServers: RTCIceServer[];
    turnServers?: RTCIceServer[];
}