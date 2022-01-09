// API - Business logic
// Create UUID
// Initiate pool, add to pool, remove from pool, broadcast change to pool, broadcast whole pool
import {v4 as uuidv4} from 'uuid';
import { version as uuidVersion } from 'uuid';
import { validate as uuidValidate } from 'uuid';

export const ConnManager = {
    peers: {},
    createPeer: (ws) => {
        let newId = uuidv4();
        ConnManager.peers[newId] = { ws:ws };
        return newId;
    },
    authPeer: (data) => {
        if(!data.id || !(uuidValidate(data.id) && uuidVersion(data.id) === 4)) {
            data.id = ConnManager.createPeer(data.ws);
        } else if(!ConnManager.peers[data.id]) {
            ConnManager.peers[data.id] = { ws:data.ws }
        } else {
            ConnManager.peers[data.id].ws = data.ws;
        }
    },
    resolver: {
        getPeers: (data) => {
            return {
                action: 'sendTo',
                ws: data.ws,
                data: {
                    resolve: 'evalConnexionPool',
                    id: data.id,
                    peers: Object.keys(ConnManager.peers),
                }
            }
        }
    },
    handleMessage: (data) => {
        ConnManager.authPeer(data);
        return data.resolve && ConnManager.resolver[data.resolve] ? ConnManager.resolver[data.resolve](data) : null
    }
}