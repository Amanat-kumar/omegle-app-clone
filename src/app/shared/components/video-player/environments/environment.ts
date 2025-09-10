import { Environment } from "./environment.model";

export const environment:Environment ={
    production:false,
    apiBaseUrl:'http://localhost:8080',
    signalingUrl:'ws://localhost:8080/ws',
    stunServers:[
        {urls:'stun:stun:l.google.com:19302'}
    ],
    turnServers:[
        {
            urls : 'turn:your-turn-server.com:3478',
            username: 'test',
            credential:'password'
        }
    ]
}