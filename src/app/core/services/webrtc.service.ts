import { Injectable } from '@angular/core';
import { environment } from '../../shared/components/video-player/environments/environment';

@Injectable({ providedIn: 'root' })
export class WebrtcService {
  private pc?: RTCPeerConnection;

  createPeer(): RTCPeerConnection {
    this.pc?.close();
    this.pc = new RTCPeerConnection({ iceServers: environment.stunServers });
    return this.pc;
  }

  getPeer(): RTCPeerConnection {
    if (!this.pc) throw new Error('Peer not created');
    return this.pc;
  }

  close() { this.pc?.close(); this.pc = undefined; }
}
