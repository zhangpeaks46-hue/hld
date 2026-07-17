<?php
/**
 * 文档处理器
 *
 * 串联整个处理流程：
 *   1. 从上传文件提取文本
 *   2. 构造格式要求（来自上传的格式模板文件 / 粘贴的文本）
 *   3. 调用 AI 客户端
 *   4. 持久化结果到 documents / document_issues 表
 *   5. 生成结果报告文件供下载
 */
require_once __DIR__ . '/DocumentTextExtractor.php';
require_once __DIR__ . '/../ai/AIFactory.php';

class DocumentProcessor
{
    /**
     * 处理单个文档
     *
     * @param PDO   $db
     * @param array $document documents 表行（含 id/file_path 等）
     * @return array 处理结果
     */
    public static function process(PDO $db, array $document)
    {
        $docId = (int)$document['id'];
        $db->prepare("UPDATE documents SET status = 'processing' WHERE id = ?")->execute([$docId]);

        try {
            // 1. 提取文档文本
            $docText = DocumentTextExtractor::extract($document['file_path']);
            if ($docText === '' || $docText === false) {
                throw new RuntimeException('无法从文档中提取文本内容');
            }

            // 2. 构造格式要求
            $formatReq = self::buildFormatRequirements($document);

            // 3. 调用 AI
            $provider = $document['ai_provider'] ?: null;
            $client = AIFactory::create($provider);
            $aiResult = $client->processDocument($docText, $formatReq, $document['service_type']);

            // 4. 统计问题数量
            $issues = $aiResult['issues'] ?? [];
            $total = count($issues);
            $fixed = $manual = $suggested = 0;
            foreach ($issues as $issue) {
                switch ($issue['status'] ?? 'suggested') {
                    case 'fixed':
                        $fixed++;
                        break;
                    case 'manual':
                        $manual++;
                        break;
                    default:
                        $suggested++;
                }
            }

            // 5. 更新文档记录
            $db->prepare(
                "UPDATE documents
                 SET status = 'completed',
                     ai_model = ?,
                     result_summary = ?,
                     total_issues = ?,
                     fixed_issues = ?,
                     manual_issues = ?,
                     suggested_issues = ?,
                     completed_at = NOW()
                 WHERE id = ?"
            )->execute([
                $client->getModelName(),
                $aiResult['summary'] ?? '',
                $total, $fixed, $manual, $suggested,
                $docId,
            ]);

            // 6. 写入问题详情
            $stmt = $db->prepare(
                "INSERT INTO document_issues
                 (document_id, page, line, issue_type, description, suggestion, original_text, revised_text, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
            );
            foreach ($issues as $issue) {
                $stmt->execute([
                    $docId,
                    isset($issue['page']) ? (int)$issue['page'] : null,
                    isset($issue['line']) ? (int)$issue['line'] : null,
                    $issue['issue_type'] ?? '其他',
                    $issue['description'] ?? '',
                    $issue['suggestion'] ?? '',
                    $issue['original_text'] ?? '',
                    $issue['revised_text'] ?? '',
                    $issue['status'] ?? 'suggested',
                ]);
            }

            // 7. 生成结果报告文件
            $reportPath = self::generateReport($document, $aiResult, $client);
            $db->prepare('UPDATE documents SET result_file_path = ? WHERE id = ?')
                ->execute([$reportPath, $docId]);

            return [
                'success' => true,
                'status' => 'completed',
                'ai_provider' => $client->getProviderName(),
                'ai_model' => $client->getModelName(),
                'summary' => $aiResult['summary'] ?? '',
                'total_issues' => $total,
                'fixed_issues' => $fixed,
                'manual_issues' => $manual,
                'suggested_issues' => $suggested,
            ];
        } catch (Exception $e) {
            $db->prepare(
                "UPDATE documents SET status = 'failed', error_message = ? WHERE id = ?"
            )->execute([$e->getMessage(), $docId]);
            return [
                'success' => false,
                'status' => 'failed',
                'message' => $e->getMessage(),
            ];
        }
    }

    /**
     * 合并格式要求文本
     */
    private static function buildFormatRequirements(array $document)
    {
        $parts = [];

        // 如果上传了格式模板文件，提取其文本
        if (!empty($document['format_file_path']) && is_file($document['format_file_path'])) {
            try {
                $templateText = DocumentTextExtractor::extract($document['format_file_path']);
                if ($templateText) {
                    $parts[] = "【上传的格式模板文件内容】\n" . $templateText;
                }
            } catch (Exception $e) {
                $parts[] = "【格式模板文件解析失败】" . $e->getMessage();
            }
        }

        // 粘贴的格式要求
        if (!empty($document['format_text'])) {
            $parts[] = "【用户粘贴的格式要求】\n" . $document['format_text'];
        }

        return implode("\n\n", $parts);
    }

    /**
     * 生成 HTML 格式的结果报告
     */
    private static function generateReport(array $document, array $aiResult, $client)
    {
        $storagePath = dirname(__DIR__) . '/storage/results';
        if (!is_dir($storagePath)) {
            mkdir($storagePath, 0755, true);
        }

        $issues = $aiResult['issues'] ?? [];
        $serviceName = [
            'format' => '格式检测',
            'proofread' => '文字校对',
            'process' => '文字加工',
        ][$document['service_type']] ?? $document['service_type'];

        $rows = '';
        foreach ($issues as $issue) {
            $statusText = [
                'fixed' => '<span style="color:#10B981">已修复</span>',
                'manual' => '<span style="color:#D97706">需手动</span>',
                'suggested' => '<span style="color:#7C3AED">建议项</span>',
            ][$issue['status'] ?? 'suggested'] ?? '建议项';

            $rows .= '<tr>'
                . '<td style="padding:8px;border:1px solid #e5e7eb">' . htmlspecialchars($issue['page'] ?? '-') . '</td>'
                . '<td style="padding:8px;border:1px solid #e5e7eb">' . htmlspecialchars($issue['line'] ?? '-') . '</td>'
                . '<td style="padding:8px;border:1px solid #e5e7eb">' . htmlspecialchars($issue['issue_type'] ?? '') . '</td>'
                . '<td style="padding:8px;border:1px solid #e5e7eb">' . htmlspecialchars($issue['description'] ?? '') . '</td>'
                . '<td style="padding:8px;border:1px solid #e5e7eb">' . htmlspecialchars($issue['suggestion'] ?? '') . '</td>'
                . '<td style="padding:8px;border:1px solid #e5e7eb">' . $statusText . '</td>'
                . '</tr>';
        }

        $html = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">'
            . '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
            . '<title>检测报告 - ' . htmlspecialchars($document['original_filename']) . '</title>'
            . '<style>body{font-family:Microsoft YaHei,sans-serif;padding:40px;color:#1f2937}'
            . 'h1{color:#1E40AF}table{border-collapse:collapse;width:100%;margin-top:16px}'
            . '.meta{background:#f0f9ff;padding:16px;border-radius:8px;margin:16px 0}</style>'
            . '</head><body>'
            . '<h1>好论点智检 - 检测报告</h1>'
            . '<div class="meta">'
            . '<p><strong>文档名称：</strong>' . htmlspecialchars($document['original_filename']) . '</p>'
            . '<p><strong>服务类型：</strong>' . $serviceName . '</p>'
            . '<p><strong>AI 模型：</strong>' . htmlspecialchars($client->getProviderName() . ' / ' . $client->getModelName()) . '</p>'
            . '<p><strong>处理时间：</strong>' . date('Y-m-d H:i:s') . '</p>'
            . '<p><strong>问题总数：</strong>' . count($issues) . '</p>'
            . '</div>'
            . '<h2>总体结论</h2><p>' . nl2br(htmlspecialchars($aiResult['summary'] ?? '无')) . '</p>';

        if (!empty($aiResult['revised_text'])) {
            $html .= '<h2>加工后全文</h2><pre style="background:#f9fafb;padding:16px;border-radius:8px;white-space:pre-wrap">'
                . htmlspecialchars($aiResult['revised_text']) . '</pre>';
        }

        $html .= '<h2>问题详情</h2><table>'
            . '<thead><tr style="background:#f3f4f6">'
            . '<th style="padding:8px;border:1px solid #e5e7eb;text-align:left">页码</th>'
            . '<th style="padding:8px;border:1px solid #e5e7eb;text-align:left">行号</th>'
            . '<th style="padding:8px;border:1px solid #e5e7eb;text-align:left">问题类型</th>'
            . '<th style="padding:8px;border:1px solid #e5e7eb;text-align:left">问题描述</th>'
            . '<th style="padding:8px;border:1px solid #e5e7eb;text-align:left">修改建议</th>'
            . '<th style="padding:8px;border:1px solid #e5e7eb;text-align:left">状态</th>'
            . '</tr></thead><tbody>' . $rows . '</tbody></table>'
            . '<p style="margin-top:32px;color:#6b7280;font-size:13px">本报告由好论点智检平台自动生成</p>'
            . '</body></html>';

        $filename = 'report_' . $document['id'] . '_' . date('Ymd_His') . '.html';
        $path = $storagePath . '/' . $filename;
        file_put_contents($path, $html);
        return $path;
    }
}
