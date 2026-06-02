# 空教室查询 V2

> **Continued by \_Thx** — 基于原作者 [Jraaay/EmptyClassroom](https://github.com/Jraaay/EmptyClassroom) 继续维护

提供给 BUPT 学生的空教室查询系统，方便同学们灵活游击战自习。

数据来源：北邮教务系统（JWGL），实时准确。

## 本地运行

```bash
# 配置环境变量
set JW_USERNAME=你的学号
set JW_PASSWORD=你的教务密码
set CONFIG_PATH=config

# 运行
ec.exe
```

访问 http://localhost:8080

## 相比原项目的变更

- 修复密码加密问题（AES-128-ECB + 双重 Base64）
- 修正校区 ID（西土城=01, 沙河=04）
- 精简课表系统，全部依赖教务实时数据
- 定时更新改为每天 7:00（而非每 5 分钟）
- 打开页面自动刷新机制
- 四季主题背景
- 开发者模式（三击设置页小虫图标）
