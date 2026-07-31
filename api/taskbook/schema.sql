-- ============================================================
-- 任务书表
-- 在宝塔面板 > 数据库 > phpMyAdmin 中执行此文件
-- ============================================================

DROP TABLE IF EXISTS `taskbooks`;
CREATE TABLE `taskbooks` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INT UNSIGNED NOT NULL,
    `thesis_title` VARCHAR(255) NOT NULL COMMENT '论文题目',
    `template_file_path` VARCHAR(500) NULL DEFAULT NULL COMMENT '上传的模板文件路径',
    `ai_provider` VARCHAR(50) NULL DEFAULT NULL COMMENT 'deepseek/doubao',
    `ai_model` VARCHAR(100) NULL DEFAULT NULL COMMENT '模型名',
    `topic_source` TEXT NULL COMMENT '课题来源',
    `requirements` TEXT NULL COMMENT '基本任务与要求',
    `research_content` TEXT NULL COMMENT '研究内容',
    `requirements_analysis` TEXT NULL COMMENT '需求分析',
    `outline_design` TEXT NULL COMMENT '概要设计',
    `schedule_json` TEXT NULL COMMENT '进度安排(JSON)',
    `references_json` TEXT NULL COMMENT '参考文献(JSON)',
    `result_file_path` VARCHAR(500) NULL DEFAULT NULL COMMENT '生成的结果报告文件路径',
    `status` ENUM('pending','completed','failed') NOT NULL DEFAULT 'pending',
    `error_message` TEXT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_user` (`user_id`),
    CONSTRAINT `fk_taskbook_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务书记录表';