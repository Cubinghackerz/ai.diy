---
name: linux-environment
version: 1.0.0
description: Use the in-browser Debian VM (CheerpX) for bash, gcc, node, and system tools. Activate before linux_run_command / linux_read_file, compile-C, or "use your Linux environment" requests.
category: developer
tools:
  - linux_environment_skill
  - linux_run_command
  - linux_read_file
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

Run real commands in the in-browser x86 Debian VM (CheerpX / WebVM). Measure versions, compile, write files, and attach results to Canvas. Never invent stdout, exit codes, or artifacts.

## When to activate

- User asks to use the Linux environment, CheerpX, WebVM, bash, gcc, or the Debian VM
- Slash command `/Linux Environment`
- Compile a `.c` file, run `uname`, or inspect `/home/user`
- Do **not** use for pandas/matplotlib/document generation — that is `run_python` (Pyodide)

## Inputs

| Name | Required | Notes |
|------|----------|-------|
| `task` | no | What to do in the VM |

## Workflow

1. Call `linux_environment_skill` once.
2. Probe only if versions matter: `uname -srm; python3 --version; gcc --version | head -n1; node --version`.
3. One job per `linux_run_command`. Pass a short `description` for the card title.
4. Write under `/home/user` or `/tmp`. After a Permission denied on home, switch to `/tmp` immediately.
5. Attach user-facing files with `linux_read_file`. Do not `create_file` the same bytes.

## Decision rules

- This VM’s `python3` is Debian 3.7 — no pandas/numpy. Use `run_python` for analysis libraries.
- No outbound network. Do not retry `apt` / `pip` / `npm` / curl / git clone.
- Do not wrap commands in GNU `timeout` (i386 stack smash).
- Stop after one crash of the same binary; simplify instead of looping.

## Tool rules

- `linux_environment_skill`: required first call.
- `linux_run_command` / `run_command`: bash only. 90s / 32KB cap. First boot has a 60s startup cap. After a VM error, do not retry Linux tools in that turn.
- `linux_read_file` / `read_file`: Canvas attach, 2 MiB cap.
- `run_python`: hand off data/chart/document work.

## Output contract

Report measured stdout/stderr and exit codes. Cite Canvas files as `filename.ext`. If the VM is unavailable (not cross-origin isolated), say so and stop.

## Validation

- A compile succeeded only if gcc’s exit code is 0 and the binary ran.
- A file exists only after `linux_read_file` or a successful `ls`/`test -f`.

## Failure handling

- Permission denied on `/home/user` → `/tmp`.
- Stack smash → drop that binary; retry a simpler command.
- Timeout → split the work.
- Missing tools in ACTIVE TOOLS → say they are off; do not fake results.
