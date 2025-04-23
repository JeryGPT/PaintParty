<?php
if (!extension_loaded('mysqli')) {
    die('mysqli extension is not enabled');
}
$servername = "kmpv0.h.filess.io";
$username = "PaintParty_wouldbare";
$password = "94b5e499dc49cc1b2d83df35f18efb52f5db4f46";
$dbname = "PaintParty_wouldbare";
$max_connections = 5;
$conn = new mysqli($servername, $username, $password, $dbname);




if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo "Method Not Allowed";
    exit;
} else if ($_POST['action']){
    $action = $_POST['action'];
    echo($action);
    $username = mysqli_real_escape_string($conn, $_POST['username']);
    $password = mysqli_real_escape_string($conn, $_POST['password']);


    if ($action == "register"){
        $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

        $passwordRepeat = mysqli_real_escape_string($conn, $_POST['repeat-password']);


    
        $sql = "INSERT INTO users (username, password) VALUES (?, ?)";

        $stmt = $conn -> prepare($sql);
        $stmt -> bind_param("ss", $username, $hashedPassword);
        if ($stmt->execute()) {
            echo "User registered successfully!";
        } else {
            echo "Error: " . $stmt->error;
        }

    }else if ($action == "login"){
        $sql = "SELECT password FROM users WHERE username = ?";

        $stmt = $conn -> prepare($sql);
        $stmt -> bind_param("s", $username);

        $stmt -> execute();
        $stmt->store_result();
        if ($stmt->num_rows == 1){
            $stmt -> bind_result($dbPassword);
            $stmt->fetch();
            if (password_verify($password, $dbPassword)) {
                echo ("Logged in as " . $username);
            } else {
                echo "Invalid password.";
            }
        };
    }
    

    $conn->close();
}
?>
