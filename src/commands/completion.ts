import type { Command } from 'commander';

import { loadProjectContext } from '@/commands/shared';
import {
  buildCompletionCandidates,
  needsWorktreeCompletion,
  normalizeCompletionWords,
  type CompletionCandidate,
} from '@/core/completion';
import { getBranchPrefix, getPrimaryBranch } from '@/core/config';
import { listWorktrees } from '@/core/worktrees';

function normalizeVariadicWords(
  words: string[] | string | undefined
): string[] {
  if (Array.isArray(words)) {
    return words;
  }

  if (typeof words === 'string') {
    return [words];
  }

  return [];
}

function sanitizeCompletionField(value: string): string {
  return value.replace(/[\t\r\n]/gu, ' ');
}

function formatCompletionCandidate(candidate: CompletionCandidate): string {
  const value = sanitizeCompletionField(candidate.value);
  const description = candidate.description
    ? sanitizeCompletionField(candidate.description)
    : '';

  return description ? `${value}\t${description}` : value;
}

export function registerCompletionCommand(program: Command): void {
  program
    .command('__complete', { hidden: true })
    .allowUnknownOption()
    .allowExcessArguments()
    .argument('[words...]')
    .action(async (words: string[] | string | undefined) => {
      try {
        const completedWords = normalizeCompletionWords(
          normalizeVariadicWords(words)
        );
        const request = {
          completedWords,
          current: process.env.GW_COMPLETE_CURRENT || '',
        };
        const data = needsWorktreeCompletion(request)
          ? await (async () => {
              const context = await loadProjectContext();
              return {
                branchPrefix: getBranchPrefix(context.config),
                primaryBranch: getPrimaryBranch(
                  context.config,
                  context.projectRoot
                ),
                worktrees: await listWorktrees(context.anchorRepo),
              };
            })()
          : undefined;
        const candidates = buildCompletionCandidates(request, data);

        if (candidates.length > 0) {
          process.stdout.write(
            `${candidates.map(formatCompletionCandidate).join('\n')}\n`
          );
        }
      } catch {
        // Completion should never interrupt the user's prompt.
      }
    });
}
