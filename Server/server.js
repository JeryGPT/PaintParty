const express = require('express');
const http = require('http');
const { Server } = require('socket.io'); 
const CryptoJS = require("crypto-js");
const cors = require('cors');
const { join } = require('path');

const key = "afa42da3lp";

const app = express();
const server = http.createServer(app);
app.use(cors({
  origin: 'http://192.168.0.227:8000'
}));

app.use(express.json());
let users_online = {}
let spam_interval = {}
let messages = []
let lobbies = {
  "public" : {
    "name" : "Public Server",
    "desc" : "Everyone can be here",
    "space" : 100,
    "visibility" : false,
    "code" : null,
    "board" : {},
    "players" : []
  }

}

function* code_generator() {
  while (1) {
    yield Math.floor( Math.random() * 1000000 + 100000)
  }
}

function* id_generator() {
  while (1) {
    yield Math.floor( Math.random() * 1000000000 + 100000000)
  }
}


const gen = code_generator()
const id_gen = id_generator()


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


function updateArt(data, id){
    let board = lobbies[id].board

    for (let px in data){

      if (!board[px] && data[px].color != 'transparent'){
        board[px] = { 'color' : data[px].color}
      }else{
        if (data[px].color != 'transparent'){
          board[px].color = data[px].color
        }else{
          delete board[px]
        }
      }
    }

}

function retreive_nicknames(id = null){
  let nicks = [];
  if (id && lobbies[id]){
    nicks = lobbies[id].players.slice();
  } else {
    for (let user in users_online) {
      nicks.push(user);
    }
  }
  return nicks;
}


function checkForEmptyLobbies(){
  for (let id in lobbies){
    if (lobbies[id].players.length == 0){
      if (id !== "public"){
        delete lobbies[id];
      }
    }
  }
}

function getLobbiesData() {
  checkForEmptyLobbies()
  let data = [];

  for (let lobby_id in lobbies) {
    data.push({
      name: lobbies[lobby_id].name,
      desc: lobbies[lobby_id].desc,
      space: `${lobbies[lobby_id].players.length}/${lobbies[lobby_id].space}`,
      id: lobby_id,
      private: lobbies[lobby_id].visibility
    });
  }
  io.emit('updateLobbies', data)
}

function findUsersLobby(user_username) {
  for (let lobby_id in lobbies) {
    if (lobbies[lobby_id].players.includes(user_username)) {
      return lobby_id;
    }
  }
  return null;
}


function removeFromLobby(username) {
  
  const id = findUsersLobby(username)
  console.log(`in lobby`, id)
  if (!id) return
  const idx = lobbies[id].players.indexOf(username);
    if (idx !== -1) {
      lobbies[id].players.splice(idx, 1);
  }
  getLobbiesData();
  if (id) {
    if (!lobbies[id]) return
    lobbies[id].players.forEach(player => {
      const playerSocket = users_online[player]?.socket;
      if (playerSocket){
        io.to(playerSocket).emit('users', retreive_nicknames(id));
        io.to(playerSocket).emit('removeUser',  username) 
      }
    });
  }
}

function addToLobby(username, id, socket, code, owner=false) {
  const lobby = lobbies[id];
  if (!lobby) {
    socket.emit('joinError', 'Lobby not found.');
    return false;
  }

  if (lobby.visibility && lobby.code !== code) {
    socket.emit('joinError', 'Invalid lobby code.');
    return false;
  }

  if (lobbies[id].code){
    if (lobbies[id].code == code){
      removeFromLobby(username); 

      users_online[username].in_lobby = id;
    }else{

      return
    }
      
  }else{
    removeFromLobby(username); 

    users_online[username].in_lobby = id;
  }
  
  lobby.players.push(username);

  socket.emit('setCanvas', lobby.board);
  lobby.players.forEach(player => {
    const playerSocketId = users_online[player]?.socket;
    if (playerSocketId && playerSocketId !== socket.id) {
      io.to(playerSocketId).emit('newMessage', `${username} joined the lobby.`);
    }
  });
  if (owner){
    console.log(code)
    socket.emit('joinedLobby', lobby.name, code);
  }else{
    socket.emit('joinedLobby', lobby.name, null);

  }
  getLobbiesData();


  return true;
}


