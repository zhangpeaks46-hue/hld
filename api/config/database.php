<?php
/**
 * 数据库连接配置
 *
 * 在宝塔面板 > 数据库 创建一个 MySQL 数据库（如 docheck），
 * 然后将下方信息替换为宝塔给出的连接信息。
 */

return [
    'host'     => '127.0.0.1',
    'port'     => 3306,
    'dbname'   => 'docheck',      // 数据库名
    'username' => 'docheck',      // 数据库用户名
    'password' => 'your_password_here', // 数据库密码
    'charset'  => 'utf8mb4',
    // 文件存储根目录（绝对路径），默认放在 api 同级 storage 目录
    'storage_path' => dirname(__DIR__) . '/storage',
];
