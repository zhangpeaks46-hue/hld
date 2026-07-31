<?php
/**
 * 短信验证码发送器
 *
 * - mock 模式：写入日志并返回验证码字符串，调用方可拿到 dev_code 用于联调
 * - 真实模式：接入阿里云/腾讯云短信（占位实现，需要时补全 HTTP 调用）
 */
class SmsSender
{
    /**
     * 发送验证码
     *
     * @param array  $smsCfg sms_config.php 配置
     * @param string $phone  手机号
     * @param string $code   验证码
     * @return array ['sent' => bool, 'dev_code' => string|null]
     */
    public static function send($smsCfg, $phone, $code)
    {
        if (!empty($smsCfg['mock'])) {
            return self::sendMock($phone, $code);
        }

        $provider = $smsCfg['provider'] ?? 'aliyun';
        if ($provider === 'tencent') {
            return self::sendTencent($smsCfg['tencent'], $phone, $code);
        }
        return self::sendAliyun($smsCfg['aliyun'], $phone, $code);
    }

    /**
     * 模拟模式 - 不真正发送，写日志
     */
    private static function sendMock($phone, $code)
    {
        $line = sprintf("[%s] 模拟短信 -> %s 验证码: %s\n", date('Y-m-d H:i:s'), $phone, $code);
        $logFile = dirname(__DIR__) . '/storage/sms_mock.log';
        @file_put_contents($logFile, $line, FILE_APPEND);

        return ['sent' => true, 'dev_code' => $code];
    }

    /**
     * 阿里云短信（占位实现）
     * 接入步骤：1) 开通短信服务 2) 申请签名与模板 3) 获取 AccessKey
     * 文档：https://help.aliyun.com/product/44282.html
     */
    private static function sendAliyun($cfg, $phone, $code)
    {
        if (empty($cfg['access_key_id']) || empty($cfg['access_secret'])) {
            return ['sent' => false, 'dev_code' => $code, 'message' => '阿里云短信未配置'];
        }
        // TODO: 按 https://help.aliyun.com/document_detail/56189.html 实现签名与请求
        // 此处使用 cURL 调用阿里云短信 API，签名算法为 HMAC-SHA1
        // 临时降级为模拟模式
        return self::sendMock($phone, $code);
    }

    /**
     * 腾讯云短信（占位实现）
     * 文档：https://cloud.tencent.com/document/product/382
     */
    private static function sendTencent($cfg, $phone, $code)
    {
        if (empty($cfg['secret_id']) || empty($cfg['secret_key'])) {
            return ['sent' => false, 'dev_code' => $code, 'message' => '腾讯云短信未配置'];
        }
        // TODO: 接入腾讯云 SMS API
        return self::sendMock($phone, $code);
    }
}
