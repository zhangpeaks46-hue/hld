<?php
/**
 * 下载任务书报告
 *
 * GET /api/taskbook/download.php?id=1
 */

require_once __DIR__ . '/../lib/CORS.php';
require_once __DIR__ . '/../lib/Database.php';
require_once __DIR__ . '/../lib/Auth.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => '仅支持 GET 请求']);
    exit;
}

$db = Database::pdo();
$user = Auth::requireLogin($db);

$id = (int)($_GET['id'] ?? 0);
if ($id <= 0) { http_response_code(400); echo '参数无效'; exit; }

$stmt = $db->prepare('SELECT thesis_title, result_file_path FROM taskbooks WHERE id = ? AND user_id = ? LIMIT 1');
$stmt->execute([$id, (int)$user['id']]);
$taskbook = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$taskbook || empty($taskbook['result_file_path']) || !is_file($taskbook['result_file_path'])) {
    http_response_code(404);
    echo '文件不存在';
    exit;
}

$filename = '毕业设计任务书_' . $taskbook['thesis_title'] . '.html';
header('Content-Type: text/html; charset=utf-8');
header('Content-Disposition: inline; filename="' . $filename . '"');
readfile($taskbook['result_file_path']);