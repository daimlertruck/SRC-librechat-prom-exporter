import client from 'prom-client';
import {
    Message,
    Banner,
    File,
    Agent,
    User,
    Session,
    PromptGroup,
    Prompt,
    ToolCall,
    Conversation,
    Transaction,
    Action
} from '../models';

export const advancedGauges = {
    // Message metrics
    messageTokenSum: new client.Gauge({
        name: 'librechat_message_token_sum',
        help: 'Sum of tokenCount for all messages'
    }),
    messageTokenAvg: new client.Gauge({
        name: 'librechat_message_token_avg',
        help: 'Average tokenCount for messages'
    }),
    errorMessageCount: new client.Gauge({
        name: 'librechat_error_message_count',
        help: 'Count of messages with error'
    }),
    messageWithAttachmentsCount: new client.Gauge({
        name: 'librechat_message_with_attachments_count',
        help: 'Count of messages with attachments'
    }),
    messagePluginUsagePercent: new client.Gauge({
        name: 'librechat_message_plugin_usage_percent',
        help: 'Percentage of messages that use a plugin'
    }),

    // Banner metrics
    activeBannerCount: new client.Gauge({
        name: 'librechat_active_banner_count',
        help: 'Count of banners currently active'
    }),

    // File metrics
    fileTotalBytes: new client.Gauge({
        name: 'librechat_file_total_bytes',
        help: 'Total bytes of all files'
    }),
    fileAvgBytes: new client.Gauge({
        name: 'librechat_file_avg_bytes',
        help: 'Average file size in bytes'
    }),

    // Agent metrics
    agentModelCount: new client.Gauge({
        name: 'librechat_agent_model_count',
        help: 'Count of agents by model',
        labelNames: ['model']
    }),

    // User metrics
    userProviderCount: new client.Gauge({
        name: 'librechat_user_provider_count',
        help: 'Count of users by provider',
        labelNames: ['provider']
    }),
    activeUserCount: new client.Gauge({
        name: 'librechat_active_users',
        help: 'Number of active users within the last 5 minutes'
    }),

    // Session metrics
    sessionAvgDuration: new client.Gauge({
        name: 'librechat_session_avg_duration',
        help: 'Average session duration in seconds'
    }),

    // Prompt Group metrics
    promptGroupGenerationsAvg: new client.Gauge({
        name: 'librechat_prompt_group_generations_avg',
        help: 'Average number of generations in prompt groups'
    }),

    // Prompt metrics
    promptCountByType: new client.Gauge({
        name: 'librechat_prompt_count_by_type',
        help: 'Count of prompts by type',
        labelNames: ['type']
    }),

    // Tool Call metrics
    toolCallCountByTool: new client.Gauge({
        name: 'librechat_tool_call_count_by_tool',
        help: 'Count of tool calls by toolId',
        labelNames: ['toolId']
    }),

    // Conversation metrics
    conversationMessageAvg: new client.Gauge({
        name: 'librechat_conversation_message_avg',
        help: 'Average number of messages per conversation'
    }),

    // Transaction metrics
    transactionCostSum: new client.Gauge({
        name: 'librechat_transaction_cost_sum',
        help: 'Sum of raw transaction amounts by token type',
        labelNames: ['tokenType']
    }),
    transactionCostAvg: new client.Gauge({
        name: 'librechat_transaction_cost_avg',
        help: 'Average raw transaction amount by token type',
        labelNames: ['tokenType']
    }),

    // Action metrics
    actionCountByType: new client.Gauge({
        name: 'librechat_action_count_by_type',
        help: 'Count of actions by type',
        labelNames: ['type']
    }),

    // Deployed models metrics (using the Message model and Agent lookup)
    deployedModelUsageCount: new client.Gauge({
        name: 'librechat_deployed_model_usage_count',
        help: 'Usage count for each deployed agent model as indicated by the Message model (using agent name)',
        labelNames: ['model']
    }),
    deployedModelNamesCount: new client.Gauge({
        name: 'librechat_deployed_model_names_count',
        help: 'Total number of distinct deployed agent model names found in messages'
    }),
};

