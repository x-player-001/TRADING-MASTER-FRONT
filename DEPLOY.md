# 🔒 安全部署指南

## 方案1：自动化安全部署（推荐）

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

# 4. 运行安全部署脚本（自动配置nginx + 随机路径 + 密码认证）
chmod +x deploy-secure.sh
sudo bash deploy-secure.sh
```

### 脚本会自动完成：

✅ 生成随机路径前缀（如 `/app-a7f3c8e2d5b9/`）
✅ 生成随机高位端口（如 `38291`）
✅ 配置HTTP Basic Auth认证
✅ 安装并配置nginx反向代理
✅ 配置防火墙规则
✅ 生成访问信息文档

### 访问方式：

```
http://你的服务器IP:38291/app-a7f3c8e2d5b9/
用户名: admin（或你设置的）
密码: ******（你设置的）
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

### 4. 创建密码文件

```bash
# 安装密码工具
yum install -y httpd-tools

# 创建用户密码（会提示输入密码）
htpasswd -c /etc/nginx/.htpasswd admin
```

### 5. 启动服务

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

### 🛡️ 三层防护

1. **端口混淆**：使用非标准高位端口（如38291），而非默认3001
2. **路径混淆**：随机16字符路径前缀，猜测难度 16^16 ≈ 10^19
3. **身份认证**：HTTP Basic Auth，需要用户名+密码

### 🔒 访问流程

```
客户端
  ↓ (需要知道端口)
http://IP:38291
  ↓ (需要知道随机路径)
/app-a7f3c8e2d5b9/
  ↓ (需要密码认证)
用户名 + 密码
  ↓
访问应用
```

### ⚠️ 注意事项

- **保管好访问信息**：路径和密码一旦丢失无法恢复
- **定期更换密码**：`htpasswd /etc/nginx/.htpasswd admin`
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
    auth_basic "Restricted Access";
    auth_basic_user_file /etc/nginx/.htpasswd;

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

# 修改密码
htpasswd /etc/nginx/.htpasswd admin

# 添加新用户
htpasswd /etc/nginx/.htpasswd newuser
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

### 2. 密码认证失败

```bash
# 检查密码文件权限
ls -l /etc/nginx/.htpasswd

# 重新创建密码
htpasswd -c /etc/nginx/.htpasswd admin
```

### 3. 代理失败

```bash
# 检查前端是否运行
netstat -tlnp | grep 3001

# 重启前端
pkill -f "vite"
npm run dev -- --host 127.0.0.1 --port 3001 &
```

---

## 安全建议

✅ 使用强密码（至少12位，包含大小写+数字+符号）
✅ 定期更换密码和随机路径
✅ 配置HTTPS加密传输
✅ 限制IP白名单（如果固定IP访问）
✅ 启用fail2ban防暴力破解
✅ 定期查看访问日志，发现异常立即封禁

---

**记住：安全性 = 端口隐藏 + 路径混淆 + 密码认证 + HTTPS加密**
