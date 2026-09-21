# Copy-paste setup prompt

Paste the prompt below into Codex, Claude Code, OpenClaw, Cursor, or another local coding agent that can run terminal commands.

```text
Set up the LinkedIn Signal Analyser from this repository on my computer:
https://github.com/Vibha-Ramprakash/Linkedin-Manager

Read README.md, SETUP-GUIDE.md, and the four SKILL.md files before changing anything. Keep the project in a new dedicated folder and do not copy credentials, cookies, browser profiles, or real lead data into the repository.

Install Agent Reach by following its current official installation guide exactly:
https://raw.githubusercontent.com/Panniantong/agent-reach/main/docs/install.md

Use the safe, read-only environment check first. Show me what is missing and ask before any system-level install or configuration write. If I approve those changes, install only the LinkedIn channel. Do not install a similarly named package from PyPI; use the official Agent Reach GitHub source specified by its guide.

Then:
1. Run `agent-reach doctor --json` and report the LinkedIn status without treating configuration alone as proof that it works.
2. Confirm that `uvx` and `mcporter` are available. Use this repository's `config/mcporter.json` for the visible, slowed, keep-alive LinkedIn connector.
3. Start the one-time human login with `uvx mcp-server-linkedin@latest --login`, then pause so I can sign in, approve any confirmation, or complete any CAPTCHA/security checkpoint myself. Never ask me for my LinkedIn password or try to bypass a checkpoint.
4. After I confirm login, verify the session with a real, non-empty, read-only `get_my_profile` call through the LinkedIn MCP. Configuration detection is not sufficient. If the read is empty or fails, say that the connection is not verified and help me retry safely.
5. Run the repository's automated tests, then start `node live-server.mjs` from the repository folder and open `http://127.0.0.1:4317`.
6. Confirm that the dashboard shows `LinkedIn connected · live read` only after the successful profile read.

Keep all LinkedIn work serial, small-batch, and read-only. The only allowed LinkedIn tools are `search_people`, `get_person_profile`, `get_company_profile`, `get_company_posts`, `search_posts`, and `close_session`. Never connect, follow, message, read inboxes, publish, schedule, modify a profile, or silently substitute example data for an empty live result.

When finished, give me: the installed Agent Reach version, the LinkedIn MCP verification result, the local dashboard URL, any remaining manual step, and a clear warning that LinkedIn may restrict automated access even for small read-only runs.
```

The agent should stop for two human decisions: approval before system-level installation, and the one-time LinkedIn sign-in/security flow.
