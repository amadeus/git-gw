import { type WorktreeEntry } from '@/core/worktrees';

export interface CompletionCandidate {
  value: string;
  description?: string;
}

export interface CompletionRequest {
  completedWords: string[];
  current: string;
}

export interface CompletionData {
  branchPrefix?: string;
  primaryBranch?: string;
  worktrees?: WorktreeEntry[];
}

const ROOT_COMMANDS: CompletionCandidate[] = [
  { value: 'list', description: 'List worktrees' },
  { value: 'switch', description: 'Switch to an existing worktree' },
  { value: 'pr', description: 'Check out a pull request' },
  { value: 'remove', description: 'Remove a worktree' },
  { value: 'rm', description: 'Alias for remove' },
  { value: 'clone', description: 'Clone into a gw project' },
  { value: 'init', description: 'Initialize a gw project' },
  { value: 'shell-init', description: 'Print shell integration' },
  { value: 'setup', description: 'Configure shell integration' },
  { value: 'help', description: 'Show help' },
];

const ROOT_OPTIONS: CompletionCandidate[] = [
  { value: '--version', description: 'Print version' },
  { value: '-v', description: 'Print version' },
  { value: '--help', description: 'Show help' },
  { value: '-h', description: 'Show help' },
];

const SWITCH_OPTIONS: CompletionCandidate[] = [
  {
    value: '--ignore-prefix',
    description: 'Ignore branch prefix resolution',
  },
];

const REMOVE_OPTIONS: CompletionCandidate[] = [
  { value: '--force', description: 'Force removal' },
  { value: '--remote', description: 'Delete the remote branch' },
  { value: '--worktree', description: 'Only remove the worktree' },
  { value: '-w', description: 'Only remove the worktree' },
  {
    value: '--ignore-prefix',
    description: 'Ignore branch prefix resolution',
  },
];

const OPTION_ALIASES = new Map<string, string>([['-w', '--worktree']]);
const WORKTREE_COMPLETION_COMMANDS = new Set(['switch', 'remove', 'rm']);

function isGwCommandWord(word: string): boolean {
  return word === 'gw' || word.endsWith('/gw');
}

function filterByCurrent(
  candidates: CompletionCandidate[],
  current: string
): CompletionCandidate[] {
  return candidates.filter((candidate) => candidate.value.startsWith(current));
}

function hasOption(words: string[], option: string): boolean {
  const canonicalOption = OPTION_ALIASES.get(option) || option;
  return words.some(
    (word) => (OPTION_ALIASES.get(word) || word) === canonicalOption
  );
}

function filterUsedOptions(
  candidates: CompletionCandidate[],
  completedWords: string[]
): CompletionCandidate[] {
  return candidates.filter(
    (candidate) => !hasOption(completedWords, candidate.value)
  );
}

function getBranchArguments(words: string[]): string[] {
  const args: string[] = [];
  let endOfOptions = false;

  for (const word of words) {
    if (!endOfOptions && word === '--') {
      endOfOptions = true;
      continue;
    }

    if (!endOfOptions && word.startsWith('-')) {
      continue;
    }

    args.push(word);
  }

  return args;
}

function getCommandOptions(command: string): CompletionCandidate[] {
  switch (command) {
    case 'switch':
      return SWITCH_OPTIONS;
    case 'remove':
    case 'rm':
      return REMOVE_OPTIONS;
    default:
      return [];
  }
}

function getDisplayBranchName(
  branchName: string,
  branchPrefix: string,
  ignorePrefix: boolean
): string {
  if (
    ignorePrefix ||
    branchPrefix === '' ||
    !branchName.startsWith(branchPrefix)
  ) {
    return branchName;
  }

  const stripped = branchName.slice(branchPrefix.length);
  return stripped || branchName;
}

function getWorktreeBranchCandidates(options: {
  command: string;
  worktrees: WorktreeEntry[];
  primaryBranch: string;
  branchPrefix: string;
  ignorePrefix: boolean;
}): CompletionCandidate[] {
  const worktrees =
    options.command === 'switch'
      ? options.worktrees
      : options.worktrees.filter(
          (worktree) => worktree.branchName !== options.primaryBranch
        );
  const proposedValues = worktrees.map((worktree) =>
    getDisplayBranchName(
      worktree.branchName,
      options.branchPrefix,
      options.ignorePrefix
    )
  );
  const proposedCounts = new Map<string, number>();

  for (const value of proposedValues) {
    proposedCounts.set(value, (proposedCounts.get(value) || 0) + 1);
  }

  return worktrees.map((worktree, index) => {
    const proposedValue = proposedValues[index];
    const value =
      proposedCounts.get(proposedValue) === 1
        ? proposedValue
        : worktree.branchName;

    return {
      value,
      description: 'existing worktree',
    };
  });
}

export function normalizeCompletionWords(rawWords: string[]): string[] {
  if (rawWords.length === 0) {
    return [];
  }

  return isGwCommandWord(rawWords[0]) ? rawWords.slice(1) : rawWords;
}

export function needsWorktreeCompletion(request: CompletionRequest): boolean {
  const [command, ...commandWords] = request.completedWords;
  if (!command || !WORKTREE_COMPLETION_COMMANDS.has(command)) {
    return false;
  }

  if (request.current.startsWith('-')) {
    return false;
  }

  return getBranchArguments(commandWords).length === 0;
}

export function buildCompletionCandidates(
  request: CompletionRequest,
  data: CompletionData = {}
): CompletionCandidate[] {
  const [command, ...commandWords] = request.completedWords;

  if (!command) {
    return filterByCurrent(
      request.current.startsWith('-') ? ROOT_OPTIONS : ROOT_COMMANDS,
      request.current
    );
  }

  if (!WORKTREE_COMPLETION_COMMANDS.has(command)) {
    return [];
  }

  const commandOptions = getCommandOptions(command);
  if (request.current.startsWith('-')) {
    return filterByCurrent(
      filterUsedOptions(commandOptions, commandWords),
      request.current
    );
  }

  if (getBranchArguments(commandWords).length > 0) {
    return [];
  }

  if (!data.worktrees || !data.primaryBranch) {
    return [];
  }

  return filterByCurrent(
    getWorktreeBranchCandidates({
      command,
      worktrees: data.worktrees,
      primaryBranch: data.primaryBranch,
      branchPrefix: data.branchPrefix || '',
      ignorePrefix: hasOption(commandWords, '--ignore-prefix'),
    }),
    request.current
  );
}
