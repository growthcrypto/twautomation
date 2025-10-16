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
    if (tabName === 'leads') {
        loadLeads();
        loadLeadsAnalytics();
    }
    if (tabName === 'testing') loadActiveTests();
    if (tabName === 'dashboard') loadDashboard();
    if (tabName === 'resources') loadAPIKeys();  // Load API keys when Resources tab opens
}

// System control
async function toggleSystem() {
    const btn = document.getElementById('systemToggle');
    
    try {
        btn.disabled = true;
        const endpoint = systemRunning ? '/system/stop' : '/system/start';
        btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>${systemRunning ? 'Stopping...' : 'Starting...'}`;
        
        const response = await fetch(`${API_URL}${endpoint}`, { method: 'POST' });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();

        if (data.success) {
            systemRunning = !systemRunning;
            updateSystemStatus();
            alert(systemRunning ? '✅ System started!' : '🛑 System stopped');
        } else {
            throw new Error(data.error || 'Unknown error');
        }
    } catch (error) {
        console.error('Toggle system error:', error);
        alert('Error: ' + (error.message || 'Unknown error'));
        updateSystemStatus(); // Restore button state
    } finally {
        btn.disabled = false;
    }
}

// Make globally available
window.toggleSystem = toggleSystem;

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

// Custom niche toggle
function toggleCustomNiche(select) {
    const customDiv = document.getElementById('customNicheDiv');
    if (select.value === 'custom') {
        customDiv.classList.remove('hidden');
    } else {
        customDiv.classList.add('hidden');
    }
}
window.toggleCustomNiche = toggleCustomNiche;

// Account registration
document.getElementById('accountForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    let niche = formData.get('niche');
    
    // Handle custom niche
    if (niche === 'custom') {
        const customNiche = document.getElementById('customNicheInput').value;
        if (!customNiche) {
            alert('Please enter a custom niche');
            return;
        }
        niche = customNiche.toLowerCase().trim();
    }
    
    const data = {
        username: formData.get('username'),
        adsPowerProfileId: formData.get('adsPowerProfileId'),
        role: formData.get('role'),
        niche: niche,
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
            alert('✅ Account registered! Now click "Extract Cookies" to save login session.');
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
        
        // Filter out archived accounts
        const activeAccounts = (data.accounts || []).filter(acc => acc.status !== 'archived');
        
        if (activeAccounts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="py-4 text-center text-gray-500">No accounts registered</td></tr>';
            return;
        }

        tbody.innerHTML = activeAccounts.map(acc => `
            <tr class="border-b border-gray-800">
                <td class="py-3">@${acc.username}</td>
                <td class="py-3">
                    <span class="px-2 py-1 text-xs rounded ${getRoleColor(acc.role)}">
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
                    <span class="px-2 py-1 text-xs rounded bg-gray-800" id="cookie-${acc._id}">
                        Loading...
                    </span>
                </td>
                <td class="py-3">
                    <div class="flex gap-2">
                        <button onclick="extractCookies('${acc._id}')" class="text-blue-400 hover:text-blue-300 text-sm" title="Extract Cookies">
                            <i class="fas fa-cookie"></i>
                        </button>
                        <button onclick="testCookies('${acc._id}')" class="text-green-400 hover:text-green-300 text-sm" title="Test Cookies">
                            <i class="fas fa-check-circle"></i>
                        </button>
                        <button onclick="deleteAccount('${acc._id}')" class="text-red-400 hover:text-red-300 text-sm" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        // Load cookie status for each account
        data.accounts.forEach(acc => loadCookieStatus(acc._id));

    } catch (error) {
        console.error('Error loading accounts:', error);
    }
}

