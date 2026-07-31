<?php
/**
 * 文档列表
 *
 * GET /api/document/list.php
 * 可选参数: status=pending|processing|completed|failed
 *
 * 返回: {"success":true,"documents":[{...}, ...]}
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

$status = $_GET['status'] ?? null;
$validStatus = ['pending', 'processing', 'completed', 'failed'];

$sql = 'SELECT id, service_type, original_filename, file_ext, status,
               total_issues, fixed_issues, manual_issues, suggested_issues,
               ai_provider, ai_model, created_at, completed_at
        FROM documents WHERE user_id = ?';
$params = [$user['id']];

if ($status && in_array($status, $validStatus, true)) {
    $sql .= ' AND status = ?';
    $params[] = $status;
}
$sql .= ' ORDER BY id DESC LIMIT 200';

$stmt = $db->prepare($sql);
$stmt->execute($params);
$docs = $stmt->fetchAll();

// 类型映射为中文
$serviceMap = ['format' => '格式检测', 'proofread' => '文字校对', 'process' => '文字加工'];
$statusMap = [
    'pending' => '等待处理',
    'processing' => '处理中',
    'completed' => '已完成',
    'failed' => '处理失败',
];
foreach ($docs as &$d) {
    $d['id'] = (int)$d['id'];
    $d['total_issues'] = (int)$d['total_issues'];
    $d['fixed_issues'] = (int)$d['fixed_issues'];
    $d['manual_issues'] = (int)$d['manual_issues'];
    $d['suggested_issues'] = (int)$d['suggested_issues'];
    $d['service_type_label'] = $serviceMap[$d['service_type']] ?? $d['service_type'];
    $d['status_label'] = $statusMap[$d['status']] ?? $d['status'];
}

Response::success(['documents' => $docs]);
