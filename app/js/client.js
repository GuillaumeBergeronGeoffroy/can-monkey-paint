// I/o channel <-> Actions
const Client = {
    id: null,
    publicId: null,
    getId: async () => {
        Client.id = util.getCookie('id');
        Client.publicId = await util.sha256(Client.id);
    },
    setId: (id) => {
        if (id && Client.id != id) {
            util.setCookie('id', id);
            Client.getId()
        }
        return true;
    },
    Peers: {
        peers: [],
    },
    MessageQueue: {
        process: true,
        messageQueue: [],
        pull: async () => {
            if (Client.MessageQueue.process && Client.MessageQueue.messageQueue.length) {
                Client.MessageQueue.process = false;
                var message = Client.MessageQueue.messageQueue.shift();
                var result = await Client[message.type].handleMessage(message.data);
                Client.MessageQueue.process = true;
                Client.MessageQueue.pull();
            } else {
                console.log(Client.MessageQueue.process, Client.MessageQueue.messageQueue)
            }
        },
    },
    Socket: {
        socket: null,
        // Initiale/Return WebSocket connection.
        getSocket: () => {
            return Client.Socket.socket ? Client.Socket.socket : function () {
                Client.Socket.socket = new WebSocket('wss://signal.canmonkeypaint.com');
                // Connection opened
                Client.Socket.socket.onopen = (e) => {
                    // Render.freeze(false)
                    Client.getId();
                    Client.Socket.sendMessage({
                        route: 'ConnManager',
                        resolve: 'getPeers',
                    })
                };
                // Connection closed / retry every 1 sec
                Client.Socket.socket.onclose = (e) => {
                    console.log(e)
                    // Render.freeze()
                    Client.Socket.socket = null;
                    setTimeout(() => {
                        Client.Socket.getSocket();
                    }, 1000)
                };
                // Listen for messages
                Client.Socket.socket.onmessage = (e) => {
                    Client.MessageQueue.messageQueue.push({ type: 'Socket', data: JSON.parse(e.data) });
                    Client.MessageQueue.pull();
                };
            }();
        },
        resolver: {
            // Look up current connections and determine if there is 
            evalConnectionPool: async (data) => {
                if (!Client.Peers.peers.length) {
                    Client.WebRTC.createOffer();
                }
            },
            receiveOffer: (data) => {
                Client.WebRTC.createAnswer(data);
            },
            cancelOffer: (data) => {
                Client.Peers.peers[data.connection_key] = null;
            },
            receiveAnswer: (data) => {
                Client.WebRTC.receiveAnswer(data);
            },
            receiveIce: (data) => {
                Client.WebRTC.receiveIce(data);
            }

        },
        handleMessage: async (data) => {
            console.log(data)
            return Client.setId(data.id) && data.resolve && Client.Socket.resolver[data.resolve] ? await Client.Socket.resolver[data.resolve](data) : console.log(data)
        },
        sendMessage: (message) => {
            Client.Socket.getSocket().send(JSON.stringify({ ...message, id: Client.id }));
        },
    },
    WebRTC: {
        // STUN server config for Internet Connectivity Establishment without TURN for now
        iceConfig: {
            'iceServers': [{ 'urls': 'stun:stun.l.google.com:19302' }]
        },
        createConnection: () => {
            let connection = {
                peerConnection: new RTCPeerConnection(Client.WebRTC.iceConfig.iceServers),
                sendChannel: null,
                iceCandidates: [],
                ownCandidate: [],
                iceReady: false
            };
            Client.WebRTC.registerConnectionEvents(connection.peerConnection);
            return connection;
        },
        createOffer: async () => {
            let connection = Client.WebRTC.createConnection();
            connection.sendChannel = connection.peerConnection.createDataChannel("sendChannel");
            Client.WebRTC.registerChannelEvent(connection.sendChannel)
            let offer = await connection.peerConnection.createOffer();
            connection.peerConnection.onicecandidate = (e) => e.candidate && connection.ownCandidate.push(e.candidate)
            connection.peerConnection.setLocalDescription(offer);
            Client.Peers.peers.push(connection);
            Client.Socket.sendMessage({
                route: 'ConnManager',
                resolve: 'createOffer',
                offer: offer,
                connection_key: Client.Peers.peers.length - 1
            });
        },
        createAnswer: (data) => {
            let connection = Client.WebRTC.createConnection();
            connection.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer)).then(async () => {
                let answer = await connection.peerConnection.createAnswer();
                connection.peerConnection.setLocalDescription(answer)
                connection.peerConnection.onicecandidate = e => Client.WebRTC.sendIce({ iceCandidate: e.candidate, connection_key: Client.Peers.peers.length - 1, offer_id: data.offer_id });
                connection.peerConnection.ondatachannel = (event) => {
                    connection.sendChannel = event.channel;
                    Client.WebRTC.registerChannelEvent(connection.sendChannel)
                };
                Client.Peers.peers.push(connection);
                Client.Socket.sendMessage({
                    route: 'ConnManager',
                    resolve: 'createAnswer',
                    answer: answer,
                    offer_id: data.offer_id,
                    connection_key: Client.Peers.peers.length - 1,
                });
                connection.iceReady = true;
                Client.WebRTC.drainRemoteIceCandidates(connection)
            });
        },
        registerConnectionEvents: (peerConnection) => {
            peerConnection.onconnectionstatechange = (e) => console.log(e)
            peerConnection.onsignalingstatechange = (e) => console.log(e)
            peerConnection.onicegatheringstatechange = (e) => console.log(e)
            peerConnection.onicecandidateerror = (e) => console.log(e)
            peerConnection.ontrack = (e) => console.log(e)
            peerConnection.onnegotiationneeded = (e) => console.log(e)
        },
        registerChannelEvent: (sendChannel) => {
            sendChannel.onerror = (error) => console.log(error);
            // Add to MessageQueue
            sendChannel.onmessage = (e) => {
                Client.MessageQueue.messageQueue.push({ type: 'WebRTC', data: JSON.parse(e.data) });
                Client.MessageQueue.pull();
            };
            // Merge board data
            sendChannel.onopen = () => console.log('open');
            // Delete peer -> Trigger offer get new connection
            sendChannel.onclose = () => console.log('close');
        },
        receiveAnswer: (data) => {
            Client.Peers.peers[data.connection_key].peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer))
            Client.Peers.peers[data.connection_key].ownCandidate.map(candidate => Client.WebRTC.sendIce({ iceCandidate: candidate, connection_key: Client.Peers.peers.length - 1, offer_id: data.offer_id }))
            Client.Peers.peers[data.connection_key].iceReady = true;
            Client.WebRTC.drainRemoteIceCandidates(Client.Peers.peers[data.connection_key])
        },
        receiveIce: (data) => {
            Client.Peers.peers[data.connection_key].iceCandidates.push(data.iceCandidate);
            Client.WebRTC.drainRemoteIceCandidates(Client.Peers.peers[data.connection_key])
        },
        sendIce: (data) => {
            console.log(data)
            if (!data.iceCandidate) return
            Client.Socket.sendMessage({
                route: 'ConnManager',
                resolve: 'sendIce',
                ...data
            });
        },
        drainRemoteIceCandidates: (connection) => {
            if (connection.iceReady) {
                let size = connection.iceCandidates.length
                connection.iceCandidates.forEach(async (iceCandidate) => {
                    try {
                        await connection.peerConnection.addIceCandidate(new RTCIceCandidate(iceCandidate))
                    } catch (e) {
                        console.log("Failed to add remote ICE candidate", e)
                    }
                })
                connection.iceCandidates = []
                console.log(`${size} received remote ICE candidates added to local peer`)
            }
        },
        resolver: {
            // Look up current connections and determine if there is 
            addPixel: (data) => {
                data = JSON.parse(data);
                Actions.addPixel(data.pixel, data.id);
            },
        },
        handleMessage: async (data) => {
            console.log(data)
            return data.resolve && Client.WebRTC.resolver[data.resolve] ? await Client.Socket.resolver[data.resolve](data) : console.log(data)
        },
        sendMessage: (data) => {
            try {
                Client.Peers.peers.map((peer) => peer && peer.sendChannel && peer.sendChannel.send(JSON.stringify(data)));
            } catch (e) { }
        },
    },
}
Client.Socket.getSocket();






