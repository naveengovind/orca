import { useAppStore } from '@/store'

/** Pull the host's forwards into the renderer. The web client has no IPC push. */
export async function syncSshPortForwards(targetId: string): Promise<void> {
  const forwards = await window.api.ssh.listPortForwards({ targetId })
  useAppStore.getState().setPortForwards(targetId, forwards)
}
