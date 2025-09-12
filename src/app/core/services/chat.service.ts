import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { SignalingService } from './signaling.services';
import { HttpClient } from '@angular/common/http';

interface ChatMessage {
  type: 'OFFER' | 'ANSWER' | 'ICE_CANDIDATE' | 'MATCH' | 'LEAVE';
  senderId: string;
  receiverId?: string;
  payload?: any;
}

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private localStream: MediaStream | null = null;
  private peerConnection!: RTCPeerConnection;
  private remoteStream = new BehaviorSubject<MediaStream | null>(null);

  remoteStream$ = this.remoteStream.asObservable();
  private currentUserId: string = '';

  constructor(private signalingService: SignalingService, private http: HttpClient) {}

  async init(userId: string): Promise<void> {
    this.currentUserId = userId;

    // Get media devices
    this.localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    // Init PeerConnection
    this.peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    // Add local tracks
    this.localStream.getTracks().forEach(track => {
      this.peerConnection.addTrack(track, this.localStream!);
    });

    // Capture remote stream
    this.peerConnection.ontrack = (event) => {
      this.remoteStream.next(event.streams[0]);
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.signalingService.sendMessage({
          type: 'ICE_CANDIDATE',
          senderId: this.currentUserId,
          payload: event.candidate,
        });
      }
    };

    // Subscribe to signaling messages
    this.signalingService.messages$.subscribe((msg: ChatMessage) => {
      this.handleSignalingMessage(msg);
    });
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  async createOffer(): Promise<void> {
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    this.signalingService.sendMessage({
      type: 'OFFER',
      senderId: this.currentUserId,
      payload: offer,
    });
  }

  async createAnswer(offer: RTCSessionDescriptionInit): Promise<void> {
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    this.signalingService.sendMessage({
      type: 'ANSWER',
      senderId: this.currentUserId,
      payload: answer,
    });
  }

  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  private async handleSignalingMessage(msg: ChatMessage): Promise<void> {
    switch (msg.type) {
      case 'OFFER':
        await this.createAnswer(msg.payload);
        break;
      case 'ANSWER':
        await this.handleAnswer(msg.payload);
        break;
      case 'ICE_CANDIDATE':
        await this.addIceCandidate(msg.payload);
        break;
      case 'MATCH':
        console.log('Matched with:', msg.receiverId);
        break;
      case 'LEAVE':
        this.endCall();
        break;
    }
  }

    // Start a random chat session (matches with another user)
  startRandomChat(): Observable<ChatSession> {
    return this.http.post<ChatSession>(`${this.apiUrl}/start`, {});
  }

  // Get chat session by ID
  getChatSession(sessionId: string): Observable<ChatSession> {
    return this.http.get<ChatSession>(`${this.apiUrl}/${sessionId}`);
  }

  endCall(): void {
    this.peerConnection?.close();
    this.remoteStream.next(null);
  }
}
