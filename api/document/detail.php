<?php
/**
 * 文档详情
 *
 * GET /api/document/detail.php?id=1
 *
 * 返回: {"success":true,"document":{...},"issues":[...]}
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
    'SELECT id, user_id, service_type, original_filename, file_ext, status,
            total_issues, fixed_issues, manual_issues, suggested_issues,
            ai_provider, ai_model, result_summary, error_message,
            created_at, completed_at
     FROM documents WHERE id = ? AND user_id = ? LIMIT 1'
);
$stmt->execute([$docId, $user['id']]);
$document = $stmt->fetch();

if (!$document) {
    Response::error('文档不存在或无权访问', 404);
}

$document['id'] = (int)$document['id'];
$document['user_id'] = (int)$document['user_id'];
$document['total_issues'] = (int)$document['total_issues'];
$document['fixed_issues'] = (int)$document['fixed_issues'];
$document['manual_issues'] = (int)$document['manual_issues'];
$document['suggested_issues'] = (int)$document['suggested_issues'];

// 获取问题列表
$stmt = $db->prepare(
    'SELECT id, page, line, issue_type, description, suggestion,
            original_text, revised_text, status, created_at
     FROM document_issues WHERE document_id = ? ORDER BY id'
);
$stmt->execute([$docId]);
$issues = $stmt->fetchAll();
foreach ($issues as &$i) {
    $i['id'] = (int)$i['id'];
    $i['page'] = $i['page'] !== null ? (int)$i['page'] : null;
    $i['line'] = $i['line'] !== null ? (int)$i['line'] : null;
}

$serviceMap = ['format' => '格式检测', 'proofread' => '文字校对', 'process' => '文字加工'];
$statusMap = [
    'pending' => '等待处理',
    'processing' => '处理中',
    'completed' => '已完成',
    'failed' => '处理失败',
];
$document['service_type_label'] = $serviceMap[$document['service_type']] ?? $document['service_type'];
$document['status_label'] = $statusMap[$document['status']] ?? $document['status'];

Response::success([
    'document' => $document,
    'issues' => $issues,
]);
