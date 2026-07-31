<?php
/**
 * 输入校验工具
 */
class Validator
{
    /**
     * 校验中国大陆手机号
     */
    public static function phone($phone)
    {
        return is_string($phone) && preg_match('/^1[3-9]\d{9}$/', $phone);
    }

    public static function required($value, $field)
    {
        if ($value === null || $value === '' ) {
            Response::error("参数 {$field} 不能为空");
        }
        return $value;
    }

    /**
     * 获取 JSON 请求体并解析为数组
     */
    public static function jsonBody()
    {
        $raw = file_get_contents('php://input');
        if (empty($raw)) {
            return [];
        }
        $data = json_decode($raw, true);
        if (!is_array($data)) {
            Response::error('请求体格式错误，需为 JSON');
        }
        return $data;
    }

    public static function clientIp()
    {
        foreach (['HTTP_X_FORWARDED_FOR', 'HTTP_CLIENT_IP', 'REMOTE_ADDR'] as $k) {
            if (!empty($_SERVER[$k])) {
                $ip = trim(explode(',', $_SERVER[$k])[0]);
                if (filter_var($ip, FILTER_VALIDATE_IP)) {
                    return $ip;
                }
            }
        }
        return '0.0.0.0';
    }
}
