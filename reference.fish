# GistID: d30c1b1c11c7b9525ba8fd8f2171af20

function __gw_err -a message
    printf '%s\n' "gw: $message" >&2
end

function __gw_find_project_root -a start_path
    set -l dir "$start_path"
    if test -z "$dir"
        set dir (pwd -P)
    else
        set dir (path resolve "$dir")
    end

    while true
        if test -f "$dir/.gw_project"
            printf '%s\n' "$dir"
            return 0
        end

        if test "$dir" = "/"
            return 1
        end

        set dir (path dirname "$dir")
    end
end

function __gw_config_value -a project_root key
    set -l config_file "$project_root/.gw_project"
    if not test -f "$config_file"
        return 1
    end

    while read -l line
        set line (string trim -- "$line")

        if test -z "$line"
            continue
        end

        if string match -q '#*' -- "$line"
            continue
        end

        set -l pair (string split -m 1 '=' -- "$line")
        if test (count $pair) -ne 2
            continue
        end

        set -l current_key (string trim -- "$pair[1]")
        if test "$current_key" != "$key"
            continue
        end

        printf '%s\n' (string trim -- "$pair[2]")
        return 0
    end < "$config_file"

    return 1
end

function __gw_primary_branch -a project_root
    set -l primary (__gw_config_value "$project_root" primary)
    if test -z "$primary"
        __gw_err "missing 'primary' in $project_root/.gw_project"
        return 1
    end

    printf '%s\n' "$primary"
end

function __gw_remote_name -a project_root
    set -l remote (__gw_config_value "$project_root" remote)
    if test -z "$remote"
        set remote origin
    end

    printf '%s\n' "$remote"
end

function __gw_branch_prefix -a project_root
    __gw_config_value "$project_root" branch-prefix
end

function __gw_anchor_repo -a project_root
    set -l primary (__gw_primary_branch "$project_root")
    or return 1

    set -l anchor_repo "$project_root/$primary"
    if not command git -C "$anchor_repo" rev-parse --is-inside-work-tree >/dev/null 2>/dev/null
        __gw_err "primary worktree is missing or invalid: $anchor_repo"
        return 1
    end

    printf '%s\n' (path resolve "$anchor_repo")
end

function __gw_strip_branch_prefix -a branch_name branch_prefix
    if test -z "$branch_prefix"
        printf '%s\n' "$branch_name"
        return 0
    end

    set -l prefix_regex (string escape --style=regex -- "$branch_prefix")
    if string match -rq -- "^$prefix_regex" "$branch_name"
        printf '%s\n' (string replace -r "^$prefix_regex" '' -- "$branch_name")
        return 0
    end

    printf '%s\n' "$branch_name"
end

function __gw_encode_branch_path -a branch_name branch_prefix
    set -l display_name (__gw_strip_branch_prefix "$branch_name" "$branch_prefix")
    printf '%s\n' (string replace -a '/' '~' -- "$display_name")
end

function __gw_is_path_inside -a child_path parent_path
    set -l child (path resolve "$child_path")
    or return 1

    set -l parent (path resolve "$parent_path")
    or return 1

    if test "$child" = "$parent"
        return 0
    end

    set -l parent_prefix "$parent/"
    set -l prefix_length (string length -- "$parent_prefix")
    test (string sub -s 1 -l "$prefix_length" -- "$child") = "$parent_prefix"
end

function __gw_current_repo -a project_root
    set -l current_repo (command git rev-parse --show-toplevel 2>/dev/null)
    or return 1

    set current_repo (path resolve "$current_repo")
    or return 1

    __gw_is_path_inside "$current_repo" "$project_root"
    or return 1

    printf '%s\n' "$current_repo"
end

function __gw_list_worktrees -a repo_path
    set -l lines (command git -C "$repo_path" worktree list --porcelain 2>/dev/null)
    or return 1

    set -l current_path
    set -l current_branch

    for line in $lines
        if string match -q 'worktree *' -- "$line"
            if test -n "$current_path"; and test -n "$current_branch"
                printf '%s\t%s\n' "$current_branch" "$current_path"
            end

            set current_branch
            set current_path (string replace -r '^worktree ' '' -- "$line")
            continue
        end

        if string match -q 'branch refs/heads/*' -- "$line"
            set current_branch (string replace -r '^branch refs/heads/' '' -- "$line")
        end
    end

    if test -n "$current_path"; and test -n "$current_branch"
        printf '%s\t%s\n' "$current_branch" "$current_path"
    end
