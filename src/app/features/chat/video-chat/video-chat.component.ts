import { Component, OnDestroy, OnInit } from '@angular/core';
import { BehaviorSubject, Subject, takeUntil } from 'rxjs';
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

  private pc!: RTCPeerConnection;
  private destroy$ = new Subject<void>();
  private makingOffer = false;
  private ignoreOffer = false;

  micOn = true;
  camOn = true;
  connecting = false;

  constructor(
    private chat: ChatService,
    private rtc: WebrtcService,
    private signaling: SignalingService,
    private auth: AuthService,
    private textChat: TextChatService
  ) {}

  async ngOnInit() {
    this.myUserId = parseInt(localStorage.getItem('userId')!); // implement in AuthService
    await this.initLocalMedia();
  }

  ngOnDestroy() {
    this.cleanup();
  }

  async startRandom() {
    this.connecting = true;
    this.chat.startRandom().subscribe({
      next: async (sess) => {
        this.sessionId = sess.id;
        await this.signaling.joinSession(sess.id);
        this.setupPeer();
        this.listenSignals();
        await this.maybeCreateOffer();
        this.connecting = false;
      },
      error: () => { this.connecting = false; }
    });
  }

  private async initLocalMedia() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    this.localStream$.next(stream);
  }

  private setupPeer() {
    this.pc = this.rtc.createPeer();

    // Add local tracks
    this.localStream$.value?.getTracks().forEach(t => this.pc.addTrack(t, this.localStream$.value!));

    // Remote stream
    const remote = new MediaStream();
    this.remoteStream$.next(remote);
    this.pc.ontrack = (e) => e.streams[0].getTracks().forEach(t => remote.addTrack(t));

    // ICE
    this.pc.onicecandidate = ({ candidate }) => {
      if (candidate && this.sessionId) {
        this.signaling.send('ICE', { fromUserId: this.myUserId, ice: candidate.toJSON() });
      }
    };

    // Negotiationneeded (polite peer handling)
    this.pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer = true;
        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);
        this.signaling.send('OFFER', { fromUserId: this.myUserId, sdp: this.pc.localDescription! });
      } finally {
        this.makingOffer = false;
      }
    };
  }

  private listenSignals() {
    this.signaling.signals$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(async (sig: SignalPayload) => {
        if (sig.fromUserId === this.myUserId) return; // ignore self

        switch (sig.type) {
          case 'OFFER':  await this.onOffer(sig);  break;
          case 'ANSWER': await this.onAnswer(sig); break;
          case 'ICE':    await this.onIce(sig);    break;
          case 'LEAVE':  this.endSession();        break;
        }
      });
  }

  private async maybeCreateOffer() {
    // Eager offer only if needed; onnegotiationneeded will cover most cases
    // But creating one here helps first peer kick things off.
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.signaling.send('OFFER', { fromUserId: this.myUserId, sdp: this.pc.localDescription! });
  }

  private async onOffer(sig: SignalPayload) {
    const offerCollision = this.makingOffer || this.pc.signalingState !== 'stable';
    this.ignoreOffer = !this.isPolite() && offerCollision;
    if (this.ignoreOffer) return;

    await this.pc.setRemoteDescription(sig.sdp!);
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    this.signaling.send('ANSWER', { fromUserId: this.myUserId, sdp: this.pc.localDescription! });
  }

  private async onAnswer(sig: SignalPayload) {
    await this.pc.setRemoteDescription(sig.sdp!);
  }

  private async onIce(sig: SignalPayload) {
    try {
      await this.pc.addIceCandidate(sig.ice!);
    } catch (err) {
      if (!this.ignoreOffer) throw err;
    }
  }

  // Simple polite rule: higher userId is polite
  private isPolite() { return this.myUserId > (this.sessionId ?? 0); }

  toggleMic() {
    this.micOn = !this.micOn;
    this.localStream$.value?.getAudioTracks().forEach(t => t.enabled = this.micOn);
  }

  toggleCam() {
    this.camOn = !this.camOn;
    this.localStream$.value?.getVideoTracks().forEach(t => t.enabled = this.camOn);
  }

  async nextPartner() {
    this.endSession(true);
    await this.startRandom();
  }

  endSession(notify = false) {
    if (notify && this.sessionId) {
      this.signaling.send('LEAVE', { fromUserId: this.myUserId });
    }
    this.cleanup();
  }

  private cleanup() {
    this.rtc.close();
    this.remoteStream$.value?.getTracks().forEach(t => t.stop());
    this.remoteStream$.next(null);
    this.sessionId = undefined;
    this.destroy$.next();
  }
}
