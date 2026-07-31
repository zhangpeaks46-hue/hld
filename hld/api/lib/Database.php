<?php
/**
 * 数据库连接单例
 */
class Database
{
    private static $instance = null;

    public static function pdo()
    {
        if (self::$instance === null) {
            $cfg = require __DIR__ . '/../config/database.php';

            $dsn = sprintf(
                'mysql:host=%s;port=%d;dbname=%s;charset=%s',
                $cfg['host'], $cfg['port'], $cfg['dbname'], $cfg['charset']
            );

            try {
                self::$instance = new PDO($dsn, $cfg['username'], $cfg['password'], [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                ]);
            } catch (PDOException $e) {
                http_response_code(500);
                header('Content-Type: application/json; charset=utf-8');
                echo json_encode([
                    'success' => false,
                    'message' => '数据库连接失败，请检查 api/config/database.php 配置',
                    'detail' => $e->getMessage(),
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }

            // 确保存储目录存在
            if (!empty($cfg['storage_path'])) {
                foreach (['uploads', 'formats', 'results'] as $sub) {
                    $dir = $cfg['storage_path'] . '/' . $sub;
                    if (!is_dir($dir)) {
                        @mkdir($dir, 0755, true);
                    }
                }
            }
        }
        return self::$instance;
    }
}
