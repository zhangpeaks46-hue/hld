<?php
/**
 * AI 平台 API 配置
 *
 * 目前框架已支持 Deepseek 与豆包（火山引擎）。
 * 获取到 API Key 后，将下方占位符替换为真实密钥即可生效，
 * 无需修改任何业务代码。
 *
 * 申请方式见项目 README.md「AI 密钥申请」章节。
 */

return [
    // 默认使用的 AI 提供商：deepseek / doubao
    'default_provider' => 'deepseek',

    // 请求超时（秒）
    'timeout' => 60,

    // Deepseek（深度求索）
    'deepseek' => [
        'api_key' => '',                                   // 填入 sk-xxxxxxxx
        'base_url' => 'https://api.deepseek.com',
        'model' => 'deepseek-chat',
        'max_tokens' => 4096,
        'temperature' => 0.2,
    ],

    // 豆包（火山引擎方舟）
    // 申请：https://www.volcengine.com/product/doubao
    'doubao' => [
        'api_key' => '',                                   // 填入火山引擎 API Key
        'base_url' => 'https://ark.cn-beijing.volces.com/api/v3',
        'model' => 'doubao-pro-32k',                       // 或 doubao-pro-128k
        'max_tokens' => 4096,
        'temperature' => 0.2,
    ],
];
