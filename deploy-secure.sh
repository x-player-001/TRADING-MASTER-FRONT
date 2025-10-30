#!/bin/bash
# Trading Master Frontend - 安全部署脚本
# 用途：生成随机路径和配置nginx反向代理

set -e

echo "=========================================="
echo "  Trading Master 安全部署配置"
echo "=========================================="
echo ""

# 检查是否为root
if [ "$EUID" -ne 0 ]; then
    echo "❌ 请使用root权限运行此脚本"
    echo "   sudo bash deploy-secure.sh"
    exit 1
fi

# 检查nginx是否安装
if ! command -v nginx &> /dev/null; then
    echo "📦 Nginx未安装，正在安装..."
    yum install -y nginx
    systemctl enable nginx
fi

# 生成随机路径前缀
RANDOM_PATH=$(openssl rand -hex 8)
RANDOM_PORT=$((30000 + RANDOM % 10000))

echo "✅ 已生成随机配置："
echo "   随机路径: /app-${RANDOM_PATH}/"
echo "   nginx端口: ${RANDOM_PORT}"
echo ""

# 生成密码
read -p "🔐 设置访问用户名 [默认: admin]: " USERNAME
USERNAME=${USERNAME:-admin}

read -sp "🔑 设置访问密码: " PASSWORD
echo ""

if [ -z "$PASSWORD" ]; then
    echo "❌ 密码不能为空"
    exit 1
fi

# 创建htpasswd文件
echo "📝 创建认证文件..."
yum install -y httpd-tools
htpasswd -bc /etc/nginx/.htpasswd "$USERNAME" "$PASSWORD"

# 修改nginx配置
NGINX_CONF="/etc/nginx/conf.d/trading-front.conf"
echo "📝 生成nginx配置: $NGINX_CONF"

cat > $NGINX_CONF <<EOF
# Trading Master Frontend - 安全配置
# 生成时间: $(date)

server {
    listen ${RANDOM_PORT};
    server_name _;

    access_log /var/log/nginx/trading-front-access.log;
    error_log /var/log/nginx/trading-front-error.log;

    # 随机路径前缀
    location /app-${RANDOM_PATH}/ {
        auth_basic "Trading Master - Restricted Access";
        auth_basic_user_file /etc/nginx/.htpasswd;

        rewrite ^/app-${RANDOM_PATH}/(.*) /\$1 break;
        proxy_pass http://127.0.0.1:3001;

        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }

    # 拒绝其他路径
    location / {
        return 404;
    }
}
EOF

# 测试nginx配置
echo "🔍 测试nginx配置..."
nginx -t

# 重启nginx
echo "🔄 重启nginx..."
systemctl restart nginx

# 配置防火墙
echo "🛡️  配置防火墙..."
if command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-port=${RANDOM_PORT}/tcp
    firewall-cmd --reload
    echo "   已开放端口: ${RANDOM_PORT}"
else
    echo "   ⚠️  未检测到firewalld，请手动开放端口: ${RANDOM_PORT}"
fi

# 保存访问信息
ACCESS_INFO="/root/trading-front-access.txt"
cat > $ACCESS_INFO <<EOF
========================================
Trading Master Frontend 访问信息
========================================
生成时间: $(date)

访问地址: http://你的服务器IP:${RANDOM_PORT}/app-${RANDOM_PATH}/
用户名: ${USERNAME}
密码: ${PASSWORD}

⚠️ 请妥善保管此文件，删除前请务必记录访问信息！

nginx配置文件: ${NGINX_CONF}
认证文件: /etc/nginx/.htpasswd

管理命令:
- 查看nginx状态: systemctl status nginx
- 重启nginx: systemctl restart nginx
- 查看访问日志: tail -f /var/log/nginx/trading-front-access.log
- 查看错误日志: tail -f /var/log/nginx/trading-front-error.log

修改密码:
  htpasswd /etc/nginx/.htpasswd ${USERNAME}
========================================
EOF

echo ""
echo "=========================================="
echo "✅ 部署完成！"
echo "=========================================="
echo ""
cat $ACCESS_INFO
echo ""
echo "📄 访问信息已保存到: $ACCESS_INFO"
echo "🔒 建议记录后删除该文件: rm $ACCESS_INFO"
echo ""
