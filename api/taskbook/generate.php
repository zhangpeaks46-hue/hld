<?php
/**
 * 生成任务书
 *
 * POST /api/taskbook/generate.php
 * Body: {"thesis_title":"论文题目", "ai_provider":"deepseek|doubao"}
 * 或 multipart: thesis_title, ai_provider, template_file(可选)
 *
 * 返回: {"success":true,"taskbook_id":1,"data":{...任务书内容}}
 */

require_once __DIR__ . '/../lib/CORS.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/Database.php';
require_once __DIR__ . '/../lib/Auth.php';
require_once __DIR__ . '/../lib/DocumentTextExtractor.php';
require_once __DIR__ . '/TaskbookProcessor.php';

header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    Response::error('仅支持 POST 请求', 405);
}

$db = Database::pdo();
$user = Auth::requireLogin($db);

// 获取论文名
$thesisTitle = '';
$templateFilePath = null;

// 支持 JSON 和 multipart 两种格式
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';

if (strpos($contentType, 'application/json') !== false) {
    // JSON 格式
    $body = json_decode(file_get_contents('php://input'), true);
    $thesisTitle = trim($body['thesis_title'] ?? '');
    $aiProvider = $body['ai_provider'] ?? null;
} else {
    // multipart 格式（可能含文件上传）
    $thesisTitle = trim($_POST['thesis_title'] ?? '');
    $aiProvider = $_POST['ai_provider'] ?? null;

    // 处理模板文件上传
    if (!empty($_FILES['template_file']) && $_FILES['template_file']['error'] === UPLOAD_ERR_OK) {
        $file = $_FILES['template_file'];
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $allowedExt = ['docx', 'pdf', 'txt', 'md', 'doc'];
        $maxSize = 20 * 1024 * 1024;

        if (in_array($ext, $allowedExt) && $file['size'] <= $maxSize) {
            $storagePath = dirname(__DIR__) . '/storage/templates';
            if (!is_dir($storagePath)) mkdir($storagePath, 0755, true);
            $saveName = 'tpl_' . $user['id'] . '_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
            $savePath = $storagePath . '/' . $saveName;
            if (move_uploaded_file($file['tmp_name'], $savePath)) {
                $templateFilePath = $savePath;
            }
        }
    }
}

if (empty($thesisTitle)) {
    Response::error('请输入论文题目');
}

// 校验AI提供商
if ($aiProvider !== null && !in_array($aiProvider, ['deepseek', 'doubao'], true)) {
    $aiProvider = null;
}

// 执行生成
$result = TaskbookProcessor::generate($db, (int)$user['id'], $thesisTitle, $aiProvider, $templateFilePath);

if (!$result['success']) {
    Response::error($result['message'] ?? '生成失败', 500);
}

Response::success($result, '任务书生成成功');