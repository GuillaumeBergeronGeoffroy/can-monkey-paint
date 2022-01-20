// Controller logic called from/to Client and Game
const Actions = {
    initGameState: (state = null) => {
        if(!state) {
            Game.state = 1;
        }
    },
    addPixel: (pixel) => {
        // 
        if(!Game.board[pixel.x + 'x' + pixel.y]) {
            Game.board[pixel.x + 'x' + pixel.y] = {color: pixel.color, id: Client.id}
            Render.drawPixel(pixel)
        }
    }
}
