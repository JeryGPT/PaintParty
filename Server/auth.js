import mysql from "mysql2"
import CryptoJS from "crypto-js";
import bcrypt from "bcrypt";
import dotenv from 'dotenv';
dotenv.config();
const key = process.env.JWT_SECRET
const JWT_EXPIRATION_TIME = 43_200;

var hostname = "3l0wab.h.filess.io";
var database = "PaintParty_pilefollow";
var port = "3307";
var username = "PaintParty_pilefollow";
var password = "5f75379508a3404e898a39babbbc710cf803b8c2";

var connection = mysql.createConnection({
  host: hostname,
  user: username,
  password,
  database,
  port,
});


function verifyJwt(token){
  if (token){
    token = token.replace('account_token=', "")
    if (!token) return
    const [header, payload, signature] = token.split('.')
    if (!header || !payload || !signature) return

    const data = header + '.' + payload
    console.log(data)
    const hex_js = btoa(CryptoJS.HmacSHA256(data, key)).replaceAll('=', '');
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

function generateJwt(username) {
  const header = btoa(JSON.stringify({alg: "HS256", typ: "JWT"}));
  const payload = btoa(JSON.stringify({username : username, exp : Math.floor(Date.now() / 1000) + JWT_EXPIRATION_TIME}));
  const data = (header + "." + payload).replaceAll("=", "");
  const token = [
    header, 
    payload, 
    btoa(CryptoJS.HmacSHA256(data, key)).replaceAll("=", "").toString(CryptoJS.enc.Base64)
  ].join(".");
  return token

}


async function login(username, password) {
  if (!password) return false
  return new Promise((resolve, error) => {
    const query = "SELECT password FROM users WHERE username = ?"
    connection.query(query, [username], async (error, res) => {
      if (error){console.log(error); resolve(false)}
      if (res.length == 0) resolve(false)
      if (await bcrypt.compare(password, res[0].password)){
        resolve(true)
      }
      
    });
  })
  
}

function register(username, password) {
  const query = "INSERT INTO users (username, password) VALUES (?, ?)";
  bcrypt.hash(password, 10, (err, hash) => {
    connection.query(query, [username, hash], (res, err) => {
      console.log(res, err)
    })
  })

}

export {
  verifyJwt,
  generateJwt,
  login,
  register
}
