<?php
/**
 * CORS 与会话启动
 * 在所有 API 入口文件 require_once 此文件即可统一处理。
 */

// 允许的来源（生产环境建议改为站点自身域名）
$allowed_origins = [
    'http://localhost',
    'http://localhost:8080',
    'http://127.0.0.1',
];

$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
if ($origin && in_array($origin, $allowed_origins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Credentials: true');
} else {
    // 同源部署或未指定 Origin 时，允许自身
    header('Access-Control-Allow-Origin: *');
}

header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// 统一开启 session，用于维持登录态
if (session_status() === PHP_SESSION_NONE) {
    // 使用更安全的 session cookie 属性
    session_set_cookie_params([
        'lifetime' => 86400 * 7,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}
