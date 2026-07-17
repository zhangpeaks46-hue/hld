<?php
/**
 * 上传文档
 *
 * POST /api/document/upload.php
 * Content-Type: multipart/form-data
 * 字段：
 *   service_type  - 必填，format/proofread/process
 *   file         - 必填，待处理文档（docx/pdf/txt/md，<=20MB）
 *   format_file  - 可选，格式模板文件
 *   format_text  - 可选，粘贴的格式要求文本
 *   ai_provider  - 可选，deepseek/doubao（不传用默认）
 *
 * 返回: {"success":true,"document_id":1,"message":"上传成功，即将开始处理"}
 */

require_once __DIR__ . '/../lib/CORS.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/Database.php';
require_once __DIR__ . '/../lib/Auth.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    Response::error('仅支持 POST 请求', 405);
}

$db = Database::pdo();
$user = Auth::requireLogin($db);

// 服务类型校验
$serviceType = $_POST['service_type'] ?? '';
if (!in_array($serviceType, ['format', 'proofread', 'process'], true)) {
    Response::error('请选择有效的服务类型');
}

// 文件校验
if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    Response::error('请上传待处理文档');
}

$file = $_FILES['file'];
$maxSize = 20 * 1024 * 1024;
if ($file['size'] > $maxSize) {
    Response::error('文件过大，请上传小于 20MB 的文件');
}

$ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
$allowedExt = ['docx', 'pdf', 'txt', 'md'];
if (!in_array($ext, $allowedExt, true)) {
    Response::error('不支持的文件格式，允许：' . implode('/', $allowedExt));
}

// 存储路径
$storagePath = dirname(__DIR__) . '/storage/uploads';
if (!is_dir($storagePath)) {
    mkdir($storagePath, 0755, true);
}

$userId = (int)$user['id'];
$saveName = 'u' . $userId . '_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
$savePath = $storagePath . '/' . $saveName;

if (!move_uploaded_file($file['tmp_name'], $savePath)) {
    Response::error('文件保存失败，请检查目录权限');
}

// 格式模板文件（可选）
$formatFilePath = null;
if (!empty($_FILES['format_file']) && $_FILES['format_file']['error'] === UPLOAD_ERR_OK) {
    $fmtFile = $_FILES['format_file'];
    $fmtExt = strtolower(pathinfo($fmtFile['name'], PATHINFO_EXTENSION));
    if (in_array($fmtExt, ['docx', 'pdf', 'txt', 'md', 'doc'], true) && $fmtFile['size'] <= $maxSize) {
        $fmtDir = dirname(__DIR__) . '/storage/formats';
        if (!is_dir($fmtDir)) {
            mkdir($fmtDir, 0755, true);
        }
        $fmtName = 'f' . $userId . '_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . $fmtExt;
        $fmtPath = $fmtDir . '/' . $fmtName;
        if (move_uploaded_file($fmtFile['tmp_name'], $fmtPath)) {
            $formatFilePath = $fmtPath;
        }
    }
}

// 粘贴的格式要求
$formatText = !empty($_POST['format_text']) ? trim($_POST['format_text']) : null;
if ($formatText !== null && mb_strlen($formatText) > 10000) {
    $formatText = mb_substr($formatText, 0, 10000);
}

// AI 提供商
$aiProvider = !empty($_POST['ai_provider']) ? $_POST['ai_provider'] : null;
if ($aiProvider !== null && !in_array($aiProvider, ['deepseek', 'doubao'], true)) {
    $aiProvider = null;
}

// 必须至少有一种格式输入（格式文件或粘贴文本），否则使用通用默认
// 这里不强制报错，允许"无格式要求"也能处理（DemoClient 会返回示例）
if ($formatFilePath === null && $formatText === null) {
    $formatText = '请按通用学术论文格式规范进行处理';
}

// 免费次数检查
if ((int)$user['free_quota'] <= 0) {
    Response::error('您的免费检测次数已用完，请联系管理员');
}

// 写入文档记录
$stmt = $db->prepare(
    "INSERT INTO documents
     (user_id, service_type, original_filename, file_path, file_size, file_ext,
      format_file_path, format_text, ai_provider, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')"
);
$stmt->execute([
    $userId,
    $serviceType,
    $file['name'],
    $savePath,
    $file['size'],
    $ext,
    $formatFilePath,
    $formatText,
    $aiProvider,
]);
$docId = (int)$db->lastInsertId();

// 扣减免费次数
$db->prepare('UPDATE users SET free_quota = free_quota - 1 WHERE id = ? AND free_quota > 0')
    ->execute([$userId]);

Response::success([
    'document_id' => $docId,
    'redirect' => 'process',
], '上传成功，即将开始处理');
