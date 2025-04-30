const color_input = document.getElementById('color-input')
const canvas = document.getElementById("canv")
const grid_canvas = document.getElementById("grid")
const ctx = canvas.getContext('2d', { willReadFrequently: true })
const ctx_grid = grid_canvas.getContext('2d')
const size_input = document.getElementById('size-input')
const size_text = document.getElementById('size-text')
const body = document.querySelector('body')
ctx.imageSmoothingEnabled = false;
const grid_frequency = 8
const width = canvas.width;
const height = canvas.height;
let mouse_down = false;
let undo_stack = []
let current_move = {}
const MAX_UNDO = 10
let changed_pixels = {}
let tool = 'brush'
let image_data;
const bucket_btn = document.getElementById('bucket')
const brush_btn = document.getElementById('brush')
const user_template = document.getElementById('user-template')
const drawing_space = document.getElementById('drawing-space')
ctx_grid.lineWidth = 0.1
size = 1
const socket = io("http://localhost:3000", {
    transports: ["websocket"],
    withCredentials: true
});




//MULTIPLAYER SHIT RAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH
setInterval(() => {
    if (Object.keys(changed_pixels).length > 0){
        socket.emit('drawData', changed_pixels);
        console.log(changed_pixels)
        changed_pixels = {} 
    }
}, 50)

socket.on('updateBoard', (data) => {
    for (let px in data){
        console.log(data[px])
        changePixel(px.split(',')[0],px.split(',')[1], data[px].color, false, false)
    }
})

socket.on('kickOut', () => {
    document.cookie = '';
    document.location.href = 'signin.html'
})

function addUsersCursor(user){
    const user_template_copy = user_template.cloneNode(true);
    const user_template_copy_nickname = user_template_copy.querySelector('p')
    user_template_copy_nickname.innerText = user
    user_template_copy.setAttribute('user', user)
    user_template_copy.style.display = 'block'
    drawing_space.appendChild(user_template_copy)
}


function changeUsersPosition(user,x,y,tool){
    const target_user = getUsersFrame(user)
    console.log(tool)
    const target_user_icon = target_user.querySelector('img')
    switch (tool) {
        case 'bucket' : {
            console.log('niga')
            target_user_icon.src = './assets/img/bucket.svg'
            break
        }
        case 'brush' : {
            target_user_icon.src = './assets/img/cursor.svg'
            break
        }
    }
    if (target_user){
        target_user.style.top = `${y}px`
        target_user.style.left = `${x}px`
    }
}

function getUsersFrame(user){
    const target_user = drawing_space.querySelector(`div[user=${user}]`)
    if (target_user) return target_user
    return false
}

socket.on('changeUserPosition', data => {
    console.log(data)
    const user = data.user;
    const x = data.x;
    const y = data.y;
    const tool = data.tool

    const target_user = getUsersFrame(user)
    if (!target_user){
        addUsersCursor(user)
    }
    changeUsersPosition(user, x, y, tool)
})

canvas.addEventListener('mousemove', (e) => {
    socket.emit('updatePosition',e.offsetX, e.offsetY, tool)
})




//END OF MULTIPLAYER SHIT RAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH


grid_canvas.style.cursor = "url('./assets/img/cursor.svg') 0 0, auto";



bucket_btn.addEventListener('mousedown', () => {
    tool = 'bucket'
    body.style.cursor = `url('./assets/img/bucket.svg') 0 22, auto`
})

brush_btn.addEventListener('mousedown', () => {
    tool = 'brush'
    body.style.cursor = `url('./assets/img/cursor.svg') 0 0, auto`
})




function drawBoard() {
    ctx_grid.fillStyle = '#b3b3b3'

    for (let x = 0; x <= width; x += grid_frequency) {
        ctx_grid.beginPath();
        ctx_grid.moveTo(x, 0);
        ctx_grid.lineTo(x, height);
        ctx_grid.stroke();
    }



    for (let y = 0; y <= height; y += grid_frequency) {
        ctx_grid.beginPath();
        ctx_grid.moveTo(0, y)
        ctx_grid.lineTo(width, y)
        ctx_grid.stroke();
    }

}

drawBoard();

function getPixelColor(x, y) {
    const data = ctx.getImageData(x * grid_frequency, y * grid_frequency, 1, 1).data
    if (data[3] == 0) {
        return 'transparent'
    }
    return `rgb(${data[0]}, ${data[1]}, ${data[2]})`;
}

