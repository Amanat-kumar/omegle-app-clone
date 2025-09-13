export type SignalType = 'OFFER' | 'ANSWER' | 'ICE' | 'LEAVE' | 'PING';

export interface SignalPayload {
  type: SignalType;
  fromUserId: number;
  sdp?: RTCSessionDescriptionInit;
  ice?: RTCIceCandidateInit;
  ts?: number;
}
