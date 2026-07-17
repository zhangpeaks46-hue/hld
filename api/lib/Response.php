<?php
/**
 * 基础库 - JSON 响应
 */
class Response
{
    public static function json($data, $statusCode = 200)
    {
        if (!headers_sent()) {
            http_response_code($statusCode);
            header('Content-Type: application/json; charset=utf-8');
        }
        echo json_encode($data, JSON_UNESCAPED_UNICODE);
        exit;
    }

    public static function success($data = [], $message = '操作成功')
    {
        self::json(array_merge(['success' => true, 'message' => $message], $data));
    }

    public static function error($message = '操作失败', $code = 400, $extra = [])
    {
        self::json(array_merge(['success' => false, 'message' => $message], $extra), $code);
    }
}
