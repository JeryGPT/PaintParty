const express = require('express');
const http = require('http');
const { Server } = require('socket.io'); 
const CryptoJS = require("crypto-js");

const key = "afa42da3lp";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
    cors: {
      origin: "http://localhost:8000", 
      credentials: true 
    }
  });

function verifyJwt(token){
  if (token){
    token = token.split('account_token=')[1]
    const [header, payload, signature] = token.split('.')

    const data = header + '.' + payload
    console.log(data)
    // domyślnie .toString(CryptoJS.enc.Hex) → ciąg hex (bez base64)
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

io.on('connection', (socket) => {
  const verify_JWT = verifyJwt(socket.handshake.headers.cookie)
  if (verify_JWT){
    socket.username = verify_JWT
  }else{
    socket.emit('kickOut');
    socket.disconnect();
  }
  console.log('A user connected:', socket.id);

    socket.on('drawData', data => {
        socket.broadcast.emit('updateBoard', data)
    })
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });

  socket.on('updatePosition', (x, y, tool) => {
    const user = socket.username
    socket.broadcast.emit('changeUserPosition', {'user' : user, 'x': x, 'y': y, 'tool': tool})
  })
});




server.listen(3000, () => {
  console.log('Node.js socket server running on port 3000');
});
