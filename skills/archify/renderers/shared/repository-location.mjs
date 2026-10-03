// Repository identity and forge links are independent of local Git object checks.
// This module never contacts a remote server or reads the user's SSH config.

const FORBIDDEN_REMOTE_CHARS = /[\s\\\u0000-\u001f\u007f?#]/;
const FORBIDDEN_SEGMENT_CHARS = /[/\\\s\u0000-\u001f\u007f?#]/;

function normalizeRemoteInput(value, authored) {
  if (typeof value !== 'string') return null;
  const raw = authored ? value : value.trim();
  if (!raw || FORBIDDEN_REMOTE_CHARS.test(raw)) return null;
  return raw;
}

function expandScpRemote(raw) {
  const scp = raw.match(/^git@([^/:]+):(.+)$/);
  if (!scp) return { scp: null, scpAbsolute: false, expanded: raw };
  return {
    scp,
    scpAbsolute: scp[2].startsWith('/'),
    expanded: `ssh://git@${scp[1]}/${scp[2].replace(/^\//, '')}`,
  };
}

function pathSegmentsFromRemote(pathPart, decodePercent) {
  try {
    let segments = pathPart.replace(/\/$/, '').split('/');
    // Git passes SCP paths literally; percent escapes are decoded only in URIs.
    if (decodePercent) segments = segments.map(decodeURIComponent);
    if (segments.some((part) => !part || part === '.' || part === '..' || FORBIDDEN_SEGMENT_CHARS.test(part))) {
      return null;
    }
    return segments;
  }
  catch {
    return null;
  }
}

function parseExpandedRemoteUrl(expanded, authored) {
  let url;
  try { url = new URL(expanded); } catch { return null; }
  const protocol = url.protocol;
  if (protocol === 'ssh:' && (url.username !== 'git' || url.password)) return null;
  if (authored && protocol !== 'ssh:' && (url.username || url.password)) return null;
  const hostname = url.hostname.toLowerCase();
  if (!hostname) return null;
  return { url, protocol, hostname };
}

function forgeProviderForHostname(hostname) {
  if (hostname === 'github.com') return 'github';
  if (hostname === 'gitee.com') return 'gitee';
  return null;
}

function normalizeRepositorySegments(segments, provider) {
  const next = segments.slice();
  const last = next.length - 1;
  if (provider) next[last] = next[last].replace(provider === 'github' ? /\.git$/i : /\.git$/, '');
  if (!next[last] || next[last] === '.' || next[last] === '..') return null;
  return next;
}

function remoteEndpoint(protocol, port, provider) {
  const resolvedPort = port || (protocol === 'ssh:' ? '22' : protocol === 'https:' ? '443' : '80');
  // Only known forges map HTTPS and SSH to one repository namespace. Other
  // hosts retain transport, port and remote-relative/absolute path semantics.
  if (provider && ((protocol === 'https:' && resolvedPort === '443') || (protocol === 'ssh:' && resolvedPort === '22'))) {
    return 'standard';
  }
  return `${protocol}${resolvedPort}`;
}

function remotePathKind(provider, scp, scpAbsolute) {
  if (provider) return 'repository';
  return scp && !scpAbsolute ? 'relative' : 'absolute';
}

function canonicalRemoteUrl({ scp, scpAbsolute, hostname, repositoryPath, protocol, host, encodedPath }) {
  if (scp) return `git@${hostname}:${scpAbsolute ? '/' : ''}${repositoryPath}`;
  return `${protocol}//${protocol === 'ssh:' ? 'git@' : ''}${host}/${encodedPath}`;
}

export function parseRepositoryRemote(value, { authored = false } = {}) {
  const raw = normalizeRemoteInput(value, authored);
  if (!raw) return null;
  const { scp, scpAbsolute, expanded } = expandScpRemote(raw);
  const match = expanded.match(/^(https?|ssh):\/\/([^/]+)\/(.+)$/i);
  if (!match) return null;
  // Validate the original path before URL parsing can collapse dot segments.
  const segments = pathSegmentsFromRemote(match[3], !scp);
  if (!segments) return null;
  const parsed = parseExpandedRemoteUrl(expanded, authored);
  if (!parsed) return null;
  const { url, protocol, hostname } = parsed;
  const provider = forgeProviderForHostname(hostname);
  const normalized = normalizeRepositorySegments(segments, provider);
  if (!normalized) return null;
  const repositoryPath = normalized.join('/');
  const endpoint = remoteEndpoint(protocol, url.port, provider);
  const pathKind = remotePathKind(provider, scp, scpAbsolute);
  // path-contract-allow: url-path -- GitHub repository names are case-insensitive URL identities.
  const identityPath = provider === 'github' ? repositoryPath.toLowerCase() : repositoryPath;
  const encodedPath = normalized.map(encodeURIComponent).join('/');
  const canonicalUrl = canonicalRemoteUrl({
    scp,
    scpAbsolute,
    hostname,
    repositoryPath,
    protocol,
    host: url.host,
    encodedPath,
  });
  return {
    identity: JSON.stringify([hostname, endpoint, pathKind, identityPath]),
    url: canonicalUrl,
    provider,
    protocol,
    path: repositoryPath,
    endpoint,
  };
}

export function redactRepositoryRemote(value) {
  return String(value || '')
    .replace(/^((?:https?|ssh):\/\/)[^/]*@/i, '$1REDACTED@')
    .replace(/[?#].*$/s, '?REDACTED');
}

export function repositorySourceHref(provider, url, revision, source) {
  const encodedPath = source.path.split('/').map(encodeURIComponent).join('/');
  const end = source.endLine && source.endLine !== source.line
    ? `-${provider === 'github' ? 'L' : ''}${source.endLine}` : '';
  const fragment = source.line ? `#L${source.line}${end}` : '';
  return `${url}/blob/${revision}/${encodedPath}${fragment}`;
}
