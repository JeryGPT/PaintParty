<?php
if (!extension_loaded('mysqli')) {
    die('mysqli extension is not enabled');
}

$JWT_KEY = 'TOTALFUCKINGNIGERALIBABAKEBABILOVWEKEBABANDGYROSGYROSJESTZAJEBISTYDAMN';

$servername = "kmpv0.h.filess.io";
$username = "PaintParty_wouldbare";
$password = "94b5e499dc49cc1b2d83df35f18efb52f5db4f46";
$dbname = "PaintParty_wouldbare";
$max_connections = 5;
$conn = new mysqli($servername, $username, $password, $dbname);


function create_response($success, $message, $cookie=""){
    if ($cookie == ""){
        return json_encode(["success" => $success, "message" => $message]);
    }else{
        return json_encode(["success" => $success, "message" => $message, "cookie" => $cookie]);
    }
}

function generate_JWT($username){
    $jwt_header = json_encode(["alg" => "HS256", "typ" => "JWT"]);
    $jwt_payload = json_encode(["username" => $username, "exp" => time() + 43_200]);
    $data = base64_encode($jwt_header) . "." . base64_encode($jwt_payload);
    $data = str_replace('=', '', $data);
    $jwt = base64_encode($jwt_header) . "." . base64_encode($jwt_payload) . "." . base64_encode(hash_hmac('sha256', $data, $JWT_KEY));
    $jwt = str_replace('=', '', $jwt);
    return $jwt;
}

function check_JWT($JWT){
    $fragments = explode('.', $JWT);
    
    $data = $fragments[0] . '.' . $fragments[1];
    $decoded_payload = json_decode(base64_decode($fragments[1]), true);
    $secret = rtrim(base64_encode(hash_hmac('sha256', $data, $JWT_KEY)), "=");
    if ($secret == $fragments[2]){
        if ($decoded_payload['exp'] > time()){
            return $decoded_payload['username'];
        }else{
            return false;
        }
    }else{
        return false;
    }
}
//$nigameon = generate_JWT("NIGAMELOOON");

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    $resp = create_response(false, "Method Not Allowed");
    echo $resp;
    $conn->close();
    exit;
} else if ($_POST['action']){
    $action = $_POST['action'];


    if ($action == "register"){
        $username = mysqli_real_escape_string($conn, $_POST['username']);
        $password = mysqli_real_escape_string($conn, $_POST['password']);
        $remember = $_POST['remember'] ?? false;
        
        $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

        $passwordRepeat = mysqli_real_escape_string($conn, $_POST['repeat-password']);
        
        if ($passwordRepeat != $password){
            $resp = create_response(false, "Password are not the same");
            echo $resp;
            $conn->close();
            exit ;
            
        }

    
        $sql = "INSERT INTO users (username, password) VALUES (?, ?)";

        $stmt = $conn -> prepare($sql);
        $stmt -> bind_param("ss", $username, $hashedPassword);
        try {
            if ($stmt->execute()) {
                if ($remember){
                    $resp = create_response(true, "User registered successfully!", $cookie=generate_JWT($username));
                }else{
                    $resp = create_response(true, "User registered successfully!");
                }
                echo $resp;
            }
        } catch (mysqli_sql_exception $e) {
            if ($stmt->errno == 1062) {
                $resp = create_response(False, "User with this nickname exists");
                echo $resp;

            } else {
                $resp = create_response(False, "Server error");
                echo $resp;
            }
        }

        

    }else if ($action == "login"){
        $username = mysqli_real_escape_string($conn, $_POST['username']);
        $password = mysqli_real_escape_string($conn, $_POST['password']);
        $remember = $_POST['remember'] ?? false;
    
        $sql = "SELECT password FROM users WHERE username = ?";

        $stmt = $conn -> prepare($sql);
        $stmt -> bind_param("s", $username);

        $stmt -> execute();
        $stmt->store_result();
        if ($stmt->num_rows == 1){
            $stmt -> bind_result($dbPassword);
            $stmt->fetch();
            if (password_verify($password, $dbPassword)) {
                $resp;
                if ($remember){
                    $resp = create_response(True, "Logged in as " . $username, $cookie=generate_JWT($username));
                }else{
                    $resp = create_response(True, "Logged in as " . $username);
                }
                echo $resp;

            } else {
                $resp = create_response(false, "Incorrect username or password");
                echo $resp; 
            }
        }else{
            usleep(rand(150000, 210000));
            $resp = create_response(false, "Incorrect username or password");
            echo $resp;
        }
    }else if ($action=="cookie_login"){

        $checked_jwt = check_JWT($_POST['cookie']);
        if ($checked_jwt){
            echo create_response(true, "Logged in as: " . $checked_jwt);
        }else{
            echo create_response(false, 'Invalid Token');
        }

    }
    

    $conn->close();
}
?>
