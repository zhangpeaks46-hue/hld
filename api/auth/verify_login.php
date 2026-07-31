<?php
/**
 * 校验验证码并登录
 *
 * POST /api/auth/verify_login.php
 * Body: {"phone":"13800138000","code":"123456"}
 * 返回: {"success":true,"message":"登录成功","user":{"id":1,"phone":"138****8000"}}
 *
 * 登录逻辑：手机号验证码正确即视为登录成功；
 * 若该手机号未注册则自动创建账号（免注册流程）。
 */

require_once __DIR__ . '/../lib/CORS.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/Validator.php';
require_once __DIR__ . '/../lib/Database.php';
require_once __DIR__ . '/../lib/Auth.php';

$smsCfg = require __DIR__ . '/../config/sms_config.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    Response::error('仅支持 POST 请求', 405);
}

$body = Validator::jsonBody();
$phone = trim($body['phone'] ?? '');
$code = trim($body['code'] ?? '');

if (!Validator::phone($phone)) {
    Response::error('手机号格式错误');
}
if ($code === '') {
    Response::error('请输入验证码');
}

$db = Database::pdo();

// 查找最近一条未使用且未过期的验证码
$stmt = $db->prepare(
    'SELECT id, code, expires_at FROM verification_codes
     WHERE phone = ? AND used = 0
     ORDER BY created_at DESC LIMIT 1'
);
$stmt->execute([$phone]);
$row = $stmt->fetch();

if (!$row) {
    Response::error('验证码不存在或已使用，请重新获取');
}

if (strtotime($row['expires_at']) < time()) {
    Response::error('验证码已过期，请重新获取');
}

if (!hash_equals($row['code'], $code)) {
    Response::error('验证码错误');
}

// 标记已使用
$db->prepare('UPDATE verification_codes SET used = 1 WHERE id = ?')->execute([$row['id']]);

// 查找或创建用户
$stmt = $db->prepare('SELECT id, phone, nickname, avatar, free_quota, status FROM users WHERE phone = ? LIMIT 1');
$stmt->execute([$phone]);
$user = $stmt->fetch();

if (!$user) {
    $stmt = $db->prepare('INSERT INTO users (phone, nickname) VALUES (?, ?)');
    $nick = '用户' . substr($phone, -4);
    $stmt->execute([$phone, $nick]);
    $userId = (int)$db->lastInsertId();
    $user = [
        'id' => $userId,
        'phone' => $phone,
        'nickname' => $nick,
        'avatar' => null,
        'free_quota' => $smsCfg ? 3 : 3,
        'status' => 1,
    ];
}

if ((int)$user['status'] !== 1) {
    Response::error('账号已被禁用，请联系管理员');
}

// 更新最后登录时间
$db->prepare('UPDATE users SET last_login_at = NOW() WHERE id = ?')
    ->execute([$user['id']]);

// 写入会话
Auth::login($user['id']);

Response::success([
    'user' => [
        'id' => (int)$user['id'],
        'phone' => Auth::maskPhone($user['phone']),
        'nickname' => $user['nickname'],
        'avatar' => $user['avatar'],
        'free_quota' => (int)$user['free_quota'],
    ],
], '登录成功');
