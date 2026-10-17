# GitHub 远程 MCP：Cursor 教程的 Codex 等效配置

本项目使用 `https://api.githubcopilot.com/mcp/`，无需 Docker。

Codex CLI 的本机帮助确认其实际配置来自 `~/.codex/config.toml`。因此同时创建教程要求的 `~/.codex/mcp.json` 参考文件，以及 Codex 真正读取的 TOML 配置，不能只写 JSON 就声称 Codex 已启用。

```toml
[mcp_servers.github]
url = "https://api.githubcopilot.com/mcp/"
bearer_token_env_var = "GITHUB_PERSONAL_ACCESS_TOKEN"
```

等效命令：

```powershell
codex mcp add github --url https://api.githubcopilot.com/mcp/ --bearer-token-env-var GITHUB_PERSONAL_ACCESS_TOKEN
```

教程风格的 `mcp.json` 参考内容：

```json
{
  "mcpServers": {
    "github": {
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": {
        "Authorization": "Bearer ${env:GITHUB_PERSONAL_ACCESS_TOKEN}"
      }
    }
  }
}
```

JSON 中的环境变量插值语法需由相应 MCP 客户端支持；Codex 使用上面的 TOML `bearer_token_env_var`，不读取这个 JSON。

令牌保存在当前 Windows 用户的环境变量中，不在仓库、Git remote URL、官网或截图中。已有 Codex 进程需要完全退出后重新打开，才能继承新环境变量并加载新增 MCP 工具；当前会话不声称已热加载工具。

已直接向远程服务器发送 JSON-RPC `initialize` 与 `tools/call`（`get_me`），确认 HTTP 200 并返回账号 `luwww0720-spec`。这验证远程服务和认证；不是 Codex 设置页面的绿色状态截图。

参考：https://developers.openai.com/codex/mcp/ 。本次自动读取该官方页面收到 HTTP 403，实际字段已通过本机 `codex mcp add --help` 及配置读取验证。
