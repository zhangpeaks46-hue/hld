<?php
/**
 * 会话管理 - 当前登录用户
 */
class Auth
{
    /**
     * 返回当前登录用户数组，未登录返回 null
     */
    public static function user(PDO $db)
    {
        if (empty($_SESSION['user_id'])) {
            return null;
        }
        $stmt = $db->prepare('SELECT id, phone, nickname, avatar, free_quota, status, created_at FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([$_SESSION['user_id']]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$user || (int)$user['status'] !== 1) {
            return null;
        }
        return $user;
    }

    public static function requireLogin(PDO $db)
    {
        $user = self::user($db);
        if (!$user) {
            Response::error('请先登录', 401);
        }
        return $user;
    }

    public static function login($userId)
    {
        session_regenerate_id(true);
        $_SESSION['user_id'] = (int)$userId;
        $_SESSION['login_at'] = time();
    }

    public static function logout()
    {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
        }
        session_destroy();
    }

    /**
     * 脱敏手机号 138****8000
     */
    public static function maskPhone($phone)
    {
        if (strlen($phone) < 7) {
            return $phone;
        }
        return substr($phone, 0, 3) . '****' . substr($phone, -4);
    }
}
