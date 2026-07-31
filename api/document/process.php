<?php
/**
 * 触发文档处理（调用 AI）
 *
 * POST /api/document/process.php
 * Body: {"document_id":1}
 *
 * 返回: {"success":true,"status":"completed","summary":"...","total_issues":N,...}
 */

require_once __DIR__ . '/../lib/CORS.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/Validator.php';
require_once __DIR__ . '/../lib/Database.php';
require_once __DIR__ . '/../lib/Auth.php';
require_once __DIR__ . '/../lib/DocumentProcessor.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    Response::error('仅支持 POST 请求', 405);
}

$db = Database::pdo();
$user = Auth::requireLogin($db);

$body = Validator::jsonBody();
$docId = (int)($body['document_id'] ?? 0);
if ($docId <= 0) {
    Response::error('参数 document_id 无效');
}

// 查询文档（必须属于当前用户）
$stmt = $db->prepare('SELECT * FROM documents WHERE id = ? AND user_id = ? LIMIT 1');
$stmt->execute([$docId, $user['id']]);
$document = $stmt->fetch();

if (!$document) {
    Response::error('文档不存在或无权访问', 404);
}

// 已处理过的直接返回结果
if (in_array($document['status'], ['completed', 'processing'], true)) {
    if ($document['status'] === 'processing') {
        Response::error('该文档正在处理中，请稍后');
    }
    // 重新查询结果
    $stmt = $db->prepare('SELECT * FROM documents WHERE id = ?');
    $stmt->execute([$docId]);
    $doc = $stmt->fetch();
    $stmt = $db->prepare('SELECT * FROM document_issues WHERE document_id = ? ORDER BY id');
    $stmt->execute([$docId]);
    $issues = $stmt->fetchAll();
    Response::success([
        'status' => 'completed',
        'ai_provider' => $doc['ai_provider'],
        'ai_model' => $doc['ai_model'],
        'summary' => $doc['result_summary'],
        'total_issues' => (int)$doc['total_issues'],
        'fixed_issues' => (int)$doc['fixed_issues'],
        'manual_issues' => (int)$doc['manual_issues'],
        'suggested_issues' => (int)$doc['suggested_issues'],
        'issues' => $issues,
    ], '处理完成');
}

// 执行处理
$result = DocumentProcessor::process($db, $document);
if (!$result['success']) {
    Response::error($result['message'] ?? '处理失败', 500);
}

Response::success($result, '处理完成');
