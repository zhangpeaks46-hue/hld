/**
 * 任务书生成 - 前端交互脚本
 * 功能：任务书模态框、模板上传、AI生成、结果展示、历史记录
 * 依赖：js/api.js
 */
(function () {
    'use strict';

    // ============================================================
    // 状态
    // ============================================================
    var taskbookState = {
        templateFile: null,      // 上传的模板文件
        currentTaskbookId: null, // 当前生成的任务书ID
        aiProvider: 'deepseek',
    };

    // ============================================================
    // 工具函数（复用api.js或降级）
    // ============================================================
    function showModal(id) {
        var el = document.getElementById(id);
        if (el) { el.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
    }
    function hideModal(id) {
        var el = document.getElementById(id);
        if (el) { el.classList.add('hidden'); }
        var any = document.querySelectorAll('.fixed.inset-0.z-50:not(.hidden)');
        if (any.length === 0) document.body.style.overflow = '';
    }
    function showToast(msg, type) {
        if (window.API && API.showToast) { API.showToast(msg, type); return; }
        var t = document.getElementById('toast');
        var m = document.getElementById('toast-message');
        if (t && m) { m.textContent = msg || ''; t.classList.remove('hidden'); setTimeout(function () { t.classList.add('hidden'); }, 2500); }
    }
    function escapeHtml(s) {
        if (s === null || s === undefined) return '';
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    // ============================================================
    // 打开任务书模态框（需登录，异步检测）
    // ============================================================
    function openTaskbookModal() {
        if (!window.API || !API.Auth) {
            showToast('请先登录后再使用任务书功能', 'error');
            return;
        }
        API.Auth.check().then(function (res) {
            if (res.logged_in) {
                resetTaskbookForm();
                showModal('taskbook-modal');
            } else {
                showToast('请先登录后再使用任务书功能', 'error');
                setTimeout(function () { if (window.API) API.redirectToLogin(); }, 600);
            }
        }).catch(function () {
            showToast('请先登录后再使用任务书功能', 'error');
        });
    }

    function resetTaskbookForm() {
        taskbookState.templateFile = null;
        taskbookState.currentTaskbookId = null;
        var titleInput = document.getElementById('thesis-title-input');
        if (titleInput) titleInput.value = '';
        var display = document.getElementById('template-file-display');
        if (display) { display.classList.add('hidden'); display.textContent = ''; }
        var actions = document.getElementById('template-file-actions');
        if (actions) actions.classList.add('hidden');
        var input = document.getElementById('template-file-input');
        if (input) input.value = '';
        var radio = document.querySelector('input[name="taskbook_ai_provider"][value="deepseek"]');
        if (radio) radio.checked = true;
    }

    // ============================================================
    // 事件绑定
    // ============================================================
    function bindEvents() {
        // "生成任务书"按钮
        var startBtn = document.getElementById('taskbook-start-btn');
        if (startBtn) startBtn.addEventListener('click', openTaskbookModal);

        // 关闭模态框
        var closeBtn = document.getElementById('close-taskbook-modal');
        if (closeBtn) closeBtn.addEventListener('click', function () { hideModal('taskbook-modal'); });

        var closeResultBtn = document.getElementById('close-taskbook-result-modal');
        if (closeResultBtn) closeResultBtn.addEventListener('click', function () { hideModal('taskbook-result-modal'); });

        var closeHistoryBtn = document.getElementById('close-taskbook-history-modal');
        if (closeHistoryBtn) closeHistoryBtn.addEventListener('click', function () { hideModal('taskbook-history-modal'); });

        // 模板文件上传
        var dropArea = document.getElementById('template-drop-area');
        var fileInput = document.getElementById('template-file-input');
        var display = document.getElementById('template-file-display');

        if (dropArea) {
            dropArea.addEventListener('click', function () { if (fileInput) fileInput.click(); });
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(function (ev) {
                dropArea.addEventListener(ev, function (e) { e.preventDefault(); e.stopPropagation(); });
            });
            ['dragenter', 'dragover'].forEach(function (ev) {
                dropArea.addEventListener(ev, function () { dropArea.classList.add('dragover'); });
            });
            ['dragleave', 'drop'].forEach(function (ev) {
                dropArea.addEventListener(ev, function () { dropArea.classList.remove('dragover'); });
            });
            dropArea.addEventListener('drop', function (e) {
                var dt = e.dataTransfer;
                if (dt && dt.files && dt.files.length > 0) handleTemplateFile(dt.files[0]);
            });
        }
        if (fileInput) {
            fileInput.addEventListener('change', function (e) {
                if (e.target.files && e.target.files.length > 0) handleTemplateFile(e.target.files[0]);
            });
        }

        // 移除模板
        var removeBtn = document.getElementById('remove-template-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', function () {
                taskbookState.templateFile = null;
                if (display) { display.classList.add('hidden'); display.textContent = ''; }
                var actions = document.getElementById('template-file-actions');
                if (actions) actions.classList.add('hidden');
                if (fileInput) fileInput.value = '';
                showToast('模板已移除', 'success');
            });
        }

        // AI 引擎选择
        document.querySelectorAll('input[name="taskbook_ai_provider"]').forEach(function (r) {
            r.addEventListener('change', function () { if (this.checked) taskbookState.aiProvider = this.value; });
        });

        // 生成任务书
        var genBtn = document.getElementById('generate-taskbook-btn');
        if (genBtn) genBtn.addEventListener('click', generateTaskbook);

        // 下载任务书
        var dlBtn = document.getElementById('download-taskbook-btn');
        if (dlBtn) dlBtn.addEventListener('click', downloadTaskbook);

        // 继续生成
        var newBtn = document.getElementById('taskbook-result-new');
        if (newBtn) newBtn.addEventListener('click', function () {
            hideModal('taskbook-result-modal');
            openTaskbookModal();
        });

        // 查看历史记录
        var historyBtn = document.getElementById('taskbook-history-btn');
        if (historyBtn) historyBtn.addEventListener('click', showHistory);
    }

    // ============================================================
    // 模板文件处理
    // ============================================================
    function handleTemplateFile(file) {
        var allowed = ['.docx', '.pdf', '.txt', '.md', '.doc'];
        var name = file.name.toLowerCase();
        var ext = name.substring(name.lastIndexOf('.'));
        if (allowed.indexOf(ext) === -1) {
            showToast('不支持的模板文件格式', 'error');
            return;
        }
        if (file.size > 20 * 1024 * 1024) {
            showToast('文件过大，请上传小于 20MB 的文件', 'error');
            return;
        }
        taskbookState.templateFile = file;
        var display = document.getElementById('template-file-display');
        if (display) {
            var mb = (file.size / 1024 / 1024).toFixed(2);
            display.textContent = '已选择: ' + file.name + ' (' + mb + ' MB)';
            display.classList.remove('hidden');
        }
        var actions = document.getElementById('template-file-actions');
        if (actions) actions.classList.remove('hidden');
    }

    // ============================================================
    // 生成任务书
    // ============================================================
    function generateTaskbook() {
        var titleInput = document.getElementById('thesis-title-input');
        var title = titleInput ? titleInput.value.trim() : '';
        if (!title) {
            showToast('请输入论文题目', 'error');
            if (titleInput) titleInput.focus();
            return;
        }

        hideModal('taskbook-modal');
        showModal('loading-modal');

        // 更新加载提示
        var loadingText = document.getElementById('loading-text');
        if (loadingText) loadingText.textContent = '正在调用 AI 生成任务书...';

        var formData = new FormData();
        formData.append('thesis_title', title);
        formData.append('ai_provider', taskbookState.aiProvider);
        if (taskbookState.templateFile) {
            formData.append('template_file', taskbookState.templateFile);
        }

        var url = getApiBase() + '/taskbook/generate.php';

        fetch(url, {
            method: 'POST',
            body: formData,
            credentials: 'same-origin'
        })
        .then(function (res) { return res.json(); })
        .then(function (res) {
            hideModal('loading-modal');
            if (res.success) {
                taskbookState.currentTaskbookId = res.taskbook_id;
                renderTaskbookResult(res.data, res.taskbook_id);
                showModal('taskbook-result-modal');
                showToast('任务书生成成功', 'success');
            } else {
                showToast(res.message || '生成失败，请重试', 'error');
            }
        })
        .catch(function (err) {
            hideModal('loading-modal');
            showToast('请求失败: ' + err.message, 'error');
        });
    }

    // ============================================================
    // 渲染任务书结果
    // ============================================================
    function renderTaskbookResult(data, taskbookId) {
        var body = document.getElementById('taskbook-result-body');
        if (!body) return;

        var schedule = data.schedule || [];
        var refs = data.references || [];

        var scheduleHtml = schedule.map(function (s) {
            return '<tr><td class="px-4 py-2 text-sm border-b border-gray-200 font-medium w-32">' + escapeHtml(s.phase) + '</td>'
                + '<td class="px-4 py-2 text-sm border-b border-gray-200">' + escapeHtml(s.task) + '</td></tr>';
        }).join('') || '<tr><td colspan="2" class="px-4 py-4 text-center text-gray-400">无</td></tr>';

        var refsHtml = refs.map(function (r, i) {
            return '<li class="text-sm text-gray-700 mb-2">[' + (i + 1) + '] ' + escapeHtml(r) + '</li>';
        }).join('') || '<li class="text-gray-400">无</li>';

        body.innerHTML =
            '<div class="bg-blue-50 p-4 rounded-lg mb-6">'
            + '<h4 class="font-semibold text-lg text-gray-800 mb-1">' + escapeHtml(data.thesis_title || '') + '</h4>'
            + '<p class="text-sm text-gray-500">任务书已生成，您可以查看各板块内容并下载</p>'
            + '</div>'

            // 课题来源
            + '<div class="mb-5">'
            + '<h4 class="text-lg font-semibold text-gray-800 mb-2 flex items-center"><span class="bg-primary text-white w-7 h-7 rounded-full text-center text-sm leading-7 mr-2">1</span>课题来源</h4>'
            + '<div class="bg-gray-50 p-4 rounded-lg text-sm text-gray-700 leading-relaxed">' + escapeHtml(data.topic_source || '无') + '</div>'
            + '</div>'

            // 基本任务与要求
            + '<div class="mb-5">'
            + '<h4 class="text-lg font-semibold text-gray-800 mb-2 flex items-center"><span class="bg-primary text-white w-7 h-7 rounded-full text-center text-sm leading-7 mr-2">2</span>基本任务与要求</h4>'
            + '<div class="bg-gray-50 p-4 rounded-lg text-sm text-gray-700 leading-relaxed">' + escapeHtml(data.requirements || '无') + '</div>'
            + '</div>'

            // 需求分析
            + '<div class="mb-5">'
            + '<h4 class="text-lg font-semibold text-gray-800 mb-2 flex items-center"><span class="bg-primary text-white w-7 h-7 rounded-full text-center text-sm leading-7 mr-2">3</span>需求分析</h4>'
            + '<div class="bg-gray-50 p-4 rounded-lg text-sm text-gray-700 leading-relaxed">' + escapeHtml(data.requirements_analysis || '无') + '</div>'
            + '</div>'

            // 研究内容
            + '<div class="mb-5">'
            + '<h4 class="text-lg font-semibold text-gray-800 mb-2 flex items-center"><span class="bg-primary text-white w-7 h-7 rounded-full text-center text-sm leading-7 mr-2">4</span>研究内容</h4>'
            + '<div class="bg-gray-50 p-4 rounded-lg text-sm text-gray-700 leading-relaxed">' + escapeHtml(data.research_content || '无') + '</div>'
            + '</div>'

            // 概要设计
            + '<div class="mb-5">'
            + '<h4 class="text-lg font-semibold text-gray-800 mb-2 flex items-center"><span class="bg-primary text-white w-7 h-7 rounded-full text-center text-sm leading-7 mr-2">5</span>概要设计</h4>'
            + '<div class="bg-gray-50 p-4 rounded-lg text-sm text-gray-700 leading-relaxed">' + escapeHtml(data.outline_design || '无') + '</div>'
            + '</div>'

            // 进度安排
            + '<div class="mb-5">'
            + '<h4 class="text-lg font-semibold text-gray-800 mb-2 flex items-center"><span class="bg-primary text-white w-7 h-7 rounded-full text-center text-sm leading-7 mr-2">6</span>课题进度安排</h4>'
            + '<div class="bg-white border border-gray-200 rounded-lg overflow-hidden">'
            + '<table class="w-full"><thead><tr class="bg-gray-100"><th class="px-4 py-2 text-left text-sm font-medium text-gray-600">阶段</th><th class="px-4 py-2 text-left text-sm font-medium text-gray-600">任务内容</th></tr></thead>'
            + '<tbody>' + scheduleHtml + '</tbody></table></div></div>'

            // 参考文献
            + '<div class="mb-2">'
            + '<h4 class="text-lg font-semibold text-gray-800 mb-2 flex items-center"><span class="bg-primary text-white w-7 h-7 rounded-full text-center text-sm leading-7 mr-2">7</span>参考文献</h4>'
            + '<div class="bg-gray-50 p-4 rounded-lg"><ol class="list-decimal pl-5">' + refsHtml + '</ol></div></div>';
    }

    // ============================================================
    // 下载任务书
    // ============================================================
    function downloadTaskbook() {
        if (!taskbookState.currentTaskbookId) {
            showToast('暂无可下载的任务书', 'error');
            return;
        }
        window.open(getApiBase() + '/taskbook/download.php?id=' + taskbookState.currentTaskbookId, '_blank');
    }

    // ============================================================
    // 历史记录
    // ============================================================
    function showHistory() {
        if (!window.API || !API.Auth) {
            showToast('请先登录后再查看历史记录', 'error');
            return;
        }
        API.Auth.check().then(function (res) {
            if (!res.logged_in) {
                showToast('请先登录后再查看历史记录', 'error');
                setTimeout(function () { if (window.API) API.redirectToLogin(); }, 600);
                return;
            }
            hideModal('taskbook-modal');
            showModal('taskbook-history-modal');
            loadHistoryList();
        });
    }

    function loadHistoryList() {
        var body = document.getElementById('taskbook-history-body');
        if (body) body.innerHTML = '<div class="text-center py-8"><div class="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3"></div><p class="text-gray-500">加载中...</p></div>';

        var url = getApiBase() + '/taskbook/list.php';

        fetch(url, { credentials: 'same-origin' })
        .then(function (res) { return res.json(); })
        .then(function (res) {
            if (!res.success) { body.innerHTML = '<p class="text-center text-gray-400">加载失败</p>'; return; }

            var list = res.taskbooks || [];
            if (list.length === 0) {
                body.innerHTML = '<div class="text-center py-12 text-gray-400"><i class="fa fa-inbox text-4xl mb-3"></i><p>暂无历史记录</p></div>';
                return;
            }

            var html = '<div class="space-y-3">';
            list.forEach(function (item) {
                html += '<div class="border border-gray-200 rounded-lg p-4 hover:border-primary transition-colors">'
                    + '<div class="flex items-start justify-between">'
                    + '<div class="flex-1">'
                    + '<h4 class="font-semibold text-gray-800 text-sm mb-1">' + escapeHtml(item.thesis_title) + '</h4>'
                    + '<p class="text-xs text-gray-500">AI: ' + escapeHtml(item.ai_provider || '') + ' / ' + escapeHtml(item.ai_model || '') + ' | ' + escapeHtml(item.created_at || '') + '</p>'
                    + '</div>'
                    + '<div class="flex gap-2 ml-4">'
                    + '<button class="text-primary text-sm hover:underline taskbook-view-btn" data-id="' + item.id + '"><i class="fa fa-eye mr-1"></i>查看</button>'
                    + '<button class="text-primary text-sm hover:underline taskbook-download-btn" data-id="' + item.id + '"><i class="fa fa-download mr-1"></i>下载</button>'
                    + '</div></div></div>';
            });
            html += '</div>';
            body.innerHTML = html;

            // 绑定查看和下载事件
            body.querySelectorAll('.taskbook-view-btn').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var id = this.getAttribute('data-id');
                    viewTaskbookDetail(id);
                });
            });
            body.querySelectorAll('.taskbook-download-btn').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var id = this.getAttribute('data-id');
                    window.open(getApiBase() + '/taskbook/download.php?id=' + id, '_blank');
                });
            });
        })
        .catch(function () {
            body.innerHTML = '<p class="text-center text-red-400">加载失败</p>';
        });
    }

    function viewTaskbookDetail(id) {
        hideModal('taskbook-history-modal');
        showModal('loading-modal');

        var url = getApiBase() + '/taskbook/detail.php?id=' + id;

        fetch(url, { credentials: 'same-origin' })
        .then(function (res) { return res.json(); })
        .then(function (res) {
            hideModal('loading-modal');
            if (res.success) {
                taskbookState.currentTaskbookId = id;
                renderTaskbookResult(res.taskbook, id);
                showModal('taskbook-result-modal');
            } else {
                showToast(res.message || '加载失败', 'error');
            }
        })
        .catch(function (err) {
            hideModal('loading-modal');
            showToast('请求失败', 'error');
        });
    }

    // ============================================================
    // API Base URL（兼容不同目录层级）
    // ============================================================
    function getApiBase() {
        if (window.API && API._API_BASE) return API._API_BASE;
        var path = window.location.pathname;
        if (path.indexOf('/pages/') !== -1) {
            return path.replace(/\/pages\/[^\/]*$/, '') + '/api';
        }
        return '/api';
    }

    // ============================================================
    // 初始化
    // ============================================================
    bindEvents();

    window.addEventListener('load', function () {
        console.log('任务书模块已加载');
    });
})();