end

function __gw_find_worktree_for_branch -a repo_path branch_name
    for entry in (__gw_list_worktrees "$repo_path")
        set -l pair (string split -m 1 \t -- "$entry")
        if test (count $pair) -ne 2
            continue
        end

        if test "$pair[1]" = "$branch_name"
            printf '%s\n' "$pair[2]"
            return 0
        end
    end

    return 1
end

function __gw_find_worktree_for_folder_name -a repo_path folder_name
    for entry in (__gw_list_worktrees "$repo_path")
        set -l pair (string split -m 1 \t -- "$entry")
        if test (count $pair) -ne 2
            continue
        end

        if test (path basename "$pair[2]") = "$folder_name"
            printf '%s\n' "$pair[2]"
            return 0
        end
    end

    return 1
end

function __gw_branch_exists -a repo_path branch_name
    command git -C "$repo_path" show-ref --verify --quiet -- "refs/heads/$branch_name"
end

function __gw_remote_branch_ref_exists -a repo_path remote_name branch_name
    command git -C "$repo_path" show-ref --verify --quiet -- "refs/remotes/$remote_name/$branch_name"
end

function __gw_remote_branch_exists -a repo_path remote_name branch_name
    if __gw_remote_branch_ref_exists "$repo_path" "$remote_name" "$branch_name"
        return 0
    end

    command git -C "$repo_path" ls-remote --exit-code --heads "$remote_name" "$branch_name" >/dev/null 2>/dev/null
end

function __gw_fetch_remote_branch_ref -a repo_path remote_name branch_name
    command git -C "$repo_path" fetch "$remote_name" "+refs/heads/$branch_name:refs/remotes/$remote_name/$branch_name"
end

function __gw_list_local_branches -a repo_path
    command git -C "$repo_path" for-each-ref --format='%(refname:strip=2)' refs/heads 2>/dev/null
end

function __gw_suffix_branch_candidates -a repo_path raw_branch
    for branch_name in (__gw_list_local_branches "$repo_path")
        if not string match -q '*/*' -- "$branch_name"
            continue
        end

        set -l parts (string split -m 1 '/' -- "$branch_name")
        if test (count $parts) -ne 2
            continue
        end

        if test "$parts[2]" = "$raw_branch"
            printf '%s\n' "$branch_name"
        end
    end
end

function __gw_prompt_branch_choice -a repo_path
    set -l branches $argv[2..-1]
    if test (count $branches) -eq 0
        return 1
    end

    if not status is-interactive
        __gw_err 'multiple matching branches found:'
        for branch_name in $branches
            set -l worktree_path (__gw_find_worktree_for_branch "$repo_path" "$branch_name")
            if test -n "$worktree_path"
                printf '%s\n' "  $branch_name -> $worktree_path" >&2
            else
                printf '%s\n' "  $branch_name -> no worktree" >&2
            end
        end
        __gw_err 'rerun with an explicit prefixed branch name or --ignore-prefix'
        return 1
    end

    printf '%s\n' 'Multiple matching branches found:' >&2

    set -l index 1
    for branch_name in $branches
        set -l worktree_path (__gw_find_worktree_for_branch "$repo_path" "$branch_name")
        if test -n "$worktree_path"
            printf '%s\n' "$index. $branch_name -> $worktree_path" >&2
        else
            printf '%s\n' "$index. $branch_name -> no worktree" >&2
        end
        set index (math "$index + 1")
    end

    while true
        read -P "Choose branch [1-"(count $branches)"]: " choice
        or return 1

        if string match -rq '^[0-9]+$' -- "$choice"
            if test "$choice" -ge 1; and test "$choice" -le (count $branches)
                printf '%s\n' "$branches[$choice]"
                return 0
            end
        end

        printf '%s\n' "Please enter a number between 1 and "(count $branches) >&2
    end
end

