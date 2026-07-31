<?php
/**
 * AI 客户端工厂
 *
 * 用法：
 *   $client = AIFactory::create('deepseek');
 *   $result = $client->processDocument($text, $format, $serviceType);
 *
 * 若对应平台未配置 API Key，将自动降级为 DemoClient（返回示例数据），
 * 保证前端联调不中断；填入真实 Key 后自动启用真实调用。
 */
require_once __DIR__ . '/AIClient.php';
require_once __DIR__ . '/PromptBuilder.php';
require_once __DIR__ . '/DeepseekClient.php';
require_once __DIR__ . '/DoubaoClient.php';
require_once __DIR__ . '/DemoClient.php';

class AIFactory
{
    /**
     * 创建 AI 客户端
     *
     * @param string|null $provider deepseek/doubao/null(使用默认)
     * @return AIClient
     */
    public static function create($provider = null)
    {
        $cfg = require __DIR__ . '/../config/ai_config.php';
        $provider = $provider ?: ($cfg['default_provider'] ?? 'deepseek');

        switch ($provider) {
            case 'deepseek':
                if (!empty($cfg['deepseek']['api_key'])) {
                    return new DeepseekClient($cfg['deepseek']);
                }
                return new DemoClient('deepseek', $cfg['deepseek']['model'] ?? 'deepseek-chat');

            case 'doubao':
                if (!empty($cfg['doubao']['api_key'])) {
                    return new DoubaoClient($cfg['doubao']);
                }
                return new DemoClient('doubao', $cfg['doubao']['model'] ?? 'doubao-pro-32k');

            default:
                return new DemoClient($provider, 'demo');
        }
    }
}
