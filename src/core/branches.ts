import { branchExists, listLocalBranches } from '@/core/git';
import {
  findWorktreeForBranch,
  listWorktrees,
  type WorktreeEntry,
} from '@/core/worktrees';

export interface BranchResolutionCandidate {
  branchName: string;
  worktreePath?: string;
}

export type BranchResolution =
  | {
      status: 'resolved';
      branchName: string;
    }
  | {
      status: 'ambiguous';
      candidates: BranchResolutionCandidate[];
    };

export interface ResolveBranchNameOptions {
  repoPath: string;
  rawBranch: string;
  primaryBranch: string;
  branchPrefix?: string;
  ignorePrefix?: boolean;
  worktrees?: WorktreeEntry[];
}

function uniqueBranches(branchNames: string[]): string[] {
  return [...new Set(branchNames)];
}

function hasBranchPrefix(branchName: string, branchPrefix: string): boolean {
  return branchPrefix !== '' && branchName.startsWith(branchPrefix);
}

export function stripBranchPrefix(
  branchName: string,
  branchPrefix: string
): string {
  if (!hasBranchPrefix(branchName, branchPrefix)) {
    return branchName;
  }

  return branchName.slice(branchPrefix.length);
}

export function encodeBranchPath(
  branchName: string,
  branchPrefix: string
): string {
  return stripBranchPrefix(branchName, branchPrefix).replaceAll('/', '~');
}

export function findSuffixBranchCandidates(
  branchNames: string[],
  rawBranch: string
): string[] {
  return branchNames.filter((branchName) => {
    const separatorIndex = branchName.indexOf('/');
    if (separatorIndex === -1) {
      return false;
    }

    return branchName.slice(separatorIndex + 1) === rawBranch;
  });
}

async function getExistingCandidates(
  repoPath: string,
  branchNames: string[]
): Promise<string[]> {
  const matches: string[] = [];

  for (const branchName of branchNames) {
    if (await branchExists(repoPath, branchName)) {
      matches.push(branchName);
    }
  }

  return matches;
}

async function buildAmbiguousCandidates(
  repoPath: string,
  branchNames: string[],
  worktrees?: WorktreeEntry[]
) {
  const repoWorktrees = worktrees || (await listWorktrees(repoPath));

  return branchNames.map((branchName) => {
    const worktreePath =
      findWorktreeForBranch(repoWorktrees, branchName) || undefined;
    return {
      branchName,
      worktreePath,
    };
  });
}

export async function resolveBranchName(
  options: ResolveBranchNameOptions
): Promise<BranchResolution> {
  const branchPrefix = options.branchPrefix || '';
  const ignorePrefix = options.ignorePrefix || false;

  const candidateBranches = uniqueBranches(
    ignorePrefix
      ? [options.rawBranch]
      : hasBranchPrefix(options.rawBranch, branchPrefix)
        ? [options.rawBranch]
        : branchPrefix
          ? [branchPrefix + options.rawBranch, options.rawBranch]
          : [options.rawBranch]
  );

  let existingCandidates = await getExistingCandidates(
    options.repoPath,
    candidateBranches
  );
  if (existingCandidates.length === 0 && branchPrefix === '') {
    existingCandidates = uniqueBranches(
      findSuffixBranchCandidates(
        await listLocalBranches(options.repoPath),
        options.rawBranch
      )
    );
  }

  if (existingCandidates.length === 1) {
    return {
      status: 'resolved',
      branchName: existingCandidates[0],
    };
  }

  if (existingCandidates.length > 1) {
    const ambiguousCandidates = await buildAmbiguousCandidates(
      options.repoPath,
      existingCandidates,
      options.worktrees
    );
    const candidatesWithWorktrees = ambiguousCandidates.filter(
      (candidate) => candidate.worktreePath
    );

    if (candidatesWithWorktrees.length === 1) {
      return {
        status: 'resolved',
        branchName: candidatesWithWorktrees[0].branchName,
      };
    }

    return {
      status: 'ambiguous',
      candidates: ambiguousCandidates,
    };
  }

  if (ignorePrefix || options.rawBranch === options.primaryBranch) {
    return {
      status: 'resolved',
      branchName: options.rawBranch,
    };
  }

  if (branchPrefix) {
    return {
      status: 'resolved',
      branchName: hasBranchPrefix(options.rawBranch, branchPrefix)
        ? options.rawBranch
        : branchPrefix + options.rawBranch,
    };
  }

  return {
    status: 'resolved',
    branchName: options.rawBranch,
  };
}
