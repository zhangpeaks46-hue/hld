/**
 * 好论点智检平台 - 主要交互脚本
 * 功能：模态框、文件上传、表单验证、平滑滚动、Toast通知等
 */

(function () {
    'use strict';

    // ============================================================
    // 工具函数
    // ============================================================

    /**
     * 显示模态框
     * @param {string} modalId 模态框 ID
     */
    function showModal(modalId) {
        var modal = document.getElementById(modalId);
        if (!modal) return;
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // 防止背景滚动
    }

    /**
     * 隐藏模态框
     * @param {string} modalId 模态框 ID
     */
    function hideModal(modalId) {
        var modal = document.getElementById(modalId);
        if (!modal) return;
        modal.classList.add('hidden');

        // 如果没有其他打开的模态框，恢复滚动
        var openModals = document.querySelectorAll('.fixed.inset-0.z-50:not(.hidden)');
        if (openModals.length === 0) {
            document.body.style.overflow = '';
        }
    }

    /**
     * 关闭所有模态框
     */
    function hideAllModals() {
        var modals = document.querySelectorAll('.fixed.inset-0.z-50');
        modals.forEach(function (modal) {
            modal.classList.add('hidden');
        });
        document.body.style.overflow = '';
    }

    /**
     * 显示 Toast 通知
     * @param {string} message 消息内容
     * @param {number} duration 持续时间（毫秒）
     */
    function showToast(message, duration) {
        var toast = document.getElementById('toast');
        var toastMessage = document.getElementById('toast-message');
        if (!toast || !toastMessage) return;

        toastMessage.textContent = message || '操作成功';
        toast.classList.remove('hidden');

        setTimeout(function () {
            toast.classList.add('hidden');
        }, duration || 2500);
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

    // 点击移动端菜单项后关闭
    var mobileLinks = mobileMenu ? mobileMenu.querySelectorAll('a[href^="#"]') : [];
    mobileLinks.forEach(function (link) {
        link.addEventListener('click', function () {
            if (mobileMenu) mobileMenu.classList.add('hidden');
        });
    });

    // ============================================================
    // 上传模态框
    // ============================================================

    var uploadBtn = document.getElementById('upload-btn');
    var closeModalBtn = document.getElementById('close-modal');
    var cancelUploadBtn = document.getElementById('cancel-upload');
    var confirmUploadBtn = document.getElementById('confirm-upload');

    if (uploadBtn) {
        uploadBtn.addEventListener('click', function () {
            showModal('upload-modal');
        });
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', function () {
            hideModal('upload-modal');
        });
    }

    if (cancelUploadBtn) {
        cancelUploadBtn.addEventListener('click', function () {
            hideModal('upload-modal');
        });
    }

    // 功能区"开始检测/校对/加工"按钮
    var featureStartBtns = document.querySelectorAll('.feature-start');
    featureStartBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
            showModal('upload-modal');
        });
    });

    // ============================================================
    // 服务类型选择
    // ============================================================

    var selectedService = null;
    var serviceOptions = document.querySelectorAll('.service-option');

    serviceOptions.forEach(function (option) {
        option.addEventListener('click', function () {
            serviceOptions.forEach(function (opt) {
                opt.classList.remove('border-primary', 'bg-blue-50', 'selected');
                opt.classList.add('border-gray-300');
            });
            this.classList.remove('border-gray-300');
            this.classList.add('border-primary', 'bg-blue-50', 'selected');
            selectedService = this.getAttribute('data-service');
        });
    });

    // ============================================================
    // 文件上传
    // ============================================================

    var dropArea = document.getElementById('drop-area');
    var fileInput = document.getElementById('file-input');
    var fileNameDisplay = document.getElementById('file-name-display');
    var selectedFile = null;

    var MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
    var ALLOWED_TYPES = [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/pdf'
    ];
    var ALLOWED_EXTENSIONS = ['.docx', '.pdf'];

    if (dropArea) {
        dropArea.addEventListener('click', function () {
            if (fileInput) fileInput.click();
        });

        // 拖拽事件
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(function (eventName) {
            dropArea.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(function (eventName) {
            dropArea.addEventListener(eventName, function () {
                dropArea.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(function (eventName) {
            dropArea.addEventListener(eventName, function () {
                dropArea.classList.remove('dragover');
            }, false);
        });

        dropArea.addEventListener('drop', function (e) {
            var dt = e.dataTransfer;
            if (dt && dt.files && dt.files.length > 0) {
                handleFile(dt.files[0]);
            }
        }, false);
    }

    if (fileInput) {
        fileInput.addEventListener('change', function (e) {
            if (e.target.files && e.target.files.length > 0) {
                handleFile(e.target.files[0]);
            }
        });
    }

    function handleFile(file) {
        // 检查文件扩展名
        var fileName = file.name.toLowerCase();
        var isValidExt = ALLOWED_EXTENSIONS.some(function (ext) {
            return fileName.endsWith(ext);
        });

        if (!isValidExt) {
            showToast('不支持的文件格式，请上传 DOCX 或 PDF 文件');
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            showToast('文件过大，请上传小于 20MB 的文件');
            return;
        }

        selectedFile = file;
        if (fileNameDisplay) {
            var sizeMB = (file.size / 1024 / 1024).toFixed(2);
            fileNameDisplay.textContent = '已选择: ' + file.name + ' (' + sizeMB + ' MB)';
            fileNameDisplay.classList.remove('hidden');
        }
    }

    // ============================================================
    // 确认上传（模拟处理过程）
    // ============================================================

    if (confirmUploadBtn) {
        confirmUploadBtn.addEventListener('click', function () {
            // 简单校验
            if (!selectedService) {
                showToast('请选择一个服务类型');
                return;
            }
            if (!selectedFile) {
                showToast('请先上传文档文件');
                return;
            }

            // 关闭上传模态框，显示加载中
            hideModal('upload-modal');
            showModal('loading-modal');

            // 模拟处理进度
            var progressBar = document.getElementById('progress-bar');
            var progress = 0;
            var loadingText = document.getElementById('loading-text');
            var texts = [
                '正在解析文档结构...',
                '正在分析内容规范...',
                '正在生成修改建议...',
                '正在整理检测结果...'
            ];

            var progressInterval = setInterval(function () {
                progress += Math.random() * 20 + 10;
                if (progress >= 100) {
                    progress = 100;
                    clearInterval(progressInterval);

                    // 延迟显示结果
                    setTimeout(function () {
                        hideModal('loading-modal');
                        showModal('result-modal');
                        if (progressBar) progressBar.style.width = '0%';
                    }, 500);
                }
                if (progressBar) {
                    progressBar.style.width = progress + '%';
                }
                if (loadingText && progress < 100) {
                    var idx = Math.min(
                        Math.floor(progress / 25),
                        texts.length - 1
                    );
                    loadingText.textContent = texts[idx];
                }
            }, 600);

            // 重置状态
            setTimeout(function () {
                selectedFile = null;
                selectedService = null;
                if (fileNameDisplay) {
                    fileNameDisplay.classList.add('hidden');
                    fileNameDisplay.textContent = '';
                }
                if (fileInput) fileInput.value = '';
                serviceOptions.forEach(function (opt) {
                    opt.classList.remove('border-primary', 'bg-blue-50', 'selected');
                    opt.classList.add('border-gray-300');
                });
            }, 800);
        });
    }

    // ============================================================
    // 结果模态框
    // ============================================================

    var closeResultModal = document.getElementById('close-result-modal');
    var downloadResultBtn = document.getElementById('download-result');

    if (closeResultModal) {
        closeResultModal.addEventListener('click', function () {
            hideModal('result-modal');
        });
    }

    if (downloadResultBtn) {
        downloadResultBtn.addEventListener('click', function () {
            showToast('文档下载已开始，请稍候...');
            hideModal('result-modal');
        });
    }

    // ============================================================
    // 登录 / 注册
    // ============================================================

    var loginBtn = document.getElementById('login-btn');
    var loginBtnMobile = document.getElementById('login-btn-mobile');
    var registerBtn = document.getElementById('register-btn');
    var registerBtnMobile = document.getElementById('register-btn-mobile');
    var switchToRegister = document.getElementById('switch-to-register');
    var switchToLogin = document.getElementById('switch-to-login');
    var closeModalButtons = document.querySelectorAll('.close-modal');

    if (loginBtn) loginBtn.addEventListener('click', function () { showModal('login-modal'); });
    if (loginBtnMobile) loginBtnMobile.addEventListener('click', function () { showModal('login-modal'); });
    if (registerBtn) registerBtn.addEventListener('click', function () { showModal('register-modal'); });
    if (registerBtnMobile) registerBtnMobile.addEventListener('click', function () { showModal('register-modal'); });

    closeModalButtons.forEach(function (btn) {
        btn.addEventListener('click', function () {
            hideAllModals();
        });
    });

    if (switchToRegister) {
        switchToRegister.addEventListener('click', function (e) {
            e.preventDefault();
            hideModal('login-modal');
            showModal('register-modal');
        });
    }

    if (switchToLogin) {
        switchToLogin.addEventListener('click', function (e) {
            e.preventDefault();
            hideModal('register-modal');
            showModal('login-modal');
        });
    }

    // 登录表单
    var loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var email = document.getElementById('email').value.trim();
            var password = document.getElementById('password').value;

            if (!email || !password) {
                showToast('请填写完整的登录信息');
                return;
            }

            var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                showToast('请输入有效的邮箱地址');
                return;
            }

            showToast('登录成功！欢迎回来');
            hideModal('login-modal');
            loginForm.reset();
        });
    }

    // 注册表单
    var registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var email = document.getElementById('register-email').value.trim();
            var password = document.getElementById('register-password').value;
            var confirmPassword = document.getElementById('confirm-password').value;
            var agreeTerms = document.getElementById('agree-terms').checked;

            if (!email || !password || !confirmPassword) {
                showToast('请填写完整的注册信息');
                return;
            }

            var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                showToast('请输入有效的邮箱地址');
                return;
            }

            if (password.length < 6) {
                showToast('密码长度至少 6 位');
                return;
            }

            if (password !== confirmPassword) {
                showToast('两次输入的密码不一致');
                return;
            }

            if (!agreeTerms) {
                showToast('请阅读并同意服务条款和隐私政策');
                return;
            }

            showToast('注册成功！欢迎加入好论点智检');
            hideModal('register-modal');
            registerForm.reset();
        });
    }

    // ============================================================
    // 演示视频模态框
    // ============================================================

    var demoBtn = document.getElementById('demo-btn');
    var closeVideoModal = document.getElementById('close-video-modal');

    if (demoBtn) {
        demoBtn.addEventListener('click', function () {
            showModal('video-modal');
        });
    }

    if (closeVideoModal) {
        closeVideoModal.addEventListener('click', function () {
            hideModal('video-modal');
        });
    }

    // ============================================================
    // ESC 键关闭模态框
    // ============================================================

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' || e.keyCode === 27) {
            hideAllModals();
        }
    });

    // ============================================================
    // 点击模态框遮罩关闭
    // ============================================================

    document.querySelectorAll('.fixed.inset-0').forEach(function (modal) {
        modal.addEventListener('click', function (e) {
            // 只当点击到模态框本身（而不是内容）时关闭
            if (e.target === modal) {
                hideAllModals();
            }
        });
    });

    // ============================================================
    // 平滑滚动（内部锚点链接）
    // ============================================================

    var anchorLinks = document.querySelectorAll('a[href^="#"]');
    anchorLinks.forEach(function (anchor) {
        anchor.addEventListener('click', function (e) {
            var targetId = this.getAttribute('href');
            if (!targetId || targetId === '#') return;

            var targetElement = document.querySelector(targetId);
            if (!targetElement) return;

            e.preventDefault();

            var offset = 80; // 顶部导航高度
            var targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - offset;

            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        });
    });

    // ============================================================
    // 滚动显示动画（IntersectionObserver）
    // ============================================================

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
            // 给每个元素初始状态（若已在视口内则不添加）
            if (el.getBoundingClientRect().top > window.innerHeight) {
                el.style.opacity = '0';
                el.style.transform = 'translateY(30px)';
                el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
                observer.observe(el);
            }
        });
    }

    // ============================================================
    // 页面加载完成后显示一次欢迎提示（可选）
    // ============================================================

    window.addEventListener('load', function () {
        // 页面加载完成后的任何初始化工作
        console.log('好论点智检平台已加载');
    });

})();
