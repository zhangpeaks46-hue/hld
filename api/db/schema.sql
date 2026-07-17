-- ============================================================
-- 好论点智检 - 数据库结构
-- 在宝塔面板 > 数据库 > phpMyAdmin 中执行此文件
-- 建议先创建数据库 docheck，再切换到该库执行
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- 用户表
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `phone` VARCHAR(20) NOT NULL COMMENT '手机号',
    `nickname` VARCHAR(50) NULL DEFAULT NULL COMMENT '昵称',
    `avatar` VARCHAR(255) NULL DEFAULT NULL COMMENT '头像URL',
    `free_quota` INT NOT NULL DEFAULT 3 COMMENT '剩余免费次数',
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT '1=正常 0=禁用',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `last_login_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- ------------------------------------------------------------
-- 验证码表
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `verification_codes`;
CREATE TABLE `verification_codes` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `phone` VARCHAR(20) NOT NULL,
    `code` VARCHAR(10) NOT NULL,
    `purpose` ENUM('login','register') NOT NULL DEFAULT 'login',
    `expires_at` TIMESTAMP NOT NULL,
    `used` TINYINT NOT NULL DEFAULT 0,
    `ip` VARCHAR(45) NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_phone_code` (`phone`, `code`),
    KEY `idx_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='短信验证码表';

-- ------------------------------------------------------------
-- 文档表
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `documents`;
CREATE TABLE `documents` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INT UNSIGNED NOT NULL,
    `service_type` ENUM('format','proofread','process') NOT NULL COMMENT '服务类型',
    `original_filename` VARCHAR(255) NOT NULL COMMENT '原始文件名',
    `file_path` VARCHAR(500) NOT NULL COMMENT '服务器存储路径',
    `file_size` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '文件大小(字节)',
    `file_ext` VARCHAR(10) NULL DEFAULT NULL COMMENT '扩展名 docx/pdf',
    -- 格式要求输入（二选一或都为空）
    `format_file_path` VARCHAR(500) NULL DEFAULT NULL COMMENT '上传的格式模板文件路径',
    `format_text` TEXT NULL COMMENT '粘贴的格式要求文本',
    -- AI 处理信息
    `ai_provider` VARCHAR(50) NULL DEFAULT NULL COMMENT 'deepseek/doubao',
    `ai_model` VARCHAR(100) NULL DEFAULT NULL COMMENT '模型名',
    -- 处理状态
    `status` ENUM('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
    -- 结果统计
    `total_issues` INT NOT NULL DEFAULT 0,
    `fixed_issues` INT NOT NULL DEFAULT 0,
    `manual_issues` INT NOT NULL DEFAULT 0,
    `suggested_issues` INT NOT NULL DEFAULT 0,
    `result_summary` TEXT NULL COMMENT 'AI 返回的总结',
    `result_file_path` VARCHAR(500) NULL DEFAULT NULL COMMENT '生成的结果报告文件路径',
    `error_message` TEXT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `completed_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_user_status` (`user_id`, `status`),
    CONSTRAINT `fk_doc_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文档记录表';

-- ------------------------------------------------------------
-- 文档问题详情表
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `document_issues`;
CREATE TABLE `document_issues` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `document_id` INT UNSIGNED NOT NULL,
    `page` INT NULL DEFAULT NULL COMMENT '页码',
    `line` INT NULL DEFAULT NULL COMMENT '行号',
    `issue_type` VARCHAR(100) NOT NULL COMMENT '问题类型',
    `description` TEXT NULL COMMENT '问题描述',
    `suggestion` TEXT NULL COMMENT '修改建议',
    `original_text` TEXT NULL COMMENT '原文片段',
    `revised_text` TEXT NULL COMMENT '修改后文本',
    `status` ENUM('fixed','manual','suggested') NOT NULL DEFAULT 'suggested',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_document` (`document_id`),
    CONSTRAINT `fk_issue_doc` FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文档问题详情表';

SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------
-- 初始化管理员说明（可选）
-- 后续通过手机号登录的用户会自动写入 users 表
-- ------------------------------------------------------------
