#!/bin/bash
# k8s 端口转发 — 在 WSL 中运行，宿主机浏览器访问 localhost
# 用法: bash port-forward.sh

echo "启动端口转发..."
echo "  宿主机浏览器访问:"

kubectl port-forward -n monitoring svc/prometheus 9090:9090 &
echo "  Prometheus → http://localhost:9090"

kubectl port-forward -n monitoring svc/grafana 3000:3000 &
echo "  Grafana    → http://localhost:3000 (admin/admin123)"

kubectl port-forward -n middleware svc/rabbitmq 15672:15672 &
echo "  RabbitMQ   → http://localhost:15672 (admin/admin123)"

kubectl port-forward -n kubernetes-dashboard svc/kubernetes-dashboard 8443:443 &
echo "  Dashboard  → https://localhost:8443"

echo ""
echo "按 Ctrl+C 停止所有转发"
wait
