<?php
/**
 * 检查当前登录状态
 * GET /api/auth/check.php
 */

require_once __DIR__ . '/../lib/CORS.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/Database.php';
require_once __DIR__ . '/../lib/Auth.php';

$db = Database::pdo();
$user = Auth::user($db);

if (!$user) {
    Response::json(['logged_in' => false]);
}

Response::json([
    'logged_in' => true,
    'user' => [
        'id' => (int)$user['id'],
        'phone' => Auth::maskPhone($user['phone']),
        'nickname' => $user['nickname'],
        'avatar' => $user['avatar'],
        'free_quota' => (int)$user['free_quota'],
    ],
]);
