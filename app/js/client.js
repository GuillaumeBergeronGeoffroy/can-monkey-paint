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
        peers: {},
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
                    Render.freeze(false)
                    Client.getId();
                    Client.Socket.sendMessage({
                        route: 'ConnManager',
                        resolve: 'getPeers',
                    })
                });
                // Connection closed / retry every 1 sec
                Client.Socket.socket.addEventListener('close', function (event) {
                    console.log(event)
                    Render.freeze()
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
            evalConnectionPool: (data) => {
                Client.Peers.peers[data.id] = {};
                let newPeers = data.peers.filter((key) => !Client.Peers.peers[key])
                console.log(newPeers)
                // Initiate peerConnection
                Actions.initGameState();
            },
            receiveOffer: () => {},
            receiveAnswer: () => {}
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
                {
                    urls: 'stun:stun.l.google.com:19302',
                }
            ]
        },
    },
}
Client.Socket.getSocket();






