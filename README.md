# 轻卡记录 - 热量记录小程序

一款极简的每日饮食热量记录小程序，帮助你养成记录习惯，轻松管理每日热量摄入。

## 项目结构

```
calorie-app/
├── client/                  # 微信小程序前端
│   ├── pages/
│   │   ├── index/          # 首页 - 今日热量仪表盘 + 记录
│   │   ├── search/         # 搜索页 - 食物搜索 / kJ换算
│   │   └── profile/        # 我的 - 身体数据 & 目标设定
│   ├── components/
│   │   ├── food-card/      # 食物卡片组件
│   │   ├── record-modal/   # 记录弹窗组件
│   │   └── progress-ring/  # 进度环组件
│   ├── utils/
│   │   ├── request.js      # 网络请求封装
│   │   └── util.js         # 工具函数（热量换算/TDEE计算）
│   ├── app.js
│   ├── app.json
│   └── app.wxss
│
└── server/                  # NestJS 后端
    ├── src/
    │   ├── modules/
    │   │   ├── auth/       # 认证模块（微信登录）
    │   │   ├── user/       # 用户模块（个人数据/目标）
    │   │   ├── food/       # 食物模块（食物库/搜索）
    │   │   └── record/     # 记录模块（饮食记录CRUD）
    │   ├── common/
    │   │   ├── guards/     # 认证守卫
    │   │   └── decorators/ # 自定义装饰器
    │   ├── app.module.ts
    │   └── main.ts
    ├── package.json
    └── tsconfig.json
```

## 技术栈

- **前端**: 微信小程序原生（WXML + WXSS + JS）
- **后端**: NestJS + TypeORM
- **数据库**: SQLite（better-sqlite3）
- **部署**: 腾讯轻量云服务器

## 核心功能

1. ✅ 搜索食物 + 快捷份量选择 → 一键记录
2. ✅ 最近吃过的食物一键再记
3. ✅ 手动输入 kJ 自动换算为大卡
4. ✅ 今日热量进度环展示
5. ✅ 智能默认餐次（根据当前时间自动判断）
6. ✅ 内置 60+ 常见食物热量数据库（支持拼音搜索）
7. ✅ 个人数据设定 + TDEE 自动计算每日目标

## 快速开始

### 后端

```bash
cd server
npm install
npm run start:dev
```

服务运行在 http://localhost:3000

### 前端

1. 打开微信开发者工具
2. 导入 `client/` 目录
3. 填入你的 AppID（或使用测试号）
4. 修改 `client/app.js` 中的 `baseUrl` 为你的服务器地址

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/login | 微信登录 |
| GET | /api/user/profile | 获取用户信息 |
| PUT | /api/user/profile | 更新用户信息 |
| GET | /api/user/stats | 获取统计数据 |
| GET | /api/foods/search?keyword=xx | 搜索食物 |
| GET | /api/foods/category?category=xx | 按分类获取食物 |
| POST | /api/records | 创建饮食记录 |
| GET | /api/records?date=YYYY-MM-DD | 获取某天记录 |
| DELETE | /api/records/:id | 删除记录 |
| GET | /api/records/recent-foods | 获取最近吃过的食物 |

## 后续迭代

- [ ] OCR 拍照识别营养标签
- [ ] AI 食物识别（辅助 + 用户确认）
- [ ] 周/月热量趋势图表
- [ ] 食物收藏功能
- [ ] 快捷组合（"我的早餐"一键记录多个食物）
- [ ] 饮食建议提醒
