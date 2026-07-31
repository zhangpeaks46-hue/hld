<?php
/**
 * 演示用 AI 客户端
 *
 * 当 Deepseek/豆包 的 API Key 未配置时，自动使用此客户端，
 * 返回构造好的示例结果，保证前端流程可完整联调。
 * 填入真实 Key 后，AIFactory 会自动切换到真实客户端。
 */
class DemoClient implements AIClient
{
    private $provider;
    private $model;

    public function __construct($provider, $model)
    {
        $this->provider = $provider;
        $this->model = $model;
    }

    public function getProviderName()
    {
        return $this->provider;
    }

    public function getModelName()
    {
        return $this->model;
    }

    public function processDocument($documentText, $formatRequirements, $serviceType)
    {
        // 模拟网络与处理耗时
        usleep(500000);

        $summary = '【演示模式】当前未配置真实的 AI API Key，以下为示例检测结果。'
            . '请在 api/config/ai_config.php 填入 Deepseek 或豆包的密钥后即可获得真实分析结果。';

        $issues = [];
        switch ($serviceType) {
            case 'format':
                $issues = [
                    [
                        'page' => 1, 'line' => 3, 'issue_type' => '字体不统一',
                        'description' => '标题使用了宋体，正文使用了微软雅黑',
                        'suggestion' => '建议统一使用宋体（标题加粗）',
                        'original_text' => '基于AI的文档检测研究',
                        'revised_text' => '基于AI的文档检测研究',
                        'status' => 'fixed',
                    ],
                    [
                        'page' => 2, 'line' => 8, 'issue_type' => '行距错误',
                        'description' => '正文行距为 1.0 倍',
                        'suggestion' => '按格式要求应设置为 1.5 倍行距',
                        'original_text' => '随着人工智能技术的发展...',
                        'revised_text' => '随着人工智能技术的发展...',
                        'status' => 'fixed',
                    ],
                    [
                        'page' => 5, 'line' => 20, 'issue_type' => '参考文献格式错误',
                        'description' => '参考文献缺少文献类型标识 [J]/[M]',
                        'suggestion' => '请按 GB/T 7714 规范补充文献类型标识',
                        'original_text' => '张三. 人工智能导论. 2023.',
                        'revised_text' => '张三. 人工智能导论[M]. 北京: XX出版社, 2023.',
                        'status' => 'manual',
                    ],
                    [
                        'page' => 7, 'line' => 15, 'issue_type' => '页边距不符合要求',
                        'description' => '当前页边距上下左右均为 2cm',
                        'suggestion' => '按要求应为上2.5cm 下2.5cm 左3cm 右2cm',
                        'original_text' => '', 'revised_text' => '',
                        'status' => 'fixed',
                    ],
                ];
                break;

            case 'proofread':
                $issues = [
                    [
                        'page' => null, 'line' => 12, 'issue_type' => '错别字',
                        'description' => '"的、地、得" 使用混淆',
                        'suggestion' => '"快速的提高" 应为 "快速地提高"',
                        'original_text' => '快速的提高效率',
                        'revised_text' => '快速地提高效率',
                        'status' => 'suggested',
                    ],
                    [
                        'page' => null, 'line' => 25, 'issue_type' => '语法',
                        'description' => '主谓不一致',
                        'suggestion' => '"数据的分析表明" 改为 "数据分析表明"',
                        'original_text' => '数据的分析表明',
                        'revised_text' => '数据分析表明',
                        'status' => 'suggested',
                    ],
                ];
                break;

            case 'process':
                $issues = [
                    [
                        'page' => null, 'line' => null, 'issue_type' => '降重改写',
                        'description' => '降低与原文相似度',
                        'suggestion' => '',
                        'original_text' => '人工智能技术发展很快',
                        'revised_text' => '人工智能技术正以前所未有的速度蓬勃发展',
                        'status' => 'fixed',
                    ],
                ];
                break;
        }

        return [
            'summary' => $summary,
            'issues' => $issues,
            'revised_text' => $serviceType === 'process' ? '【演示模式】完整的加工后文本...' : null,
        ];
    }
}
