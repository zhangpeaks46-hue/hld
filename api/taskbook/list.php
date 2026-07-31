<?php
/**
 * 获取任务书列表
 *
 * GET /api/taskbook/list.php
 *
 * 返回: {"success":true,"taskbooks":[...]}
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

$stmt = $db->prepare('SELECT id, thesis_title, ai_provider, ai_model, status, created_at FROM taskbooks WHERE user_id = ? ORDER BY id DESC');
$stmt->execute([(int)$user['id']]);
$taskbooks = $stmt->fetchAll(PDO::FETCH_ASSOC);

Response::success(['taskbooks' => $taskbooks]);