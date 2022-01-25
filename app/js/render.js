// Dom Mgmt called from Game
const Render = {
    refs: {
        body: null,
        canvas: null,
        picker: null,
        game_container: null,
        info_container: null,
        info_icon: null,
        back_icon: null,
        dark_icon: null,
        picker_sample: null
    },
    context: null,
    setRefs: () => {
        Object.keys(Render.refs).map(refKey => {
            Render.refs[refKey] = document.getElementById(refKey);
        })
        var picker = new Picker(Render.refs.picker);
        picker.show();
        Render.refs.picker_sample = document.querySelector('.picker_sample');
        Render.context = Render.refs.canvas.getContext('2d');
    },
    initSettings: () => {
        if (util.getCookie('darkmode') == 'false') {
            Render.refs.body.classList.remove('darkmode');
        }
    },
    registerEvents: () => {
        Render.refs.info_icon.onclick = () => {
            Render.refs.game_container.style.display = 'none';
            Render.refs.info_container.style.display = 'block';
            Render.refs.info_icon.style.display = 'none';
            Render.refs.back_icon.style.display = 'block';
        },
            Render.refs.back_icon.onclick = () => {
                Render.refs.game_container.style.display = 'block';
                Render.refs.info_container.style.display = 'none';
                Render.refs.info_icon.style.display = 'block';
                Render.refs.back_icon.style.display = 'none';
            }
        Render.refs.dark_icon.onclick = Render.toggleDarkmode;
        Render.refs.canvas.onclick = (e) => {
            e.isTrusted && Actions.handleAddPixelEvent({ x: e.offsetX, y: e.offsetY, color: Render.refs.picker_sample.style.color })
        }
    },
    toggleDarkmode: () => {
        if (util.getCookie('darkmode') == 'true') {
            Render.refs.body.classList.remove('darkmode');
            util.setCookie('darkmode', false)
        } else {
            Render.refs.body.classList.add('darkmode');
            util.setCookie('darkmode', true)
        }
    },
    freeze: (freeze = true) => {
        if (freeze) {
            Render.refs.body.style.pointerEvents = 'none';
        } else {
            Render.refs.body.style.pointerEvents = 'auto';
        }
    },
    drawPixel: (pixel) => {
        Render.context.beginPath();
        Render.context.fillStyle = pixel.color;
        Render.context.fillRect(pixel.x, pixel.y, 1, 1);
        Render.context.fill();
    }
}
Render.setRefs();
Render.initSettings();
Render.registerEvents();