/** Fetches a manifest from a public GitHub repository via raw.githubusercontent.com. */

const CANDIDATES = ['package-lock.json', 'package.json', 'requirements.txt'];

export interface RepoRef {
  owner: string;
  repo: string;
  ref: string;
  /** Folder inside the repo, '' or ending in '/' */
  dir: string;
}

export function parseRepo(input: string): RepoRef | null {
  const text = input.trim().replace(/\.git$/, '').replace(/\/+$/, '');
  const url = text.match(/github\.com[/:]([^/\s]+)\/([^/\s#?]+)(?:\/(?:tree|blob)\/([^/\s]+)(?:\/(.*))?)?/i);
  if (url) {
    let dir = url[4] || '';
    // A link straight to a manifest: scan the folder it lives in
    if (CANDIDATES.some(c => dir === c || dir.endsWith(`/${c}`))) dir = dir.slice(0, dir.lastIndexOf('/') + 1);
    if (dir && !dir.endsWith('/')) dir += '/';
    return { owner: url[1], repo: url[2], ref: url[3] || 'HEAD', dir };
  }
  const short = text.match(/^([\w.-]+)\/([\w.-]+)$/);
  return short ? { owner: short[1], repo: short[2], ref: 'HEAD', dir: '' } : null;
}

export async function fetchManifest(ref: RepoRef): Promise<{ file: File; label: string; url: string }> {
  const base = `https://raw.githubusercontent.com/${ref.owner}/${ref.repo}/${ref.ref}/${ref.dir}`;
  // Prefer the lockfile: it pins exact versions, so the scan matches what is installed
  for (const name of CANDIDATES) {
    let res: Response;
    try {
      res = await fetch(base + name);
    } catch {
      throw new Error('Couldn’t reach GitHub. Check your connection and try again.');
    }
    if (res.ok) {
      const text = await res.text();
      return {
        file: new File([text], name, { type: name.endsWith('.json') ? 'application/json' : 'text/plain' }),
        label: `${ref.owner}/${ref.repo}${ref.dir ? `/${ref.dir.replace(/\/$/, '')}` : ''}`,
        url: `https://github.com/${ref.owner}/${ref.repo}`,
      };
    }
  }
  throw new Error(
    `No package-lock.json, package.json or requirements.txt in ${ref.owner}/${ref.repo}${ref.dir ? `/${ref.dir}` : ''}. ` +
    'Only public repositories can be scanned.'
  );
}
