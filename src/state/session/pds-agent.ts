import {Agent} from '@atproto/api'

const pdsAgents = new WeakMap<Agent, Agent>()

/**
 * Returns an authenticated agent that sends requests directly to the account's
 * PDS. Actor preferences are stored on the PDS and are not AppView methods.
 */
export function getPdsAgent(agent: Agent): Agent {
  let pdsAgent = pdsAgents.get(agent)
  if (!pdsAgent) {
    pdsAgent = agent.clone()
    pdsAgent.configureProxy(null)
    pdsAgents.set(agent, pdsAgent)
  }
  return pdsAgent
}
