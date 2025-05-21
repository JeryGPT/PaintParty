<?php

$request = $_SERVER['REQUEST_URI'];

if (str_starts_with($request, '/api/')) {
    $apiPath = realpath(__DIR__ . '/../Server/api/' . basename($request) . ".php");
    if ($apiPath && file_exists($apiPath)) {
        include $apiPath;
        exit;
    } else {
        http_response_code(404);
        echo "API endpoint not found.";
        exit;
    }
}

$file = __DIR__ . parse_url($request, PHP_URL_PATH);
if (file_exists($file) && !is_dir($file)) {
    return false; 
}

include __DIR__ . '/Signin.html';