function __gw_resolve_branch -a project_root raw_branch ignore_prefix
    set -l anchor_repo (__gw_anchor_repo "$project_root")
    or return 1

    set -l branch_prefix (__gw_branch_prefix "$project_root")
    set -l primary_branch (__gw_primary_branch "$project_root")
    or return 1

    set -l candidates
    if test "$ignore_prefix" = 1
        set candidates "$raw_branch"
    else if test -n "$branch_prefix"
        set -l prefix_regex (string escape --style=regex -- "$branch_prefix")
        if string match -rq -- "^$prefix_regex" "$raw_branch"
            set candidates "$raw_branch"
        else
            set candidates "$branch_prefix$raw_branch" "$raw_branch"
        end
    else
        set candidates "$raw_branch"
    end

    set -l unique_candidates
    for candidate in $candidates
        contains -- "$candidate" $unique_candidates
        or set -a unique_candidates "$candidate"
    end
    set candidates $unique_candidates

    set -l existing_candidates
    for candidate in $candidates
        if __gw_branch_exists "$anchor_repo" "$candidate"
            set -a existing_candidates "$candidate"
        end
    end

    if test (count $existing_candidates) -eq 0; and test -z "$branch_prefix"
        for candidate in (__gw_suffix_branch_candidates "$anchor_repo" "$raw_branch")
            contains -- "$candidate" $existing_candidates
            or set -a existing_candidates "$candidate"
        end
    end

    if test (count $existing_candidates) -eq 1
        printf '%s\n' "$existing_candidates[1]"
        return 0
    end

    if test (count $existing_candidates) -gt 1
        set -l candidates_with_worktrees
        for candidate in $existing_candidates
            set -l worktree_path (__gw_find_worktree_for_branch "$anchor_repo" "$candidate")
            if test -n "$worktree_path"
                set -a candidates_with_worktrees "$candidate"
            end
        end

        if test (count $candidates_with_worktrees) -eq 1
            printf '%s\n' "$candidates_with_worktrees[1]"
            return 0
        end

        __gw_prompt_branch_choice "$anchor_repo" $existing_candidates
        return $status
    end

    if test "$ignore_prefix" = 1
        printf '%s\n' "$raw_branch"
        return 0
    end

    if test "$raw_branch" = "$primary_branch"
        printf '%s\n' "$raw_branch"
        return 0
    end

    if test -n "$branch_prefix"
        set -l prefix_regex (string escape --style=regex -- "$branch_prefix")
        if string match -rq -- "^$prefix_regex" "$raw_branch"
            printf '%s\n' "$raw_branch"
        else
            printf '%s\n' "$branch_prefix$raw_branch"
        end
        return 0
    end

    printf '%s\n' "$raw_branch"
end

function __gw_detect_remote_head_from_url -a target
    set -l lines (command git ls-remote --symref "$target" HEAD 2>/dev/null)
    or return 1

    for line in $lines
        set -l branch_name (string match -r --groups-only '^ref: refs/heads/(.+)[[:space:]]+HEAD$' -- "$line")
        if test -n "$branch_name"
            printf '%s\n' "$branch_name"
            return 0
        end
    end

    return 1
end

function __gw_preferred_remote -a repo_path
    set -l remotes (command git -C "$repo_path" remote 2>/dev/null)
    or return 1

    if contains -- origin $remotes
        printf '%s\n' origin
        return 0
    end

    if test (count $remotes) -eq 1
        printf '%s\n' "$remotes[1]"
        return 0
    end

    __gw_err "could not determine which remote to use for $repo_path"
    return 1
end

function __gw_detect_remote_head_from_repo -a repo_path remote_name
    set -l lines (command git -C "$repo_path" ls-remote --symref "$remote_name" HEAD 2>/dev/null)
    or return 1

    for line in $lines
        set -l branch_name (string match -r --groups-only '^ref: refs/heads/(.+)[[:space:]]+HEAD$' -- "$line")
        if test -n "$branch_name"
            printf '%s\n' "$branch_name"
            return 0
        end
    end

    return 1
end

