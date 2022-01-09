// I/o channel <-> Actions
const Client = {
     // If another users is lying/tempering with data, he'll get shadowbanned
    id: null,
    blackList: {},
    peerConnectionPool: {},
    socket: {
        value: null,
        init: () => {
            Client.id = util.getCookie('id');
            Client.socket.sendMessage({
                id: Client.id,
                route: 'ConnManager',
                resolve: 'getPeers',
            })
        },
        sendMessage: (message) => {
            Client.getSocket().send(JSON.stringify(message));
        },
        resolver: {
            // Look up current connections and determine if there is 
            evalConnexionPool: (data) => {
                util.setCookie('id', data.id);
                Client.peerConnectionPool[data.id] = {};
                let newPeers = data.peers.filter((key) => !Client.peerConnectionPool[key])
                console.log(newPeers)
            },
            receiveOffer: () => {},
            receiveAnswer: () => {}
        },
        handleMessage: (data) => {
            console.log(data)
            return  data.resolve && Client.socket.resolver[data.resolve] ? Client.socket.resolver[data.resolve](data) : console.log(data)
        },
    },
     // Initiale/Return WebSocket connection.
    getSocket: function() { 
        return this.socket.value ? this.socket.value : function() {
            Client.socket.value = new WebSocket('ws://localhost:8080');
            // Connection opened
            Client.socket.value.addEventListener('open', function (event) {
                Client.socket.init();
            });
            // Connection closed / retry every 1 sec
            Client.socket.value.addEventListener('close', function (event) {
                console.log(event)
                setTimeout(() => {
                    Client.socket.value = null;
                    Client.getSocket()
                }, 1000)
            });
            // Listen for messages
            Client.socket.value.addEventListener('message', function (event) {
                Client.socket.handleMessage(JSON.parse(event.data))
            });
        }();
    },
    // TURN server config for signaling
    iceConfiguration: {
        iceServers: [
            {
                urls: 'turn:localhost:19403',
                username: 'optional-username',
                credentials: 'auth-token'
            }
        ]
    },
}
Client.getSocket();






