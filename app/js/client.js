// I/o channel <-> Actions
const Client = {
    id: null,
    getId: () => {
        Client.id = util.getCookie('id');
    },
    setId: (id) => {
        if(id && Client.id != id) {
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
            if(Client.MessageQueue.process && Client.MessageQueue.messageQueue.length) {
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
        getSocket: function() { 
            return Client.Socket.socket ? Client.Socket.socket : function() {
                Client.Socket.socket = new WebSocket('ws://localhost:8080');
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
                    Client.MessageQueue.messageQueue.push({type:'Socket', data: JSON.parse(event.data)});
                    Client.MessageQueue.pull();
                });
            }();
        },
        resolver: {
            // Look up current connections and determine if there is 
            evalConnectionPool: async (data) => {
                // If less then 5 peers offer 
                if(Client.Peers.peers.length < 5) {
                    Client.WebRTC.createOffer();
                }             
            },
            receiveOffer: (data) =>  {
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
            Client.Socket.getSocket().send(JSON.stringify({...message, id: Client.id}));
        },
    },
    WebRTC : {
        // STUN server config for Internet Connectivity Establishment without TURN for now
        iceConfig: {
            iceServers: [
                {url:'stun:stun01.sipphone.com'},
                {url:'stun:stun.ekiga.net'},
                {url:'stun:stun.fwdnet.net'},
                {url:'stun:stun.ideasip.com'},
                {url:'stun:stun.iptel.org'},
                {url:'stun:stun.rixtelecom.se'},
                {url:'stun:stun.schlund.de'},
                {url:'stun:stun.l.google.com:19302'},
                {url:'stun:stun1.l.google.com:19302'},
                {url:'stun:stun2.l.google.com:19302'},
                {url:'stun:stun3.l.google.com:19302'},
                {url:'stun:stun4.l.google.com:19302'},
                {url:'stun:stunserver.org'},
                {url:'stun:stun.softjoys.com'},
                {url:'stun:stun.voiparound.com'},
                {url:'stun:stun.voipbuster.com'},
                {url:'stun:stun.voipstunt.com'},
                {url:'stun:stun.voxgratia.org'},
                {url:'stun:stun.xten.com'},
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
        createOffer: async () => {
            let connectionObject = {
                peerConnection: new RTCPeerConnection(Client.WebRTC.iceConfig.iceServers),
                sendChannel: null,
                iceCandidates: [],
                iceReady: false
            };
            Client.WebRTC.registerConnectionEvents(connectionObject.peerConnection);
            connectionObject.sendChannel = connectionObject.peerConnection.createDataChannel("sendChannel");
            Client.WebRTC.registerChannelEvent(connectionObject.sendChannel)
            let sessionDescription = await connectionObject.peerConnection.createOffer();
            connectionObject.peerConnection.setLocalDescription(sessionDescription);
            Client.Peers.peers.push(connectionObject);
            Client.Socket.sendMessage({
                route: 'ConnManager',
                resolve: 'createOffer',
                sessionDescription: sessionDescription,
                connection_key: Client.Peers.peers.length - 1
            });
        },
        createAnswer: (data) => {
            let connectionObject = {
                peerConnection: new RTCPeerConnection(Client.WebRTC.iceConfig.iceServers),
                sendChannel: null,
                iceCandidates: [],
                iceReady: false
            };
            Client.WebRTC.registerConnectionEvents(connectionObject.peerConnection);
            connectionObject.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer)).then(async () => {
                let sessionDescription = await connectionObject.peerConnection.createAnswer();
                connectionObject.peerConnection.setLocalDescription(sessionDescription)
                connectionObject.peerConnection.ondatachannel = (event) => {
                    connectionObject.sendChannel = event.channel;
                    Client.WebRTC.registerChannelEvent(connectionObject.sendChannel)
                };
                Client.Peers.peers.push(connectionObject);
                connectionObject.peerConnection.onicecandidate = e => Client.WebRTC.sendIce({iceCandidate: e.candidate, connection_key: Client.Peers.peers.length - 1, offer_id: data.offer_id})
                Client.Socket.sendMessage({
                    route: 'ConnManager',
                    resolve: 'createAnswer',
                    sessionDescription: sessionDescription,
                    offer_id: data.offer_id,
                    connection_key: Client.Peers.peers.length - 1,
                });
                connectionObject.iceReady = true;
                Client.WebRTC.drainRemoteIceCandidates(connectionObject)
            });
        },
        registerConnectionEvents: (peerConnection) => {
            peerConnection.onconnectionstatechange = (e) => console.log(e)
            peerConnection.onsignalingstatechange = (e) => console.log(e)
            peerConnection.onicegatheringstatechange = (e) => console.log(e)
            peerConnection.onicecandidateerror = (e) => console.log(e)
            peerConnection.onaddstream = (e) => console.log(e)
            peerConnection.onnegotiationneeded = (e) => console.log(e)
        },
        registerChannelEvent: (sendChannel) => {
            sendChannel.onmessage = () => console.log('message');
            sendChannel.onopen = () => console.log('open');
            sendChannel.onclose = () => console.log('close');
        },
        receiveAnswer: (data) => {
            Client.Peers.peers[data.connection_key].peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer))
            Client.Peers.peers[data.connection_key].peerConnection.onicecandidate = e =>  Client.WebRTC.sendIce({iceCandidate: e.candidate, connection_key: Client.Peers.peers.length - 1, offer_id: data.offer_id})
            Client.Peers.peers[data.connection_key].iceReady = true;
            Client.WebRTC.drainRemoteIceCandidates(Client.Peers.peers[data.connection_key])
        },
        receiveIce: (data) => {
            Client.Peers.peers[data.connection_key].iceCandidates.push(data.iceCandidate);
            Client.WebRTC.drainRemoteIceCandidates(Client.Peers.peers[data.connection_key])
        },
        sendIce: (data) => {
            console.log(data)
            if(!data.iceCandidate) return
            Client.Socket.sendMessage({
                route: 'ConnManager',
                resolve: 'sendIce',
                ...data
            });
        },
        drainRemoteIceCandidates: (connectionObject) => {
            if(connectionObject.iceReady) {
                let size = connectionObject.iceCandidates.length
                connectionObject.iceCandidates.forEach(async (iceCandidate) => {
                    try {
                        await connectionObject.peerConnection.addIceCandidate(new RTCIceCandidate(iceCandidate))
                    } catch (e) {
                        console.log("Failed to add remote ICE candidate", e)
                    }
                })
                connectionObject.iceCandidates = []
                console.log(`${size} received remote ICE candidates added to local peer`)
            }
        }
    },
}
Client.Socket.getSocket();






