# SmartSeat - 智能座位安排系统

<div align="center">
  <img src="public/next.svg" alt="SmartSeat Logo" width="120" height="120">
  <p><em>让座位安排变得简单而智能</em></p>
</div>

## 📋 项目简介

SmartSeat是一个现代化的智能座位安排系统，专为婚礼、聚会、会议等活动的座位规划而设计。通过直观的拖拽界面和AI智能推荐，让复杂的座位安排变得简单高效。

### ✨ 核心特性

- 🎯 **直观的拖拽界面** - 支持宾客在不同桌子间自由拖拽
- 🤖 **AI智能排座** - 基于DeepSeek API的智能座位推荐
- 📁 **多项目管理** - 创建和管理多个活动项目
- 💾 **实时保存** - 自动保存功能，防止数据丢失
- 📊 **批量导入** - 支持Excel、CSV、TXT格式的宾客名单导入
- 📄 **PDF导出** - 一键生成座位表PDF文件
- 🔐 **安全认证** - 基于Supabase的用户认证系统
- 📱 **响应式设计** - 适配桌面端和移动端

## 🛠️ 技术栈

### 前端框架
- **Next.js 15.5.4** - React全栈框架
- **React 19.1.0** - 用户界面库
- **TypeScript 5** - 类型安全的JavaScript

### 样式和UI
- **TailwindCSS 4** - 原子化CSS框架
- **@dnd-kit** - 现代化拖拽库
- **响应式设计** - 支持多设备访问

### 后端服务
- **Supabase** - 数据库和认证服务
- **DeepSeek API** - AI智能排座服务

### 文件处理
- **html2canvas** - 页面截图生成
- **jsPDF** - PDF文件生成
- **xlsx & papaparse** - Excel/CSV文件解析

## 🚀 快速开始

### 环境要求

- Node.js 18.0+
- npm 或 yarn
- 现代浏览器

### 安装步骤

1. **克隆项目**
   ```bash
   git clone https://github.com/jackyboys/SmartSeat.git
   cd SmartSeat
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **环境配置**
   
   创建 `.env.local` 文件并配置以下变量：
   ```bash
   # Supabase 配置
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

   # DeepSeek API 配置
   DEEPSEEK_API_KEY=your_deepseek_api_key
   ```

4. **启动开发服务器**
   ```bash
   npm run dev
   ```

5. **打开浏览器访问**
   
   访问 [http://localhost:3000](http://localhost:3000)

## 📖 使用指南

### 用户认证
1. 使用邮箱注册/登录
2. 通过邮件验证码完成认证

### 项目管理
1. **创建项目** - 点击"新建项目"按钮
2. **项目切换** - 在侧边栏选择不同项目
3. **项目删除** - 悬停项目名称显示删除按钮

### 宾客管理
1. **添加宾客** - 支持手动输入或文件批量导入
2. **宾客拖拽** - 在未分配区和桌子间自由拖拽
3. **宾客删除** - 支持移动到未分配区或彻底删除

### 桌子管理
1. **添加桌子** - 手动输入桌子名称或批量导入
2. **桌子删除** - 删除桌子时宾客自动移至未分配区

### AI智能排座
1. 点击"AI智能排座"按钮
2. 输入或粘贴完整宾客名单
3. 系统自动分析并生成座位安排建议

### 导出功能
1. **PDF导出** - 点击"导出PDF"生成座位表
2. **自动保存** - 开启后实时保存项目更改

## 🏗️ 项目结构

```
SmartSeat/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API路由
│   │   │   ├── generate-seating/ # AI排座API
│   │   │   └── whoami/        # 用户验证API
│   │   ├── auth/              # 认证相关
│   │   │   └── callback/      # 认证回调
│   │   ├── dashboard/         # 主要应用界面
│   │   ├── globals.css        # 全局样式
│   │   ├── layout.tsx         # 根布局
│   │   └── page.tsx           # 首页
│   ├── components/            # React组件
│   │   ├── AuthForm.tsx       # 认证表单
│   │   └── LogoutButton.tsx   # 登出按钮
│   └── utils/                 # 工具函数
│       └── supabase/          # Supabase配置
├── public/                    # 静态资源
├── tests/                     # E2E测试(可选)
├── package.json              # 项目依赖
├── tailwind.config.js        # TailwindCSS配置
├── next.config.ts            # Next.js配置
└── README.md                 # 项目文档
```

## 🧪 测试

项目包含端到端测试支持：

```bash
# 安装测试依赖
npm run test:e2e:install

# 运行E2E测试
npm run test:e2e

# 运行测试UI界面
npm run test:e2e:ui
```

## 🚀 部署

### Vercel部署（推荐）

1. **连接GitHub仓库**
   - 在Vercel控制台导入GitHub仓库

2. **配置环境变量**
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   DEEPSEEK_API_KEY=your_deepseek_api_key
   ```

3. **部署设置**
   - 构建命令：`npm run build`
   - 输出目录：`.next`

4. **自动部署**
   - 每次提交到main分支自动部署

### 其他部署方式

```bash
# 构建生产版本
npm run build

# 启动生产服务器
npm run start
```

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开Pull Request

## 📝 版本历史

### v0.1.0 (当前版本)
- ✅ 基础拖拽功能
- ✅ 用户认证系统
- ✅ AI智能排座
- ✅ PDF导出功能
- ✅ 文件批量导入
- ✅ 响应式设计

## 🐛 问题反馈

如果您遇到任何问题或有功能建议，请：

1. 查看 [Issues](https://github.com/jackyboys/SmartSeat/issues) 页面
2. 创建新的Issue描述问题
3. 提供详细的重现步骤

## 📄 许可证

本项目采用MIT许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 👨‍💻 作者

- **jackyboys** - *项目创建者* - [GitHub](https://github.com/jackyboys)

## 🙏 致谢

- [Next.js](https://nextjs.org/) - 优秀的React框架
- [Supabase](https://supabase.com/) - 强大的后端服务
- [Tailwind CSS](https://tailwindcss.com/) - 现代化CSS框架
- [DnD Kit](https://dndkit.com/) - 拖拽功能支持
- [DeepSeek](https://www.deepseek.com/) - AI智能服务

---

<div align="center">
  <p>如果这个项目对您有帮助，请给它一个⭐️</p>
  <p>Made with ❤️ by <a href="https://github.com/jackyboys">jackyboys</a></p>
</div>
