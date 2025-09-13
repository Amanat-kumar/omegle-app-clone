import { Injectable } from '@angular/core';
import { WebsocketService } from './websocket.service';
import { BehaviorSubject, Subject } from 'rxjs';
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
            await this.ws.connect();

            // Subscribe to the signaling channel and process the message as SignalPayload
            this.ws.subscribe<SignalPayload>(`signal_${sessionId}`, `/topic/signal/${sessionId}`).subscribe({
                next: (payload: SignalPayload) => {
                    this.signal$.next(payload); // This is a correctly typed SignalPayload
                },
                error: (err) => {
                    console.error('Error in WebSocket subscription:', err);
                }
            });
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
