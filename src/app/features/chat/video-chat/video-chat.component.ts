import { Component, OnDestroy, OnInit } from '@angular/core';
import { BehaviorSubject, Subject, takeUntil, filter, delay, firstValueFrom } from 'rxjs';
import { ChatService } from '../../../core/services/chat.service';
import { WebrtcService } from '../../../core/services/webrtc.service';
import { SignalingService } from '../../../core/services/signaling.services';
import { AuthService } from '../../../core/services/auth.services';
import { TextChatService } from '../../../core/services/text-chat.service';
import { SignalPayload } from '../../../core/models/signal-message-model';
import { VideoPlayerComponent } from '../../../shared/components/video-player/video-player.component';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'app-video-chat',
  templateUrl: './video-chat.component.html',
  styleUrls: ['./video-chat.component.scss'],
  imports: [VideoPlayerComponent, AsyncPipe]
})
export class VideoChatComponent implements OnInit, OnDestroy {
  localStream$ = new BehaviorSubject<MediaStream | null>(null);
  remoteStream$ = new BehaviorSubject<MediaStream | null>(null);
  sessionId?: number;
  myUserId!: number;
  partnerUserId?: number;

  private pc!: RTCPeerConnection;
  private destroy$ = new Subject<void>();
  private makingOffer = false;
  private ignoreOffer = false;
  private isSettingRemoteAnswerPending = false;

  micOn = true;
  camOn = true;
  connecting = false;
  connectionState: RTCPeerConnectionState = 'new';

  // FAANG-level retry and circuit breaker patterns
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private retryCount = 0;
  private readonly CONNECTION_TIMEOUT = 30000; // 30 seconds
  private connectionTimeoutId?: number;

  constructor(
    private chat: ChatService,
    private rtc: WebrtcService,
    private signaling: SignalingService,
    private auth: AuthService,
    private textChat: TextChatService
  ) { }

