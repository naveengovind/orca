import {
  connectRegisteredSshTarget,
  getRegisteredSshState,
  listRegisteredRemovedSshTargetLabels,
  listRegisteredSshTargets
} from '../../../ssh/ssh-target-registry'
import { defineMethod } from '../core'
import { getPublicSshError, getPublicSshState } from '../../public-ssh-state'
import type { SshTargetSummary } from '../../../../shared/ssh-types'
import {
  SshPortForwardCreate,
  SshPortForwardRemove,
  SshPortForwardUpdate,
  SshTarget
} from '../../../../shared/rpc-contract/ssh-params'
import {
  addRegisteredPortForward,
  listRegisteredDetectedPorts,
  listRegisteredPortForwards,
  removeRegisteredPortForward,
  updateRegisteredPortForward
} from '../../../ssh/ssh-port-forward-registry'

// Why: `generation` stays optional on the wire — an old server simply omits it and its rows key on target id alone.
function listRegisteredSshTargetSummaries(): SshTargetSummary[] {
  return listRegisteredSshTargets().map(({ id, label, generation }) => {
    const state = getRegisteredSshState(id)
    const remotePlatform = state?.remotePlatform
    return {
      id,
      label,
      ...(generation === undefined ? {} : { generation }),
      connected: state?.status === 'connected',
      ...(state?.status === undefined ? {} : { connectionStatus: state.status }),
      ...(remotePlatform === undefined ? {} : { remotePlatform })
    }
  })
}

export const SSH_METHODS = [
  defineMethod({
    name: 'ssh.getState',
    params: SshTarget,
    handler: (params) => ({
      state: getPublicSshState(getRegisteredSshState(params.targetId) ?? null)
    })
  }),
  defineMethod({
    name: 'ssh.connect',
    params: SshTarget,
    handler: async (params) => {
      try {
        return { state: getPublicSshState(await connectRegisteredSshTarget(params.targetId)) }
      } catch {
        const state = getRegisteredSshState(params.targetId)
        throw new Error(getPublicSshError(state?.status ?? 'error'))
      }
    }
  }),
  defineMethod({
    name: 'ssh.listTargets',
    params: null,
    // Why: legacy clients can call this method directly, so it must preserve the same HUB-private secret boundary.
    handler: () => ({ targets: listRegisteredSshTargetSummaries() })
  }),
  defineMethod({
    name: 'ssh.listTargetSummaries',
    params: null,
    // Why: paired clients need display identity only; SSH addresses, jump chains, and credentials remain HUB-private.
    handler: () => ({ targets: listRegisteredSshTargetSummaries() })
  }),
  defineMethod({
    name: 'ssh.listRemovedTargetLabels',
    params: null,
    handler: () => ({ labels: listRegisteredRemovedSshTargetLabels() })
  }),
  defineMethod({
    name: 'ssh.addPortForward',
    params: SshPortForwardCreate,
    handler: (params) => addRegisteredPortForward(params)
  }),
  defineMethod({
    name: 'ssh.updatePortForward',
    params: SshPortForwardUpdate,
    handler: (params) => updateRegisteredPortForward(params)
  }),
  defineMethod({
    name: 'ssh.removePortForward',
    params: SshPortForwardRemove,
    handler: async (params) => ({ entry: await removeRegisteredPortForward(params.id) })
  }),
  defineMethod({
    name: 'ssh.listPortForwards',
    params: SshTarget,
    handler: (params) => ({ forwards: listRegisteredPortForwards(params.targetId) })
  }),
  defineMethod({
    name: 'ssh.listDetectedPorts',
    params: SshTarget,
    handler: (params) => ({ ports: listRegisteredDetectedPorts(params.targetId) })
  })
]
