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
        let id = uuidv4();
        ConnManager.peers[id] = { ws:ws, ip:ws._socket.remoteAddress, peers:  Object.keys(ConnManager.peers).sort(() => .5 - Math.random()).slice(0, 5), peersConn: {} };
        return {id: id};
    },
    authPeer: (data) => {
        if(!ConnManager.blacklist[data.ws._socket.remoteAddress]) {
            if(!data.id || !(uuidValidate(data.id) && uuidVersion(data.id) === 4)) {
                data = { ...data, ...ConnManager.createPeer(data.ws) };
            } else if(!ConnManager.peers[data.id]) {
                ConnManager.peers[data.id] = { ws:data.ws, ip:data.ws._socket.remoteAddress, peers: Object.keys(ConnManager.peers).sort(() => .5 - Math.random()).slice(0, 5), peersConn: {} };
            } else {
                ConnManager.peers[data.id].ws = data.ws;
                ConnManager.peers[data.id].ip = data.ws._socket.remoteAddress;
            }
            return data;
        }
        return false;
    },
    resolver: {
        getPeers: (data) => {
            return {
                resolve: 'send',
                ws: data.ws,
                data: {
                    resolve: 'evalConnectionPool',
                    id: data.id,
                }
            }
        },
        createOffer: (data) => {
            let result = {
                resolve: 'send',
                ws: data.ws,
                data: {
                    resolve: 'cancelOffer',
                    id: data.id,
                    connection_key: data.connection_key,
                }
            }
            ConnManager.peers[data.id].peers.map(key => {
                if(!ConnManager.peers[data.id].peersConn[key]) {
                    let peer = ConnManager.peers[key];
                    data.offer_id = uuidv4();
                    ConnManager.peers[data.id].peersConn[key] = {offer_id: data.offer_id};
                    ConnManager.peers[key].peersConn[data.id] = {offer_id: data.offer_id, connection_key: data.connection_key};
                    result = {
                        resolve: 'send',
                        ws: peer.ws,
                        data: {
                            resolve: 'receiveOffer',
                            id: key,
                            offer: data.sessionDescription,
                            offer_id: data.offer_id,
                        }
                    }
                }
            }) 
            return result;
        },
        createAnswer: (data) => {
            let result = null
            Object.keys(ConnManager.peers[data.id].peersConn).map(key => {
                let peerData = ConnManager.peers[data.id].peersConn[key];
                if(peerData.offer_id && peerData.offer_id == data.offer_id) {
                    ConnManager.peers[key].peersConn[data.id].connection_key = data.connection_key;
                    let peer = ConnManager.peers[key];
                    result = {
                        resolve: 'send',
                        ws: peer.ws,
                        data: {
                            resolve: 'receiveAnswer',
                            id: key,
                            answer: data.sessionDescription,
                            connection_key: peerData.connection_key,
                            offer_id: data.offer_id,
                        }
                    }
                }
            });
            return result;
        },
        sendIce: (data) => {
            let result = null;
            Object.keys(ConnManager.peers[data.id].peersConn).map(key => {
                let peerData = ConnManager.peers[data.id].peersConn[key];
                if(peerData.offer_id && peerData.offer_id == data.offer_id) {
                    let peer = ConnManager.peers[key];
                    result = {
                        resolve: 'send',
                        ws: peer.ws,
                        data: {
                            resolve: 'receiveIce',
                            id: key,
                            connection_key: ConnManager.peers[data.id].peersConn[key].connection_key,
                            iceCandidate: data.iceCandidate
                        }
                    }
                }
            });
            return result;
        }
    },
    handleMessage: (data) => {
        data = ConnManager.authPeer(data)
        return data && data.resolve ? ConnManager.resolver[data.resolve](data) : null;
    }
}