// Load saved configs
async function loadConfigs() {
    try {
        // Load both follow and DM configs
        const [followRes, dmRes] = await Promise.all([
            fetch(`${API_URL}/configs/follow-unfollow`),
            fetch(`${API_URL}/configs/mass-dm`)
        ]);
        
        const followData = await followRes.json();
        const dmData = await dmRes.json();
        
        const allConfigs = [
            ...(followData.configs || []).map(c => ({ ...c, type: 'Follow/Unfollow' })),
            ...(dmData.configs || []).map(c => ({ ...c, type: 'Mass DM' }))
        ];
        
        const tbody = document.getElementById('configsTableBody');
        
        if (allConfigs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="py-4 text-center text-gray-500">No campaigns configured. Click "Configure" buttons below to create one.</td></tr>';
            return;
        }
        
        tbody.innerHTML = allConfigs.map(config => {
            const accountCount = config.accountIds?.length || 0;
            const accountNames = (config.accountIds || [])
                .map(acc => acc.username ? `@${acc.username}` : '')
                .filter(n => n)
                .join(', ') || `${accountCount} account(s)`;
            
            let details = '';
            if (config.type === 'Follow/Unfollow') {
                const targets = (config.targetSources || []).map(t => 
                    t.type === 'hashtag' ? `#${t.value}` : `@${t.value}`
                ).join(', ');
                details = `${config.maxFollowsPerDay || 0}/day → ${targets || 'No targets'}`;
            } else if (config.type === 'Mass DM') {
                details = `${config.maxDMsPerDay || 0} DMs/day`;
            }
            
            return `
                <tr class="border-b border-gray-800">
                    <td class="py-3">
                        <div class="font-medium">${config.name || 'Unnamed'}</div>
                        <div class="text-xs text-gray-500">${config.niche || 'No niche'}</div>
                    </td>
                    <td class="py-3">
                        <span class="px-2 py-1 text-xs rounded ${config.type === 'Follow/Unfollow' ? 'bg-blue-900 text-blue-300' : 'bg-green-900 text-green-300'}">
                            ${config.type}
                        </span>
                    </td>
                    <td class="py-3">
                        <span class="text-xs" title="${accountNames}">${accountCount} account(s)</span>
                    </td>
                    <td class="py-3">
                        <span class="px-2 py-1 text-xs rounded ${config.enabled ? 'bg-green-900 text-green-300' : 'bg-gray-800 text-gray-400'}">
                            ${config.enabled ? 'Active' : 'Disabled'}
                        </span>
                    </td>
                    <td class="py-3 text-xs text-gray-400">${details}</td>
                    <td class="py-3">
                        <div class="flex gap-2 justify-center">
                            <button onclick="editConfigAccounts('${config._id}', '${config.type}')" 
                                class="text-blue-400 hover:text-blue-300 text-sm" 
                                title="Edit Accounts">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="toggleConfig('${config._id}', '${config.type}', ${!config.enabled})" 
                                class="text-${config.enabled ? 'yellow' : 'green'}-400 hover:text-${config.enabled ? 'yellow' : 'green'}-300 text-sm" 
                                title="${config.enabled ? 'Disable' : 'Enable'}">
                                <i class="fas fa-${config.enabled ? 'pause' : 'play'}-circle"></i>
                            </button>
                            <button onclick="deleteConfig('${config._id}', '${config.type}')" 
                                class="text-red-400 hover:text-red-300 text-sm" 
                                title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading configs:', error);
    }
}

// Toggle config enabled/disabled
async function toggleConfig(configId, type, enabled) {
    try {
        const endpoint = type === 'Follow/Unfollow' ? 'follow-unfollow' : 'mass-dm';
        const response = await fetch(`${API_URL}/configs/${endpoint}/${configId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled })
        });
        
        const data = await response.json();
        if (data.success) {
            alert(`✅ Campaign ${enabled ? 'enabled' : 'disabled'}!`);
            loadConfigs();
        } else {
            alert('❌ Error: ' + data.error);
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

// Delete config
async function deleteConfig(configId, type) {
    if (!confirm('Are you sure you want to delete this campaign?')) return;
    
    try {
        const endpoint = type === 'Follow/Unfollow' ? 'follow-unfollow' : 'mass-dm';
        const response = await fetch(`${API_URL}/configs/${endpoint}/${configId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        if (data.success) {
            alert('✅ Campaign deleted!');
            loadConfigs();
        } else {
            alert('❌ Error: ' + data.error);
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

// Edit config accounts modal
async function editConfigAccounts(configId, type) {
  try {
    const endpoint = type === 'Follow/Unfollow' ? 'follow-unfollow' : 'mass-dm';
    
    // Load config and accounts
    const [configRes, accountsRes] = await Promise.all([
      fetch(`${API_URL}/configs/${endpoint}/${configId}`),
      fetch(`${API_URL}/accounts`)
    ]);
    
    const configData = await configRes.json();
    const accountsData = await accountsRes.json();
    
    if (!configData.success || !accountsData.success) {
      alert('❌ Error loading data');
      return;
    }
    
    const config = configData.config;
    const allAccounts = accountsData.accounts.filter(a => a.status !== 'archived' && a.role === 'traffic');
    
    // Get currently assigned account IDs
    const assignedIds = new Set((config.accountIds || []).map(a => a._id || a));
    
    // Build modal HTML
    const modalHtml = `
      <div id="editAccountsModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-xl font-bold text-white">Edit Accounts: ${config.name}</h3>
            <button onclick="closeEditAccountsModal()" class="text-gray-400 hover:text-white">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div class="mb-4">
            <p class="text-gray-400 text-sm mb-2">Select which accounts should run this campaign:</p>
          </div>
          
          <div class="space-y-2 mb-6">
            ${allAccounts.map(acc => `
              <label class="flex items-center p-3 bg-gray-800 rounded hover:bg-gray-750 cursor-pointer">
                <input 
                  type="checkbox" 
                  value="${acc._id}" 
                  ${assignedIds.has(acc._id) ? 'checked' : ''}
                  class="account-checkbox w-4 h-4 mr-3"
                >
                <div class="flex-1">
                  <div class="text-white font-medium">@${acc.username}</div>
                  <div class="text-xs text-gray-500">${acc.niche || 'No niche'}</div>
                </div>
                <div class="text-xs ${acc.status === 'active' ? 'text-green-400' : 'text-yellow-400'}">
                  ${acc.status}
                </div>
              </label>
            `).join('')}
          </div>
          
          ${allAccounts.length === 0 ? '<p class="text-gray-500 text-center py-4">No traffic accounts available. Register accounts first!</p>' : ''}
          
          <div class="flex gap-3">
            <button 
              onclick="saveConfigAccounts('${configId}', '${type}')" 
              class="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-medium"
              ${allAccounts.length === 0 ? 'disabled' : ''}
            >
              <i class="fas fa-save mr-2"></i>Save Changes
            </button>
            <button 
              onclick="closeEditAccountsModal()" 
              class="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    `;
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
  } catch (error) {
    console.error('Error opening edit modal:', error);
    alert('❌ Error: ' + error.message);
  }
}

// Close modal
function closeEditAccountsModal() {
  const modal = document.getElementById('editAccountsModal');
  if (modal) modal.remove();
}

// Save account assignments
async function saveConfigAccounts(configId, type) {
  try {
    // Get selected account IDs
    const checkboxes = document.querySelectorAll('.account-checkbox:checked');
    const accountIds = Array.from(checkboxes).map(cb => cb.value);
    
    if (accountIds.length === 0) {
      if (!confirm('⚠️ No accounts selected. This campaign won\'t run. Continue?')) {
        return;
      }
    }
    
    const endpoint = type === 'Follow/Unfollow' ? 'follow-unfollow' : 'mass-dm';
    
    const response = await fetch(`${API_URL}/configs/${endpoint}/${configId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountIds })
    });
    
    const data = await response.json();
    
    if (data.success) {
      alert(`✅ Updated! ${accountIds.length} account(s) assigned.`);
      closeEditAccountsModal();
      loadConfigs(); // Reload to show updated counts
    } else {
      alert('❌ Error: ' + data.error);
    }
  } catch (error) {
    console.error('Save error:', error);
    alert('❌ Error: ' + error.message);
  }
}

// Make globally available
window.toggleConfig = toggleConfig;
window.deleteConfig = deleteConfig;
window.editConfigAccounts = editConfigAccounts;
window.closeEditAccountsModal = closeEditAccountsModal;
window.saveConfigAccounts = saveConfigAccounts;

function getRoleColor(role) {
    const colors = {
        follow: 'bg-blue-900 text-blue-300',
        massdm: 'bg-green-900 text-green-300',
        chat: 'bg-purple-900 text-purple-300',
        traffic: 'bg-blue-900 text-blue-300'
    };
    return colors[role] || 'bg-gray-800 text-gray-400';
}

function getStatusColor(status) {
    const colors = {
        active: 'bg-green-900 text-green-300',
        warming_up: 'bg-yellow-900 text-yellow-300',
        banned: 'bg-red-900 text-red-300'
    };
    return colors[status] || 'bg-gray-800 text-gray-400';
}

// Cookie Management
async function loadCookieStatus(accountId) {
    try {
        const response = await fetch(`${API_URL}/accounts/${accountId}/cookie-status`);
        const data = await response.json();

        const element = document.getElementById(`cookie-${accountId}`);
        if (!element) return;

        if (data.hasCookies) {
            const colors = {
                'Valid': 'bg-green-900 text-green-300',
                'Expiring Soon': 'bg-yellow-900 text-yellow-300',
                'Expired': 'bg-red-900 text-red-300'
            };
            element.className = `px-2 py-1 text-xs rounded ${colors[data.status] || 'bg-gray-800'}`;
            element.textContent = data.message;
        } else {
            element.className = 'px-2 py-1 text-xs rounded bg-gray-800 text-gray-400';
            element.textContent = 'No cookies';
        }
    } catch (error) {
        console.error('Error loading cookie status:', error);
    }
}

async function extractCookies(accountId) {
    if (!confirm('Make sure you are logged into Twitter in the AdsPower profile for this account. Continue?')) {
        return;
    }

    const btn = event.target.closest('button');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
        const response = await fetch(`${API_URL}/accounts/${accountId}/extract-cookies`, {
            method: 'POST'
        });

        const result = await response.json();

        if (result.success) {
            alert(`✅ ${result.message}\nExtracted ${result.cookieCount} cookies.`);
            loadCookieStatus(accountId);
        } else {
            alert('❌ Error: ' + result.error);
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-cookie"></i>';
    }
}

async function testCookies(accountId) {
    const btn = event.target.closest('button');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
        const response = await fetch(`${API_URL}/accounts/${accountId}/test-cookies`, {
            method: 'POST'
        });

        const result = await response.json();

        if (result.valid) {
            alert('✅ ' + result.message);
        } else {
            alert('❌ Cookies invalid: ' + result.reason);
        }

        loadCookieStatus(accountId);
    } catch (error) {
        alert('❌ Error: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check-circle"></i>';
    }
}

async function deleteAccount(id) {
    if (!confirm('⚠️ Delete this account?\n\nThis will archive the account and cancel all its tasks.')) return;
    
    try {
        const response = await fetch(`${API_URL}/accounts/${id}`, { method: 'DELETE' });
        const result = await response.json();
        
        if (result.success) {
            alert('✅ Account deleted successfully');
        loadAccounts();
        } else {
            alert('❌ Error: ' + (result.error || 'Failed to delete'));
        }
    } catch (error) {
        console.error('Delete error:', error);
        alert('❌ Error: ' + error.message);
    }
}

// Make functions globally available for onclick handlers
window.deleteAccount = deleteAccount;
window.extractCookies = extractCookies;
window.testCookies = testCookies;
window.clearAPIKeys = clearAPIKeys;

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

// Profile pics upload
document.getElementById('profilePicsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const niche = document.getElementById('picNiche').value;
    const files = document.getElementById('profilePicsUpload').files;
    
    if (files.length === 0) {
        alert('Please select images');
        return;
    }

    const formData = new FormData();
    formData.append('niche', niche);
    for (let file of files) {
        formData.append('images', file);
    }

    try {
        const response = await fetch(`${API_URL}/resources/profile-pics`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            alert(`✅ ${result.message}`);
            e.target.reset();
        } else {
            alert('❌ Error: ' + result.error);
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
});

// Emails upload
document.getElementById('emailsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const emailsText = document.getElementById('emailsList').value;
    const lines = emailsText.split('\n').filter(l => l.trim());
    
    const emails = lines.map(line => {
        const [address, password] = line.split(':');
        return {
            address: address.trim(),
            password: password?.trim() || '',
            provider: address.includes('@gmail') ? 'gmail' : 'other'
        };
    });

    try {
        const response = await fetch(`${API_URL}/resources/emails`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emails })
        });

        const result = await response.json();

        if (result.success) {
            alert(`✅ ${result.message}`);
            e.target.reset();
        } else {
            alert('❌ Error: ' + result.error);
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
});

// Bio template
document.getElementById('bioTemplateForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {
        niche: formData.get('niche'),
        role: formData.get('role'),
        template: formData.get('template'),
        variables: ['chat_account']
    };

    try {
        const response = await fetch(`${API_URL}/resources/bio-templates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            alert('✅ Bio template added!');
            e.target.reset();
        } else {
            alert('❌ Error: ' + result.error);
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
});

// API Keys form
document.getElementById('apiKeysForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    try {
        // Disable button while saving
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Saving...';
        }

        const payload = {
            phoneApiKey: formData.get('phoneApiKey'),
            captchaApiKey: formData.get('captchaApiKey'),
            aiApiUrl: formData.get('aiApiUrl'),
            aiApiKey: formData.get('aiApiKey')
        };
        
        console.log('💾 Saving API keys:', { 
            phoneApiKey: payload.phoneApiKey ? '***' : 'empty',
            captchaApiKey: payload.captchaApiKey ? '***' : 'empty',
            aiApiUrl: payload.aiApiUrl || 'empty',
            aiApiKey: payload.aiApiKey ? '***' : 'empty'
        });

        // Save all API keys at once
        const response = await fetch(`${API_URL}/resources/api-keys`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        
        console.log('✅ API keys save response:', result);
        
        if (result.success) {
            const savedKeys = [];
            if (result.saved.phoneService) savedKeys.push('Phone Service');
            if (result.saved.twoCaptcha) savedKeys.push('2Captcha');
            if (result.saved.aiUrl || result.saved.aiKey) savedKeys.push('AI API');
            
            alert(`✅ API keys saved successfully!\n\nSaved: ${savedKeys.join(', ')}`);
            
            // Reload keys to confirm
            setTimeout(() => loadAPIKeys(), 500);
        } else {
            alert(`❌ Error: ${result.error}`);
        }
    } catch (error) {
        console.error('❌ Error saving API keys:', error);
        alert(`❌ Error saving API keys: ${error.message}`);
    } finally {
        // Re-enable button
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-save mr-2"></i>Save API Keys';
        }
    }
});

// Load existing API keys
async function loadAPIKeys() {
    try {
        const response = await fetch(`${API_URL}/resources`);
        const result = await response.json();
        
        if (result.success && result.pool) {
            // Load phone API key
            if (result.pool.phoneService?.apiKey) {
                const phoneInput = document.querySelector('input[name="phoneApiKey"]');
                if (phoneInput) phoneInput.value = result.pool.phoneService.apiKey;
            }
            
            // Load 2captcha API key
            if (result.pool.apiKeys?.twoCaptcha) {
                const captchaInput = document.querySelector('input[name="captchaApiKey"]');
                if (captchaInput) captchaInput.value = result.pool.apiKeys.twoCaptcha;
            }
            
            // Load AI API settings
            if (result.pool.apiKeys?.ai?.url) {
                const aiUrlInput = document.querySelector('input[name="aiApiUrl"]');
                if (aiUrlInput) aiUrlInput.value = result.pool.apiKeys.ai.url;
            }
            if (result.pool.apiKeys?.ai?.key) {
                const aiKeyInput = document.querySelector('input[name="aiApiKey"]');
                if (aiKeyInput) aiKeyInput.value = result.pool.apiKeys.ai.key;
            }
            
            console.log('✅ API keys loaded successfully');
        } else {
            console.log('ℹ️ No saved API keys found');
        }
    } catch (error) {
        console.error('❌ Error loading API keys:', error);
    }
}

// Clear API keys
async function clearAPIKeys() {
    if (!confirm('⚠️ Are you sure you want to clear ALL API keys?\n\nThis will delete:\n- Phone Service API Key\n- 2Captcha API Key\n- AI API URL & Key\n\nThis cannot be undone!')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/resources/api-keys?keyType=all`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            alert('✅ All API keys cleared successfully!');
            
            // Clear form inputs
            const form = document.getElementById('apiKeysForm');
            if (form) {
                form.reset();
            }
        } else {
            alert(`❌ Error: ${result.error}`);
        }
    } catch (error) {
        console.error('❌ Error clearing API keys:', error);
        alert(`❌ Error: ${error.message}`);
    }
}

// Live Logs
let logsVisible = false;
let logEventSource = null;

function toggleLogs() {
    const container = document.getElementById('liveLogsContainer');
    const btn = document.getElementById('logsToggleBtn');
    
    logsVisible = !logsVisible;
    
    if (logsVisible) {
        container.style.display = 'block';
        btn.querySelector('span').textContent = 'Hide Logs';
        connectToLogs();
    } else {
        container.style.display = 'none';
        btn.querySelector('span').textContent = 'Show Logs';
        if (logEventSource) {
            logEventSource.close();
            logEventSource = null;
        }
    }
}

function connectToLogs() {
    if (logEventSource) return;
    
    const logsContent = document.getElementById('logsContent');
    logsContent.innerHTML = '<div class="text-gray-500">📡 Connected to live logs...</div>';
    
    logEventSource = new EventSource(`${API_URL}/logs/stream`);
    
    logEventSource.onmessage = (event) => {
        const log = JSON.parse(event.data);
        appendLog(log);
    };
    
    logEventSource.onerror = () => {
        document.getElementById('logClientCount').textContent = '❌ Disconnected';
        setTimeout(() => {
            if (logsVisible) {
                logEventSource.close();
                logEventSource = null;
                connectToLogs();
            }
        }, 3000);
    };
    
    logEventSource.onopen = () => {
        document.getElementById('logClientCount').textContent = '✅ Connected';
    };
}

function appendLog(log) {
    const logsContent = document.getElementById('logsContent');
    const time = new Date(log.timestamp).toLocaleTimeString();
    
    const colors = {
        info: 'text-blue-400',
        success: 'text-green-400',
        warning: 'text-yellow-400',
        error: 'text-red-400'
    };
    
    const color = colors[log.level] || 'text-gray-400';
    
    const logLine = document.createElement('div');
    logLine.className = `${color} mb-1`;
    logLine.innerHTML = `<span class="text-gray-500">[${time}]</span> ${log.message}`;
    
    logsContent.appendChild(logLine);
    
    // Auto-scroll to bottom
    logsContent.scrollTop = logsContent.scrollHeight;
    
    // Keep only last 200 logs
    while (logsContent.children.length > 200) {
        logsContent.removeChild(logsContent.firstChild);
    }
}

function clearLogs() {
    document.getElementById('logsContent').innerHTML = '<div class="text-gray-500">Logs cleared. New logs will appear here...</div>';
}

// ============================================
// LEADS MANAGEMENT
// ============================================

async function loadLeadsAnalytics() {
    try {
        const timeframe = document.getElementById('timeframeFilter').value;
        const response = await fetch(`${API_URL}/leads/analytics/overview?timeframe=${timeframe}`);
        const data = await response.json();
        
        if (data.success) {
            const { overview, rates } = data.analytics;
            
            // Update analytics cards
            document.getElementById('totalLeads').textContent = overview.totalLeads;
            document.getElementById('totalConversions').textContent = overview.conversions;
            document.getElementById('totalRevenue').textContent = `$${overview.totalRevenue}`;
            document.getElementById('replyRate').textContent = `${rates.replyRate}%`;
            
            document.getElementById('conversionRate').textContent = `${rates.conversionRate}% conversion rate`;
            document.getElementById('avgRevenue').textContent = `$${rates.avgRevenuePerConversion} avg per conversion`;
            document.getElementById('repliesReceived').textContent = `${overview.repliesReceived} replies received`;
        }
    } catch (error) {
        console.error('Error loading analytics:', error);
    }
}

async function loadLeads() {
    try {
        const statusFilter = document.getElementById('statusFilter').value;
        const queryParams = new URLSearchParams();
        if (statusFilter) queryParams.set('status', statusFilter);
        queryParams.set('limit', '100');
        
        const response = await fetch(`${API_URL}/leads?${queryParams}`);
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error);
        }
        
        const tbody = document.getElementById('leadsTableBody');
        
        if (data.leads.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="py-8 text-center text-gray-500">No leads found</td></tr>';
            return;
        }
        
        tbody.innerHTML = data.leads.map(lead => {
            const statusColors = {
                new_lead: 'bg-gray-700 text-gray-300',
                dm_sent: 'bg-blue-700 text-blue-200',
                in_conversation: 'bg-purple-700 text-purple-200',
                link_sent: 'bg-orange-700 text-orange-200',
                converted: 'bg-green-700 text-green-200',
                ghosted: 'bg-gray-600 text-gray-400',
                not_interested: 'bg-red-700 text-red-200'
            };
            
            const statusLabels = {
                new_lead: 'New Lead',
                dm_sent: 'DM Sent',
                in_conversation: 'In Conversation',
                link_sent: 'Link Sent',
                converted: '🎉 Converted',
                ghosted: 'Ghosted',
                not_interested: 'Not Interested'
            };
            
            const statusClass = statusColors[lead.status] || 'bg-gray-700 text-gray-300';
            const statusLabel = statusLabels[lead.status] || lead.status;
            
            return `
                <tr class="border-b border-gray-800 hover:bg-gray-800 transition">
                    <td class="py-3">
                        <a href="https://twitter.com/${lead.username}" target="_blank" class="text-blue-400 hover:text-blue-300">
                            @${lead.username}
                        </a>
                    </td>
                    <td class="py-3">
                        <span class="px-2 py-1 rounded text-xs ${statusClass}">
                            ${statusLabel}
                        </span>
                    </td>
                    <td class="py-3 text-sm">
                        ${lead.sourceAccount?.username ? `@${lead.sourceAccount.username}` : '-'}
                    </td>
                    <td class="py-3 text-sm">
                        ${lead.chatAccount?.username ? `@${lead.chatAccount.username}` : '-'}
                    </td>
                    <td class="py-3 text-center">${lead.messageCount || 0}</td>
                    <td class="py-3 text-center">
                        ${lead.revenue ? `<span class="text-green-400 font-medium">$${lead.revenue}</span>` : '-'}
                    </td>
                    <td class="py-3 text-sm text-gray-400">
                        ${formatDate(lead.lastInteractionDate || lead.firstContactDate)}
                    </td>
                    <td class="py-3">
                        <div class="flex gap-2">
                            ${lead.status !== 'converted' ? `
                                <button onclick="markAsConverted('${lead._id}')" 
                                    class="text-green-400 hover:text-green-300 text-sm px-2 py-1 rounded hover:bg-gray-700"
                                    title="Mark as converted">
                                    <i class="fas fa-check-circle"></i>
                                </button>
                            ` : ''}
                            <button onclick="updateLeadStatus('${lead._id}', '${lead.status}')" 
                                class="text-blue-400 hover:text-blue-300 text-sm px-2 py-1 rounded hover:bg-gray-700"
                                title="Change status">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="deleteLead('${lead._id}')" 
                                class="text-red-400 hover:text-red-300 text-sm px-2 py-1 rounded hover:bg-gray-700"
                                title="Delete lead">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading leads:', error);
        alert('❌ Error loading leads: ' + error.message);
    }
}

async function markAsConverted(leadId) {
    const revenue = prompt('💰 Enter revenue amount (e.g., 9.99):');
    
    if (revenue === null) return; // Cancelled
    
    const revenueNum = parseFloat(revenue) || 0;
    
    if (revenueNum <= 0) {
        alert('⚠️ Please enter a valid revenue amount');
        return;
    }
    
    const ofUsername = prompt('(Optional) Enter their OnlyFans username:');
    
    try {
        const response = await fetch(`${API_URL}/leads/${leadId}/convert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                revenue: revenueNum,
                ofUsername: ofUsername || undefined
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(`🎉 Lead marked as converted! Revenue: $${revenueNum}`);
            loadLeads();
            loadLeadsAnalytics();
        } else {
            alert('❌ Error: ' + data.error);
        }
    } catch (error) {
        console.error('Error marking as converted:', error);
        alert('❌ Error: ' + error.message);
    }
}

async function updateLeadStatus(leadId, currentStatus) {
    const statuses = [
        { value: 'new_lead', label: 'New Lead' },
        { value: 'dm_sent', label: 'DM Sent' },
        { value: 'in_conversation', label: 'In Conversation' },
        { value: 'link_sent', label: 'Link Sent' },
        { value: 'converted', label: 'Converted' },
        { value: 'ghosted', label: 'Ghosted' },
        { value: 'not_interested', label: 'Not Interested' }
    ];
    
    let message = 'Select new status:\n\n';
    statuses.forEach((s, i) => {
        message += `${i + 1}. ${s.label}${s.value === currentStatus ? ' (current)' : ''}\n`;
    });
    
    const choice = prompt(message + '\nEnter number (1-7):');
    
    if (!choice) return;
    
    const index = parseInt(choice) - 1;
    if (index < 0 || index >= statuses.length) {
        alert('Invalid choice');
        return;
    }
    
    const newStatus = statuses[index].value;
    
    try {
        const response = await fetch(`${API_URL}/leads/${leadId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(`✅ Status updated to: ${statuses[index].label}`);
            loadLeads();
            loadLeadsAnalytics();
        } else {
            alert('❌ Error: ' + data.error);
        }
    } catch (error) {
        console.error('Error updating status:', error);
        alert('❌ Error: ' + error.message);
    }
}

async function deleteLead(leadId) {
    if (!confirm('⚠️ Are you sure you want to delete this lead? This cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/leads/${leadId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ Lead deleted');
            loadLeads();
            loadLeadsAnalytics();
        } else {
            alert('❌ Error: ' + data.error);
        }
    } catch (error) {
        console.error('Error deleting lead:', error);
        alert('❌ Error: ' + error.message);
    }
}

// ============================================
// TESTING / A/B TESTING
// ============================================

async function loadActiveTests() {
    try {
        const response = await fetch(`${API_URL}/configs/testing/cohorts`);
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error);
        }
        
        const container = document.getElementById('activeTestsList');
        const test1Select = document.getElementById('compareTest1');
        const test2Select = document.getElementById('compareTest2');
        
        if (data.cohorts.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-500 py-8">
                    <i class="fas fa-flask text-4xl mb-2 opacity-50"></i>
                    <p>No active tests. Create one to get started!</p>
                </div>
            `;
            return;
        }
        
        // Populate test list
        container.innerHTML = data.cohorts.map(cohort => `
            <div class="bg-gray-800 p-4 rounded-lg border border-gray-700">
                <div class="flex items-center justify-between mb-2">
                    <div>
                        <h4 class="font-bold text-white">${cohort.testName}</h4>
                        <p class="text-xs text-gray-400">${cohort.strategy.replace(/_/g, ' ')}</p>
                    </div>
                    <span class="px-2 py-1 rounded text-xs ${
                        cohort.status === 'running' ? 'bg-green-900 text-green-300' :
                        cohort.status === 'completed' ? 'bg-blue-900 text-blue-300' :
                        'bg-gray-700 text-gray-300'
                    }">
                        ${cohort.status}
                    </span>
                </div>
                <div class="grid grid-cols-4 gap-2 text-xs mb-3">
                    <div class="text-center">
                        <div class="text-gray-500">Accounts</div>
                        <div class="text-white font-medium">${cohort.accounts?.length || 0}</div>
                    </div>
                    <div class="text-center">
                        <div class="text-gray-500">Ban Rate</div>
                        <div class="text-white font-medium">${cohort.results?.banRate?.toFixed(1) || 0}%</div>
                    </div>
                    <div class="text-center">
                        <div class="text-gray-500">Conv Rate</div>
                        <div class="text-white font-medium">${cohort.results?.conversionRate?.toFixed(1) || 0}%</div>
                    </div>
                    <div class="text-center">
                        <div class="text-gray-500">Revenue</div>
                        <div class="text-white font-medium">$${cohort.results?.totalRevenue?.toFixed(0) || 0}</div>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button onclick="viewTestDetails('${cohort._id}')" class="flex-1 text-blue-400 hover:text-blue-300 text-sm">
                        <i class="fas fa-eye mr-1"></i>View
                    </button>
                    ${cohort.status === 'running' ? `
                        <button onclick="stopTest('${cohort._id}')" class="flex-1 text-orange-400 hover:text-orange-300 text-sm">
                            <i class="fas fa-stop mr-1"></i>Stop
                        </button>
                    ` : ''}
                    ${cohort.status === 'planning' ? `
                        <button onclick="startTest('${cohort._id}')" class="flex-1 text-green-400 hover:text-green-300 text-sm">
                            <i class="fas fa-play mr-1"></i>Start
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');
        
        // Populate comparison dropdowns
        const options = data.cohorts.map(c => `<option value="${c._id}">${c.testName}</option>`).join('');
        test1Select.innerHTML = '<option value="">Select test...</option>' + options;
        test2Select.innerHTML = '<option value="">Select test...</option>' + options;
        
    } catch (error) {
        console.error('Error loading tests:', error);
        alert('❌ Error loading tests: ' + error.message);
    }
}

async function createTestCohort() {
    const name = prompt('Test Name:', 'My A/B Test');
    if (!name) return;
    
    const strategies = [
        'evolution_single_account',
        'hybrid_follow_dm',
        'specialist_separate',
        'specialist_follow_only',
        'specialist_dm_only',
        'custom'
    ];
    
    const strategyChoice = prompt(
        'Choose strategy:\n\n' +
        '1. Evolution (single account)\n' +
        '2. Hybrid (follow + DM)\n' +
        '3. Specialist (separate accounts)\n' +
        '4. Follow only\n' +
        '5. DM only\n' +
        '6. Custom\n\n' +
        'Enter number (1-6):'
    );
    
    if (!strategyChoice || strategyChoice < 1 || strategyChoice > 6) {
        alert('Invalid choice');
        return;
    }
    
    const strategy = strategies[parseInt(strategyChoice) - 1];
    
    try {
        const response = await fetch(`${API_URL}/configs/testing/cohorts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                testName: name,
                strategy,
                status: 'planning',
                config: {
                    warmupDays: 14,
                    followPerDay: 100,
                    dmPerDay: 30,
                    hasPremium: false
                }
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(`✅ Test created! Now add accounts to it.`);
            loadActiveTests();
        } else {
            alert('❌ Error: ' + data.error);
        }
    } catch (error) {
        console.error('Error creating test:', error);
        alert('❌ Error: ' + error.message);
    }
}

