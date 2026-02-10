# Hexo 博客部署到 GitHub 指南

这个仓库已经配置好了 **GitHub Actions 自动部署到 GitHub Pages**。

## 1. 创建 GitHub 仓库并推送代码

1. 在 GitHub 新建仓库（例如：`blog`）。
2. 把本地代码推到该仓库。

## 2. 修改 Hexo 站点地址

编辑根目录 `_config.yml`：

- `url` 改成你的 Pages 地址：
  - 用户/组织主页仓库（`<username>.github.io`）：`https://<username>.github.io`
  - 项目仓库（如 `blog`）：`https://<username>.github.io/blog`
- `root`：
  - 用户/组织主页仓库用 `/`
  - 项目仓库用 `/blog/`

## 3. 启用 GitHub Pages

进入仓库 `Settings -> Pages`：

- `Build and deployment` 选择 `Source: GitHub Actions`

## 4. 触发自动部署

工作流文件是：`.github/workflows/deploy-pages.yml`。

- 当你 push 到 `main` 或 `master` 分支时，会自动：
  1. 安装依赖
  2. 构建 Hexo 静态文件
  3. 发布到 `gh-pages` 分支

## 5. 本地预览

```bash
npm install
npm run clean
npm run build
npm run server
```

默认本地地址：`http://localhost:4000`

---

如果你愿意，我还可以继续帮你把仓库名、`url/root` 按你的 GitHub 用户名直接改成可用的最终版本。
