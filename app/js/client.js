// I/o channel <-> Actions
const Client = {
    id: null,
    getId: () => {
        Client.id = util.getCookie('id');
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
            }
        },
    },
    Socket: {
        socket: null,
        // Initiale/Return WebSocket connection.
        getSocket: function () {
            return Client.Socket.socket ? Client.Socket.socket : function () {
                Client.Socket.socket = new WebSocket('wss://signal.canmonkeypaint.com');
                // Connection opened
                Client.Socket.socket.addEventListener('open', function (event) {
                    // Render.freeze(false)
                    Client.getId();
                    Client.Socket.sendMessage({
                        route: 'ConnManager',
                        resolve: 'getPeers',
                    })
                });
                // Connection closed / retry every 1 sec
                Client.Socket.socket.addEventListener('close', function (event) {
                    console.log(event)
                    // Render.freeze()
                    Client.Socket.socket = null;
                    setTimeout(() => {
                        Client.Socket.getSocket();
                    }, 1000)
                });
                // Listen for messages
                Client.Socket.socket.addEventListener('message', function (event) {
                    Client.MessageQueue.messageQueue.push({ type: 'Socket', data: JSON.parse(event.data) });
                    Client.MessageQueue.pull();
                });
            }();
        },
        resolver: {
            // Look up current connections and determine if there is 
            evalConnectionPool: async (data) => {
                // If less then 5 peers offer 
                if (Client.Peers.peers.length < 5) {
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
            iceServers: [
                { url: 'stun:stun01.sipphone.com' },
                { url: 'stun:stun.ekiga.net' },
                { url: 'stun:stun.fwdnet.net' },
                { url: 'stun:stun.ideasip.com' },
                { url: 'stun:stun.iptel.org' },
                { url: 'stun:stun.rixtelecom.se' },
                { url: 'stun:stun.schlund.de' },
                { url: 'stun:stun.l.google.com:19302' },
                { url: 'stun:stun1.l.google.com:19302' },
                { url: 'stun:stun2.l.google.com:19302' },
                { url: 'stun:stun3.l.google.com:19302' },
                { url: 'stun:stun4.l.google.com:19302' },
                { url: 'stun:stunserver.org' },
                { url: 'stun:stun.softjoys.com' },
                { url: 'stun:stun.voiparound.com' },
                { url: 'stun:stun.voipbuster.com' },
                { url: 'stun:stun.voipstunt.com' },
                { url: 'stun:stun.voxgratia.org' },
                { url: 'stun:stun.xten.com' },
                {
                    url: 'turn:numb.viagenie.ca',
                    credential: 'muazkh',
                    username: 'webrtc@live.com'
                },
                {
                    url: 'turn:192.158.29.39:3478?transport=udp',
                    credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
                    username: '28224511:1379330808'
                },
                {
                    url: 'turn:192.158.29.39:3478?transport=tcp',
                    credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
                    username: '28224511:1379330808'
                }
            ]
        },
        createConnection: () => {
            let connection = {
                peerConnection: new RTCPeerConnection(Client.WebRTC.iceConfig.iceServers),
                sendChannel: null,
                iceCandidates: [],
                ownCandidates: [],
                iceReady: false
            };
            Client.WebRTC.registerConnectionEvents(connection);
            return connection;
        },
        createOffer: async (connection) => {
            connection.sendChannel = connection.peerConnection.createDataChannel("sendChannel");
            Client.WebRTC.registerChannelEvent(connection.sendChannel)
            let offer = await connection.peerConnection.createOffer();
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
        registerConnectionEvents: (connection) => {
            // peerConnection.onicecandidate = (e) => console.log(e.iceCandidate) && e.iceCandidate && peerConnection.ownCandidates.push(e.iceCandidate)
            connection.peerConnection.onconnectionstatechange = (e) => console.log(e)
            connection.peerConnection.onsignalingstatechange = (e) => console.log(e)
            connection.peerConnection.onicegatheringstatechange = (e) => console.log(e)
            connection.peerConnection.onicecandidateerror = (e) => console.log(e)
            connection.peerConnection.onaddstream = (e) => console.log(e)
            connection.peerConnection.onnegotiationneeded = (e) => Client.WebRTC.createOffer(connection);
        },
        registerChannelEvent: (sendChannel) => {
            sendChannel.onerror = (error) => console.log(error);
            sendChannel.onmessage = (e) => console.log(e);
            sendChannel.onopen = () => console.log('open');
            sendChannel.onclose = () => console.log('close');
        },
        receiveAnswer: (data) => {
            Client.Peers.peers[data.connection_key].peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer))
            Client.Peers.peers[data.connection_key].peerConnection.onicecandidate = e => Client.WebRTC.sendIce({ iceCandidate: e.candidate, connection_key: Client.Peers.peers.length - 1, offer_id: data.offer_id })
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
        }
    },
}
Client.Socket.getSocket();






