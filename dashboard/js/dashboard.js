const API_URL = 'http://localhost:3000/api';

// Auto-refresh dashboard every 30 seconds
let autoRefreshInterval;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    refreshDashboard();
    startAutoRefresh();
});

function startAutoRefresh() {
    autoRefreshInterval = setInterval(() => {
        refreshDashboard();
    }, 30000); // 30 seconds
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
}

async function refreshDashboard() {
    try {
        await Promise.all([
            loadSystemStatus(),
            loadDashboardMetrics(),
            loadAccounts(),
            loadLeads(),
            loadTaskStats()
        ]);
    } catch (error) {
        console.error('Error refreshing dashboard:', error);
    }
}

async function loadSystemStatus() {
    try {
        const response = await fetch(`${API_URL}/system/status`);
        const data = await response.json();

        if (data.success) {
            const status = data.status;
            
            // Update status indicators
            updateStatusDot('status-database', status.database);
            updateStatusDot('status-adspower', status.adsPower);
            updateStatusDot('status-health', status.healthMonitor);
            updateStatusDot('status-scheduler', status.taskScheduler);
        }
    } catch (error) {
        console.error('Error loading system status:', error);
    }
}

function updateStatusDot(elementId, isActive) {
    const element = document.getElementById(elementId);
    if (element) {
        element.className = `status-dot ${isActive ? 'status-active' : 'status-offline'}`;
    }
}

async function loadDashboardMetrics() {
    try {
        const response = await fetch(`${API_URL}/analytics/dashboard`);
        const data = await response.json();

        if (data.success) {
            const d = data.dashboard;

            // Accounts
            document.getElementById('metric-total-accounts').textContent = d.accounts.total;
            document.getElementById('metric-active-accounts').textContent = d.accounts.active;

            // Today's activity
            document.getElementById('metric-today-follows').textContent = d.today.follows;
            document.getElementById('metric-today-follows-detail').textContent = d.today.follows;
            document.getElementById('metric-today-dms').textContent = d.today.dms;

            // Leads
            document.getElementById('metric-leads-active').textContent = d.leads.inConversation;
            document.getElementById('metric-leads-new').textContent = d.leads.new;
            document.getElementById('metric-leads-link-sent').textContent = d.leads.linkSent;

            // Conversions & Revenue
            document.getElementById('metric-conversions').textContent = d.leads.converted;
            document.getElementById('metric-revenue').textContent = d.revenue.total.toFixed(2);

            // Pipeline
            document.getElementById('pipeline-new').textContent = d.leads.new;
            document.getElementById('pipeline-conversation').textContent = d.leads.inConversation;
            document.getElementById('pipeline-link-sent').textContent = d.leads.linkSent;
            document.getElementById('pipeline-converted').textContent = d.leads.converted;

            // Tasks
            document.getElementById('tasks-pending').textContent = d.tasks.pending;
            document.getElementById('tasks-failed').textContent = d.tasks.failedToday;
        }
    } catch (error) {
        console.error('Error loading dashboard metrics:', error);
    }
}

