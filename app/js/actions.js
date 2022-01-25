// Controller logic called from/to Client and Game
const Actions = {
    initGameState: (state = null) => {
        if (!state) {
            Game.state = 1;
        }
    },
    addPixel: (pixel, id = Client.publicId) => {
        if (!Game.board[pixel.x + 'x' + pixel.y]) {
            Client.WebRTC.sendMessage({
                resolve: 'addPixel',
                pixel: pixel,
                id: id
            });
            Game.board[pixel.x + 'x' + pixel.y] = { color: pixel.color, id: id }
            Render.drawPixel(pixel)
        }
    }
}
