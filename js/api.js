/**
 * 好论点智检 - 前端 API 辅助模块
 * 统一处理后端请求、登录态、Toast 提示
 *
 * ★ 演示模式 ★
 * 当后端未部署时，设置 DEMO_MODE = true 可在本地完整体验全流程。
 * 所有 API 调用返回模拟数据，数据存储在 localStorage 中。
 * 部署到宝塔后改为 false 即可切换到真实后端。
 */
(function (global) {
    'use strict';

    // ================================================================
    // ★ 演示模式开关 ★
    // 本地预览设为 true；部署到服务器后改为 false
    // ================================================================
    var DEMO_MODE = true;

    // 演示模式：通用验证码（任意手机号都可用此验证码登录）
    var DEMO_CODE = '888888';

    // API 基础路径：相对于站点根目录
    var API_BASE = (function () {
        if (location.pathname.indexOf('/pages/') !== -1) {
            return '../api';
        }
        return 'api';
    })();

    // ================================================================
    // 演示模式数据存储（localStorage）
    // ================================================================
    var DEMO_KEY = 'hld_demo';
    var demoData = null;

    function loadDemoData() {
        try {
            var raw = localStorage.getItem(DEMO_KEY);
            demoData = raw ? JSON.parse(raw) : null;
        } catch (e) { demoData = null; }
        if (!demoData) {
            demoData = { loggedIn: false, user: null, documents: [] };
            saveDemoData();
        }
    }

    function saveDemoData() {
        try { localStorage.setItem(DEMO_KEY, JSON.stringify(demoData)); } catch (e) {}
    }

    loadDemoData();

    // ================================================================
    // 真实请求
    // ================================================================
    function realRequest(method, path, body, isFormData) {
        var opts = {
            method: method,
            credentials: 'same-origin',
            headers: {},
        };
        if (body !== undefined && body !== null) {
            if (isFormData) {
                opts.body = body;
            } else {
                opts.headers['Content-Type'] = 'application/json';
                opts.body = JSON.stringify(body);
            }
        }
        return fetch(API_BASE + path, opts).then(function (resp) {
            var ct = resp.headers.get('Content-Type') || '';
            if (ct.indexOf('application/json') !== -1) {
                return resp.json().then(function (data) {
                    if (resp.status === 401) {
                        redirectToLogin();
                        throw data;
                    }
                    return data;
                });
            }
            if (!resp.ok) throw new Error('请求失败 ' + resp.status);
            return resp;
        });
    }

    function realGet(path) { return realRequest('GET', path, null); }
    function realPost(path, body) { return realRequest('POST', path, body, false); }
    function realPostForm(path, formData) { return realRequest('POST', path, formData, true); }

    // ================================================================
    // 演示模式请求（返回 Promise 模拟异步）
    // ================================================================
    function delay(ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms || 300); });
    }

    function demoPost(path, body) {
        return delay(400).then(function () { return handleDemoPost(path, body); });
    }

    function demoGet(path) {
        return delay(200).then(function () { return handleDemoGet(path); });
    }

    function handleDemoPost(path, body) {
        // --- 发送验证码 ---
        if (path.indexOf('/auth/send_code') !== -1) {
            var phone = body.phone || '';
            if (!/^1[3-9]\d{9}$/.test(phone)) {
                return { success: false, message: '手机号格式错误' };
            }
            return {
                success: true,
                message: '验证码已发送',
                dev_code: DEMO_CODE,
                mock: true
            };
        }

        // --- 验证码登录 ---
        if (path.indexOf('/auth/verify_login') !== -1) {
            var phone = body.phone || '';
            var code = body.code || '';
            if (!/^1[3-9]\d{9}$/.test(phone)) {
                return { success: false, message: '手机号格式错误' };
            }
            if (code !== DEMO_CODE) {
                return { success: false, message: '验证码错误，请输入 ' + DEMO_CODE };
            }
            var nickname = '用户' + phone.slice(-4);
            demoData.loggedIn = true;
            demoData.user = {
                id: 1,
                phone: phone.slice(0, 3) + '****' + phone.slice(-4),
                phone_raw: phone,
                nickname: nickname,
                avatar: null,
                free_quota: 10,
            };
            saveDemoData();
            return {
                success: true,
                message: '登录成功（演示模式）',
                user: demoData.user
            };
        }

        // --- 退出登录 ---
        if (path.indexOf('/auth/logout') !== -1) {
            demoData.loggedIn = false;
            demoData.user = null;
            saveDemoData();
            return { success: true, message: '已退出登录' };
        }

        // --- 上传文档 ---
        if (path.indexOf('/document/upload') !== -1) {
            // body 在演示模式不处理 FormData，用全局 wizardState 获取文件名
            var docId = Date.now();
            var serviceTypes = { format: '格式检测', proofread: '文字校对', process: '文字加工' };
            var doc = {
                id: docId,
                service_type: 'format',
                original_filename: '示例论文.docx',
                file_ext: 'docx',
                status: 'pending',
                total_issues: 0, fixed_issues: 0, manual_issues: 0, suggested_issues: 0,
                ai_provider: 'deepseek',
                ai_model: 'deepseek-chat (演示)',
                created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
                completed_at: null,
                service_type_label: '格式检测',
                status_label: '等待处理',
            };
            demoData.documents.unshift(doc);
            saveDemoData();
            return { success: true, document_id: docId, message: '上传成功' };
        }

        // --- 处理文档 ---
        if (path.indexOf('/document/process') !== -1) {
            var docId = body.document_id;
            var doc = findDoc(docId);
            if (!doc) return { success: false, message: '文档不存在' };
            doc.status = 'completed';
            doc.completed_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
            doc.total_issues = 8;
            doc.fixed_issues = 5;
            doc.manual_issues = 2;
            doc.suggested_issues = 1;
            doc.status_label = '已完成';
            saveDemoData();
            return {
                success: true, status: 'completed',
                ai_provider: 'deepseek', ai_model: 'deepseek-chat (演示)',
                summary: '【演示模式】文档检测完成，发现 8 处格式问题。请部署后端并配置 AI 密钥以获得真实检测结果。',
                total_issues: 8, fixed_issues: 5, manual_issues: 2, suggested_issues: 1,
                issues: [
                    { page: 1, line: 3, issue_type: '字体不统一', description: '标题使用了宋体，应使用黑体', suggestion: '将标题字体改为黑体三号', original_text: '基于AI的文档检测', revised_text: '基于AI的文档检测', status: 'fixed' },
                    { page: 2, line: 8, issue_type: '行距错误', description: '正文行距为 1.0 倍', suggestion: '应设置为 1.5 倍行距', original_text: '随着人工智能技术的发展...', revised_text: '随着人工智能技术的发展...', status: 'fixed' },
                    { page: 3, line: 15, issue_type: '字号不正确', description: '一级标题使用了四号字', suggestion: '一级标题应使用三号字', original_text: '一、研究背景', revised_text: '一、研究背景', status: 'fixed' },
                    { page: 4, line: 5, issue_type: '页边距错误', description: '上下页边距为 2cm', suggestion: '按格式要求应为 2.5cm', original_text: '', revised_text: '', status: 'fixed' },
                    { page: 5, line: 20, issue_type: '页码格式', description: '页码位置在页面底部居中', suggestion: '应按格式要求调整', original_text: '', revised_text: '', status: 'fixed' },
                    { page: 6, line: 10, issue_type: '参考文献格式错误', description: '缺少文献类型标识', suggestion: '按 GB/T 7714 补充 [J]/[M] 标识', original_text: '张三.人工智能导论.2023.', revised_text: '张三.人工智能导论[M].北京:XX出版社,2023.', status: 'manual' },
                    { page: 7, line: 12, issue_type: '图表编号', description: '图表编号不连续', suggestion: '检查并重新编号', original_text: '图1、图3', revised_text: '图1、图2', status: 'manual' },
                    { page: 8, line: 3, issue_type: '目录未更新', description: '目录页码与正文不一致', suggestion: '在 Word 中更新目录', original_text: '', revised_text: '', status: 'suggested' },
                ]
            };
        }

        return { success: false, message: '演示模式不支持该操作' };
    }

    function handleDemoGet(path) {
        // --- 检查登录 ---
        if (path.indexOf('/auth/check') !== -1) {
            if (demoData.loggedIn && demoData.user) {
                return { logged_in: true, user: demoData.user };
            }
            return { logged_in: false };
        }

        // --- 文档列表 ---
        if (path.indexOf('/document/list') !== -1) {
            var status = (path.match(/status=(\w+)/) || [])[1] || null;
            var docs = demoData.documents || [];
            if (status) docs = docs.filter(function (d) { return d.status === status; });
            return { success: true, documents: docs };
        }

        // --- 文档详情 ---
        if (path.indexOf('/document/detail') !== -1) {
            var id = parseInt((path.match(/id=(\d+)/) || [])[1], 10);
            var doc = findDoc(id);
            if (!doc) return { success: false, message: '文档不存在' };
            return {
                success: true,
                document: doc,
                issues: doc._issues || [
                    { page: 1, line: 3, issue_type: '字体不统一', description: '标题字体错误', suggestion: '改为黑体三号', original_text: '示例', revised_text: '示例', status: 'fixed' },
                ]
            };
        }

        return { success: false, message: '未知接口' };
    }

    function findDoc(id) {
        if (!demoData.documents) return null;
        for (var i = 0; i < demoData.documents.length; i++) {
            if (demoData.documents[i].id === id) return demoData.documents[i];
        }
        return null;
    }

    // ================================================================
    // 统一入口：演示模式 vs 真实请求
    // ================================================================
    function request(method, path, body, isFormData) {
        if (DEMO_MODE) {
            if (method === 'GET') return demoGet(path);
            return demoPost(path, body);
        }
        return realRequest(method, path, body, isFormData);
    }
    function get(path) { return request('GET', path, null); }
    function post(path, body) { return request('POST', path, body, false); }
    function postForm(path, formData) {
        if (DEMO_MODE) return demoPost(path, null);
        return request('POST', path, formData, true);
    }

    // ============ Auth API ============
    var Auth = {
        check: function () { return get('/auth/check.php'); },
        sendCode: function (phone) { return post('/auth/send_code.php', { phone: phone }); },
        verifyLogin: function (phone, code) { return post('/auth/verify_login.php', { phone: phone, code: code }); },
        logout: function () { return post('/auth/logout.php'); },
    };

    // ============ Document API ============
    var Document = {
        upload: function (formData) { return postForm('/document/upload.php', formData); },
        process: function (docId) { return post('/document/process.php', { document_id: docId }); },
        list: function (status) { return get('/document/list.php' + (status ? '?status=' + status : '')); },
        detail: function (id) { return get('/document/detail.php?id=' + id); },
        downloadUrl: function (id) {
            if (DEMO_MODE) return 'javascript:void(0)';
            return API_BASE + '/document/download.php?id=' + id;
        },
    };

    // ============ 工具函数 ============
    function redirectToLogin() {
        var loginPath = (location.pathname.indexOf('/pages/') !== -1) ? 'login.html' : 'pages/login.html';
        var redirect = encodeURIComponent(location.href);
        location.href = loginPath + '?redirect=' + redirect;
    }

    function redirectToDashboard() {
        var dashPath = (location.pathname.indexOf('/pages/') !== -1) ? 'dashboard.html' : 'pages/dashboard.html';
        location.href = dashPath;
    }

    function showToast(message, type) {
        var toast = document.getElementById('toast');
        var toastMessage = document.getElementById('toast-message');
        if (!toast || !toastMessage) { alert(message); return; }
        toastMessage.textContent = message || '操作成功';
        toast.classList.remove('hidden');
        var box = toast.querySelector('div');
        if (box) {
            box.classList.remove('bg-gray-800', 'bg-red-600', 'bg-green-600');
            if (type === 'error') box.classList.add('bg-red-600');
            else if (type === 'success') box.classList.add('bg-green-600');
            else box.classList.add('bg-gray-800');
        }
        clearTimeout(showToast._t);
        showToast._t = setTimeout(function () { toast.classList.add('hidden'); }, 2500);
    }

    function formatDateTime(s) {
        if (!s) return '-';
        var d = new Date(s.replace(' ', 'T'));
        if (isNaN(d.getTime())) return s;
        var pad = function (n) { return n < 10 ? '0' + n : n; };
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
            + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    }

    function formatFileSize(bytes) {
        if (!bytes) return '0 B';
        var units = ['B', 'KB', 'MB', 'GB'];
        var i = 0;
        while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
        return bytes.toFixed(i === 0 ? 0 : 2) + ' ' + units[i];
    }

    // 导出
    global.API = {
        base: API_BASE,
        DEMO_MODE: DEMO_MODE,
        request: request, get: get, post: post, postForm: postForm,
        Auth: Auth, Document: Document,
        redirectToLogin: redirectToLogin,
        redirectToDashboard: redirectToDashboard,
        showToast: showToast,
        formatDateTime: formatDateTime,
        formatFileSize: formatFileSize,
    };
})(window);