const express = require('express');
const http = require('http');
const { Server } = require('socket.io'); 
const CryptoJS = require("crypto-js");

const key = "afa42da3lp";

const app = express();
const server = http.createServer(app);
let art = {}
let users_online = {}
let spam_interval = {}
let messages = []
const io = new Server(server, { 
    cors: {
      origin: "http://localhost:8000", 
      credentials: true 
    },
  });

function verifyJwt(token){
  if (token){
    token = token.split('account_token=')[1]
    if (!token) return
    const [header, payload, signature] = token.split('.')

    const data = header + '.' + payload
    console.log(data)
    const hex_js = btoa(CryptoJS.HmacSHA256(data, key)).replace('==', '');
    if (hex_js === signature){
      const decoded_header = atob(header);
      const decoded_payload = JSON.parse(atob(payload))
      const now = Math.floor(Date.now() / 1000)
      if (decoded_payload.exp >= now){
        console.log('valid: ', decoded_payload.username, ' for: ', decoded_payload.exp - now, 's', now)
        return decoded_payload.username
      }
    }
  }
  return false
}


function updateArt(data){
  for (let px in data){

    if (!art[px] && data[px].color != 'transparent'){
      art[px] = { 'color' : data[px].color}
    }else{
      if (data[px].color != 'transparent'){
        art[px].color = data[px].color
      }else{
        delete art[px]
      }
    }
  }
}

function retreive_nicknames(){
  let nicks = [];
  for (let user in users_online){
    nicks.push(user)
  }

  return nicks
}

io.on('connection', (socket) => {
  const verify_JWT = verifyJwt(socket.handshake.headers.cookie)
  if (verify_JWT){
    socket.username = verify_JWT
    socket.emit('setCanvas', art)
    users_online[socket.username] = {'socket': socket.id}
    spam_interval[socket.username] = {'time' : Date.now()}
    io.emit('newMessage', 'User ' + socket.username + " joined.")

    io.emit('users', retreive_nicknames())
  }else{
    socket.emit('kickOut');
    socket.disconnect();
  }
  console.log('A user connected:', socket.id);

    socket.on('drawData', data => {
      updateArt(data)
        socket.broadcast.emit('updateBoard', data)
    })
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    delete users_online[socket.username]
    delete spam_interval[socket.username]
    io.emit('users', retreive_nicknames())
    io.emit('removeUser', socket.username)
    io.emit('newMessage', 'User ' + socket.username + " left.")
  });

  socket.on('updatePosition', (x, y, tool) => {
    const user = socket.username
    socket.broadcast.emit('changeUserPosition', {'user' : user, 'x': x, 'y': y, 'tool': tool})
  })



  socket.on('getUsers', () => {
    socket.emit('users', retreive_nicknames());
  })
  

  socket.on('newMessage', message => {
    if (spam_interval[socket.username]){
      if (spam_interval[socket.username]['time'] < Date.now()){
        spam_interval[socket.username] = {'time' : Date.now() + 1500}
        io.emit('newMessage', socket.username + ": " + message)
      }
    }
  })
});

server.listen(3000, '192.168.0.119', () => {
  console.log('Node.js socket server running on port 3000');
});