function __gw_sync_hooks_path -a source_repo target_repo
    set -l hooks_path (command git -C "$source_repo" config --get core.hooksPath 2>/dev/null)
    if test -z "$hooks_path"
        return 0
    end

    if string match -q -- '/*' "$hooks_path"
        return 0
    end

    set -l source_hooks "$source_repo/$hooks_path"
    if not test -d "$source_hooks"
        return 0
    end

    set -l target_hooks "$target_repo/$hooks_path"
    if test -f "$target_hooks/.gitignore"
        return 0
    end

    command mkdir -p "$target_hooks"
    or return 1

    command cp -R "$source_hooks/." "$target_hooks"
end

function __gw_write_config -a project_root primary_branch remote_name branch_prefix
    begin
        printf '%s\n' 'version=1'
        printf 'primary=%s\n' "$primary_branch"
        printf 'remote=%s\n' "$remote_name"
        printf '%s\n' 'path_style=flat-tilde'
        printf 'branch-prefix=%s\n' "$branch_prefix"
    end > "$project_root/.gw_project"
end

function __gw_help
    printf '%s\n' 'Usage:'
    printf '%s\n' '  gw list'
    printf '%s\n' '  gw switch [--ignore-prefix] [<branch>]'
    printf '%s\n' '  gw remove [--force] [--remote] [--ignore-prefix] <branch>'
    printf '%s\n' '  gw clone [--branch-prefix <prefix>] <project-name> <repo-url>'
    printf '%s\n' '  gw init [--branch-prefix <prefix>]'
    printf '%s\n' '  gw help'
end

function __gw_formatted_worktree_rows -a anchor_repo current_dir
    set -l markers
    set -l folder_names
    set -l branch_names
    set -l worktree_paths
    set -l max_folder_length 0

    for entry in (__gw_list_worktrees "$anchor_repo")
        set -l pair (string split -m 1 \t -- "$entry")
        if test (count $pair) -ne 2
            continue
        end

        set -l branch_name "$pair[1]"
        set -l worktree_path "$pair[2]"
        set -l folder_name "./"(path basename "$worktree_path")
        set -l marker ' '
        __gw_is_path_inside "$current_dir" "$worktree_path"
        and set marker '*'

        set -a markers "$marker"
        set -a folder_names "$folder_name"
        set -a branch_names "$branch_name"
        set -a worktree_paths "$worktree_path"

        set -l folder_length (string length -- "$folder_name")
        if test "$folder_length" -gt "$max_folder_length"
            set max_folder_length "$folder_length"
        end
    end

    for index in (seq (count $folder_names))
        set -l display_row (printf '%s %-*s -> %s' "$markers[$index]" "$max_folder_length" "$folder_names[$index]" "$branch_names[$index]")
        printf '%s\t%s\n' "$display_row" "$worktree_paths[$index]"
    end
end

function __gw_pick_worktree_path -a anchor_repo current_dir
    if not status is-interactive
        __gw_err 'gw switch without a branch requires an interactive terminal'
        return 1
    end

    if not test -r /dev/tty
        __gw_err 'gw switch without a branch requires a terminal'
        return 1
    end

    set -l picker_script (string join \n -- \
        'rows=()' \
        'paths=()' \
        'selected=0' \
        'rendered=' \
        "while IFS=\$'\\t' read -r display path; do" \
        '  [[ -n "$display" ]] || continue' \
        '  rows+=("$display")' \
        '  paths+=("$path")' \
        '  if [[ "${display:0:1}" == "*" ]]; then' \
        '    selected=$((${#rows[@]} - 1))' \
        '  fi' \
        'done' \
        '[[ ${#rows[@]} -gt 0 ]] || exit 1' \
        'render() {' \
        '  if [[ -n "$rendered" ]]; then' \
        '    printf "\033[%sA" "$rendered" > /dev/tty' \
        '  fi' \
        '  rendered=$((${#rows[@]} + 1))' \
        '  printf "\r\033[2K%s\n" "gw switch: use up/down arrows, Enter to switch, Esc to cancel" > /dev/tty' \
        '  for i in "${!rows[@]}"; do' \
        '    printf "\r\033[2K" > /dev/tty' \
        '    if [[ $i -eq $selected ]]; then' \
        '      printf "> %s\n" "${rows[$i]}" > /dev/tty' \
        '    else' \
        '      printf "  %s\n" "${rows[$i]}" > /dev/tty' \
        '    fi' \
        '  done' \
        '}' \
        'render' \
        'while true; do' \
        '  IFS= read -rsn1 key < /dev/tty || continue' \
        '  case "$key" in' \
        "    \"\"|\$'\\r'|\$'\\n')" \
        '      printf "%s\n" "${paths[$selected]}"' \
        '      exit 0' \
        '      ;;' \
        "    \$'\\e')" \
        '      IFS= read -rsn1 -t 0.1 next < /dev/tty || exit 0' \
        '      if [[ "$next" == "[" ]]; then' \
        '        IFS= read -rsn1 -t 0.1 final < /dev/tty || continue' \
        '        case "$final" in' \
        '          A)' \
        '            if [[ $selected -gt 0 ]]; then' \
        '              selected=$((selected - 1))' \
        '            fi' \
        '            render' \
        '            ;;' \
        '          B)' \
        '            if [[ $selected -lt $((${#rows[@]} - 1)) ]]; then' \
        '              selected=$((selected + 1))' \
        '            fi' \
        '            render' \
        '            ;;' \
        '        esac' \
        '      else' \
        '        exit 0' \
        '      fi' \
        '      ;;' \
        '  esac' \
        'done' | string collect)

    set -l selected_path (__gw_formatted_worktree_rows "$anchor_repo" "$current_dir" | command bash -c "$picker_script")
    set -l picker_status $status
    if test $picker_status -eq 1
        __gw_err 'no attached worktrees found'
        return 1
    end
    if test $picker_status -ne 0
        return 1
    end

    printf '%s\n' "$selected_path"
