# 上传到GitHub完整指南

## 第一步：创建GitHub仓库

1. **登录GitHub**
   - 访问 [github.com](https://github.com)
   - 登录你的账户

2. **创建新仓库**
   - 点击右上角的 "+" 号
   - 选择 "New repository"
   - 仓库名称：`coin-life` 或 `coinlife-game`
   - 描述：`模拟币生 - 7天币圈交易模拟游戏`
   - 设置为 **Public**（公开）
   - **不要**勾选 "Add a README file"（我们已经有了）
   - 点击 "Create repository"

## 第二步：上传代码

在你的项目目录中运行以下命令：

```bash
# 1. 添加远程仓库（替换 yourusername 为你的GitHub用户名）
git remote add origin https://github.com/yourusername/coin-life.git

# 2. 推送代码到GitHub
git branch -M main
git push -u origin main
```

如果遇到认证问题，可能需要：
- 使用GitHub Personal Access Token
- 或者使用SSH密钥

## 第三步：启用GitHub Pages

1. **进入仓库设置**
   - 在你的仓库页面，点击 "Settings" 标签
   
2. **配置Pages**
   - 在左侧菜单找到 "Pages"
   - Source 选择 "Deploy from a branch"
   - Branch 选择 "main"
   - 文件夹选择 "/ (root)"
   - 点击 "Save"

3. **等待部署**
   - GitHub会显示部署状态
   - 通常需要几分钟时间
   - 部署完成后会显示访问链接

## 第四步：访问游戏

部署完成后，你可以通过以下链接访问游戏：
```
https://yourusername.github.io/coin-life
```

## 故障排除

### 如果游戏无法加载：
1. 检查浏览器控制台是否有错误
2. 确保所有文件都已正确上传
3. 等待几分钟让GitHub Pages完全部署

### 如果音效不工作：
1. 确保使用HTTPS访问（GitHub Pages默认支持）
2. 在游戏中点击任意按钮激活音频上下文

### 如果推送失败：
```bash
# 如果遇到认证问题，可以使用token
git remote set-url origin https://token@github.com/yourusername/coin-life.git

# 或者使用SSH（需要先配置SSH密钥）
git remote set-url origin git@github.com:yourusername/coin-life.git
```

## 更新游戏

当你修改游戏后，使用以下命令更新：

```bash
git add .
git commit -m "Update game features"
git push origin main
```

GitHub Pages会自动重新部署。

## 分享游戏

游戏上传成功后，你可以：
- 分享链接给朋友体验
- 在社交媒体上展示
- 添加到你的个人作品集
- 继续开发新功能

## 自定义域名（可选）

如果你有自己的域名：

1. 在仓库根目录创建 `CNAME` 文件
2. 文件内容写入你的域名：`game.yourdomain.com`
3. 在域名DNS设置中添加CNAME记录指向 `yourusername.github.io`

---

**恭喜！** 你的"模拟币生"游戏现在已经在互联网上了！🎉