import express from 'express';
import http from 'http';
import { Server } from 'socket.io'; 
import CryptoJS from "crypto-js";
import cors from 'cors';
import { join } from 'path';
import { verifyJwt, generateJwt, login, register } from './auth.js';
import { env } from 'process';
const IP = "0.0.0.0"
const PORT = 2000
import path from 'path';
import exp from 'constants';


const app = express();
app.use(express.urlencoded({ extended: true }));
const server = http.createServer(app);
app.use(cors({
  origin: `http://0.0.0.0:2000`
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
    "players" : [],
    "last_quit" : 0,
  }

}

function* codeGenerator() {
  while (1) {
    yield Math.floor( Math.random() * 1000000 + 100000)
  }
}

function* idGenerator() {
  while (1) {
    yield String(Math.floor( Math.random() * 1000000000 + 100000000))
  }
}


const gen = codeGenerator()
const id_gen = idGenerator()


const io = new Server(server, { 
    cors: {
      origin: "http://localhost:8000", 
      credentials: true 
    },
  });




function updateArt(data, id){
    if (!lobbies[id]) return;
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

function retreiveNicknames(id = null){
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
    if (lobbies[id].players.length == 0 && id !== 'public' && ((lobbies[id].visibility == true && lobbies[id].last_quit + 10 < Math.floor(Date.now() / 1000)) ||(lobbies[id].visibility == false && lobbies[id].last_quit + 120 < Math.floor(Date.now() / 1000))) ){ //usun prywatne lobby jak przez 10s nikogo niema i publiczne jak 120s
        delete lobbies[id];
      
    }
  }
}

function getLobbiesData() {
  let data = [];
  checkForEmptyLobbies()

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


setTimeout(() => {
  getLobbiesData()
}, 5000)

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
  if (!id) return
  users_online[username].lobby_id = "public"
  const idx = lobbies[id].players.indexOf(username);
    if (idx !== -1) {
      lobbies[id].players.splice(idx, 1);
  }
  if (id) {
    lobbies[id].last_quit = Date.now() / 1000
    if (!lobbies[id]) return
    
    lobbies[id].players.forEach(player => {
      const playerSocket = users_online[player]?.socket;
      if (playerSocket){
        io.to(playerSocket).emit('users', retreiveNicknames(id));
        io.to(playerSocket).emit('removeUser',  username) 
      }
    });
  }
  getLobbiesData();
  
}

function addToLobby(username, id, socket, code, owner=false) {
  
  const lobby = lobbies[id];
  if (!lobby) {
    socket.emit('joinError', 'Lobby not found.');
    return false;
  }

  if (lobbies[id].code){
    if (lobbies[id].code != code){
      console.log('wypierdalaj')
      return
    }
  }
  removeFromLobby(username); 
  lobby.players.push(username);

  users_online[username].in_lobby = id;
  if (!lobby.players.includes(username)) {
    lobby.players.push(username);
  }

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

function getSpecificCookie(cookies, cookie_name) {
  if (!cookies) return;
  const cookies_splitted = cookies.split("; ");
  for (let cookie of cookies_splitted) {
    if (cookie.startsWith(cookie_name)) {
      return cookie.split('=')[1];
    }
  }
  return null
}


io.on('connection', (socket) => {
  const user_token = socket.handshake.auth.token
  const verify_JWT = verifyJwt(user_token)
  console.log("TOKEN: ", user_token)

 
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
          io.to(playerSocket).emit('users', retreiveNicknames(lobbyId));
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
      if (user_lobby){
        updateArt(data, user_lobby)
        console.log(user_lobby, 'user_lobby', lobbies)
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
    io.emit('users', retreiveNicknames())
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
          io.to(playerSocket).emit('users', retreiveNicknames(lobbyId));
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
      if (!lobbies[id]) return;
      lobbies[id].players.forEach(player => {
        const playerSocket = users_online[player]?.socket;
        if (playerSocket){
          io.to(playerSocket).emit('users', retreiveNicknames(id));
        }
      });
    }
  })

  socket.on('fetchLobbies', () => {
    getLobbiesData();
  })
});

function createLobby(name, description, space, visibility) {
  const id = id_gen.next().value
  let code;
  if (visibility) {
    code = gen.next().value;
  }else{
    code = null;
    visibility = false;
  }
  lobbies[id] = {
    "name" : name,
    "desc" : description,
    "space" : space,
    "visibility" : visibility,
    "code" : code,
    "board" : {},
    "players" : [],
    "last_quit" : Math.floor(Date.now() / 1000)
  }
  return id
}

app.post('/api/createLobby', (req, res) => {
  const values = req.body
  const desc = values.desc
  const name = values.name
  const space = values.space
  let visibility = values.visibility;
  console.log('vos',visibility)
  const socket_instance = io.sockets.sockets.get(values.socketid)
  const username = socket_instance.username;




  const new_lobby_id = createLobby(name, desc, space, visibility);
  const new_lobby = lobbies[new_lobby_id]
  console.log("NEW LOBBY: ", lobbies)

  addToLobby(username, new_lobby_id, socket_instance, new_lobby.code, true)
  getLobbiesData();

})

app.post("/api/login", async (req, res) => {
  const values = req.body;
  const username = values.username;
  const password = values.password;
  const cookie = values.cookie;
  const action = values.action
  console.log(action, ' dad a', values)
  if (action == "cookie_login") {
    console.log("CL")
    if (verifyJwt(cookie)){
      return res.json({success: true, token: values.cookie, message: "login successfull"});
    }else{
      return res.json({success: false, message: "token expired"});
      
    }
  }
  if (await login(username, password)) {
    return res.json({success: true, "token": generateJwt(username), message: "login successfull"});
  }else{
   return  res.json({success: false, "error": "User doesn't exist or the password is incorrect"});
  }

})
app.use(express.static(path.resolve('..', 'Public')));

app.get('/', (req, res) => {
  res.sendFile(path.resolve('..', 'Public', 'Signin.html'));
});

server.listen(PORT, IP, () => {
  console.log('Node.js socket server running on port 2000');
});
