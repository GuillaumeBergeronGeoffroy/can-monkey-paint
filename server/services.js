// API - Business logic
// Create UUID
// Initiate pool, add to pool, remove from pool, broadcast change to pool, broadcast whole pool
import {v4 as uuidv4} from 'uuid';
import { version as uuidVersion } from 'uuid';
import { validate as uuidValidate } from 'uuid';

export const ConnManager = {
    peers: {},
    blacklist: {},
    createPeer: (ws) => {
        let newId = uuidv4();
        ConnManager.peers[newId] = { ws:ws, ip:ws._socket.remoteAddress };
        return newId;
    },
    authPeer: (data) => {
        if(!ConnManager.blacklist[data.ws._socket.remoteAddress]) {
            if(!data.id || !(uuidValidate(data.id) && uuidVersion(data.id) === 4)) {
                data.id = ConnManager.createPeer(data.ws);
            } else if(!ConnManager.peers[data.id]) {
                ConnManager.peers[data.id] = { ws:data.ws, ip:data.ws._socket.remoteAddress }
            } else {
                ConnManager.peers[data.id].ws = data.ws;
                ConnManager.peers[data.id].ip = data.ws._socket.remoteAddress;
            }
            return true;
        }
        return false;
    },
    resolver: {
        getPeers: (data) => {
            return {
                action: 'sendTo',
                ws: data.ws,
                data: {
                    resolve: 'evalConnectionPool',
                    id: data.id,
                    peers: Object.keys(ConnManager.peers)
                }
            }
        }
    },
    handleMessage: (data) => {
        return ConnManager.authPeer(data) && data.resolve && ConnManager.resolver[data.resolve] ? ConnManager.resolver[data.resolve](data) : null
    }
}