import { defaultRegistry } from '@/lib/agents/registry';
import { getAvailableProviders } from '@/lib/ai/factory';

async function auditAgents() {
  console.log("================================================================================");
  console.log("                    AUREN AI AGENT FLEET STATUS AUDIT                           ");
  console.log("================================================================================");

  const agents = defaultRegistry.getAllAgents();
  console.log(`\nActive Autonomous Agents: ${agents.length}`);

  for (const agent of agents) {
    console.log(`\n================================================================================`);
    console.log(`[AGENT] ${agent.name} (ID: '${agent.id}')`);
    console.log(`Role: ${agent.description}`);
    console.log(`Capabilities (${agent.capabilities.length}):`);
    for (const cap of agent.capabilities) {
      console.log(`  * ${cap}`);
    }
    console.log(`Registered Tools (${agent.tools.length}):`);
    for (const tool of agent.tools) {
      const approval = tool.requiresHumanApproval ? " [APPROVAL REQUIRED]" : "";
      const mutation = tool.isMutation ? " [MUTATION]" : "";
      console.log(`  > ${tool.name}${approval}${mutation}`);
      console.log(`    - ${tool.description}`);
    }
  }

  console.log("\n================================================================================");
  console.log("                   CENTRAL ORCHESTRATOR & PROVIDERS                            ");
  console.log("================================================================================");
  try {
    const providers = getAvailableProviders();
    console.log("Configured LLM Providers:");
    for (const p of providers) {
      console.log(`  - ${p.id.toUpperCase()}: ${p.name} | Configured: ${p.configured} | Default Model: ${p.defaultModel}`);
    }
  } catch (err) {
    console.log("Provider check error:", err);
  }
}

auditAgents().catch(console.error);
