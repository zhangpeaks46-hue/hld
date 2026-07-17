<?php
/**
 * 发送短信验证码
 *
 * POST /api/auth/send_code.php
 * Body: {"phone":"13800138000"}
 * 返回: {"success":true,"message":"验证码已发送","dev_code":"123456"}
 *      dev_code 仅在 mock 模式下返回，用于联调
 */

require_once __DIR__ . '/../lib/CORS.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/Validator.php';
require_once __DIR__ . '/../lib/Database.php';
require_once __DIR__ . '/../lib/SmsSender.php';

$smsCfg = require __DIR__ . '/../config/sms_config.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    Response::error('仅支持 POST 请求', 405);
}

$body = Validator::jsonBody();
$phone = trim($body['phone'] ?? '');

if (!Validator::phone($phone)) {
    Response::error('手机号格式错误');
}

$db = Database::pdo();

// 频率限制：同一手机号 resend_interval 秒内不可重复发送
$interval = (int)($smsCfg['resend_interval'] ?? 60);
$stmt = $db->prepare(
    'SELECT created_at FROM verification_codes
     WHERE phone = ? AND created_at > (NOW() - INTERVAL ? SECOND)
     ORDER BY created_at DESC LIMIT 1'
);
$stmt->execute([$phone, $interval]);
if ($stmt->fetch()) {
    Response::error("发送太频繁，请 {$interval} 秒后重试");
}

// IP 每日限制
$ip = Validator::clientIp();
$dailyLimit = (int)($smsCfg['daily_limit_per_ip'] ?? 10);
$stmt = $db->prepare('SELECT COUNT(*) AS c FROM verification_codes WHERE ip = ? AND created_at > CURDATE()');
$stmt->execute([$ip]);
$row = $stmt->fetch();
if ($row && (int)$row['c'] >= $dailyLimit) {
    Response::error('今日发送次数已达上限');
}

// 生成验证码
$len = (int)($smsCfg['code_length'] ?? 6);
$code = '';
for ($i = 0; $i < $len; $i++) {
    $code .= (string)mt_rand(0, 9);
}

// 失效之前未使用的同手机号验证码
$db->prepare('UPDATE verification_codes SET used = 1 WHERE phone = ? AND used = 0')
    ->execute([$phone]);

// 入库
$expire = (int)($smsCfg['expire_seconds'] ?? 300);
$stmt = $db->prepare(
    'INSERT INTO verification_codes (phone, code, purpose, expires_at, ip)
     VALUES (?, ?, "login", DATE_ADD(NOW(), INTERVAL ? SECOND), ?)'
);
$stmt->execute([$phone, $code, $expire, $ip]);

// 发送
$result = SmsSender::send($smsCfg, $phone, $code);
if (!$result['sent']) {
    Response::error($result['message'] ?? '验证码发送失败');
}

$resp = ['success' => true, 'message' => '验证码已发送'];
// mock 模式回传验证码方便联调
if (!empty($result['dev_code'])) {
    $resp['dev_code'] = $result['dev_code'];
    $resp['mock'] = true;
}
Response::json($resp);
