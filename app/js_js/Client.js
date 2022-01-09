// I/o channel <-> Actions
const Client = {
    blackList: {}, // If another users is lying/tempering with data, he'll get shadowbanned
    connectionPool: {},
    socket: {
        value: null,
        sendMessage: function(message) {
            this.getSocket.value.send(message);
        },
        handleMessage: function(event) {
            console.log(event)
        }
    },
    getSocket: socket.value ? socket.value : function() { // Initiale/Return WebSocket connection.
        this.socket.value = new WebSocket('ws://localhost:8080', {
            perMessageDeflate: false
        });
        // Connection opened
        this.socket.value.addEventListener('open', function (event) {
            console.log(event)
        });
        // Connection closed
        this.socket.value.addEventListener('close', function (event) {
            console.log(event)
        });
        // Listen for messages
        socket.addEventListener('message', function (event) {
            this.socket.handleMessage(event)
        });
    }
}
Client.getSocket();