function fixXY(x, y) { // zwraca x i y odpowiadajace gridzie
    const fixed_x = Math.floor(x / grid_frequency)
    const fixed_y = Math.floor(y / grid_frequency)
    return [fixed_x, fixed_y]
}



function calculateSurrounding(cx, cy) {
    cx = Math.floor(cx);
    cy = Math.floor(cy);
    //tutaj zapytalem chatgpt zeby powiedzial mi jak to moge wykonac, dal mi te rownanie
    //(x - cx)² + (y - cy)² <= r²
    //x i y to punkt ktory sprawdzam, a cx i cy to punkt ktory klikam, jezeli jest mniejsze lub rowne r2 -> nalezy do kola i moge namalowac to
    //sprawdze otoczenie w zasiegu {size} dookola klikniecia i namaluje te ktore sa w okregu



    let points_to_check = []
    let approved_points = []
    if (size % 2 == 0) {
        size += 1;
    }

    const radius = (size - 1) / 2;


    for (let xx = -radius; xx <= radius; xx++) {
        for (let yy = -radius; yy <= radius; yy++) {
            points_to_check.push([cx + xx, cy + yy])
        }
    }
    //to tworzy kule balls
    points_to_check.forEach(point => {
        const px = point[0];
        const py = point[1];
        const equation = Math.pow((px - cx), 2) + Math.pow((py - cy), 2)

        if (equation <= Math.pow(radius, 2)) {
            approved_points.push(point)
            changePixel(px,py,color_input.value)
        }
    });
}




function undo() {
    const latest_undo_data = undo_stack[undo_stack.length - 1]
    for (key in latest_undo_data) {
        if (latest_undo_data[key].prev_color) {
            changePixel(key.split(',')[0], key.split(',')[1], latest_undo_data[key].prev_color, false)
        }
    }

    undo_stack.pop()
}

function addNewUndo() {
    undo_stack.push({})
}

function modifyLatestUndo(x, y, color, prev_color) {
    const latest_undo = undo_stack.length - 1
    let latest_undo_data = undo_stack[latest_undo]
    if (!latest_undo_data[`${x},${y}`]) {
        latest_undo_data[`${x},${y}`] = {};
        latest_undo_data[`${x},${y}`]['color'] = color
        latest_undo_data[`${x},${y}`]['prev_color'] = prev_color
    } else {
        latest_undo_data[`${x},${y}`]['color'] = color
    }
}

function addPixelToQueue(x, y, color) {
    if (!changed_pixels[`${x},${y}`]) {
        changed_pixels[`${x},${y}`] = {}
        changed_pixels[`${x},${y}`] = {'color' : color};
    } else {
        changed_pixels[`${x},${y}`] = {'color' : color};
    }
}


function changePixel(x, y, color = 'black', save_to_undo = true, yours=true) {//zmienia pixel na canvasie, save_to_undo zapobiega rekursywnemy wykonywaniu przez undo
    if (yours){
        addPixelToQueue(x,y,color)
    }
    if (color == 'transparent'){
        erasePixel(x,y,yours)
        return
    }
    ctx.fillStyle = color;
    if (save_to_undo && yours) {
        modifyLatestUndo(x, y, color, getPixelColor(x, y))
    }
    ctx.fillRect(x * grid_frequency, y * grid_frequency, grid_frequency, grid_frequency);
}


function erasePixel(x, y, yours = true) {
    if (yours){
        addPixelToQueue(x,y,'transparent')
    }
    ctx.clearRect(x * grid_frequency, y * grid_frequency, grid_frequency, grid_frequency)

}
function getColotFromImg(imageData, gx, gy) {
    const x = gx * grid_frequency;
    const y = gy * grid_frequency;
    const data = imageData.data;
    const idx = (y * grid_canvas.width + x) * 4;
    if (data[idx + 3] == 0) {
        return 'transparent'
    }
    return `rgb(${data[idx]}, ${data[idx + 1]}, ${data[idx + 2]})`;
}




