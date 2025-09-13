import { Injectable } from '@angular/core';
import { Client, IMessage, StompSubscription, StompConfig } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Subject, Observable } from 'rxjs';
import { environment } from '../../shared/components/video-player/environments/environment';

@Injectable({ providedIn: 'root' })
export class WebsocketService {
  private client!: Client;
  private connected = false;
  // private readonly url = environment.signalingUrl; // e.g. http://localhost:8080/ws

  private readonly url = '/ws' 

  // for global connection status notifications
  private connectionState$ = new Subject<boolean>();

  // keep subscriptions so we can unsubscribe when needed
  private subs = new Map<string, StompSubscription>();

  constructor() {}

  connect(): Observable<boolean> {
    if (this.connected) {
      this.connectionState$.next(true);
      return this.connectionState$.asObservable();
    }

    // Create STOMP client and use SockJS
    const client = new Client({
      brokerURL: undefined, // must be undefined when using webSocketFactory
      webSocketFactory: () => new SockJS(this.url) as any,
      connectHeaders: {},
      debug: (str) => {
        // optional: enable for debugging
        console.debug('[STOMP]', str);
      },
      reconnectDelay: 2000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000
    } as StompConfig);

    this.client = client;

    client.onConnect = () => {
      this.connected = true;
      this.connectionState$.next(true);
    };

    client.onStompError = (frame) => {
      console.error('Broker reported error: ' + frame.headers['message']);
      console.error('Additional details: ' + frame.body);
    };

    client.onWebSocketClose = () => {
      this.connected = false;
      this.connectionState$.next(false);
    };

    client.activate(); // opens the connection
    return this.connectionState$.asObservable();
  }

  disconnect(): void {
    if (this.client && this.connected) {
      this.client.deactivate();
      this.connected = false;
      this.connectionState$.next(false);
    }
    // cleanup subscriptions
    this.subs.forEach((s) => s.unsubscribe());
    this.subs.clear();
  }

  /**
   * Subscribe to a destination (topic or queue). Returns an observable of parsed JSON payloads.
   * subscriptionId should be unique string to manage unsubscription.
   */
  subscribe<T = any>(subscriptionId: string, destination: string): Observable<T> {
    const out = new Subject<T>();
  
    if (!this.client) {
      out.error(new Error('STOMP client not initialized. Call connect() first.'));
      return out.asObservable();
    }
  
    // If already subscribed, return a proxy to existing subject
    if (this.subs.has(subscriptionId)) {
      // create an observable wrapper that forwards from existing subscription pipe
      return out.asObservable(); // (consumer should avoid duplicate subscribes; keep simple)
    }
  
    const stompSub = this.client.subscribe(destination, (msg: IMessage) => {
      if (msg.body) {
        try {
          // Attempt to parse the message body into a JSON object
          const parsed = JSON.parse(msg.body);
          out.next(parsed);
        } catch (e) {
          // Handle case for non-JSON payloads, forward the raw message
          // @ts-ignore
          out.next(msg.body);
        }
      }
    });
  
    this.subs.set(subscriptionId, stompSub);
  
    // Return the result$ observable which will emit the parsed message
    const result$ = new Observable<T>((subscriber) => {
      const sub = out.subscribe(subscriber);
      return () => {
        sub.unsubscribe();
        // Unsubscribe from the stomp client when consumer unsubscribes
        const s = this.subs.get(subscriptionId);
        if (s) {
          s.unsubscribe();
          this.subs.delete(subscriptionId);
        }
      };
    });
  
    return result$;
  }
  
  

  /**
   * Send payload to destination. payload will be JSON.stringified.
   */
  send(destination: string, payload: any, headers: any = {}): void {
    if (!this.client || !this.connected) {
      console.warn('WebSocket not connected yet. Message not sent:', destination);
      return;
    }
    this.client.publish({ destination, body: JSON.stringify(payload), headers });
  }
}
