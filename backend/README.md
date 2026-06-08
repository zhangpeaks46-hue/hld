# 好论点智检平台 - 后端服务

## 项目结构

```
backend/
├── app/
│   ├── api/
│   │   ├── auth.py          # 用户认证API
│   │   ├── documents.py     # 文档管理API
│   │   └── services.py      # 核心服务API
│   ├── auth/
│   │   └── security.py      # 安全认证相关
│   ├── config/
│   │   └── settings.py      # 配置文件
│   ├── models/
│   │   ├── database.py      # 数据库连接
│   │   └── models.py        # 数据库模型
│   ├── schemas/
│   │   └── schemas.py       # Pydantic模型
│   ├── utils/
│   │   └── document_processor.py  # 文档处理工具
│   ├── v1/
│   │   └── __init__.py      # API路由注册
│   └── main.py              # 应用入口
├── tests/                   # 测试目录
├── requirements.txt         # 依赖列表
└── run.py                   # 启动脚本
```

## 技术栈

- Python 3.10+
- FastAPI 0.104+
- SQLAlchemy 2.0+
- SQLite（开发环境）
- JWT 认证

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 运行服务

```bash
python run.py
```

### 3. 访问API文档

启动服务后，访问以下地址查看API文档：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API端点

### 认证模块

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | /api/v1/auth/register | 用户注册 |
| POST | /api/v1/auth/login | 用户登录 |
| GET | /api/v1/auth/me | 获取当前用户信息 |

### 文档模块

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | /api/v1/documents/upload | 上传文档 |
| GET | /api/v1/documents/ | 获取用户文档列表 |
| GET | /api/v1/documents/{id} | 获取单个文档 |
| DELETE | /api/v1/documents/{id} | 删除文档 |

### 服务模块

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | /api/v1/services/format-check/{id} | 格式检测 |
| POST | /api/v1/services/proofreading/{id} | 文字校对 |
| POST | /api/v1/services/text-processing/{id} | 文字加工 |
| GET | /api/v1/services/results | 获取处理结果 |

## 配置说明

配置文件位于 `app/config/settings.py`：

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| API_V1_STR | API版本前缀 | /api/v1 |
| SECRET_KEY | JWT密钥 | 需修改 |
| ALGORITHM | JWT算法 | HS256 |
| ACCESS_TOKEN_EXPIRE_MINUTES | token过期时间 | 30分钟 |
| DATABASE_URL | 数据库连接 | sqlite:///./app.db |
| UPLOAD_DIR | 上传文件目录 | ./uploads |
| MAX_FILE_SIZE | 最大文件大小 | 20MB |

## 数据库迁移

首次运行会自动创建数据库表。

## 测试

```bash
cd backend
python -m pytest tests/
```