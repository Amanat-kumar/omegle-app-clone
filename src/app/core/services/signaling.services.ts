import { Injectable } from '@angular/core';
import { WebsocketService } from './websocket.service';
import { Subject } from 'rxjs';
import { SignalPayload, SignalType } from '../models/signal-message-model';

@Injectable({ providedIn: 'root' })
export class SignalingService {
    private sessionId?: number;
    private signal$ = new Subject<SignalPayload>();

    constructor(private ws: WebsocketService) { }

    async joinSession(sessionId: number) {
        this.sessionId = sessionId;

        try {
            // Ensure WebSocket connection is established
            const connectionStatus$ = await this.ws.connect().toPromise();
            
            // Check if the connection is successful
            if (connectionStatus$) {
                console.log('WebSocket connection established');
                // Proceed to subscribe to the signaling channel after the WebSocket connection is established
                this.ws.subscribe<SignalPayload>(`signal_${sessionId}`, `/topic/signal/${sessionId}`).subscribe({
                    next: (payload: SignalPayload) => {
                        this.signal$.next(payload); // This is a correctly typed SignalPayload
                    },
                    error: (err) => {
                        console.error('Error in WebSocket subscription:', err);
                    }
                });
            }
        } catch (error) {
            console.error('Error joining session:', error);
        }
    }

    signals$() { return this.signal$.asObservable(); }

    send(type: SignalType, payload: Omit<SignalPayload, 'type'>) {
        if (!this.sessionId) throw new Error('No session');
        this.ws.send(`/app/signal/${this.sessionId}`, { type, ...payload, ts: Date.now() });
    }
}
