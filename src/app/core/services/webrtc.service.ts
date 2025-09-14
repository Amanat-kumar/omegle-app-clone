import { Injectable } from '@angular/core';
import { environment } from '../../shared/components/video-player/environments/environment';

export interface WebRTCMetrics {
  connectionsCreated: number;
  connectionsSucceeded: number;
  connectionsFailed: number;
  averageConnectionTime: number;
  lastConnectionTime?: number;
}

@Injectable({ providedIn: 'root' })
export class WebrtcService {
  private pc?: RTCPeerConnection;
  private metrics: WebRTCMetrics = {
    connectionsCreated: 0,
    connectionsSucceeded: 0,
    connectionsFailed: 0,
    averageConnectionTime: 0
  };
  
  // STUN/TURN server failover
  private readonly iceServers = [
    // Google STUN servers (primary)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    
    // Backup STUN servers
    { urls: 'stun:stun.stunprotocol.org:3478' },
    { urls: 'stun:stun.voiparound.com' },
    
    // Add your TURN servers here for production
    // {
    //   urls: 'turn:your-turn-server.com:3478',
    //   username: 'username',
    //   credential: 'password'
    // }
  ];

  createPeer(): RTCPeerConnection {
    const startTime = Date.now();
    this.pc?.close();
    
    try {
      this.pc = new RTCPeerConnection({
        iceServers: this.iceServers,
        iceCandidatePoolSize: 10, // Pre-gather ICE candidates for faster connection
        bundlePolicy: 'max-bundle', // Bundle all media on single connection
        rtcpMuxPolicy: 'require', // Use single port for RTP/RTCP
        iceTransportPolicy: 'all' // Allow both STUN and TURN
      });

      // Add connection monitoring
      this.pc.onconnectionstatechange = () => {
        const connectionTime = Date.now() - startTime;
        
        if (this.pc!.connectionState === 'connected') {
          this.metrics.connectionsSucceeded++;
          this.metrics.lastConnectionTime = connectionTime;
          this.updateAverageConnectionTime(connectionTime);
          console.log(`WebRTC connection established in ${connectionTime}ms`);
        } else if (this.pc!.connectionState === 'failed') {
          this.metrics.connectionsFailed++;
          console.error(`WebRTC connection failed after ${connectionTime}ms`);
        }
      };

      // Enhanced ICE connection monitoring
      this.pc.oniceconnectionstatechange = () => {
        console.log(`ICE connection state: ${this.pc!.iceConnectionState}`);
        
        if (this.pc!.iceConnectionState === 'failed') {
          // Trigger ICE restart
          this.restartIce();
        }
      };

      // Monitor data channel state if using data channels
      this.pc.ondatachannel = (event) => {
        const channel = event.channel;
        console.log(`Data channel received: ${channel.label}`);
        
        channel.onopen = () => console.log(`Data channel ${channel.label} opened`);
        channel.onclose = () => console.log(`Data channel ${channel.label} closed`);
        channel.onerror = (error) => console.error(`Data channel ${channel.label} error:`, error);
      };

      this.metrics.connectionsCreated++;
      console.log('Peer connection created with enhanced configuration');
      
      return this.pc;
    } catch (error) {
      this.metrics.connectionsFailed++;
      console.error('Error creating peer connection:', error);
      throw error;
    }
  }

  getPeer(): RTCPeerConnection {
    if (!this.pc) {
      throw new Error('Peer connection not created. Call createPeer() first.');
    }
    return this.pc;
  }

  // ICE restart for failed connections
  async restartIce(): Promise<void> {
    if (!this.pc) return;
    
    try {
      console.log('Restarting ICE...');
      const offer = await this.pc.createOffer({ iceRestart: true });
      await this.pc.setLocalDescription(offer);
      
      // You'll need to send this offer through your signaling service
      // This is typically handled by your signaling logic
    } catch (error) {
      console.error('Error restarting ICE:', error);
    }
  }

  // Get connection statistics for monitoring
  async getConnectionStats(): Promise<RTCStatsReport | null> {
    if (!this.pc) return null;
    
    try {
      return await this.pc.getStats();
    } catch (error) {
      console.error('Error getting connection stats:', error);
      return null;
    }
  }

  // Get detailed metrics
  getMetrics(): WebRTCMetrics {
    return { ...this.metrics };
  }

  // Reset metrics (useful for testing)
  resetMetrics(): void {
    this.metrics = {
      connectionsCreated: 0,
      connectionsSucceeded: 0,
      connectionsFailed: 0,
      averageConnectionTime: 0
    };
  }

  // Health check for the service
  async healthCheck(): Promise<boolean> {
    try {
      // Create a temporary peer connection to test functionality
      const tempPc = new RTCPeerConnection({ iceServers: this.iceServers });
      const offer = await tempPc.createOffer();
      tempPc.close();
      return true;
    } catch (error) {
      console.error('WebRTC service health check failed:', error);
      return false;
    }
  }

  close(): void {
    if (this.pc) {
      // Gracefully close all tracks and data channels
      this.pc.getSenders().forEach(sender => {
        if (sender.track) {
          sender.track.stop();
        }
      });
      
      this.pc.getReceivers().forEach(receiver => {
        if (receiver.track) {
          receiver.track.stop();
        }
      });
      
      this.pc.close();
      this.pc = undefined;
      console.log('Peer connection closed and cleaned up');
    }
  }

  private updateAverageConnectionTime(newTime: number): void {
    const successCount = this.metrics.connectionsSucceeded;
    if (successCount === 1) {
      this.metrics.averageConnectionTime = newTime;
    } else {
      // Calculate running average
      this.metrics.averageConnectionTime = 
        (this.metrics.averageConnectionTime * (successCount - 1) + newTime) / successCount;
    }
  }
}