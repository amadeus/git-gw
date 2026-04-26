export interface PullRequestHead {
  headRefName: string;
  headRepositoryOwner: string;
}

export function derivePullRequestRemoteUrl(
  baseRemoteUrl: string,
  headRepositoryOwner: string
): string {
  const urlMatch = /^([A-Za-z][A-Za-z0-9+.-]*:\/\/[^/]+\/)([^/]+)\/(.+)$/u.exec(
    baseRemoteUrl
  );
  if (urlMatch) {
    return `${urlMatch[1]}${headRepositoryOwner}/${urlMatch[3]}`;
  }

  const scpMatch = /^([^@]+@[^:]+:)([^/]+)\/(.+)$/u.exec(baseRemoteUrl);
  if (scpMatch) {
    return `${scpMatch[1]}${headRepositoryOwner}/${scpMatch[3]}`;
  }

  throw new Error(`unsupported remote URL: ${baseRemoteUrl}`);
}

export function choosePullRequestRemoteName(
  headRepositoryOwner: string,
  existingRemotes: string[]
): string {
  const baseName = headRepositoryOwner.toLowerCase();
  if (!existingRemotes.includes(baseName)) {
    return baseName;
  }

  const prName = `${baseName}-pr`;
  if (!existingRemotes.includes(prName)) {
    return prName;
  }

  let suffix = 2;
  while (existingRemotes.includes(`${prName}-${suffix}`)) {
    suffix += 1;
  }

  return `${prName}-${suffix}`;
}
