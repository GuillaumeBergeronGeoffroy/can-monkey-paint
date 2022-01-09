// Websocket server
import WebSocket, { WebSocketServer } from 'ws';
import { ConnManager } from './services.js';

const wss = new WebSocketServer({
    port: 8080,
});

const actions = {
    broadcast: (data, ws = null) => {
        wss.clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(data);
            }
        });
    },
    sendTo: (data, ws) => {
        ws.send(data);
    }
};

const routes = {
    ConnManager: ConnManager
}

wss.on('connection', (ws) => {
    ws.on('message',  async (data) => {
        data = JSON.parse(data);
        data.ws = ws;
        let result = data.route ? await routes[data.route].handleMessage(data) : null
        result && result.action && actions[result.action] ? actions[result.action](JSON.stringify(result.data), result.ws) : null
    });
});