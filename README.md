# 好论点智检 - 部署与配置指南

基于您现有的静态网站，新增了**手机验证码登录**、**用户中心**、**格式要求输入**、**AI 文档处理**四大功能。

本指南面向 **宝塔 Linux 面板（轻量服务器/CUEA）**，按步骤操作即可上线。

---

## 一、项目结构

```
hld/
├── index.html              # 首页（已改造为多步骤上传向导）
├── pages/
│   ├── login.html          # 手机验证码登录页
│   └── dashboard.html      # 用户中心（文档结果查询与下载）
├── css/style.css           # 样式（已扩充步骤向导/标签页等）
├── js/
│   ├── api.js              # 前端 API 辅助模块（新增）
│   └── main.js             # 首页交互（已重写）
├── images/
├── api/                    # PHP 后端（新增）
│   ├── config/             # 配置文件（数据库/AI/短信）
│   ├── lib/                # 基础库（数据库/会话/响应/短信/文档提取/处理器）
│   ├── ai/                 # AI 客户端（Deepseek/豆包/工厂/提示词）
│   ├── auth/               # 鉴权接口（发送验证码/登录/登出/检查）
│   ├── document/           # 文档接口（上传/列表/详情/下载/处理）
│   ├── db/schema.sql      # 数据库结构
│   └── storage/            # 文件存储目录（运行时自动创建）
└── README.md               # 本文件
```

---

## 二、宝塔面板部署步骤

### 1. 上传代码

1. 登录宝塔面板 → **文件** → 进入您的站点目录（例如 `/www/wwwroot/您的域名/`）
2. 将本目录所有文件上传覆盖（保留原有 `index.html`、`css/`、`js/`、`images/`，新增 `pages/` 与 `api/` 目录）

### 2. 创建数据库

1. 宝塔面板 → **数据库** → **添加数据库**
2. 数据库名：`docheck`（可自定义），用户名：`docheck`，设置一个强密码
3. 记下数据库名、用户名、密码（稍后配置要用）
4. 点击 **管理**（phpMyAdmin）→ 选择 `docheck` 库 → **导入** → 上传 `api/db/schema.sql` → 执行

### 3. 修改数据库配置

编辑 `api/config/database.php`，填入上一步的信息：

```php
return [
    'host'     => '127.0.0.1',
    'port'     => 3306,
    'dbname'   => 'docheck',           // 你的数据库名
    'username' => 'docheck',           // 你的数据库用户名
    'password' => '你的数据库密码',
    'charset'  => 'utf8mb4',
    'storage_path' => dirname(__DIR__) . '/storage',
];
```

### 4. 检查 PHP 扩展

宝塔面板 → **软件商店** → **PHP**（建议 7.4 或 8.0+）→ **设置** → **安装扩展**，确保以下扩展已安装：

- `pdo_mysql`（必装，数据库连接）
- `zip`（必装，解析 DOCX 文件）
- `curl`（必装，调用 AI API）
- `openssl`、`mbstring`、`fileinfo`（一般默认已装）

### 5. 设置目录权限

宝塔面板 → **文件** → 进入站点目录，将 `api/storage` 目录权限设置为 `755`，所有者设为 `www`：

```bash
# 在宝塔终端执行
chmod -R 755 /www/wwwroot/你的域名/api/storage
chown -R www:www /www/wwwroot/你的域名/api/storage
```

### 6. 配置站点（关键！）

宝塔面板 → **网站** → 你的站点 → **设置**：

1. **运行目录**：保持站点根目录（不要改成 `/api`）
2. **伪静态**（若使用 Nginx，添加以下规则，确保 API 请求能正常到达 PHP）：
   ```nginx
   location /api/ {
       try_files $uri $uri/ /api/$uri.php?$query_string;
   }
   ```
   > 实际上 PHP 文件直接以 `/api/auth/send_code.php` 形式访问即可，无需伪静态。若遇到 404，再添加上述规则。

### 7. 验证部署

1. 打开浏览器访问 `https://你的域名/api/auth/check.php`
2. 应返回 JSON：`{"logged_in":false}` —— 说明后端运行正常
3. 若返回 500 或报错，按报错信息检查 `database.php` 配置与 PHP 扩展

