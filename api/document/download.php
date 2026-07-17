<?php
/**
 * 下载结果报告
 *
 * GET /api/document/download.php?id=1
 *
 * 直接输出文件流（HTML 报告），浏览器触发下载
 */

require_once __DIR__ . '/../lib/CORS.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/Database.php';
require_once __DIR__ . '/../lib/Auth.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    Response::error('仅支持 GET 请求', 405);
}

$db = Database::pdo();
$user = Auth::requireLogin($db);

$docId = (int)($_GET['id'] ?? 0);
if ($docId <= 0) {
    Response::error('参数 id 无效');
}

$stmt = $db->prepare(
    'SELECT id, user_id, original_filename, status, result_file_path
     FROM documents WHERE id = ? AND user_id = ? LIMIT 1'
);
$stmt->execute([$docId, $user['id']]);
$document = $stmt->fetch();

if (!$document) {
    Response::error('文档不存在或无权访问', 404);
}

if ($document['status'] !== 'completed') {
    Response::error('文档尚未处理完成，无法下载');
}

if (empty($document['result_file_path']) || !is_file($document['result_file_path'])) {
    Response::error('结果文件不存在', 404);
}

$file = $document['result_file_path'];
$baseName = pathinfo($document['original_filename'], PATHINFO_FILENAME);
$downloadName = '检测结果_' . $baseName . '_' . date('Ymd') . '.html';

header('Content-Description: File Transfer');
header('Content-Type: text/html; charset=utf-8');
header('Content-Disposition: attachment; filename="' . urlencode($downloadName) . '"');
header('Content-Length: ' . filesize($file));
header('Cache-Control: must-revalidate');
header('Pragma: public');
readfile($file);
exit;
