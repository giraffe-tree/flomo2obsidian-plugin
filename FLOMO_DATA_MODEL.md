# Flomo 数据模型与同步策略摘要

## 1. API 鉴权方式

- **Token 获取**: 浏览器登录 v.flomoapp.com → F12 → Network → 任意请求 Headers → 复制 `Authorization` 值
- **Token 格式**: `Bearer 1023456|AA000000ABCDEFGHIJKHLMNOP000000000000000`
- **鉴权 Header**: `Authorization: Bearer <token>`

## 2. API 端点

### 获取更新的 Memo 列表
```
GET https://flomoapp.com/api/v1/memo/updated/
```

**请求参数**:
| 参数 | 说明 | 示例 |
|------|------|------|
| `limit` | 每页数量，最大 200 | `200` |
| `latest_updated_at` | 上次同步的最大 updated_at 时间戳 | `1704067200` |
| `latest_slug` | 上次最后一条 memo 的 slug | `MTI3MTMwMzQ0` |
| `tz` | 时区 | `8:0` |
| `timestamp` | 当前时间戳（用于 sign） | |
| `api_key` | 固定值 `flomo_web` | |
| `app_version` | 固定值 `4.0` | |
| `platform` | 固定值 `web` | |
| `webp` | 固定值 `1` | |
| `sign` | MD5 签名 | |

**Sign 算法**:
1. 按 key 字典序排列参数
2. 跳过值为 null/空字符串/false 的参数（保留数字 0）
3. 列表类型：`key[]=value`，value 排序
4. 追加 secret: `dbbc3dd73364b4084c3a69346e0ce2b2`
5. 取 MD5

### 返回数据结构
```typescript
interface FlomoMemo {
  slug: string;              // 唯一标识，如 "MTI3MTMwMzQ0"
  content: string;           // HTML 格式内容
  tags: string[];            // 标签数组，如 ["英语/如何学习"]
  created_at: string;        // "2024-07-11 00:20:04"
  updated_at: string;        // "2024-07-11 00:20:04"
  source: string;            // 来源，如 "android", "ios", "web"
  files?: FlomoFile[];       // 附件列表
}

interface FlomoFile {
  name: string;              // 文件名
  url: string;               // 远程 URL
}
```

## 3. 分页/游标机制

- 使用 `latest_updated_at` + `latest_slug` 作为游标
- API 按 updated_at 升序返回，每页最多 200 条
- 当返回条数 < limit 时，表示已到达末尾
- 增量同步策略：记录上次同步的最大 updated_at，下次从这个时间点开始

## 4. 文件命名规则

格式：`{日期}_{标签叶}_{内容前6字}_{slug}.md`

- 日期：created_at 前 10 位（YYYY-MM-DD）
- 标签叶：第一个标签的斜杠最后一段
- 内容前6字：清理后的内容前 6 个有效字符（汉字+字母数字）
- slug：memo 的唯一标识

## 5. 附件处理

**支持的图片格式**: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`
**支持的音频格式**: `.m4a`, `.mp3`, `.wav`, `.ogg`

**存储路径**: `images/YYYY/MM/DD/{slug}_{filename}`
**Markdown 语法**:
- 图片: `![name](path)`
- 音频: `[name](path)`

## 6. 增量同步策略

### 推荐策略（基于 updated_at + slug 游标）

1. **首次同步**: `latest_updated_at=0`, `latest_slug=""`，全量拉取
2. **增量同步**: 使用上次保存的 `latest_updated_at` 和 `latest_slug`
3. **容错处理**: 同步时间减 1 天，避免边界遗漏

### 去重策略

- 以 `slug` 作为主键
- 文件命名包含 slug，便于查找和覆盖
- 若文件名变化但 slug 相同，删除旧文件创建新文件

### 状态判定

- **created**: 新文件
- **updated**: slug 存在但内容或文件名变化
- **skipped**: 文件已存在且内容相同

## 7. Markdown 输出格式

```markdown
---
slug: MTI3MTMwMzQ0
created_at: 2024-07-11 00:20:04
updated_at: 2024-07-11 00:20:04
tags: [英语/如何学习]
source: android
---

#英语/如何学习

你不是学不会，你只是不学

**附件:**
![photo.png](images/2024/07/11/MTI3MTMwMzQ0_photo.png)
```

## 8. MVP 版本字段支持

| 字段 | 必须 | 说明 |
|------|------|------|
| slug | 是 | 唯一标识 |
| content | 是 | HTML 转 Markdown |
| created_at | 是 | ISO 格式 frontmatter |
| updated_at | 是 | ISO 格式 frontmatter |
| tags | 是 | frontmatter + 正文标签 |
| source | 否 | frontmatter |
| files | 否 | 附件下载/链接 |

## 9. 错误处理

| HTTP 状态 | 处理策略 |
|-----------|----------|
| 401/403 | Token 过期，提示重新获取 |
| 429 | 限速，指数退避重试 |
| 网络错误 | 重试 3 次后报错 |
| API 错误 | code != 0 时抛出错误 |
