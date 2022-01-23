// Websocket server
import WebSocket, { WebSocketServer } from 'ws';
import { ConnManager } from './services.js';

const Server = {
    server: null,
    routes: {
        ConnManager: ConnManager
    },
    resolver: {
        broadcast: (data, ws = null) => {
            wss.clients.forEach(client => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(data);
                }
            });
        },
        send: (data, ws) => {
            ws.send(data);
        }
    },
    run: () => {
        Server.server = new WebSocketServer({
            port: 8080,
        });
        Server.server.on('connection', (ws) => {
            ws.on('message', (data) => {
                console.log(data)
                data = {...JSON.parse(data), ws:ws };
                let result = Server.routes[data.route].handleMessage(data)
                result && result.resolve && Server.resolver[result.resolve] ? Server.resolver[result.resolve](JSON.stringify(result.data), result.ws) : null
            });
        });
    },
}
Server.run();
