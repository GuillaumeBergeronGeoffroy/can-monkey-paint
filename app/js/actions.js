// Controller logic called from/to Client and Game
const Actions = {
    initGameState: (state = null) => {
        if (!state) {
            Game.state = 1;
        }
    },
    handleAddPixelEvent: (pixel) => {
        Client.WebRTC.sendMessage({
            resolve: 'addPixel',
            pixel: pixel,
            id: Client.publicId
        });
        Actions.addPixel(pixel);
    },
    addPixel: (pixel, id = Client.publicId) => {
        if (!Game.board[pixel.x + 'x' + pixel.y]) {
            Game.board[pixel.x + 'x' + pixel.y] = { color: pixel.color, id: id }
            Render.drawPixel(pixel)
        }
    }
}
