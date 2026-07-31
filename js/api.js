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

        // --- 任务书生成（新路径） ---\r\n        if (path.indexOf('/taskbook/generate') !== -1) {\r\n            return delay(2000).then(function () {\r\n                var demoTaskbooks = demoData.taskbooks || [];\r\n                var tbId = Date.now();\r\n                var tb = {\r\n                    id: tbId,\r\n                    thesis_title: '【演示】基于深度学习的图像识别系统设计与实现',\r\n                    ai_provider: 'deepseek',\r\n                    ai_model: 'deepseek-chat',\r\n                    status: 'completed',\r\n                    created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),\r\n                };\r\n                demoTaskbooks.unshift(tb);\r\n                demoData.taskbooks = demoTaskbooks;\r\n                saveDemoData();\r\n                return {\r\n                    success: true,\r\n                    taskbook_id: tbId,\r\n                    data: {\r\n                        thesis_title: '【演示】基于深度学习的图像识别系统设计与实现',\r\n                        topic_source: '自选课题',\r\n                        requirements: '1. 查阅国内外关于深度学习与图像识别的相关文献，了解当前研究现状与发展趋势。\\n2. 学习并掌握深度学习相关理论，包括卷积神经网络（CNN）、迁移学习等核心技术。\\n3. 设计并实现一个基于深度学习的图像识别系统，要求能够对特定类别图像进行准确分类。\\n4. 对系统进行功能测试与性能评估，分析实验结果。\\n5. 撰写毕业设计论文，论文格式符合学校要求，字数不少于12000字。\\n6. 准备毕业设计答辩材料，完成答辩。',\r\n                        research_content: '本课题主要研究基于深度学习的图像识别技术，具体包括以下几个方面：\\n\\n1. 研究背景与意义\\n分析图像识别技术在工业检测、医疗诊断、自动驾驶等领域的应用需求，阐述本研究的理论价值和实际意义。\\n\\n2. 相关技术综述\\n对卷积神经网络（CNN）、ResNet、VGG等经典深度学习模型进行对比分析，研究迁移学习、数据增强等关键技术的应用。\\n\\n3. 系统设计与实现\\n设计基于B/S架构的图像识别系统，包括前端用户界面、后端服务接口和深度学习推理模块。\\n\\n4. 实验与评估\\n使用标准数据集对模型进行训练和测试，通过准确率、召回率、F1值等指标评估系统性能。',\r\n                        requirements_analysis: '随着人工智能技术的飞速发展，深度学习在图像识别领域取得了突破性进展。图像识别作为计算机视觉的核心任务之一，广泛应用于人脸识别、自动驾驶、医疗影像分析等众多领域。\\n\\n当前，传统图像识别方法在处理复杂场景时存在准确率不高、泛化能力不足等问题。而基于深度学习的图像识别方法通过多层神经网络自动提取图像特征，能够显著提升识别性能。\\n\\n本课题旨在设计并实现一个基于深度学习的图像识别系统，通过实际项目开发，深入理解深度学习原理，掌握模型训练与部署的完整流程，为将来从事人工智能相关工作奠定坚实基础。',\r\n                        outline_design: '系统采用前后端分离的B/S架构设计：\\n\\n1. 前端模块：使用Vue.js/React构建用户交互界面，实现图片上传、结果展示、历史记录查询等功能。\\n\\n2. 后端模块：基于Flask/Django框架提供RESTful API服务，负责用户管理、任务调度、模型推理等。\\n\\n3. 深度学习模块：基于PyTorch/TensorFlow框架构建卷积神经网络模型，支持模型训练、评估和推理。\\n\\n4. 数据库模块：使用MySQL存储用户信息、识别记录和模型配置。\\n\\n开发环境：Python 3.9+、PyTorch 2.0+、Flask 2.0+、Vue.js 3.0+、MySQL 8.0',\r\n                        schedule: [\r\n                            { phase: '第1-2周', task: '查阅文献资料，了解研究现状，完成开题报告' },\r\n                            { phase: '第3-4周', task: '学习深度学习理论与技术，搭建开发环境' },\r\n                            { phase: '第5-8周', task: '设计系统架构，编写核心代码，实现图像识别功能' },\r\n                            { phase: '第9-12周', task: '系统测试与优化，分析实验数据' },\r\n                            { phase: '第13-14周', task: '撰写毕业论文，准备答辩材料' },\r\n                            { phase: '第15-16周', task: '论文修改完善，毕业设计答辩' }\r\n                        ],\r\n                        references: [\r\n                            'LeCun Y, Bengio Y, Hinton G. Deep learning[J]. Nature, 2015, 521(7553): 436-444.',\r\n                            'He K, Zhang X, Ren S, et al. Deep residual learning for image recognition[C]//CVPR. 2016: 770-778.',\r\n                            'Krizhevsky A, Sutskever I, Hinton G E. ImageNet classification with deep convolutional neural networks[C]//NeurIPS. 2012: 1097-1105.',\r\n                            '周志华. 机器学习[M]. 北京: 清华大学出版社, 2016.',\r\n                            'Goodfellow I, Bengio Y, Courville A. Deep learning[M]. MIT Press, 2016.',\r\n                            'Simonyan K, Zisserman A. Very deep convolutional networks for large-scale image recognition[C]//ICLR. 2015.',\r\n                            '张三, 李四. 基于卷积神经网络的图像分类研究[J]. 计算机工程与应用, 2023, 59(5): 120-128.',\r\n                            'Deng J, Dong W, Socher R, et al. ImageNet: A large-scale hierarchical image database[C]//CVPR. 2009: 248-255.',\r\n                            'Vaswani A, et al. Attention is all you need[C]//NeurIPS. 2017.',\r\n                            '何恺明, 等. 面向计算机视觉的深度学习: 综述[J]. 中国科学: 信息科学, 2022.'\r\n                        ]\r\n                    },\r\n                    message: '【演示模式】任务书生成成功，部署后端并配置 AI 密钥后可生成真实内容。'\r\n                };\r\n            });\r\n        }\r\n\r\n        // --- 生成任务书 ---
        if (path.indexOf('/task/generate') !== -1) {
            return delay(2500).then(function () {
                return {
                    success: true,
                    result: {
                        title: '演示论文题目：基于深度学习的图像识别系统设计与实现',
                        school: '演示大学',
                        major: '计算机科学与技术',
                        degree: '本科',
                        advisor: '张教授',
                        basic_tasks: '1. 查阅国内外关于深度学习与图像识别的相关文献，了解当前研究现状与发展趋势。\n2. 学习并掌握深度学习相关理论，包括卷积神经网络（CNN）、迁移学习等核心技术。\n3. 设计并实现一个基于深度学习的图像识别系统，要求能够对特定类别图像进行准确分类。\n4. 对系统进行功能测试与性能评估，分析实验结果。\n5. 撰写毕业设计论文，论文格式符合学校要求，字数不少于12000字。\n6. 准备毕业设计答辩材料，完成答辩。',
                        schedule: [
                            { phase: '第一阶段', time: '第1-2周', content: '查阅文献资料，了解研究现状，完成开题报告' },
                            { phase: '第二阶段', time: '第3-5周', content: '学习深度学习相关理论与技术，搭建开发环境' },
                            { phase: '第三阶段', time: '第6-10周', content: '设计系统架构，编写核心代码，实现图像识别功能' },
                            { phase: '第四阶段', time: '第11-13周', content: '系统测试与优化，分析实验数据，撰写论文初稿' },
                            { phase: '第五阶段', time: '第14-15周', content: '论文修改完善，准备答辩材料' },
                            { phase: '第六阶段', time: '第16周', content: '毕业设计答辩' }
                        ],
                        research_content: '本课题主要研究基于深度学习的图像识别技术，具体包括以下几个方面：\n\n1. 研究背景与意义\n分析图像识别技术在工业检测、医疗诊断、自动驾驶等领域的应用需求，阐述本研究的理论价值和实际意义。\n\n2. 相关技术综述\n对卷积神经网络（CNN）、ResNet、VGG等经典深度学习模型进行对比分析，研究迁移学习、数据增强等关键技术的应用。\n\n3. 系统设计与实现\n设计基于B/S架构的图像识别系统，包括前端用户界面、后端服务接口和深度学习推理模块。采用PyTorch/TensorFlow框架构建识别模型。\n\n4. 实验与评估\n使用标准数据集对模型进行训练和测试，通过准确率、召回率、F1值等指标评估系统性能，与传统方法进行对比分析。',
                        references: [
                            '[1] LeCun Y, Bengio Y, Hinton G. Deep learning[J]. Nature, 2015, 521(7553): 436-444.',
                            '[2] He K, Zhang X, Ren S, et al. Deep residual learning for image recognition[C]//CVPR. 2016: 770-778.',
                            '[3] Krizhevsky A, Sutskever I, Hinton G E. ImageNet classification with deep convolutional neural networks[C]//NeurIPS. 2012: 1097-1105.',
                            '[4] 周志华. 机器学习[M]. 北京: 清华大学出版社, 2016.',
                            '[5] Goodfellow I, Bengio Y, Courville A. Deep learning[M]. MIT Press, 2016.',
                            '[6] Simonyan K, Zisserman A. Very deep convolutional networks for large-scale image recognition[C]//ICLR. 2015.',
                            '[7] 张三, 李四. 基于卷积神经网络的图像分类研究[J]. 计算机工程与应用, 2023, 59(5): 120-128.',
                            '[8] Deng J, Dong W, Socher R, et al. ImageNet: A large-scale hierarchical image database[C]//CVPR. 2009: 248-255.'
                        ],
                        expected_outcome: '1. 完成基于深度学习的图像识别系统设计与实现，系统能够对至少5类图像进行准确分类，分类准确率达到90%以上。\n2. 撰写完整的毕业设计论文一篇（不少于12000字），格式符合学校毕业论文撰写规范。\n3. 提交系统的源代码、测试数据和可运行程序。\n4. 完成毕业设计答辩并取得良好以上成绩。'
                    },
                    message: '【演示模式】任务书生成成功，部署后端并配置 AI 密钥后可生成真实内容。'
                };
            });
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

        // --- 任务书列表 ---\r\n        if (path.indexOf('/taskbook/list') !== -1) {\r\n            return { success: true, taskbooks: demoData.taskbooks || [] };\r\n        }\r\n\r\n        // --- 任务书详情 ---\r\n        if (path.indexOf('/taskbook/detail') !== -1) {\r\n            var tbId = parseInt((path.match(/id=(\\d+)/) || [])[1], 10);\r\n            var tbs = demoData.taskbooks || [];\r\n            var tb = null;\r\n            for (var j = 0; j < tbs.length; j++) { if (tbs[j].id === tbId) { tb = tbs[j]; break; } }\r\n            if (!tb) return { success: false, message: '任务书不存在' };\r\n            return {\r\n                success: true,\r\n                taskbook: {\r\n                    id: tb.id,\r\n                    thesis_title: tb.thesis_title,\r\n                    topic_source: '自选课题',\r\n                    requirements: '【演示数据】基本任务与要求内容...',\r\n                    research_content: '【演示数据】研究内容...',\r\n                    requirements_analysis: '【演示数据】需求分析...',\r\n                    outline_design: '【演示数据】概要设计...',\r\n                    schedule: [{phase:'第1-2周',task:'查阅文献'},{phase:'第3-4周',task:'学习技术'}],\r\n                    references: ['文献1','文献2'],\r\n                    ai_provider: tb.ai_provider,\r\n                    ai_model: tb.ai_model,\r\n                    created_at: tb.created_at\r\n                }\r\n            };\r\n        }\r\n\r\n        return { success: false, message: '未知接口' };
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

    // ============ Task API ============
    var Task = {
        generate: function (data) { return post('/task/generate.php', data); },
    };

    // 导出
    global.API = {
        base: API_BASE,
        DEMO_MODE: DEMO_MODE,
        request: request, get: get, post: post, postForm: postForm,
        Auth: Auth, Document: Document, Task: Task,
        redirectToLogin: redirectToLogin,
        redirectToDashboard: redirectToDashboard,
        showToast: showToast,
        formatDateTime: formatDateTime,
        formatFileSize: formatFileSize,
    };
})(window);