---

## 三、AI 平台 API 密钥申请与配置

当前框架**未配置密钥时自动进入演示模式**（返回示例结果），填入密钥后自动切换真实调用，无需改代码。

### Deepseek（深度求索）

1. 访问 https://platform.deepseek.com/
2. 注册账号 → **API Keys** → **创建 API Key**，复制 `sk-` 开头的密钥
3. 新用户通常有 500 万 tokens 免费额度，足够测试
4. 编辑 `api/config/ai_config.php`，填入：
   ```php
   'deepseek' => [
       'api_key' => 'sk-你的密钥',
       // 其余保持默认
   ],
   ```

### 豆包（火山引擎方舟）

1. 访问 https://www.volcengine.com/product/doubao
2. 注册火山引擎账号 → 开通**方舟大模型**服务
3. 进入 **在线推理** → 创建推理接入点 → 获取 API Key 与模型 ID（如 `doubao-pro-32k`）
4. 编辑 `api/config/ai_config.php`，填入：
   ```php
   'doubao' => [
       'api_key' => '你的火山引擎API Key',
       'model'   => 'doubao-pro-32k',  // 或控制台给出的接入点ID
   ],
   ```

### 切换默认 AI 引擎

修改 `api/config/ai_config.php` 顶部：

```php
'default_provider' => 'deepseek',  // 或 'doubao'
```

用户在前端上传时也可在**步骤3**手动选择引擎。

---

## 四、短信验证码：从模拟到真实

当前 `api/config/sms_config.php` 中 `'mock' => true`，验证码不真正发送短信，而是：

- 写入日志 `api/storage/sms_mock.log`
- 在接口响应中返回 `dev_code` 字段，前端登录页会直接显示验证码供测试

### 接入阿里云短信

1. 登录 https://dysms.console.aliyun.com/
2. **国内消息** → 申请签名（如"好论点智检"，需企业资质或个人测试签名）
3. **模板管理** → 创建模板，模板内容如：`您的验证码是${code}，5分钟内有效，请勿泄露。`
4. 获取 **AccessKey**：https://ram.console.aliyun.com/manage/ak
5. 编辑 `api/config/sms_config.php`：

   ```php
   'mock' => false,  // 关键！改为 false

   'aliyun' => [
       'access_key_id' => '你的AccessKeyId',
       'access_secret' => '你的AccessKeySecret',
       'sign_name'      => '好论点智检',
       'template_code' => 'SMS_xxxxxxxx',
   ],
   ```

6. 在 `api/lib/SmsSender.php` 的 `sendAliyun()` 方法中，按阿里云文档补全签名与 HTTP 请求（已有占位注释）。也可使用 `composer require alibabacloud/dysmsapi-20170525` 简化。

### 接入腾讯云短信

类似流程，配置 `tencent` 字段并把 `provider` 改为 `tencent`，再在 `sendTencent()` 中补全调用。

---

## 五、PDF 解析（可选但推荐）

DOCX 由 PHP 原生解析（基于 ZipArchive，无需第三方库）。

PDF 解析需要安装 `smalot/pdfparser`：

```bash
# 在站点根目录执行（需已安装 composer，宝塔终端可用）
cd /www/wwwroot/你的域名
composer require smalot/pdfparser
```

或安装系统工具 `pdftotext`（Debian/Ubuntu）：

```bash
apt-get install poppler-utils
```

若两者都未安装，上传 PDF 会提示"PDF 解析需要安装依赖"。**DOCX 不受影响，可正常使用**。

---

## 六、功能使用说明

### 用户流程

1. **访问首页** → 浏览功能介绍（无需登录）
2. **点击"开始检测/上传文档"** → 系统检测未登录，跳转到 `/pages/login.html`
3. **登录页** → 输入手机号 → 获取验证码（模拟模式下页面会直接显示验证码）→ 输入验证码 → 登录成功
   - 未注册手机号会**自动创建账号**
4. **回到首页** → 再次点击上传 → 弹出 3 步向导：
   - **步骤1**：选择服务类型（格式检测/文字校对/文字加工）
   - **步骤2**：输入格式要求（粘贴文本 或 上传格式模板文件，二选一）
   - **步骤3**：上传待处理文档 + 选择 AI 引擎
