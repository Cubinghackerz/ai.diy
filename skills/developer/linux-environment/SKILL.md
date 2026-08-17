---
name: linux-environment
version: 1.1.0
description: Use the in-browser Debian VM (CheerpX) for bash, gcc, node, and system tools. Activate before linux_run_command / linux_read_file, compile-C, or "use your Linux environment" requests.
category: developer
tools:
  - linux_environment_skill
  - linux_run_command
  - linux_read_file
  - linux_background_start
  - linux_list_processes
  - linux_kill_process
  - run_python
  - ask_user
inputs:
  - name: task
    type: string
    required: false
outputs:
  - name: result
    type: markdown
permissions:
  - filesystem
  - code_execution
popular: true
---

# Linux Environment

## Job charter

Run real commands in the in-browser x86 Debian VM (CheerpX / WebVM). Measure versions, compile, write files, start and stop servers, and attach results to Canvas. Never invent stdout, exit codes, pids, or artifacts.

## When to activate

- User asks to use the Linux environment, CheerpX, WebVM, bash, gcc, or the Debian VM
- Slash command `/Linux Environment`
- Compile a `.c` file, run `uname`, or inspect `/home/user`
- Start a server or long job in the VM
- Do **not** use for pandas/matplotlib/document generation — that is `run_python` (Pyodide)

## Inputs

| Name | Required | Notes |
|------|----------|-------|
| `task` | no | What to do in the VM |

## Workflow

1. Load the `linux_environment_skill` contract **once per conversation**; on later turns reuse it without re-calling.
2. Probe only if versions matter: `node --version; python3 --version; gcc --version | head -n1`.
3. One job per `linux_run_command`. Pass a short `description` for the card title.
4. Write under `/home/user` or `/tmp`. After a Permission denied on home, switch to `/tmp` immediately.
5. Attach user-facing files with `linux_read_file`. Do not `create_file` the same bytes.
6. Start servers with `linux_background_start`, then verify with `linux_list_processes` and read the returned log before claiming readiness. Stop them with `linux_kill_process <pid>`.

## Decision rules

- This VM’s `python3` is Debian 3.7 — no pandas/numpy. Use `run_python` for analysis libraries.
- Networking is off until the user connects Tailscale in Settings → Experimental. Public internet additionally requires an exit node. Do not retry `apt` / `pip` / `npm` / curl / git clone before networking is connected.
- Never mask failures: no `|| true`, no trailing `echo` hiding a failing command. Quote real exit codes and output.
- Do not wrap commands in GNU `timeout` (i386 stack smash).
- Stop after one crash of the same binary; simplify instead of looping.
- A bare `&` inside `linux_run_command` dies with the shell — use `linux_background_start`.
- There is no loopback TCP in the VM — never claim a server is "listening on port X" unless its log confirms it.

## Tool rules

- `linux_environment_skill`: required first call (once per conversation).
- `linux_run_command` / `run_command`: bash only. 90s / 32KB cap; optional `timeoutSec` (1-300, default 90) extends the kill timeout for long compiles or servers. On timeout the VM kills the command and its descendants. First boot has a 60s startup cap. After a VM error, do not retry Linux tools in that turn.
- `linux_read_file` / `read_file`: Canvas attach, 2 MiB cap.
- `linux_background_start`: detached process (setsid); returns `pid` + log path.
- `linux_list_processes`: verify a background process is alive; find pids to kill.
- `linux_kill_process`: stop a process and its whole group.
- `run_python`: hand off data/chart/document work.

## Output contract

Report measured stdout/stderr, exit codes, and pids. Cite Canvas files as `filename.ext`. If the VM is unavailable (not cross-origin isolated), say so and stop.

## Validation

- A compile succeeded only if gcc’s exit code is 0 and the binary ran.
- A file exists only after `linux_read_file` or a successful `ls`/`test -f`.
- A background process is running only after `linux_list_processes` shows it and its log confirms readiness.

## Failure handling

- Permission denied on `/home/user` → `/tmp`.
- Stack smash → drop that binary; retry a simpler command.
- Timeout → split the work.
- Server did not stay up → read the log, fix the error, restart via `linux_background_start`.
- Missing tools in ACTIVE TOOLS → say they are off; do not fake results.