io.on('connection', (socket) => {
  const verify_JWT = verifyJwt(socket.handshake.headers.cookie)
  if (verify_JWT){
    socket.username = verify_JWT
    socket.emit('setCanvas', lobbies["public"].board)
    users_online[socket.username] = {'socket': socket.id, 'in_lobby' : "public"}
    spam_interval[socket.username] = {'time' : Date.now()}
    addToLobby(socket.username, "public", socket)
    io.emit('newMessage', 'User ' + socket.username + " joined.")

    const lobbyId = users_online[socket.username]?.in_lobby;
  if (lobbyId) {
    lobbies[lobbyId].players.forEach(player => {
      const playerSocket = users_online[player]?.socket;
      if (playerSocket){
        io.to(playerSocket).emit('users', retreive_nicknames(lobbyId));
      }
    });
  }

  }else{
    socket.emit('kickOut');
    socket.disconnect();
  }
  console.log('A user connected:', socket.id);

    socket.on('drawData', data => {
      const user_lobby = users_online[socket.username].in_lobby
      updateArt(data, user_lobby)

      if (user_lobby){
        lobbies[user_lobby].players.forEach(player =>{
          io.to(users_online[player].socket).emit('updateBoard', data)
        })
      }
    })
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    removeFromLobby(socket.username);
    delete users_online[socket.username]
    delete spam_interval[socket.username]
    io.emit('users', retreive_nicknames())
    io.emit('removeUser', socket.username)
    io.emit('newMessage', 'User ' + socket.username + " left.")
  });

  socket.on('updatePosition', (x, y, tool) => {
    const user = socket.username;
    const user_lobby = users_online[user]?.in_lobby;
  
    if (!lobbies[user_lobby]) return;
    
    lobbies[user_lobby].players.forEach(player => {
      const playerSocketId = users_online[player]?.socket;
      if (playerSocketId && playerSocketId !== socket.id) {
        io.to(playerSocketId).emit('changeUserPosition', {
          user,
          x,
          y,
          tool
        });
      }
    });
  });
  



  socket.on('getUsers', () => {
    const lobbyId = users_online[socket.username].in_lobby
    if (lobbyId) {
      lobbies[lobbyId].players.forEach(player => {
        const playerSocket = users_online[player]?.socket;
        if (playerSocket){
          io.to(playerSocket).emit('users', retreive_nicknames(lobbyId));
        }
      });
    }
  })
  


  socket.on('newMessage', message => {
    const username = socket.username;
    const user_lobby = users_online[username]?.in_lobby;
    if (!user_lobby || !lobbies[user_lobby]) return;
  
    if (spam_interval[username]){
      if (spam_interval[username]['time'] < Date.now()){
        spam_interval[username] = {'time' : Date.now() + 1500};
        lobbies[user_lobby].players.forEach(player => {
          const playerSocket = users_online[player]?.socket;
          if (playerSocket){
            io.to(playerSocket).emit('newMessage', `${username}: ${message}`);
          }
        });
      }
    }
  });
  

  socket.on('joinLobby', (id, code) => {
    addToLobby(socket.username, id, socket, code);
    if (id) {
      lobbies[id].players.forEach(player => {
        const playerSocket = users_online[player]?.socket;
        if (playerSocket){
          io.to(playerSocket).emit('users', retreive_nicknames(id));
        }
      });
    }
  })

  socket.on('fetchLobbies', () => {
    getLobbiesData();
  })
});


app.post('/api/createLobby', (req, res) => {
  const values = req.body
  const desc = values.desc
  const name = values.name
  const space = values.space
  let visibility = values.visibility;
  console.log('vos',visibility)
  const socket_instance = io.sockets.sockets.get(values.socketid)
  const username = socket_instance.username;

  let code;
  if (visibility) {
    code = gen.next().value;
  }else{
    code = null;
    visibility = false;
  }


  const id = id_gen.next().value

  lobbies[id] = {
    "name" : name,
    "desc" : desc,
    "space" : space,
    "visibility" : visibility,
    "code" : code,
    "board" : {},
    "players" : []
  }
  addToLobby(username, id, socket_instance, code, true)

})


server.listen(3000, '192.168.0.227', () => {
  console.log('Node.js socket server running on port 3000');
});