end

function __gw_cmd_list
    argparse --name='gw list' --strict-longopts --max-args=0 'h/help' -- $argv
    or return 1

    if set -ql _flag_help
        printf '%s\n' 'Usage: gw list'
        return 0
    end

    set -l project_root (__gw_find_project_root (pwd -P))
    if test -z "$project_root"
        __gw_err 'not inside a gw project'
        return 1
    end

    set -l anchor_repo (__gw_anchor_repo "$project_root")
    or return 1

    set -l current_dir (pwd -P)
    for entry in (__gw_formatted_worktree_rows "$anchor_repo" "$current_dir")
        set -l pair (string split -m 1 \t -- "$entry")
        if test (count $pair) -ne 2
            continue
        end

        printf '%s\n' "$pair[1]"
    end
end

function __gw_cmd_switch
    argparse --name='gw switch' --strict-longopts --max-args=1 'h/help' 'ignore-prefix' -- $argv
    or return 1

    if set -ql _flag_help
        printf '%s\n' 'Usage: gw switch [--ignore-prefix] [<branch>]'
        return 0
    end

    set -l project_root (__gw_find_project_root (pwd -P))
    if test -z "$project_root"
        __gw_err 'not inside a gw project'
        return 1
    end

    set -l anchor_repo (__gw_anchor_repo "$project_root")
    or return 1

    set -l ignore_prefix 0
    if set -ql _flag_ignore_prefix
        set ignore_prefix 1
    end

    if test (count $argv) -eq 0
        if test $ignore_prefix -eq 1
            __gw_err '--ignore-prefix requires a branch name'
            return 1
        end

        set -l selected_path (__gw_pick_worktree_path "$anchor_repo" (pwd -P))
        or return 1
        if test -z "$selected_path"
            return 0
        end

        cd "$selected_path"
        return 0
    end

    set -l raw_branch "$argv[1]"
    set -l folder_worktree (__gw_find_worktree_for_folder_name "$anchor_repo" "$raw_branch")
    if test -n "$folder_worktree"
        cd "$folder_worktree"
        return 0
    end

    set -l remote_name (__gw_remote_name "$project_root")
    set -l resolved_branch
    set -l remote_start_ref
    if __gw_branch_exists "$anchor_repo" "$raw_branch"
        set resolved_branch "$raw_branch"
    else if __gw_remote_branch_exists "$anchor_repo" "$remote_name" "$raw_branch"
        set resolved_branch "$raw_branch"
        set remote_start_ref "$remote_name/$raw_branch"
    else
        set resolved_branch (__gw_resolve_branch "$project_root" "$raw_branch" "$ignore_prefix")
        or return 1
    end

    set -l existing_worktree (__gw_find_worktree_for_branch "$anchor_repo" "$resolved_branch")
    if test -n "$existing_worktree"
        cd "$existing_worktree"
        return 0
    end

    set -l branch_prefix (__gw_branch_prefix "$project_root")
    set -l folder_name (__gw_encode_branch_path "$resolved_branch" "$branch_prefix")
    set -l target_path "$project_root/$folder_name"

    if test -e "$target_path"
        __gw_err "target path already exists: $target_path"
        return 1
    end

    if __gw_branch_exists "$anchor_repo" "$resolved_branch"
        command git -C "$anchor_repo" worktree add "$target_path" "$resolved_branch"
        or return 1
    else if test -n "$remote_start_ref"
        __gw_fetch_remote_branch_ref "$anchor_repo" "$remote_name" "$resolved_branch"
        or return 1

        command git -C "$anchor_repo" worktree add -b "$resolved_branch" "$target_path" "$remote_start_ref"
        or return 1

        command git -C "$target_path" branch --set-upstream-to="$remote_start_ref" "$resolved_branch" >/dev/null 2>/dev/null
    else
        set -l base_repo (__gw_current_repo "$project_root")
        if test -z "$base_repo"
            set base_repo "$anchor_repo"
        end

        command git -C "$base_repo" worktree add -b "$resolved_branch" "$target_path"
        or return 1
    end

    __gw_sync_hooks_path "$anchor_repo" "$target_path"
    or __gw_err "failed to sync hooks into new worktree: $target_path"

    cd "$target_path"
