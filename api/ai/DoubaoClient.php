<?php
/**
 * 豆包（火山引擎方舟）AI 客户端
 * API 文档：https://www.volcengine.com/docs/82379
 * 接口风格同样兼容 OpenAI Chat Completions
 */
class DoubaoClient implements AIClient
{
    private $cfg;

    public function __construct(array $cfg)
    {
        $this->cfg = $cfg;
    }

    public function getProviderName()
    {
        return 'doubao';
    }

    public function getModelName()
    {
        return $this->cfg['model'] ?? 'doubao-pro-32k';
    }

    public function processDocument($documentText, $formatRequirements, $serviceType)
    {
        $prompts = PromptBuilder::build($serviceType, $documentText, $formatRequirements);

        $payload = [
            'model' => $this->cfg['model'] ?? 'doubao-pro-32k',
            'messages' => [
                ['role' => 'system', 'content' => $prompts['system']],
                ['role' => 'user', 'content' => $prompts['user']],
            ],
            'temperature' => $this->cfg['temperature'] ?? 0.2,
            'max_tokens' => $this->cfg['max_tokens'] ?? 4096,
        ];

        $resp = $this->httpPost(
            rtrim($this->cfg['base_url'], '/') . '/chat/completions',
            $payload
        );

        $content = $resp['choices'][0]['message']['content'] ?? '';
        return $this->parseResult($content);
    }

    private function httpPost($url, $payload)
    {
        if (empty($this->cfg['api_key'])) {
            throw new RuntimeException('豆包 API Key 未配置，请在 api/config/ai_config.php 中填写');
        }

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $this->cfg['api_key'],
            ],
            CURLOPT_TIMEOUT => $this->cfg['timeout'] ?? 60,
        ]);
        $body = curl_exec($ch);
        $err = curl_error($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($err) {
            throw new RuntimeException('豆包请求失败: ' . $err);
        }
        if ($code >= 400) {
            throw new RuntimeException('豆包返回错误 ' . $code . ': ' . $body);
        }
        $data = json_decode($body, true);
        if (!is_array($data)) {
            throw new RuntimeException('豆包响应解析失败');
        }
        return $data;
    }

    private function parseResult($content)
    {
        $content = trim($content);
        if (strpos($content, '```') === 0) {
            $content = preg_replace('/^```(?:json)?\s*|\s*```$/s', '', $content);
        }
        $data = json_decode($content, true);
        if (!is_array($data)) {
            return [
                'summary' => 'AI 返回内容无法解析',
                'issues' => [],
                'raw' => $content,
            ];
        }
        return [
            'summary' => $data['summary'] ?? '',
            'issues' => $data['issues'] ?? [],
            'revised_text' => $data['revised_text'] ?? null,
        ];
    }
}