async function loadAccounts() {
    try {
        const response = await fetch(`${API_URL}/accounts`);
        const data = await response.json();

        if (data.success) {
            const tbody = document.getElementById('accounts-table-body');
            tbody.innerHTML = '';

            data.accounts.forEach(account => {
                const row = document.createElement('tr');
                row.className = 'border-b border-white/10 hover:bg-white/5';
                row.innerHTML = `
                    <td class="py-3 px-4">
                        <div class="font-semibold">${account.username}</div>
                        <div class="text-xs text-gray-400">${account.email || 'N/A'}</div>
                    </td>
                    <td class="py-3 px-4">
                        <span class="px-2 py-1 rounded text-xs ${
                            account.role === 'traffic' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'
                        }">
                            ${account.role.toUpperCase()}
                        </span>
                    </td>
                    <td class="py-3 px-4">
                        <span class="px-2 py-1 rounded text-xs bg-gray-500/20 text-gray-300">
                            ${account.niche || 'general'}
                        </span>
                    </td>
                    <td class="py-3 px-4">
                        ${getStatusBadge(account.status)}
                    </td>
                    <td class="py-3 px-4">
                        <div class="text-sm">
                            Follows: ${account.today.follows || 0} | 
                            DMs: ${account.today.dms || 0}
                        </div>
                    </td>
                    <td class="py-3 px-4">
                        <div class="text-sm">
                            ${account.role === 'traffic' ? 
                                `Leads: ${account.totalLeadsGenerated || 0}` : 
                                `Conversions: ${account.totalConversions || 0}`
                            }
                        </div>
                        <div class="text-xs text-gray-400">
                            Health: ${(account.health?.actionSuccessRate || 100).toFixed(0)}%
                        </div>
                    </td>
                    <td class="py-3 px-4">
                        <button onclick="viewAccount('${account._id}')" class="text-blue-400 hover:text-blue-300 mr-2">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button onclick="deleteAccount('${account._id}')" class="text-red-400 hover:text-red-300">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }
    } catch (error) {
        console.error('Error loading accounts:', error);
    }
}

function getStatusBadge(status) {
    const colors = {
        active: 'bg-green-500/20 text-green-300',
        warming_up: 'bg-yellow-500/20 text-yellow-300',
        rate_limited: 'bg-orange-500/20 text-orange-300',
        shadowbanned: 'bg-red-500/20 text-red-300',
        banned: 'bg-red-600/20 text-red-400',
        archived: 'bg-gray-500/20 text-gray-400'
    };

    const color = colors[status] || colors.archived;

    return `<span class="px-2 py-1 rounded text-xs ${color}">${status.toUpperCase().replace('_', ' ')}</span>`;
}

async function loadLeads() {
    try {
        const response = await fetch(`${API_URL}/leads?limit=50`);
        const data = await response.json();

        if (data.success) {
            const tbody = document.getElementById('leads-table-body');
            tbody.innerHTML = '';

            // Count statuses for pipeline
            const statusCounts = {
                new_lead: 0,
                dm_sent: 0,
                in_conversation: 0,
                link_sent: 0,
                converted: 0
            };

            data.leads.forEach(lead => {
                statusCounts[lead.status] = (statusCounts[lead.status] || 0) + 1;

                const row = document.createElement('tr');
                row.className = 'border-b border-white/10 hover:bg-white/5';
                row.innerHTML = `
                    <td class="py-3 px-4">
                        <div class="font-semibold">@${lead.username}</div>
                        <div class="text-xs text-gray-400">${lead.niche || 'general'}</div>
                    </td>
                    <td class="py-3 px-4">
                        ${getLeadStatusBadge(lead.status)}
                    </td>
                    <td class="py-3 px-4">
                        <div class="text-sm">${lead.sourceAccount?.username || 'N/A'}</div>
                        <div class="text-xs text-gray-400">${lead.sourceAccount?.role || ''}</div>
                    </td>
                    <td class="py-3 px-4">
                        <div class="text-sm">${lead.chatAccount?.username || 'N/A'}</div>
                    </td>
                    <td class="py-3 px-4">
                        ${lead.messageCount || 0}
                    </td>
                    <td class="py-3 px-4">
                        <div class="text-xs">${formatDate(lead.lastInteractionDate || lead.createdAt)}</div>
                    </td>
                `;
                tbody.appendChild(row);
            });

            // Update pipeline counts
            document.getElementById('pipeline-dm-sent').textContent = statusCounts.dm_sent || 0;
        }
    } catch (error) {
        console.error('Error loading leads:', error);
    }
}

function getLeadStatusBadge(status) {
    const colors = {
        new_lead: 'bg-blue-500/20 text-blue-300',
        dm_sent: 'bg-indigo-500/20 text-indigo-300',
        in_conversation: 'bg-purple-500/20 text-purple-300',
        link_sent: 'bg-yellow-500/20 text-yellow-300',
        converted: 'bg-green-500/20 text-green-300',
        ghosted: 'bg-gray-500/20 text-gray-400',
        not_interested: 'bg-red-500/20 text-red-400'
    };

    const color = colors[status] || 'bg-gray-500/20 text-gray-400';

    return `<span class="px-2 py-1 rounded text-xs ${color}">${status.toUpperCase().replace('_', ' ')}</span>`;
}

async function loadTaskStats() {
    try {
        const response = await fetch(`${API_URL}/tasks?status=pending`);
        const data = await response.json();

        if (data.success) {
            // These are already loaded in loadDashboardMetrics
            // This is just for task-specific views if needed
        }
    } catch (error) {
        console.error('Error loading task stats:', error);
    }
}

function formatDate(dateString) {
    if (!dateString) return 'Never';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
}

async function startSystem() {
    try {
        const response = await fetch(`${API_URL}/system/start`, { method: 'POST' });
        const data = await response.json();

        if (data.success) {
            alert('✅ System started successfully!');
            refreshDashboard();
        } else {
            alert('❌ Failed to start system: ' + data.error);
        }
    } catch (error) {
        alert('❌ Error starting system: ' + error.message);
    }
}

async function stopSystem() {
    try {
        const response = await fetch(`${API_URL}/system/stop`, { method: 'POST' });
        const data = await response.json();

        if (data.success) {
            alert('🛑 System stopped');
            refreshDashboard();
        } else {
            alert('❌ Failed to stop system: ' + data.error);
        }
    } catch (error) {
        alert('❌ Error stopping system: ' + error.message);
    }
}

function showCreateAccountModal() {
    alert('Account creation UI coming soon! For now, use the API: POST /api/accounts');
}

function viewAccount(accountId) {
    window.location.href = `/account.html?id=${accountId}`;
}

async function deleteAccount(accountId) {
    if (!confirm('Are you sure you want to archive this account?')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/accounts/${accountId}`, { 
            method: 'DELETE' 
        });
        const data = await response.json();

        if (data.success) {
            alert('✅ Account archived');
            loadAccounts();
        } else {
            alert('❌ Failed to archive account: ' + data.error);
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