end

function __gw_cmd_remove
    argparse --name='gw remove' --strict-longopts --min-args=1 --max-args=1 'h/help' 'force' 'remote' 'ignore-prefix' -- $argv
    or return 1

    if set -ql _flag_help
        printf '%s\n' 'Usage: gw remove [--force] [--remote] [--ignore-prefix] <branch>'
        return 0
    end

    set -l project_root (__gw_find_project_root (pwd -P))
    if test -z "$project_root"
        __gw_err 'not inside a gw project'
        return 1
    end

    set -l anchor_repo (__gw_anchor_repo "$project_root")
    or return 1

    set -l ignore_prefix 0
    if set -ql _flag_ignore_prefix
        set ignore_prefix 1
    end

    set -l raw_branch "$argv[1]"
    set -l resolved_branch (__gw_resolve_branch "$project_root" "$raw_branch" "$ignore_prefix")
    or return 1

    set -l primary_branch (__gw_primary_branch "$project_root")
    or return 1
    if test "$resolved_branch" = "$primary_branch"
        __gw_err 'refusing to remove the primary branch'
        return 1
    end

    set -l existing_worktree (__gw_find_worktree_for_branch "$anchor_repo" "$resolved_branch")
    set -l branch_exists 0
    if __gw_branch_exists "$anchor_repo" "$resolved_branch"
        set branch_exists 1
    end

    if test $branch_exists -ne 1; and test -z "$existing_worktree"
        __gw_err "branch does not exist: $resolved_branch"
        return 1
    end

    if test -n "$existing_worktree"
        __gw_is_path_inside (pwd -P) "$existing_worktree"
        and begin
            __gw_err "cannot remove the current worktree while you are inside it: $existing_worktree"
            return 1
        end

        set -l remove_flags
        if set -ql _flag_force
            set remove_flags -f
        end

        command git -C "$anchor_repo" worktree remove $remove_flags "$existing_worktree"
        or return 1
    end

    if test $branch_exists -eq 1
        if set -ql _flag_force
            command git -C "$anchor_repo" branch -D "$resolved_branch"
        else
            command git -C "$anchor_repo" branch -d "$resolved_branch"
        end
        or return 1
    end

    if set -ql _flag_remote
        set -l remote_name (__gw_remote_name "$project_root")
        command git -C "$anchor_repo" push "$remote_name" ":$resolved_branch"
        or return 1
    end
end

