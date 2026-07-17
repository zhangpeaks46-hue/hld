<?php
/**
 * 短信验证码配置
 *
 * 当前为「模拟模式」(mock = true)：验证码不会真正发送短信，
 * 而是写入日志并随接口返回 dev_code 字段，方便前端联调。
 *
 * 接入真实短信（阿里云/腾讯云）时：
 *   1. 注册服务商账号并开通短信服务
 *   2. 将 mock 改为 false
 *   3. 填写 access_key / secret / sign_name / template_code
 *   4. 在 lib/SmsSender.php 中实现真实发送逻辑（已有占位）
 */

return [
    // 是否使用模拟模式
    'mock' => true,

    // 验证码长度
    'code_length' => 6,

    // 验证码有效期（秒）
    'expire_seconds' => 300,

    // 同一手机号最短发送间隔（秒），防止刷接口
    'resend_interval' => 60,

    // 同一 IP 每天最多发送次数
    'daily_limit_per_ip' => 10,

    // 真实短信服务商（mock=false 时启用）
    'provider' => 'aliyun',  // aliyun / tencent

    'aliyun' => [
        'access_key_id' => '',
        'access_secret' => '',
        'sign_name' => '好论点智检',
        'template_code' => 'SMS_xxxxxxxx',
        'endpoint' => 'dysmsapi.aliyuncs.com',
    ],

    'tencent' => [
        'secret_id' => '',
        'secret_key' => '',
        'sdk_app_id' => '',
        'sign_name' => '好论点智检',
        'template_id' => '',
        'region' => 'ap-guangzhou',
    ],
];