  async ngOnInit() {
    this.myUserId = parseInt(localStorage.getItem('userId')!);
    await this.initLocalMedia();

    // Setup global error handling
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));
  }

  ngOnDestroy() {
    this.cleanup();
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));
  }

  async startRandom() {
    console.log("Starting random chat session...");
    this.connecting = true;
    this.retryCount = 0;

    const maxRetries = 10; // Try for ~30 seconds

    while (this.retryCount < maxRetries) {
      try {
        const sess = await firstValueFrom(this.chat.startRandom());
        // Success - proceed with session
        this.sessionId = sess.id;
        await this.signaling.joinSession(sess.id);
        console.log(`✅ Joined session: ${sess.id}`);

        await this.setupPeer();
        this.listenSignals();
        this.setConnectionTimeout();

        setTimeout(async () => {
          if (!this.isPolite() && this.pc.signalingState === 'stable') {
            await this.initiateCall();
          }
        }, 1000);

        this.connecting = false;
        return; // Exit the retry loop

      } catch (error: any) {
        if (error.message?.includes('Waiting for another user')) {
          console.log(`⏳ Waiting... Attempt ${this.retryCount + 1}/${maxRetries}`);
          this.retryCount++;
          await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
        } else {
          console.error("Error starting random chat:", error);
          this.connecting = false;
          return;
        }
      }
    }

    // Max retries reached
    console.log("❌ Max retries reached. No partner found.");
    this.connecting = false;
  }

  private async initLocalMedia() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: { echoCancellation: true, noiseSuppression: true }
      });
      this.localStream$.next(stream);
      console.log("Local media initialized");
    } catch (error) {
      console.error("Error accessing media devices:", error);
      throw error;
    }
  }

  private async setupPeer() {
    console.log("Setting up peer connection...");

    this.pc = this.rtc.createPeer();

    // Connection state monitoring
    this.pc.onconnectionstatechange = () => {
      this.connectionState = this.pc.connectionState;
      console.log(`Connection state: ${this.connectionState}`);

      if (this.connectionState === 'connected') {
        this.clearConnectionTimeout();
      } else if (this.connectionState === 'failed') {
        this.handleConnectionFailure();
      }
    };

    // ICE connection state monitoring
    this.pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection state: ${this.pc.iceConnectionState}`);
    };

    // Add local tracks to peer connection
    const localStream = this.localStream$.value;
    if (localStream) {
      localStream.getTracks().forEach(track => {
        console.log(`Adding local track: ${track.kind}`);
        this.pc.addTrack(track, localStream);
      });
    }

    // Handle remote streams
    const remoteStream = new MediaStream();
    this.remoteStream$.next(remoteStream);

    this.pc.ontrack = (event) => {
      console.log(`Received remote track: ${event.track.kind}`);
      event.streams[0].getTracks().forEach(track => {
        remoteStream.addTrack(track);
      });

      // Force video element to update
      this.remoteStream$.next(new MediaStream(remoteStream.getTracks()));
    };

    // Handle ICE candidates
    this.pc.onicecandidate = (event) => {
      if (event.candidate && this.sessionId) {
        console.log("Sending ICE candidate");
        this.signaling.send('ICE', {
          fromUserId: this.myUserId,
          ice: event.candidate.toJSON()
        });
      }
    };

    // Handle negotiation needed
    this.pc.onnegotiationneeded = async () => {
      try {
        console.log("Negotiation needed");
        this.makingOffer = true;
        await this.pc.setLocalDescription(await this.pc.createOffer());
        this.signaling.send('OFFER', {
          fromUserId: this.myUserId,
          sdp: this.pc.localDescription!
        });
      } catch (error) {
        console.error("Error during negotiation:", error);
      } finally {
        this.makingOffer = false;
      }
    };
  }

  private listenSignals() {
    this.signaling.signals$()
      .pipe(
        takeUntil(this.destroy$),
        filter(sig => sig.fromUserId !== this.myUserId) // Filter out own messages
      )
      .subscribe({
        next: async (sig: SignalPayload) => {
          console.log(`Received signal: ${sig.type} from user ${sig.fromUserId}`);

          // Store partner user ID
          if (!this.partnerUserId) {
            this.partnerUserId = sig.fromUserId;
          }

          try {
            switch (sig.type) {
              case 'OFFER':
                await this.handleOffer(sig);
                break;
              case 'ANSWER':
                await this.handleAnswer(sig);
                break;
              case 'ICE':
                await this.handleIceCandidate(sig);
                break;
              case 'LEAVE':
                this.endSession();
                break;
            }
          } catch (error) {
            console.error(`Error handling ${sig.type} signal:`, error);
          }
        },
        error: (error) => {
          console.error("Error in signaling:", error);
        }
      });
  }

  private async initiateCall() {
    console.log("Initiating call as impolite peer");
    try {
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      this.signaling.send('OFFER', {
        fromUserId: this.myUserId,
        sdp: this.pc.localDescription!
      });
    } catch (error) {
      console.error("Error initiating call:", error);
    }
  }

  private async handleOffer(sig: SignalPayload) {
    console.log("Handling offer");

    const offerCollision = this.makingOffer || this.pc.signalingState !== 'stable';
    this.ignoreOffer = !this.isPolite() && offerCollision;

    if (this.ignoreOffer) {
      console.log("Ignoring offer due to collision");
      return;
    }

    this.isSettingRemoteAnswerPending = false;
    await this.pc.setRemoteDescription(sig.sdp!);

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    this.signaling.send('ANSWER', {
      fromUserId: this.myUserId,
      sdp: this.pc.localDescription!
    });
  }

  private async handleAnswer(sig: SignalPayload) {
    console.log("Handling answer");

    if (this.isSettingRemoteAnswerPending) {
      return;
    }

    this.isSettingRemoteAnswerPending = true;
    await this.pc.setRemoteDescription(sig.sdp!);
    this.isSettingRemoteAnswerPending = false;
  }

  private async handleIceCandidate(sig: SignalPayload) {
    console.log("Handling ICE candidate");

    try {
      await this.pc.addIceCandidate(sig.ice!);
    } catch (error) {
      if (!this.ignoreOffer) {
        console.error("Error adding ICE candidate:", error);
      }
    }
  }

  // Polite peer determination: higher userId is polite
  private isPolite(): boolean {
    return this.partnerUserId ? this.myUserId > this.partnerUserId : false;
  }

  private setConnectionTimeout() {
    this.connectionTimeoutId = window.setTimeout(() => {
      console.log("Connection timeout reached");
      this.handleConnectionFailure();
    }, this.CONNECTION_TIMEOUT);
  }

  private clearConnectionTimeout() {
    if (this.connectionTimeoutId) {
      clearTimeout(this.connectionTimeoutId);
      this.connectionTimeoutId = undefined;
    }
  }

  private handleConnectionFailure() {
    console.log("Handling connection failure");
    this.clearConnectionTimeout();

    if (this.retryCount < this.MAX_RETRY_ATTEMPTS) {
      this.retryCount++;
      console.log(`Connection failed, retrying... Attempt ${this.retryCount}/${this.MAX_RETRY_ATTEMPTS}`);
      setTimeout(() => this.startRandom(), 3000);
    } else {
      console.error("Max retry attempts reached");
      this.endSession(true);
    }
  }

  private handleUnhandledRejection(event: PromiseRejectionEvent) {
    console.error("Unhandled promise rejection:", event.reason);
    event.preventDefault();
  }

  toggleMic() {
    this.micOn = !this.micOn;
    this.localStream$.value?.getAudioTracks().forEach(track => {
      track.enabled = this.micOn;
    });
  }

  toggleCam() {
    this.camOn = !this.camOn;
    this.localStream$.value?.getVideoTracks().forEach(track => {
      track.enabled = this.camOn;
    });
  }

  async nextPartner() {
    this.endSession(true);
    // Wait a bit before starting new session to clean up properly
    setTimeout(() => this.startRandom(), 1000);
  }

  endSession(notify = false) {
    console.log("Ending session");

    if (notify && this.sessionId) {
      this.signaling.send('LEAVE', { fromUserId: this.myUserId });
    }

    this.cleanup();
  }

  private cleanup() {
    console.log("Cleaning up resources");

    this.clearConnectionTimeout();
    this.rtc.close();

    // Stop remote stream tracks
    this.remoteStream$.value?.getTracks().forEach(track => track.stop());
    this.remoteStream$.next(null);

    // Reset state
    this.sessionId = undefined;
    this.partnerUserId = undefined;
    this.makingOffer = false;
    this.ignoreOffer = false;
    this.isSettingRemoteAnswerPending = false;
    this.retryCount = 0;

    this.destroy$.next();
  }
}