5. **处理中** → 显示进度条
6. **结果展示** → 查看问题统计、详细列表、总体结论
7. **下载结果** → 下载 HTML 格式检测报告
8. **用户中心** → `/pages/dashboard.html` → 查看全部历史记录、详情、重新下载

### 用户中心功能

- 顶部 4 张统计卡片：总文档数 / 已完成 / 处理中 / 剩余免费次数
- 文档列表：支持按状态筛选（全部/等待处理/处理中/已完成/失败）
- 每条记录：查看详情、下载报告
- 详情弹窗：显示问题统计、AI 模型信息、总体结论、问题明细表

### 每位用户默认 3 次免费额度

修改 `api/db/schema.sql` 中 `free_quota` 默认值，或直接在 phpMyAdmin 中调整。

---

## 七、接口一览

### 鉴权

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/send_code.php` | 发送验证码，body: `{"phone":"13800138000"}` |
| POST | `/api/auth/verify_login.php` | 验证登录，body: `{"phone":"...","code":"..."}` |
| POST | `/api/auth/logout.php` | 退出登录 |
| GET  | `/api/auth/check.php` | 检查登录状态 |

### 文档

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/document/upload.php` | 上传文档（multipart：file, service_type, format_file?, format_text?, ai_provider?） |
| POST | `/api/document/process.php` | 触发 AI 处理，body: `{"document_id":1}` |
| GET  | `/api/document/list.php?status=` | 文档列表 |
| GET  | `/api/document/detail.php?id=1` | 文档详情 |
| GET  | `/api/document/download.php?id=1` | 下载结果报告 |

---

## 八、安全注意事项

1. **生产环境务必修改** `api/lib/CORS.php` 中的 `$allowed_origins`，仅保留你的域名
2. `api/config/` 与 `api/db/` 已通过 `.htaccess` 禁止直接访问（Apache 生效；Nginx 需在站点配置中手动禁用）
3. **AI API Key 是敏感信息**，不要提交到公开仓库；`.gitignore` 建议忽略 `api/config/*.php` 的真实改动
4. 建议给站点配置 HTTPS（宝塔 → SSL → Let's Encrypt 免费证书），登录态依赖 Cookie
5. `api/storage/` 目录存放用户上传文件，确保不被搜索引擎索引（可加 `robots.txt`）

---

## 九、常见问题排查

**Q: 登录后刷新又变成未登录？**
A: 检查站点是否启用了 HTTPS，且 `api/lib/CORS.php` 的 `session.cookie_samesite` 配置。跨子域需调整 cookie 域名。

**Q: 上传 DOCX 提示"无法解析"？**
A: 确认 PHP 已启用 `zip` 扩展（宝塔 → PHP 设置 → 安装扩展）。

**Q: AI 处理返回"API Key 未配置"？**
A: 编辑 `api/config/ai_config.php` 填入密钥。未填时会返回演示数据而非报错，若报此错说明走到了真实客户端分支但密钥为空。

**Q: 免费次数用完了怎么重置？**
A: phpMyAdmin 执行：`UPDATE users SET free_quota = 3 WHERE phone = '手机号';`

**Q: 如何查看模拟验证码？**
A: 查看 `api/storage/sms_mock.log`，或登录页会直接显示。接入真实短信后此提示自动消失。

**Q: 如何切换 AI 引擎为默认豆包？**
A: 修改 `api/config/ai_config.php` 中 `'default_provider' => 'doubao'`。

---

## 十、后续可扩展方向

- 接入微信扫码登录
- 增加付费/充值模块（对接支付宝/微信支付）
- 文档处理改为异步队列（大文件耗时较长时避免请求超时）
- 增加更多 AI 模型（通义千问、文心一言、Kimi 等，按 `DeepseekClient.php` 模式新增类即可）
- 结果报告支持 PDF/Word 格式导出
- 增加管理员后台（用户管理、文档审核、统计看板）

---

部署遇到问题，可对照"验证部署"一节逐步排查。祝上线顺利！
