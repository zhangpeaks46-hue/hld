<?php
/**
 * 任务书生成处理器
 * 负责调用AI生成任务书内容，并生成结果文件
 */
require_once __DIR__ . '/../lib/DocumentTextExtractor.php';
require_once __DIR__ . '/../ai/AIFactory.php';
require_once __DIR__ . '/TaskbookPromptBuilder.php';

class TaskbookProcessor
{
    /**
     * 生成任务书
     *
     * @param PDO $db 数据库连接
     * @param int $userId 用户ID
     * @param string $thesisTitle 论文题目
     * @param string|null $aiProvider AI提供商
     * @param string|null $templateFilePath 模板文件路径（可选）
     * @return array 处理结果
     */
    public static function generate(PDO $db, $userId, $thesisTitle, $aiProvider = null, $templateFilePath = null)
    {
        try {
            // 1. 如果有模板文件，提取其文本
            $templateText = null;
            if ($templateFilePath && is_file($templateFilePath)) {
                $templateText = DocumentTextExtractor::extract($templateFilePath);
            }

            // 2. 构建提示词
            $prompts = TaskbookPromptBuilder::build($thesisTitle, $templateText);

            // 3. 创建AI客户端
            $client = AIFactory::create($aiProvider);

            // 4. 调用AI生成任务书
            $payload = [
                'model' => $client->getModelName(),
                'messages' => [
                    ['role' => 'system', 'content' => $prompts['system']],
                    ['role' => 'user', 'content' => $prompts['user']],
                ],
                'temperature' => 0.3,
                'max_tokens' => 8192,
            ];

            // 获取API配置
            $cfg = require __DIR__ . '/../config/ai_config.php';
            $provider = $aiProvider ?: ($cfg['default_provider'] ?? 'deepseek');
            $providerCfg = $cfg[$provider] ?? [];

            $baseUrl = rtrim($providerCfg['base_url'] ?? '', '/');
            if ($provider === 'deepseek') {
                $url = $baseUrl . '/v1/chat/completions';
            } else {
                $url = $baseUrl . '/chat/completions';
            }

            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
                CURLOPT_HTTPHEADER => [
                    'Content-Type: application/json',
                    'Authorization: Bearer ' . ($providerCfg['api_key'] ?? ''),
                ],
                CURLOPT_TIMEOUT => 120,
            ]);
            $body = curl_exec($ch);
            $err = curl_error($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($err) throw new RuntimeException('AI 请求失败: ' . $err);
            if ($code >= 400) throw new RuntimeException('AI 返回错误 ' . $code . ': ' . $body);

            $data = json_decode($body, true);
            if (!is_array($data)) throw new RuntimeException('AI 响应解析失败');

            $content = $data['choices'][0]['message']['content'] ?? '';
            // 兼容markdown代码块
            $content = trim($content);
            if (strpos($content, '```') === 0) {
                $content = preg_replace('/^```(?:json)?\s*|\s*```$/s', '', $content);
            }

            $taskbookData = json_decode($content, true);
            if (!is_array($taskbookData)) {
                throw new RuntimeException('AI 返回的任务书内容无法解析');
            }

            // 5. 生成任务书HTML报告
            $reportPath = self::generateReport($thesisTitle, $taskbookData, $client, $userId);

            // 6. 保存到数据库
            $stmt = $db->prepare(
                "INSERT INTO taskbooks
                 (user_id, thesis_title, template_file_path, ai_provider, ai_model,
                  topic_source, requirements, research_content, requirements_analysis,
                  outline_design, schedule_json, references_json,
                  status, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', NOW())"
            );
            $stmt->execute([
                $userId,
                $thesisTitle,
                $templateFilePath,
                $client->getProviderName(),
                $client->getModelName(),
                $taskbookData['topic_source'] ?? '',
                $taskbookData['requirements'] ?? '',
                $taskbookData['research_content'] ?? '',
                $taskbookData['requirements_analysis'] ?? '',
                $taskbookData['outline_design'] ?? '',
                json_encode($taskbookData['schedule'] ?? [], JSON_UNESCAPED_UNICODE),
                json_encode($taskbookData['references'] ?? [], JSON_UNESCAPED_UNICODE),
            ]);
            $taskbookId = (int)$db->lastInsertId();

            // 更新报告路径
            $db->prepare('UPDATE taskbooks SET result_file_path = ? WHERE id = ?')
                ->execute([$reportPath, $taskbookId]);

            return [
                'success' => true,
                'taskbook_id' => $taskbookId,
                'data' => $taskbookData,
                'ai_provider' => $client->getProviderName(),
                'ai_model' => $client->getModelName(),
            ];
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => $e->getMessage(),
            ];
        }
    }

    /**
     * 生成任务书HTML报告
     */
    private static function generateReport($thesisTitle, $data, $client, $userId)
    {
        $storagePath = dirname(__DIR__) . '/storage/taskbooks';
        if (!is_dir($storagePath)) mkdir($storagePath, 0755, true);

        $schedule = $data['schedule'] ?? [];
        $references = $data['references'] ?? [];

        $scheduleRows = '';
        foreach ($schedule as $item) {
            $scheduleRows .= '<tr>'
                . '<td style="padding:8px;border:1px solid #e5e7eb">' . htmlspecialchars($item['phase'] ?? '') . '</td>'
                . '<td style="padding:8px;border:1px solid #e5e7eb">' . htmlspecialchars($item['task'] ?? '') . '</td>'
                . '</tr>';
        }

        $refList = '';
        foreach ($references as $i => $ref) {
            $refList .= '<li style="margin-bottom:4px">[' . ($i + 1) . '] ' . htmlspecialchars($ref) . '</li>';
        }

        $html = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">'
            . '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
            . '<title>毕业设计任务书 - ' . htmlspecialchars($thesisTitle) . '</title>'
            . '<style>body{font-family:Microsoft YaHei,sans-serif;padding:40px;max-width:800px;margin:0 auto;color:#1f2937}'
            . 'h1{color:#1E40AF;text-align:center;border-bottom:3px double #1E40AF;padding-bottom:12px}'
            . 'h2{color:#1E40AF;border-left:4px solid #3B82F6;padding-left:12px;margin-top:32px}'
            . '.meta{background:#f0f9ff;padding:16px;border-radius:8px;margin:16px 0;font-size:14px}'
            . '.section{margin:20px 0;line-height:1.8}'
            . 'table{border-collapse:collapse;width:100%;margin:12px 0}'
            . 'ol{padding-left:20px}'
            . '</style></head><body>'
            . '<h1>毕业设计（论文）任务书</h1>'
            . '<div class="meta">'
            . '<p><strong>论文题目：</strong>' . htmlspecialchars($thesisTitle) . '</p>'
            . '<p><strong>AI 模型：</strong>' . htmlspecialchars($client->getProviderName() . ' / ' . $client->getModelName()) . '</p>'
            . '<p><strong>生成时间：</strong>' . date('Y-m-d H:i:s') . '</p>'
            . '</div>'
            . '<h2>课题来源</h2><div class="section">' . nl2br(htmlspecialchars($data['topic_source'] ?? '无')) . '</div>'
            . '<h2>基本任务与要求</h2><div class="section">' . nl2br(htmlspecialchars($data['requirements'] ?? '无')) . '</div>'
            . '<h2>需求分析</h2><div class="section">' . nl2br(htmlspecialchars($data['requirements_analysis'] ?? '无')) . '</div>'
            . '<h2>研究内容</h2><div class="section">' . nl2br(htmlspecialchars($data['research_content'] ?? '无')) . '</div>'
            . '<h2>概要设计</h2><div class="section">' . nl2br(htmlspecialchars($data['outline_design'] ?? '无')) . '</div>'
            . '<h2>课题进度安排</h2>'
            . '<table><thead><tr style="background:#f3f4f6"><th style="padding:8px;border:1px solid #e5e7eb;text-align:left">阶段</th><th style="padding:8px;border:1px solid #e5e7eb;text-align:left">任务内容</th></tr></thead>'
            . '<tbody>' . $scheduleRows . '</tbody></table>'
            . '<h2>参考文献</h2><ol class="section">' . $refList . '</ol>'
            . '<p style="margin-top:32px;color:#6b7280;font-size:13px;text-align:center">本任务书由好论点智检平台 AI 辅助生成，仅供参考</p>'
            . '</body></html>';

        $filename = 'taskbook_' . $userId . '_' . date('Ymd_His') . '.html';
        $path = $storagePath . '/' . $filename;
        file_put_contents($path, $html);
        return $path;
    }
}