export async function updateAdvancedMetrics(): Promise<void> {
    try {
        // Message metrics: sum and average tokenCount
        const tokenSumAgg = await Message.aggregate([
            { $group: { _id: null, total: { $sum: '$tokenCount' } } }
        ]);
        advancedGauges.messageTokenSum.set(tokenSumAgg[0]?.total || 0);

        const tokenAvgAgg = await Message.aggregate([
            { $group: { _id: null, avg: { $avg: '$tokenCount' } } }
        ]);
        advancedGauges.messageTokenAvg.set(tokenAvgAgg[0]?.avg || 0);

        // Error message count
        const errorCount = await Message.countDocuments({ error: true });
        advancedGauges.errorMessageCount.set(errorCount);

        // Messages with attachments
        const msgWithAttachCount = await Message.countDocuments({ attachments: { $exists: true, $ne: [] } });
        advancedGauges.messageWithAttachmentsCount.set(msgWithAttachCount);

        // Percentage of messages with plugin usage
        const totalMsgCount = await Message.countDocuments({});
        const pluginUsageCount = await Message.countDocuments({ plugin: { $exists: true, $ne: null } });
        const pluginUsagePercent = totalMsgCount > 0 ? (pluginUsageCount / totalMsgCount) * 100 : 0;
        advancedGauges.messagePluginUsagePercent.set(pluginUsagePercent);

        // Active banners (displayFrom <= now and (displayTo is null or >= now))
        const now = new Date();
        const activeBanners = await Banner.countDocuments({
            displayFrom: { $lte: now },
            $or: [{ displayTo: null }, { displayTo: { $gte: now } }]
        });
        advancedGauges.activeBannerCount.set(activeBanners);

        // File metrics: total bytes and average file size
        const fileBytesAgg = await File.aggregate([
            { $group: { _id: null, totalBytes: { $sum: '$bytes' }, avgBytes: { $avg: '$bytes' } } }
        ]);
        advancedGauges.fileTotalBytes.set(fileBytesAgg[0]?.totalBytes || 0);
        advancedGauges.fileAvgBytes.set(fileBytesAgg[0]?.avgBytes || 0);

        // Group agents by model (using the agent model field)
        const agentModelAgg = await Agent.aggregate([
            { $group: { _id: '$model', count: { $sum: 1 } } }
        ]);
        advancedGauges.agentModelCount.reset();
        for (const result of agentModelAgg) {
            const model = result._id || 'unknown';
            advancedGauges.agentModelCount.set({ model }, result.count);
        }

        // Group users by provider
        const userProviderAgg = await User.aggregate([
            { $group: { _id: '$provider', count: { $sum: 1 } } }
        ]);
        advancedGauges.userProviderCount.reset();
        for (const result of userProviderAgg) {
            const provider = result._id || 'unknown';
            advancedGauges.userProviderCount.set({ provider }, result.count);
        }

        // Active users within the last 5 minutes
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const activeUserAgg = await Message.aggregate([
            { $match: { createdAt: { $gte: fiveMinutesAgo } } },
            { $group: { _id: '$user' } },
            { $count: 'activeUsers' }
        ]);
        const activeUsers = activeUserAgg.length > 0 ? activeUserAgg[0].activeUsers : 0;
        advancedGauges.activeUserCount.set(activeUsers);

        // Average session duration (expiration - createdAt) in seconds
        const sessionAgg = await Session.aggregate([
            { $project: { duration: { $subtract: ['$expiration', '$createdAt'] } } },
            { $group: { _id: null, avgDuration: { $avg: '$duration' } } }
        ]);
        advancedGauges.sessionAvgDuration.set((sessionAgg[0]?.avgDuration || 0) / 1000);

        // Average generations in prompt groups
        const promptGroupAgg = await PromptGroup.aggregate([
            { $group: { _id: null, avgGenerations: { $avg: '$numberOfGenerations' } } }
        ]);
        advancedGauges.promptGroupGenerationsAvg.set(promptGroupAgg[0]?.avgGenerations || 0);

        // Prompts count grouped by type
        const promptAgg = await Prompt.aggregate([
            { $group: { _id: '$type', count: { $sum: 1 } } }
        ]);
        advancedGauges.promptCountByType.reset();
        for (const result of promptAgg) {
            const type = result._id || 'unknown';
            advancedGauges.promptCountByType.set({ type }, result.count);
        }

        // Group tool calls by toolId
        const toolCallAgg = await ToolCall.aggregate([
            { $group: { _id: '$toolId', count: { $sum: 1 } } }
        ]);
        advancedGauges.toolCallCountByTool.reset();
        for (const result of toolCallAgg) {
            const toolId = result._id || 'unknown';
            advancedGauges.toolCallCountByTool.set({ toolId }, result.count);
        }

        // Average number of messages per conversation
        const convAgg = await Conversation.aggregate([
            { $project: { msgCount: { $size: '$messages' } } },
            { $group: { _id: null, avgMessages: { $avg: '$msgCount' } } }
        ]);
        advancedGauges.conversationMessageAvg.set(convAgg[0]?.avgMessages || 0);

        // Transaction metrics: sum and average rawAmount grouped by tokenType
        const txnAgg = await Transaction.aggregate([
            { $group: { _id: '$tokenType', totalCost: { $sum: '$rawAmount' }, avgCost: { $avg: '$rawAmount' } } }
        ]);
        advancedGauges.transactionCostSum.reset();
        advancedGauges.transactionCostAvg.reset();
        for (const result of txnAgg) {
            const tokenType = result._id || 'unknown';
            advancedGauges.transactionCostSum.set({ tokenType }, result.totalCost);
            advancedGauges.transactionCostAvg.set({ tokenType }, result.avgCost);
        }

        // Group actions by type
        const actionAgg = await Action.aggregate([
            { $group: { _id: '$type', count: { $sum: 1 } } }
        ]);
        advancedGauges.actionCountByType.reset();
        for (const result of actionAgg) {
            const type = result._id || 'unknown';
            advancedGauges.actionCountByType.set({ type }, result.count);
        }

        // Deployed models metrics using the Message model
        // Group messages by their "model" field (which stores the agent id)
        const deployedModelsAgg = await Message.aggregate([
            { $match: { model: { $ne: null } } },
            { $group: { _id: '$model', count: { $sum: 1 } } }
        ]);
        // Get the list of agent IDs from the aggregation result
        const agentIds = deployedModelsAgg.map(result => result._id);
        // Query Agent collection to get their names based on the agent id field
        const agents = await Agent.find({ id: { $in: agentIds } });
        const agentMap = new Map<string, string>();
        agents.forEach(agent => {
            // Use agent.name if available; otherwise fallback to agent.id
            agentMap.set(agent.id, agent.name ? agent.name : agent.id);
        });
        advancedGauges.deployedModelUsageCount.reset();
        for (const result of deployedModelsAgg) {
            const agentId = result._id;
            // If the agentId starts with "agent_" and is not found in the agent table, skip it.
            if (agentId.startsWith("agent_") && !agentMap.has(agentId)) {
                continue;
            }
            // Use the name from the agent map if available; otherwise fallback to the agentId.
            const displayName = agentMap.get(agentId) || agentId;
            advancedGauges.deployedModelUsageCount.set({ model: displayName }, result.count);
        }
        // Also count the total number of distinct deployed model names,
        const distinctModelsAgg = await Message.aggregate([
            { $match: { model: { $ne: null } } },
            { $group: { _id: '$model' } }
        ]);
        // filtering out models starting with "agent_" that are not present in our agent lookup.
        const filteredDistinctModels = distinctModelsAgg.filter(doc => {
            const agentId = doc._id;
            return !(agentId.startsWith("agent_") && !agentMap.has(agentId));

        });
        advancedGauges.deployedModelNamesCount.set(filteredDistinctModels.length);

        console.log('Advanced metrics updated.');
    } catch (error) {
        console.error('Error updating advanced metrics:', error);
    }
}