const API_URL = window.location.origin + '/api';
let systemRunning = false;

// Tab switching
function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
    
    // Show selected tab
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.getAttribute('data-tab') === tabName) {
            btn.classList.remove('bg-gray-800', 'text-gray-300');
            btn.classList.add('bg-blue-600', 'text-white');
        } else {
            btn.classList.remove('bg-blue-600', 'text-white');
            btn.classList.add('bg-gray-800', 'text-gray-300');
        }
    });

    // Load data for this tab
    if (tabName === 'accounts') loadAccounts();
    if (tabName === 'leads') loadLeads();
    if (tabName === 'dashboard') loadDashboard();
}

// System control
async function toggleSystem() {
    const btn = document.getElementById('systemToggle');
    
    try {
        const endpoint = systemRunning ? '/system/stop' : '/system/start';
        const response = await fetch(`${API_URL}${endpoint}`, { method: 'POST' });
        const data = await response.json();

        if (data.success) {
            systemRunning = !systemRunning;
            updateSystemStatus();
            alert(systemRunning ? '✅ System started!' : '🛑 System stopped');
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

function updateSystemStatus() {
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    const btn = document.getElementById('systemToggle');

    if (systemRunning) {
        dot.classList.remove('bg-gray-500');
        dot.classList.add('bg-green-500');
        text.textContent = 'Running';
        btn.innerHTML = '<i class="fas fa-stop mr-2"></i>Stop System';
        btn.classList.remove('bg-green-600', 'hover:bg-green-700');
        btn.classList.add('bg-red-600', 'hover:bg-red-700');
    } else {
        dot.classList.remove('bg-green-500');
        dot.classList.add('bg-gray-500');
        text.textContent = 'Offline';
        btn.innerHTML = '<i class="fas fa-play mr-2"></i>Start System';
        btn.classList.remove('bg-red-600', 'hover:bg-red-700');
        btn.classList.add('bg-green-600', 'hover:bg-green-700');
    }
}

// Account registration
document.getElementById('accountForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {
        username: formData.get('username'),
        password: formData.get('password'),
        role: formData.get('role'),
        niche: formData.get('niche'),
        status: 'active'
    };

    try {
        const response = await fetch(`${API_URL}/accounts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success || response.ok) {
            alert('✅ Account registered!');
            e.target.reset();
            loadAccounts();
        } else {
            alert('❌ Error: ' + (result.error || 'Failed to register account'));
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
});

// Load accounts
async function loadAccounts() {
    try {
        const response = await fetch(`${API_URL}/accounts`);
        const data = await response.json();

        const tbody = document.getElementById('accountsTableBody');
        
        if (!data.accounts || data.accounts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-gray-500">No accounts registered</td></tr>';
            return;
        }

        tbody.innerHTML = data.accounts.map(acc => `
            <tr class="border-b border-gray-800">
                <td class="py-3">@${acc.username}</td>
                <td class="py-3">
                    <span class="px-2 py-1 text-xs rounded ${acc.role === 'traffic' ? 'bg-blue-900 text-blue-300' : 'bg-purple-900 text-purple-300'}">
                        ${acc.role}
                    </span>
                </td>
                <td class="py-3">${acc.niche || 'general'}</td>
                <td class="py-3">
                    <span class="px-2 py-1 text-xs rounded ${getStatusColor(acc.status)}">
                        ${acc.status}
                    </span>
                </td>
                <td class="py-3">
                    <button onclick="deleteAccount('${acc._id}')" class="text-red-400 hover:text-red-300">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Error loading accounts:', error);
    }
}

function getStatusColor(status) {
    const colors = {
        active: 'bg-green-900 text-green-300',
        warming_up: 'bg-yellow-900 text-yellow-300',
        banned: 'bg-red-900 text-red-300'
    };
    return colors[status] || 'bg-gray-800 text-gray-400';
}

async function deleteAccount(id) {
    if (!confirm('Delete this account?')) return;
    
    try {
        await fetch(`${API_URL}/accounts/${id}`, { method: 'DELETE' });
        alert('✅ Account deleted');
        loadAccounts();
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

// Load dashboard metrics
async function loadDashboard() {
    try {
        const response = await fetch(`${API_URL}/analytics/dashboard`);
        const data = await response.json();

        if (data.success) {
            document.getElementById('metric-total').textContent = data.dashboard.accounts.total;
            document.getElementById('metric-active').textContent = data.dashboard.accounts.active;
            document.getElementById('metric-follows').textContent = data.dashboard.today.follows;
            document.getElementById('metric-leads').textContent = data.dashboard.leads.inConversation;
            document.getElementById('metric-conversions').textContent = data.dashboard.leads.converted;
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// Load leads
async function loadLeads() {
    try {
        const response = await fetch(`${API_URL}/leads`);
        const data = await response.json();

        const tbody = document.getElementById('leadsTableBody');
        
        if (!data.leads || data.leads.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-gray-500">No leads yet</td></tr>';
            return;
        }

        tbody.innerHTML = data.leads.slice(0, 50).map(lead => `
            <tr class="border-b border-gray-800">
                <td class="py-3">@${lead.username}</td>
                <td class="py-3">
                    <span class="px-2 py-1 text-xs rounded bg-gray-800">
                        ${lead.status.replace('_', ' ')}
                    </span>
                </td>
                <td class="py-3">${lead.sourceAccount?.username || 'N/A'}</td>
                <td class="py-3">${lead.messageCount || 0}</td>
                <td class="py-3">${formatDate(lead.lastInteractionDate)}</td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Error loading leads:', error);
    }
}

function formatDate(date) {
    if (!date) return 'Never';
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

// Campaign config modals
function showCampaignConfig(type) {
    const modal = document.getElementById('campaignConfigModal');
    const title = document.getElementById('configModalTitle');
    const content = document.getElementById('configModalContent');

    const configs = {
        follow: {
            title: 'Follow/Unfollow Campaign',
            html: `
                <form id="followConfigForm" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Campaign Name</label>
                        <input type="text" name="name" required class="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white" placeholder="Soccer Follow Campaign">
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">Max Follows/Day</label>
                            <input type="number" name="maxFollows" value="100" class="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">Delay (seconds)</label>
                            <input type="number" name="delay" value="60" class="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white">
                        </div>
                    </div>
                    <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded font-medium">
                        Save Config
                    </button>
                </form>
            `
        },
        dm: {
            title: 'Mass DM Campaign',
            html: `
                <form id="dmConfigForm" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Campaign Name</label>
                        <input type="text" name="name" required class="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Message Template</label>
                        <textarea name="template" rows="3" class="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white" placeholder="Hey! Check out my main @{chat_account}"></textarea>
                    </div>
                    <button type="submit" class="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded font-medium">
                        Save Config
                    </button>
                </form>
            `
        },
        chat: {
            title: 'AI Chat Config',
            html: `
                <form id="chatConfigForm" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Campaign Name</label>
                        <input type="text" name="name" required class="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Messages Before OF Link</label>
                        <input type="number" name="messagesBeforeLink" value="12" class="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white">
                    </div>
                    <button type="submit" class="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded font-medium">
                        Save Config
                    </button>
                </form>
            `
        }
    };

    title.textContent = configs[type].title;
    content.innerHTML = configs[type].html;
    modal.classList.remove('hidden');
}

function closeCampaignConfig() {
    document.getElementById('campaignConfigModal').classList.add('hidden');
}

// Proxy form
document.getElementById('proxyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {
        type: 'mobile',
        host: formData.get('host'),
        port: parseInt(formData.get('port')),
        username: formData.get('username'),
        password: formData.get('password'),
        status: 'active'
    };

    try {
        const response = await fetch(`${API_URL}/proxies`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            alert('✅ Proxy added!');
            e.target.reset();
            loadProxies();
        } else {
            alert('❌ Failed to add proxy');
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
});

async function loadProxies() {
    try {
        const response = await fetch(`${API_URL}/proxies`);
        const data = await response.json();

        const list = document.getElementById('proxiesList');
        
        if (!data.proxies || data.proxies.length === 0) {
            list.innerHTML = '<p class="text-gray-400 text-sm">No proxies added yet</p>';
            return;
        }

        list.innerHTML = data.proxies.map(p => `
            <div class="flex justify-between items-center py-2 border-b border-gray-800">
                <span class="text-sm">${p.host}:${p.port}</span>
                <span class="text-xs text-gray-500">${p.type}</span>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error loading proxies:', error);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
    loadAccounts();
    
    // Auto-refresh every 30 seconds
    setInterval(() => {
        if (document.getElementById('tab-dashboard').classList.contains('hidden') === false) {
            loadDashboard();
        }
    }, 30000);
});
