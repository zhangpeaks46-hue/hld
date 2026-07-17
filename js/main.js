/**
 * 好论点智检平台 - 主要交互脚本
 * 功能：
 *   - 登录态检测与导航栏切换
 *   - 上传前登录拦截
 *   - 多步骤上传向导（服务选择 → 格式要求 → 文档上传）
 *   - 调用后端 API 上传与处理
 *   - 结果展示与下载
 *   - 模态框、Toast、平滑滚动等基础交互
 * 依赖：js/api.js（提供 API 调用与工具函数）
 */

(function () {
    'use strict';

    // ============================================================
    // 工具函数
    // ============================================================

    function showModal(modalId) {
        var modal = document.getElementById(modalId);
        if (!modal) return;
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    function hideModal(modalId) {
        var modal = document.getElementById(modalId);
        if (!modal) return;
        modal.classList.add('hidden');
        var openModals = document.querySelectorAll('.fixed.inset-0.z-50:not(.hidden)');
        if (openModals.length === 0) {
            document.body.style.overflow = '';
        }
    }

    function hideAllModals() {
        document.querySelectorAll('.fixed.inset-0.z-50').forEach(function (modal) {
            modal.classList.add('hidden');
        });
        document.body.style.overflow = '';
    }

    function escapeHtml(s) {
        if (s === null || s === undefined) return '';
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    // 复用 api.js 的 showToast，若不存在则降级
    function showToast(message, type) {
        if (window.API && API.showToast) {
            API.showToast(message, type);
            return;
        }
        var toast = document.getElementById('toast');
        var toastMessage = document.getElementById('toast-message');
        if (!toast || !toastMessage) return;
        toastMessage.textContent = message || '操作成功';
        toast.classList.remove('hidden');
        setTimeout(function () { toast.classList.add('hidden'); }, 2500);
    }

    // ============================================================
    // 登录态与导航栏
    // ============================================================

    var isLoggedIn = false;
    var currentUser = null;

    function refreshLoginState() {
        if (!window.API) return Promise.resolve(false);
        return API.Auth.check().then(function (res) {
            isLoggedIn = !!res.logged_in;
            currentUser = res.user || null;
            renderNavByLoginState();
            return isLoggedIn;
        }).catch(function () {
            isLoggedIn = false;
            renderNavByLoginState();
            return false;
        });
    }

    function renderNavByLoginState() {
        var loginBtn = document.getElementById('login-btn');
        var registerBtn = document.getElementById('register-btn');
        var userArea = document.getElementById('user-area');
        var navDashboard = document.getElementById('nav-dashboard');
        var navUsername = document.getElementById('nav-username');
        var logoutBtn = document.getElementById('logout-btn');

        // 移动端
        var mobileAuth = document.getElementById('mobile-auth');
        var mobileDashboard = document.getElementById('mobile-dashboard');
        var logoutBtnMobile = document.getElementById('logout-btn-mobile');

        if (isLoggedIn) {
            if (loginBtn) loginBtn.classList.add('hidden');
            if (registerBtn) registerBtn.classList.add('hidden');
            if (userArea) {
                userArea.classList.remove('hidden');
                userArea.classList.add('flex');
            }
            if (navDashboard) navDashboard.classList.remove('hidden');
            if (navUsername && currentUser) navUsername.textContent = currentUser.nickname || currentUser.phone;
            if (mobileDashboard) mobileDashboard.classList.remove('hidden');
            if (mobileAuth) mobileAuth.classList.add('hidden');
            if (logoutBtnMobile) logoutBtnMobile.classList.remove('hidden');
        } else {
            if (loginBtn) loginBtn.classList.remove('hidden');
            if (registerBtn) registerBtn.classList.remove('hidden');
            if (userArea) {
                userArea.classList.add('hidden');
                userArea.classList.remove('flex');
            }
            if (navDashboard) navDashboard.classList.add('hidden');
            if (mobileDashboard) mobileDashboard.classList.add('hidden');
            if (mobileAuth) mobileAuth.classList.remove('hidden');
            if (logoutBtnMobile) logoutBtnMobile.classList.add('hidden');
        }
    }

    function bindLogoutButtons() {
        var logoutBtn = document.getElementById('logout-btn');
        var logoutBtnMobile = document.getElementById('logout-btn-mobile');
        function doLogout() {
            if (!window.API) return;
            API.Auth.logout().then(function () {
                showToast('已退出登录', 'success');
                refreshLoginState();
            }).catch(function () {
                refreshLoginState();
            });
        }
        if (logoutBtn) logoutBtn.addEventListener('click', doLogout);
        if (logoutBtnMobile) logoutBtnMobile.addEventListener('click', doLogout);
    }

    // ============================================================
    // 移动端菜单
    // ============================================================

    var mobileMenuBtn = document.getElementById('mobile-menu-button');
    var mobileMenu = document.getElementById('mobile-menu');

    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', function () {
            mobileMenu.classList.toggle('hidden');
        });
    }

    var mobileLinks = mobileMenu ? mobileMenu.querySelectorAll('a[href^="#"]') : [];
    mobileLinks.forEach(function (link) {
        link.addEventListener('click', function () {
            if (mobileMenu) mobileMenu.classList.add('hidden');
        });
    });

    // ============================================================
    // 上传向导状态
    // ============================================================

    var wizardState = {
        step: 1,
        serviceType: null,       // format/proofread/process
        formatFile: null,        // File 或 null
        formatText: '',          // 粘贴的文本
        formatTab: 'text',       // text/file
        documentFile: null,      // 待处理文档 File
        aiProvider: 'deepseek',  // deepseek/doubao
        currentDocId: null,      // 处理后的文档ID
    };

    var MAX_FILE_SIZE = 20 * 1024 * 1024;
    var ALLOWED_DOC_EXT = ['.docx', '.pdf', '.txt', '.md'];
    var ALLOWED_FMT_EXT = ['.docx', '.pdf', '.txt', '.md', '.doc'];

    // ============================================================
    // 触发上传：登录拦截
    // ============================================================

    function triggerUploadFlow() {
        if (isLoggedIn) {
            resetWizard();
            goToStep(1);
            showModal('upload-modal');
        } else {
            showToast('请先登录后再使用检测功能', 'error');
            // 保存意图后跳转登录
            setTimeout(function () {
                if (window.API) API.redirectToLogin();
            }, 600);
        }
    }

    var uploadBtn = document.getElementById('upload-btn');
    if (uploadBtn) uploadBtn.addEventListener('click', triggerUploadFlow);

    document.querySelectorAll('.feature-start').forEach(function (btn) {
        btn.addEventListener('click', triggerUploadFlow);
    });

    // 支持 #upload 锚点跳转触发
    if (location.hash === '#upload' && uploadBtn) {
        triggerUploadFlow();
    }
    window.addEventListener('hashchange', function () {
        if (location.hash === '#upload') triggerUploadFlow();
    });

    // 关闭按钮
    var closeModalBtn = document.getElementById('close-modal');
    if (closeModalBtn) closeModalBtn.addEventListener('click', function () { hideModal('upload-modal'); });

    // ============================================================
    // 步骤切换
    // ============================================================

    function goToStep(step) {
        wizardState.step = step;
        // 面板切换
        [1, 2, 3].forEach(function (n) {
            var panel = document.getElementById('step-' + n);
            if (panel) panel.classList.toggle('hidden', n !== step);
        });
        // 步骤指示器
        document.querySelectorAll('.step-indicator').forEach(function (el) {
            var n = parseInt(el.getAttribute('data-step'), 10);
            var circle = el.querySelector('.step-circle');
            if (circle) {
                circle.classList.toggle('step-circle-active', n <= step);
                circle.classList.toggle('step-circle-done', n < step);
            }
        });
        document.querySelectorAll('.step-line').forEach(function (line, idx) {
            line.classList.toggle('step-line-active', idx < step - 1);
        });
    }

    function resetWizard() {
        wizardState = {
            step: 1,
            serviceType: null,
            formatFile: null,
            formatText: '',
            formatTab: 'text',
            documentFile: null,
            aiProvider: 'deepseek',
            currentDocId: null,
        };
        // 重置 UI
        document.querySelectorAll('.service-option').forEach(function (opt) {
            opt.classList.remove('selected', 'bg-blue-50', 'border-primary');
            opt.classList.add('border-gray-300');
        });
        var fmtText = document.getElementById('format-text');
        if (fmtText) fmtText.value = '';
        var fmtDisplay = document.getElementById('format-file-display');
        if (fmtDisplay) { fmtDisplay.classList.add('hidden'); fmtDisplay.textContent = ''; }
        var fmtInput = document.getElementById('format-file-input');
        if (fmtInput) fmtInput.value = '';
        var fileDisplay = document.getElementById('file-name-display');
        if (fileDisplay) { fileDisplay.classList.add('hidden'); fileDisplay.textContent = ''; }
        var fileInput = document.getElementById('file-input');
        if (fileInput) fileInput.value = '';
        switchFormatTab('text');
        var deepseekRadio = document.querySelector('input[name="ai_provider"][value="deepseek"]');
        if (deepseekRadio) deepseekRadio.checked = true;
    }

    // 步骤1 → 2
    var step1Next = document.getElementById('step1-next');
    if (step1Next) {
        step1Next.addEventListener('click', function () {
            if (!wizardState.serviceType) {
                showToast('请先选择服务类型', 'error');
                return;
            }
            goToStep(2);
        });
    }

    // 步骤2 → 3
    var step2Next = document.getElementById('step2-next');
    if (step2Next) {
        step2Next.addEventListener('click', function () {
            // 同步格式文本
            var fmtText = document.getElementById('format-text');
            wizardState.formatText = fmtText ? fmtText.value.trim() : '';
            if (wizardState.formatTab === 'file' && !wizardState.formatFile) {
                showToast('请上传格式模板文件，或切换到文本输入', 'error');
                return;
            }
            goToStep(3);
        });
    }

    // 上一步按钮
    document.querySelectorAll('.step-prev').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var target = parseInt(btn.getAttribute('data-target'), 10);
            goToStep(target);
        });
    });

    // ============================================================
    // 步骤1：服务类型选择
    // ============================================================

    var serviceOptions = document.querySelectorAll('.service-option');
    serviceOptions.forEach(function (option) {
        option.addEventListener('click', function () {
            serviceOptions.forEach(function (opt) {
                opt.classList.remove('selected', 'bg-blue-50', 'border-primary');
                opt.classList.add('border-gray-300');
            });
            this.classList.remove('border-gray-300');
            this.classList.add('selected', 'bg-blue-50', 'border-primary');
            wizardState.serviceType = this.getAttribute('data-service');
        });
    });

    // ============================================================
    // 步骤2：格式要求输入（Tab 切换）
    // ============================================================

    function switchFormatTab(tab) {
        wizardState.formatTab = tab;
        document.querySelectorAll('.tab-btn').forEach(function (btn) {
            var active = btn.getAttribute('data-tab') === tab;
            btn.classList.toggle('tab-active', active);
            btn.classList.toggle('text-gray-500', !active);
        });
        document.getElementById('tab-text').classList.toggle('hidden', tab !== 'text');
        document.getElementById('tab-file').classList.toggle('hidden', tab !== 'file');
    }

    document.querySelectorAll('.tab-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            switchFormatTab(btn.getAttribute('data-tab'));
        });
    });

    // 格式文件上传
    var formatDropArea = document.getElementById('format-drop-area');
    var formatFileInput = document.getElementById('format-file-input');
    var formatFileDisplay = document.getElementById('format-file-display');

    if (formatDropArea) {
        formatDropArea.addEventListener('click', function () {
            if (formatFileInput) formatFileInput.click();
        });
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(function (eventName) {
            formatDropArea.addEventListener(eventName, function (e) {
                e.preventDefault(); e.stopPropagation();
            });
        });
        ['dragenter', 'dragover'].forEach(function (eventName) {
            formatDropArea.addEventListener(eventName, function () {
                formatDropArea.classList.add('dragover');
            });
        });
        ['dragleave', 'drop'].forEach(function (eventName) {
            formatDropArea.addEventListener(eventName, function () {
                formatDropArea.classList.remove('dragover');
            });
        });
        formatDropArea.addEventListener('drop', function (e) {
            var dt = e.dataTransfer;
            if (dt && dt.files && dt.files.length > 0) {
                handleFormatFile(dt.files[0]);
            }
        });
    }

    if (formatFileInput) {
        formatFileInput.addEventListener('change', function (e) {
            if (e.target.files && e.target.files.length > 0) {
                handleFormatFile(e.target.files[0]);
            }
        });
    }

    function handleFormatFile(file) {
        var name = file.name.toLowerCase();
        var valid = ALLOWED_FMT_EXT.some(function (ext) { return name.endsWith(ext); });
        if (!valid) {
            showToast('格式模板文件格式不支持', 'error');
            return;
        }
        if (file.size > MAX_FILE_SIZE) {
            showToast('文件过大，请上传小于 20MB 的文件', 'error');
            return;
        }
        wizardState.formatFile = file;
        if (formatFileDisplay) {
            var sizeMB = (file.size / 1024 / 1024).toFixed(2);
            formatFileDisplay.textContent = '已选择: ' + file.name + ' (' + sizeMB + ' MB)';
            formatFileDisplay.classList.remove('hidden');
        }
    }

    // ============================================================
    // 步骤3：文档上传
    // ============================================================

    var dropArea = document.getElementById('drop-area');
    var fileInput = document.getElementById('file-input');
    var fileNameDisplay = document.getElementById('file-name-display');

    if (dropArea) {
        dropArea.addEventListener('click', function () {
            if (fileInput) fileInput.click();
        });
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(function (eventName) {
            dropArea.addEventListener(eventName, function (e) {
                e.preventDefault(); e.stopPropagation();
            });
        });
        ['dragenter', 'dragover'].forEach(function (eventName) {
            dropArea.addEventListener(eventName, function () {
                dropArea.classList.add('dragover');
            });
        });
        ['dragleave', 'drop'].forEach(function (eventName) {
            dropArea.addEventListener(eventName, function () {
                dropArea.classList.remove('dragover');
            });
        });
        dropArea.addEventListener('drop', function (e) {
            var dt = e.dataTransfer;
            if (dt && dt.files && dt.files.length > 0) {
                handleDocumentFile(dt.files[0]);
            }
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', function (e) {
            if (e.target.files && e.target.files.length > 0) {
                handleDocumentFile(e.target.files[0]);
            }
        });
    }

    function handleDocumentFile(file) {
        var name = file.name.toLowerCase();
        var valid = ALLOWED_DOC_EXT.some(function (ext) { return name.endsWith(ext); });
        if (!valid) {
            showToast('不支持的文档格式，允许 DOCX/PDF/TXT/MD', 'error');
            return;
        }
        if (file.size > MAX_FILE_SIZE) {
            showToast('文件过大，请上传小于 20MB 的文件', 'error');
            return;
        }
        wizardState.documentFile = file;
        if (fileNameDisplay) {
            var sizeMB = (file.size / 1024 / 1024).toFixed(2);
            fileNameDisplay.textContent = '已选择: ' + file.name + ' (' + sizeMB + ' MB)';
            fileNameDisplay.classList.remove('hidden');
        }
    }

    // AI 提供商选择
    document.querySelectorAll('input[name="ai_provider"]').forEach(function (radio) {
        radio.addEventListener('change', function () {
            if (this.checked) wizardState.aiProvider = this.value;
        });
    });

    // ============================================================
    // 确认上传 → 调用后端
    // ============================================================

    var confirmUploadBtn = document.getElementById('confirm-upload');
    if (confirmUploadBtn) {
        confirmUploadBtn.addEventListener('click', function () {
            if (!wizardState.serviceType) {
                showToast('请选择服务类型', 'error');
                goToStep(1);
                return;
            }
            if (!wizardState.documentFile) {
                showToast('请上传待处理文档', 'error');
                return;
            }

            // 同步格式文本
            var fmtText = document.getElementById('format-text');
            if (fmtText) wizardState.formatText = fmtText.value.trim();

            // 构建 FormData
            var formData = new FormData();
            formData.append('service_type', wizardState.serviceType);
            formData.append('file', wizardState.documentFile);
            if (wizardState.formatTab === 'file' && wizardState.formatFile) {
                formData.append('format_file', wizardState.formatFile);
            } else if (wizardState.formatText) {
                formData.append('format_text', wizardState.formatText);
            }
            formData.append('ai_provider', wizardState.aiProvider);

            // 切到处理中
            hideModal('upload-modal');
            showProcessing();

            API.Document.upload(formData).then(function (res) {
                if (res.success) {
                    wizardState.currentDocId = res.document_id;
                    // 触发处理
                    return API.Document.process(res.document_id);
                } else {
                    throw new Error(res.message || '上传失败');
                }
            }).then(function (res) {
                if (res.success) {
                    hideModal('loading-modal');
                    renderResultModal(res, wizardState.currentDocId);
                    showModal('result-modal');
                    refreshLoginState(); // 刷新剩余次数显示
                } else {
                    throw new Error(res.message || '处理失败');
                }
            }).catch(function (err) {
                hideModal('loading-modal');
                showToast(err.message || '处理失败，请重试', 'error');
            });
        });
    }

    function showProcessing() {
        showModal('loading-modal');
        var progressBar = document.getElementById('progress-bar');
        var loadingText = document.getElementById('loading-text');
        var progress = 0;
        var texts = [
            '正在解析文档结构...',
            '正在调用 AI 分析...',
            '正在生成修改建议...',
            '正在整理检测结果...'
        ];
        var interval = setInterval(function () {
            progress += Math.random() * 15 + 5;
            if (progress >= 90) {
                progress = 90;
                clearInterval(interval);
            }
            if (progressBar) progressBar.style.width = progress + '%';
            if (loadingText) {
                var idx = Math.min(Math.floor(progress / 25), texts.length - 1);
                loadingText.textContent = texts[idx];
            }
        }, 800);
        // 处理完成后端会返回，interval 在结果显示时无需再清理
    }

    // ============================================================
    // 结果模态框
    // ============================================================

    function renderResultModal(result, docId) {
        var body = document.getElementById('result-body');
        if (!body) return;

        var issues = result.issues || [];
        var total = result.total_issues || issues.length;
        var fixed = result.fixed_issues || 0;
        var manual = result.manual_issues || 0;
        var suggested = result.suggested_issues || 0;

        var issueRows = issues.map(function (it) {
            var statusBadge = {
                fixed: '<span class="text-green-600">已修复</span>',
                manual: '<span class="text-yellow-600">需手动</span>',
                suggested: '<span class="text-purple-600">建议项</span>',
            }[it.status] || it.status;
            return '<tr>'
                + '<td class="px-4 py-2">' + (it.page || '-') + '</td>'
                + '<td class="px-4 py-2">' + (it.line || '-') + '</td>'
                + '<td class="px-4 py-2">' + escapeHtml(it.issue_type) + '</td>'
                + '<td class="px-4 py-2">' + escapeHtml(it.description) + '</td>'
                + '<td class="px-4 py-2">' + statusBadge + '</td>'
                + '</tr>';
        }).join('') || '<tr><td colspan="5" class="px-4 py-4 text-center text-gray-400">未发现明显问题</td></tr>';

        body.innerHTML =
            '<div class="bg-green-100 text-green-800 p-4 rounded-lg mb-4">'
            + '<div class="flex items-center"><i class="fa fa-check-circle text-2xl mr-2"></i><h4 class="font-semibold">处理成功</h4></div>'
            + '<p class="mt-2">您的文档已成功处理，共检测到 <span class="font-semibold">' + total + '</span> 处问题，'
            + '已自动修复 <span class="font-semibold">' + fixed + '</span> 处。</p>'
            + '</div>'
            + '<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">'
            + '<div class="bg-blue-50 p-4 rounded text-center"><div class="text-3xl font-bold text-primary">' + total + '</div><div class="text-sm text-gray-600">总问题数</div></div>'
            + '<div class="bg-green-50 p-4 rounded text-center"><div class="text-3xl font-bold text-secondary">' + fixed + '</div><div class="text-sm text-gray-600">已修复</div></div>'
            + '<div class="bg-yellow-50 p-4 rounded text-center"><div class="text-3xl font-bold text-yellow-600">' + manual + '</div><div class="text-sm text-gray-600">需手动</div></div>'
            + '<div class="bg-purple-50 p-4 rounded text-center"><div class="text-3xl font-bold text-purple-600">' + suggested + '</div><div class="text-sm text-gray-600">建议项</div></div>'
            + '</div>'
            + (result.summary ? '<div class="bg-gray-50 p-4 rounded-lg mb-4 text-sm text-gray-700"><strong>总体结论：</strong><div class="mt-1">' + escapeHtml(result.summary).replace(/\n/g, '<br>') + '</div></div>' : '')
            + '<div class="bg-white border border-gray-200 rounded-lg shadow-sm">'
            + '<div class="p-4 border-b border-gray-200"><h4 class="font-semibold">问题详情</h4></div>'
            + '<div class="p-4 max-h-64 overflow-y-auto">'
            + '<table class="min-w-full text-sm"><thead><tr class="bg-gray-50">'
            + '<th class="px-4 py-2 text-left font-medium text-gray-500">页码</th>'
            + '<th class="px-4 py-2 text-left font-medium text-gray-500">行数</th>'
            + '<th class="px-4 py-2 text-left font-medium text-gray-500">问题类型</th>'
            + '<th class="px-4 py-2 text-left font-medium text-gray-500">描述</th>'
            + '<th class="px-4 py-2 text-left font-medium text-gray-500">状态</th>'
            + '</tr></thead><tbody class="divide-y divide-gray-200">' + issueRows + '</tbody></table>'
            + '</div></div>';
    }

    var closeResultModal = document.getElementById('close-result-modal');
    if (closeResultModal) {
        closeResultModal.addEventListener('click', function () { hideModal('result-modal'); });
    }

    var downloadResultBtn = document.getElementById('download-result');
    if (downloadResultBtn) {
        downloadResultBtn.addEventListener('click', function () {
            if (wizardState.currentDocId) {
                window.open(API.Document.downloadUrl(wizardState.currentDocId), '_blank');
            } else {
                showToast('暂无可下载的结果', 'error');
            }
        });
    }

    var resultNewUpload = document.getElementById('result-new-upload');
    if (resultNewUpload) {
        resultNewUpload.addEventListener('click', function () {
            hideModal('result-modal');
            triggerUploadFlow();
        });
    }

    // ============================================================
    // 登录/注册模态框（保留旧入口，但登录按钮跳转到登录页）
    // ============================================================

    var loginBtn = document.getElementById('login-btn');
    var loginBtnMobile = document.getElementById('login-btn-mobile');
    var registerBtn = document.getElementById('register-btn');
    var registerBtnMobile = document.getElementById('register-btn-mobile');

    // 原来的邮箱登录模态框，现在改为跳转到登录页
    function gotoLogin() {
        if (window.API) API.redirectToLogin();
    }
    if (loginBtn) loginBtn.addEventListener('click', gotoLogin);
    if (loginBtnMobile) loginBtnMobile.addEventListener('click', gotoLogin);
    if (registerBtn) registerBtn.addEventListener('click', gotoLogin);
    if (registerBtnMobile) registerBtnMobile.addEventListener('click', gotoLogin);

    // 旧的登录/注册模态框关闭逻辑保留（向后兼容）
    document.querySelectorAll('.close-modal').forEach(function (btn) {
        btn.addEventListener('click', function () { hideAllModals(); });
    });

    // ============================================================
    // 演示视频模态框
    // ============================================================

    var demoBtn = document.getElementById('demo-btn');
    var closeVideoModal = document.getElementById('close-video-modal');
    if (demoBtn) demoBtn.addEventListener('click', function () { showModal('video-modal'); });
    if (closeVideoModal) closeVideoModal.addEventListener('click', function () { hideModal('video-modal'); });

    // ============================================================
    // 全局事件
    // ============================================================

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' || e.keyCode === 27) {
            hideAllModals();
        }
    });

    document.querySelectorAll('.fixed.inset-0').forEach(function (modal) {
        modal.addEventListener('click', function (e) {
            if (e.target === modal) hideAllModals();
        });
    });

    // 平滑滚动
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
        anchor.addEventListener('click', function (e) {
            var targetId = this.getAttribute('href');
            if (!targetId || targetId === '#' || targetId === '#upload') return;
            var targetElement = document.querySelector(targetId);
            if (!targetElement) return;
            e.preventDefault();
            var offset = 80;
            var targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - offset;
            window.scrollTo({ top: targetPosition, behavior: 'smooth' });
        });
    });

    // 滚动显示动画
    if ('IntersectionObserver' in window) {
        var revealElements = document.querySelectorAll('.card-hover, section');
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });
        revealElements.forEach(function (el) {
            if (el.getBoundingClientRect().top > window.innerHeight) {
                el.style.opacity = '0';
                el.style.transform = 'translateY(30px)';
                el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
                observer.observe(el);
            }
        });
    }

    // ============================================================
    // 初始化
    // ============================================================

    bindLogoutButtons();
    refreshLoginState();

    window.addEventListener('load', function () {
        console.log('好论点智检平台已加载');
    });

})();
