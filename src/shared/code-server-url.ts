// Default base URL for the chromeless code-server tab. Overridable via the
// Browser settings pane (persisted ui state `codeServerUrl`). Client-local
// webviews load it directly; remote worktrees rely on a local port forward.
export const DEFAULT_CODE_SERVER_URL = 'http://127.0.0.1:13337'
