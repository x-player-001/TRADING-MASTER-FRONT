# 🔒 安全部署指南

## 方案1：自动化部署（推荐）

### 一键部署脚本

```bash
# 1. 上传代码到服务器
cd /root
git clone <你的仓库地址> TRADING-MASTER-FRONT
cd TRADING-MASTER-FRONT

# 2. 配置环境变量
cp .env.example .env.local
vi .env.local  # 填写实际配置

# 3. 安装依赖并启动前端
npm install
npm run dev -- --host 127.0.0.1 --port 3001 &

# 4. 运行安全部署脚本（自动配置nginx + 随机路径 + 随机端口）
chmod +x deploy-secure.sh
sudo bash deploy-secure.sh
```

### 脚本会自动完成：

✅ 生成随机路径前缀（如 `/app-a7f3c8e2d5b9/`）
✅ 生成随机高位端口（如 `38291`）
✅ 安装并配置nginx反向代理
✅ 配置防火墙规则
✅ 生成访问信息文档

### 访问方式：

```
http://你的服务器IP:38291/app-a7f3c8e2d5b9/
```

---

## 方案2：手动配置

### 1. 生成随机路径

```bash
# 生成16位随机字符串
openssl rand -hex 8
# 输出示例: a7f3c8e2d5b9
```

### 2. 选择随机端口

```bash
# 建议范围：30000-39999
RANDOM_PORT=$((30000 + RANDOM % 10000))
echo $RANDOM_PORT
```

### 3. 创建nginx配置

```bash
vi /etc/nginx/conf.d/trading-front.conf
```

复制 `nginx.conf` 内容并修改：
- 替换 `app-a7f3c8e2d5b9` 为你生成的随机路径
- 替换 `38291` 为你选择的随机端口

### 4. 启动服务

```bash
# 启动前端（监听本地）
npm run dev -- --host 127.0.0.1 --port 3001 &

# 重启nginx
nginx -t
systemctl restart nginx

# 开放端口
firewall-cmd --permanent --add-port=38291/tcp
firewall-cmd --reload
```

---

## 安全特性说明

### 🛡️ 双层防护

1. **端口混淆**：使用非标准高位端口（30000-39999），而非默认3001
2. **路径混淆**：随机16字符路径前缀，猜测难度 16^16 ≈ 10^19

### 🔒 访问流程

```
客户端
  ↓ (需要知道端口)
http://IP:38291
  ↓ (需要知道随机路径)
/app-a7f3c8e2d5b9/
  ↓
访问应用
```

### ⚠️ 注意事项

- **保管好访问地址**：路径和端口一旦丢失需要查看nginx配置
- **定期更换**：建议定期更换随机路径和端口
- **监控访问日志**：`tail -f /var/log/nginx/trading-front-access.log`
- **建议使用HTTPS**：配置SSL证书加密传输

---

## 生产环境优化

### 1. 构建生产版本

```bash
npm run build
```

修改nginx配置为静态文件服务：

```nginx
location /app-a7f3c8e2d5b9/ {
    alias /root/TRADING-MASTER-FRONT/dist/;
    try_files $uri $uri/ /index.html;
}
```

### 2. 使用PM2管理进程

```bash
npm install -g pm2
pm2 start npm --name trading-front -- run preview
pm2 save
pm2 startup
```

### 3. 配置HTTPS（推荐）

```bash
# 使用Let's Encrypt免费证书
yum install -y certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com
```

---

## 管理命令

```bash
# 查看nginx状态
systemctl status nginx

# 重启nginx
systemctl restart nginx

# 查看实时访问日志
tail -f /var/log/nginx/trading-front-access.log

# 查看错误日志
tail -f /var/log/nginx/trading-front-error.log

# 查看访问地址（如果忘记）
cat /root/trading-front-access.txt
```

---

## 故障排查

### 1. 无法访问

```bash
# 检查防火墙
firewall-cmd --list-ports

# 检查nginx状态
systemctl status nginx

# 检查端口监听
netstat -tlnp | grep nginx
```

### 2. 代理失败

```bash
# 检查前端是否运行
netstat -tlnp | grep 3001

# 重启前端
pkill -f "vite"
npm run dev -- --host 127.0.0.1 --port 3001 &
```

### 3. 查看nginx配置

```bash
# 查看配置文件
cat /etc/nginx/conf.d/trading-front.conf

# 测试配置
nginx -t

# 查看错误日志
tail -f /var/log/nginx/trading-front-error.log
```

---

## 安全建议

✅ 只告知必要人员访问地址
✅ 定期更换随机路径和端口
✅ 配置HTTPS加密传输
✅ 限制IP白名单（如果固定IP访问）
✅ 定期查看访问日志，发现异常立即封禁

---

## 如果需要增加密码保护

如果后续需要增加密码认证，可以：

```bash
# 1. 安装密码工具
yum install -y httpd-tools

# 2. 创建密码文件
htpasswd -c /etc/nginx/.htpasswd admin

# 3. 修改nginx配置，在location块中添加：
auth_basic "Restricted Access";
auth_basic_user_file /etc/nginx/.htpasswd;

# 4. 重启nginx
systemctl restart nginx
```

---

**记住：安全性 = 端口隐藏 + 路径混淆**
