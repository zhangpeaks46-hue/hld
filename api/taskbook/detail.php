<?php
/**
 * 获取任务书详情
 *
 * GET /api/taskbook/detail.php?id=1
 *
 * 返回: {"success":true,"taskbook":{...}}
 */

require_once __DIR__ . '/../lib/CORS.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/Database.php';
require_once __DIR__ . '/../lib/Auth.php';

header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    Response::error('仅支持 GET 请求', 405);
}

$db = Database::pdo();
$user = Auth::requireLogin($db);

$id = (int)($_GET['id'] ?? 0);
if ($id <= 0) Response::error('参数 id 无效');

$stmt = $db->prepare('SELECT * FROM taskbooks WHERE id = ? AND user_id = ? LIMIT 1');
$stmt->execute([$id, (int)$user['id']]);
$taskbook = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$taskbook) Response::error('任务书不存在', 404);

// 解析JSON字段
$taskbook['schedule'] = json_decode($taskbook['schedule_json'] ?? '[]', true) ?: [];
$taskbook['references'] = json_decode($taskbook['references_json'] ?? '[]', true) ?: [];
unset($taskbook['schedule_json'], $taskbook['references_json']);

Response::success(['taskbook' => $taskbook]);