function __gw_cmd_clone
    argparse --name='gw clone' --strict-longopts --min-args=2 --max-args=2 'h/help' 'branch-prefix=' -- $argv
    or return 1

    if set -ql _flag_help
        printf '%s\n' 'Usage: gw clone [--branch-prefix <prefix>] <project-name> <repo-url>'
        return 0
    end

    set -l project_name "$argv[1]"
    set -l repo_url "$argv[2]"
    set -l branch_prefix
    if set -ql _flag_branch_prefix
        set branch_prefix $_flag_branch_prefix[-1]
    end

    set -l current_dir (path resolve .)
    set -l project_root "$current_dir/$project_name"
    if test -e "$project_root"
        __gw_err "target directory already exists: $project_root"
        return 1
    end

    set -l primary_branch (__gw_detect_remote_head_from_url "$repo_url")
    if test -z "$primary_branch"
        __gw_err "could not detect the remote default branch for $repo_url"
        return 1
    end

    command mkdir -p "$project_root"
    or return 1

    set -l clone_target "$project_root/$primary_branch"
    command git clone "$repo_url" "$clone_target"
    or return 1

    __gw_write_config "$project_root" "$primary_branch" origin "$branch_prefix"
    or return 1

    cd "$clone_target"
end

function __gw_cmd_init
    argparse --name='gw init' --strict-longopts --max-args=0 'h/help' 'branch-prefix=' -- $argv
    or return 1

    if set -ql _flag_help
        printf '%s\n' 'Usage: gw init [--branch-prefix <prefix>]'
        return 0
    end

    set -l project_root (pwd -P)
    if test -f "$project_root/.gw_project"
        __gw_err ".gw_project already exists in $project_root"
        return 1
    end

    if command git rev-parse --show-toplevel >/dev/null 2>/dev/null
        __gw_err 'run gw init from the top-level project directory, not from inside a worktree'
        return 1
    end

    set -l child_repos
    for child_path in "$project_root"/*
        if not test -d "$child_path"
            continue
        end

        set -l resolved_child (path resolve "$child_path")
        set -l repo_top (command git -C "$resolved_child" rev-parse --show-toplevel 2>/dev/null)
        or continue

        set repo_top (path resolve "$repo_top")
        if test "$repo_top" = "$resolved_child"
            set -a child_repos "$resolved_child"
        end
    end

    if test (count $child_repos) -eq 0
        __gw_err 'found no child worktrees to initialize'
        return 1
    end

    set -l sample_repo "$child_repos[1]"
    set -l remote_name (__gw_preferred_remote "$sample_repo")
    or return 1

    set -l primary_branch (__gw_detect_remote_head_from_repo "$sample_repo" "$remote_name")
    if test -z "$primary_branch"
        __gw_err "could not detect the remote default branch from $remote_name"
        return 1
    end

    set -l primary_path "$project_root/$primary_branch"
    if not test -d "$primary_path"
        __gw_err "expected a child directory named after the default branch: $primary_branch"
        return 1
    end

    set -l primary_repo_top (command git -C "$primary_path" rev-parse --show-toplevel 2>/dev/null)
    or begin
        __gw_err "$primary_path is not a valid worktree"
        return 1
    end

    set primary_repo_top (path resolve "$primary_repo_top")
    if test "$primary_repo_top" != (path resolve "$primary_path")
        __gw_err "$primary_path is not a worktree root"
        return 1
    end

    set -l checked_out_branch (command git -C "$primary_path" symbolic-ref --quiet --short HEAD 2>/dev/null)
    if test "$checked_out_branch" != "$primary_branch"
        __gw_err "$primary_path is not checked out on $primary_branch"
        return 1
    end

    set -l branch_prefix
    if set -ql _flag_branch_prefix
        set branch_prefix $_flag_branch_prefix[-1]
    end

    __gw_write_config "$project_root" "$primary_branch" "$remote_name" "$branch_prefix"
end

function gw --description 'Manage git worktree projects'
    if test (count $argv) -eq 0
        __gw_help
        return 0
    end

    set -l command_name "$argv[1]"
    set -e argv[1]

    switch "$command_name"
        case help -h --help
            __gw_help
        case list
            __gw_cmd_list $argv
        case switch
            __gw_cmd_switch $argv
        case remove rm
            __gw_cmd_remove $argv
        case clone
            __gw_cmd_clone $argv
        case init
            __gw_cmd_init $argv
        case '*'
            __gw_err "unknown subcommand: $command_name"
            __gw_help >&2
            return 1
    end
end
