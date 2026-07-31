<?php
/**
 * 毕业设计任务书生成接口
 * POST: title, major, degree, advisor, school, word_count, ai_provider
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Auth.php';
require_once __DIR__ . '/../lib/CORS.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../ai/AIFactory.php';
require_once __DIR__ . '/../ai/PromptBuilder.php';

CORS::handle();

$auth = new Auth($pdo);
$user = $auth->getCurrentUser();
if (!$user) {
    Response::error('请先登录', 401);
    exit;
}

$title = trim($_POST['title'] ?? '');
if (empty($title)) {
    Response::error('论文题目不能为空');
    exit;
}

$params = [
    'major'      => trim($_POST['major'] ?? ''),
    'degree'     => trim($_POST['degree'] ?? '本科'),
    'advisor'    => trim($_POST['advisor'] ?? ''),
    'school'     => trim($_POST['school'] ?? ''),
    'word_count' => trim($_POST['word_count'] ?? '12000'),
];

$provider = trim($_POST['ai_provider'] ?? '') ?: 'deepseek';

try {
    $prompts = PromptBuilder::buildTaskBook($title, $params);
    $client = AIFactory::create($provider);

    $combinedUserPrompt = $prompts['user'];
    $combinedSystemPrompt = $prompts['system'];

    $result = callAIForTaskBook($client, $combinedSystemPrompt, $combinedUserPrompt, $provider);

    $stmt = $pdo->prepare('
        INSERT INTO task_books (user_id, title, major, degree, advisor, school, word_count,
                                ai_provider, ai_model, result_json, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "completed", NOW())
    ');
    $stmt->execute([
        $user['id'], $title, $params['major'], $params['degree'],
        $params['advisor'], $params['school'], $params['word_count'],
        $result['provider'], $result['model'],
        json_encode($result['result'], JSON_UNESCAPED_UNICODE),
    ]);

    Response::success([
        'task_id' => $pdo->lastInsertId(),
        'result'  => $result['result'],
    ]);

} catch (Exception $e) {
    Response::error('生成失败：' . $e->getMessage());
}

function callAIForTaskBook($client, $systemPrompt, $userPrompt, $provider)
{
    $fakeDoc = json_encode(['task' => 'generate_task_book'], JSON_UNESCAPED_UNICODE);
    $fakeFormat = json_encode(['system_override' => $systemPrompt, 'user_override' => $userPrompt], JSON_UNESCAPED_UNICODE);

    $raw = $client->processDocument($fakeDoc, $fakeFormat, 'taskbook');

    $taskResult = null;
    if (!empty($raw['revised_text'])) {
        $taskResult = json_decode($raw['revised_text'], true);
    }
    if (!is_array($taskResult) && !empty($raw['summary'])) {
        $taskResult = json_decode($raw['summary'], true);
    }
    if (!is_array($taskResult)) {
        if (!empty($raw['issues']) && is_array($raw['issues'])) {
            $taskResult = $raw;
        } else {
            $taskResult = [
                'title' => '生成结果解析异常',
                'basic_tasks' => $raw['summary'] ?? 'AI 返回内容无法解析为任务书格式',
                'schedule' => [],
                'research_content' => '',
                'references' => [],
                'expected_outcome' => '',
            ];
        }
    }

    return [
        'provider' => $client->getProviderName(),
        'model'    => $client->getModelName(),
        'result'   => $taskResult,
    ];
}