let clicked_color;
function fillBucket(x, y, recurrention = false) {
    if (x * grid_frequency < 0 || x * grid_frequency >= grid_canvas.width || y * grid_frequency < 0 || y * grid_frequency >= grid_canvas.height) return
    const width = Math.floor(grid_canvas.width / grid_frequency)
    const height = Math.floor(grid_canvas.height / grid_frequency)
    const visited = new Array(width * height)
    const queue = [[x, y]]
    image_data = ctx.getImageData(0, 0, grid_canvas.width, grid_canvas.height)
    clicked_color = getPixelColor(x, y)

    while (queue.length > 0) {
        const [cx, cy] = queue.shift();
        const index = cy * width + cx;
        if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
        if (visited[index]) continue;

        visited[index] = 1
        changePixel(cx, cy, color_input.value)
        if (getColotFromImg(image_data, cx + 1, cy) === clicked_color) {
            queue.push([cx + 1, cy]);
        }
        if (getColotFromImg(image_data, cx - 1, cy) === clicked_color) {
            queue.push([cx - 1, cy]);
        }
        if (getColotFromImg(image_data, cx, cy + 1) === clicked_color) {
            queue.push([cx, cy + 1]);
        }
        if (getColotFromImg(image_data, cx, cy - 1) === clicked_color) {
            queue.push([cx, cy - 1]);
        }


    }

}


canvas.addEventListener('mousedown', (e) => {
    if (undo_stack[undo_stack.length - 1] == {}) undo_stack.pop()
    addNewUndo();

    mouse_down = true;
    const fixed_xy = fixXY(e.offsetX, e.offsetY)

    const fixed_x = fixed_xy[0]
    const fixed_y = fixed_xy[1]
    switch (tool) {
        case 'bucket': {
            fillBucket(fixed_x, fixed_y)
            break
        }
        case 'brush': {


            calculateSurrounding(fixed_x, fixed_y)
            addPixelToQueue(fixed_x, fixed_y, color_input.value)

            let dat = ctx.getImageData(0, 0, grid_canvas.width, grid_canvas.height)
            break
        }
    }

})

canvas.addEventListener('mouseup', (e) => {
    mouse_down = false;
})
let last_x;
let last_y;


canvas.addEventListener('mousemove', (e) => {
    if (mouse_down) {

        const fixed_xy = fixXY(e.offsetX, e.offsetY)
        const fixed_x = fixed_xy[0]
        const fixed_y = fixed_xy[1]
        calculateSurrounding(fixed_x, fixed_y)

        if (last_y) {    //wygladzanie linii, bez tego troche dziurawe jest
            const dx = fixed_x - last_x;
            const dy = fixed_y - last_y;
            const delta = Math.sqrt(dx * dx + dy * dy); // dlugosc najszybszej drogi (zwyklej prostej) od pozycji z poprzedniego 'ticka' do obecnej

            if (delta > 0.3 * size) { //jezeli zmiana jest wieksza niz 1/3 wielkosci pedzla -> wygladzamy
                const steps = Math.floor(delta / size / 0.3) // dziele te droge na odcinki 1/3 wielkosci pedzla, jest to ilosc dodatkowych punktow miedzy ostatnia i obecna pozycja myszy


                for (let i = 0; i <= steps; i++) {
                    //LERP 
                    //fixed_x - last_x -> przesuniecie myszy
                    // (fixed_x - last_x) * (i/steps) -> i/steps zwraca wartosci od 0 - 1 dzieki czemu dzieli przebyty dystans na czesci    
                    // czyli step 1 z 10 na drodze 100 -> 0.1 * 100 = 10, step 2 -> 20 etc az do konca
                    // to oblicza tylko podzial na kroki, ale trzeba je jeszcze dodac do poprzedniej pozycji, by od niej zaczac wygladzanie
                    // np. z przesuniecia 50 -> 300 zrobi sie 50 -> 100 -> 150 -> 200 -> 250 -> 300
                    const x = last_x + (fixed_x - last_x) * (i / steps)
                    const y = last_y + (fixed_y - last_y) * (i / steps)

                    calculateSurrounding(x, y)
                }
            }
        }
        last_x = fixed_x
        last_y = fixed_y
        addPixelToQueue(fixed_x, fixed_y, color_input.value)



    } else {
        last_y = undefined
    }
})

canvas.addEventListener('mouseleave', e => {
    mouse_down = false;
})


document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key == 'z') {
        console.log('ctrl z')
        undo();
    }
})





size_input.addEventListener('input', e => {
    size_text.innerText = `Size: ${e.target.value}`
    size = size = parseInt(e.target.value);
})