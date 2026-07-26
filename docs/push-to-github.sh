#!/usr/bin/env bash

set -euo pipefail

commit_message="${1:-chore: sync workspace changes}"

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "错误：当前目录不在 Git 仓库中。" >&2
  exit 1
}

cd "$repo_root"

branch="$(git branch --show-current)"
if [[ -z "$branch" ]]; then
  echo "错误：当前处于 detached HEAD，无法确定要推送的分支。" >&2
  exit 1
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "错误：仓库未配置 origin 远端。" >&2
  exit 1
fi

git add -A

if git diff --cached --quiet; then
  echo "没有需要提交的修改。"
  exit 0
fi

git commit -m "$commit_message"

if git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' >/dev/null 2>&1; then
  git push
else
  git push --set-upstream origin "$branch"
fi

echo "已将全部修改推送到 origin/$branch。"
