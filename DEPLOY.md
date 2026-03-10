# 部署指南

## GitHub Pages 部署

1. **创建GitHub仓库**
   - 登录GitHub，创建新仓库
   - 仓库名建议：`coin-life` 或 `coinlife-game`
   - 设置为公开仓库

2. **上传代码**
   ```bash
   # 添加远程仓库
   git remote add origin https://github.com/yourusername/coin-life.git
   
   # 推送代码
   git branch -M main
   git push -u origin main
   ```

3. **启用GitHub Pages**
   - 进入仓库设置 (Settings)
   - 找到 "Pages" 选项
   - Source 选择 "Deploy from a branch"
   - Branch 选择 "main" 分支
   - 文件夹选择 "/ (root)"
   - 点击 Save

4. **访问游戏**
   - 等待几分钟部署完成
   - 访问：`https://yourusername.github.io/coin-life`

## 其他部署选项

### Netlify
1. 将代码推送到GitHub
2. 登录Netlify，选择"New site from Git"
3. 连接GitHub仓库
4. 部署设置保持默认即可
5. 点击"Deploy site"

### Vercel
1. 将代码推送到GitHub
2. 登录Vercel，点击"New Project"
3. 导入GitHub仓库
4. 部署设置保持默认
5. 点击"Deploy"

### 本地测试
```bash
# 使用Python启动本地服务器
python -m http.server 8000

# 或使用Node.js
npx serve .

# 然后访问 http://localhost:8000
```

## 自定义域名

如果你有自己的域名，可以在GitHub Pages设置中添加自定义域名：

1. 在仓库根目录创建 `CNAME` 文件
2. 文件内容为你的域名，如：`coinlife.yourdomain.com`
3. 在域名DNS设置中添加CNAME记录指向 `yourusername.github.io`

## 注意事项

- 确保所有文件路径使用相对路径
- 游戏使用纯前端技术，无需服务器端配置
- 支持HTTPS访问，确保音频功能正常工作
- 移动端访问体验已优化