async function viewTestDetails(testId) {
    try {
        const response = await fetch(`${API_URL}/configs/testing/cohorts/${testId}`);
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error);
        }
        
        const cohort = data.cohort;
        alert(
            `📊 ${cohort.testName}\n\n` +
            `Strategy: ${cohort.strategy.replace(/_/g, ' ')}\n` +
            `Status: ${cohort.status}\n` +
            `Accounts: ${cohort.accounts.length}\n\n` +
            `Results:\n` +
            `- Ban Rate: ${cohort.results.banRate.toFixed(1)}%\n` +
            `- Follow-back Rate: ${cohort.results.followBackRate.toFixed(1)}%\n` +
            `- Reply Rate: ${cohort.results.replyRate.toFixed(1)}%\n` +
            `- Conversion Rate: ${cohort.results.conversionRate.toFixed(1)}%\n` +
            `- Revenue/Account: $${cohort.results.revenuePerAccount.toFixed(2)}\n` +
            `- Total Revenue: $${cohort.results.totalRevenue.toFixed(2)}`
        );
    } catch (error) {
        console.error('Error:', error);
        alert('❌ Error: ' + error.message);
    }
}

async function startTest(testId) {
    if (!confirm('Start this test?')) return;
    
    try {
        const response = await fetch(`${API_URL}/configs/testing/cohorts/${testId}/start`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ Test started!');
            loadActiveTests();
        } else {
            alert('❌ Error: ' + data.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('❌ Error: ' + error.message);
    }
}

async function stopTest(testId) {
    if (!confirm('Stop this test? (Will calculate final results)')) return;
    
    try {
        const response = await fetch(`${API_URL}/configs/testing/cohorts/${testId}/stop`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ Test stopped and results calculated!');
            loadActiveTests();
        } else {
            alert('❌ Error: ' + data.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('❌ Error: ' + error.message);
    }
}

async function compareTests() {
    const test1Id = document.getElementById('compareTest1').value;
    const test2Id = document.getElementById('compareTest2').value;
    
    if (!test1Id || !test2Id) {
        alert('Please select two tests to compare');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/configs/testing/compare?cohortIds=${test1Id},${test2Id}`);
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error);
        }
        
        const results = document.getElementById('comparisonResults');
        results.classList.remove('hidden');
        
        results.innerHTML = `
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead class="border-b border-gray-700">
                        <tr>
                            <th class="text-left py-2 text-gray-400">Metric</th>
                            <th class="text-center py-2 text-blue-400">${data.comparison[0].name}</th>
                            <th class="text-center py-2 text-green-400">${data.comparison[1].name}</th>
                            <th class="text-center py-2 text-gray-400">Winner</th>
                        </tr>
                    </thead>
                    <tbody class="text-gray-300">
                        <tr class="border-b border-gray-800">
                            <td class="py-2">Ban Rate</td>
                            <td class="text-center">${data.comparison[0].banRate.toFixed(1)}%</td>
                            <td class="text-center">${data.comparison[1].banRate.toFixed(1)}%</td>
                            <td class="text-center">${data.comparison[0].banRate < data.comparison[1].banRate ? '👈 Test 1' : '👉 Test 2'}</td>
                        </tr>
                        <tr class="border-b border-gray-800">
                            <td class="py-2">Follow-back Rate</td>
                            <td class="text-center">${data.comparison[0].followBackRate.toFixed(1)}%</td>
                            <td class="text-center">${data.comparison[1].followBackRate.toFixed(1)}%</td>
                            <td class="text-center">${data.comparison[0].followBackRate > data.comparison[1].followBackRate ? '👈 Test 1' : '👉 Test 2'}</td>
                        </tr>
                        <tr class="border-b border-gray-800">
                            <td class="py-2">Reply Rate</td>
                            <td class="text-center">${data.comparison[0].replyRate.toFixed(1)}%</td>
                            <td class="text-center">${data.comparison[1].replyRate.toFixed(1)}%</td>
                            <td class="text-center">${data.comparison[0].replyRate > data.comparison[1].replyRate ? '👈 Test 1' : '👉 Test 2'}</td>
                        </tr>
                        <tr class="border-b border-gray-800">
                            <td class="py-2">Conversion Rate</td>
                            <td class="text-center font-bold">${data.comparison[0].conversionRate.toFixed(1)}%</td>
                            <td class="text-center font-bold">${data.comparison[1].conversionRate.toFixed(1)}%</td>
                            <td class="text-center font-bold">${data.comparison[0].conversionRate > data.comparison[1].conversionRate ? '🏆 Test 1' : '🏆 Test 2'}</td>
                        </tr>
                        <tr>
                            <td class="py-2">Revenue/Account</td>
                            <td class="text-center font-bold text-green-400">$${data.comparison[0].revenuePerAccount.toFixed(2)}</td>
                            <td class="text-center font-bold text-green-400">$${data.comparison[1].revenuePerAccount.toFixed(2)}</td>
                            <td class="text-center font-bold">${data.comparison[0].revenuePerAccount > data.comparison[1].revenuePerAccount ? '💰 Test 1' : '💰 Test 2'}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
        
    } catch (error) {
        console.error('Error comparing tests:', error);
        alert('❌ Error: ' + error.message);
    }
}

function loadTestResults() {
    loadActiveTests();
}

// Make globally available
window.toggleLogs = toggleLogs;
window.clearLogs = clearLogs;
window.loadLeads = loadLeads;
window.loadLeadsAnalytics = loadLeadsAnalytics;
window.markAsConverted = markAsConverted;
window.updateLeadStatus = updateLeadStatus;
window.deleteLead = deleteLead;
window.loadActiveTests = loadActiveTests;
window.createTestCohort = createTestCohort;
window.viewTestDetails = viewTestDetails;
window.startTest = startTest;
window.stopTest = stopTest;
window.compareTests = compareTests;
window.loadTestResults = loadTestResults;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
    loadAccounts();
    loadConfigs();
    // API keys will load when Resources tab is opened (not on page load)
    
    // Auto-refresh every 30 seconds
    setInterval(() => {
        if (document.getElementById('tab-dashboard').classList.contains('hidden') === false) {
            loadDashboard();
        }
    }, 30000);
});
