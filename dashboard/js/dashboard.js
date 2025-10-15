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

// Make globally available
window.toggleLogs = toggleLogs;
window.clearLogs = clearLogs;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
    loadAccounts();
    // API keys will load when Resources tab is opened (not on page load)
    
    // Auto-refresh every 30 seconds
    setInterval(() => {
        if (document.getElementById('tab-dashboard').classList.contains('hidden') === false) {
            loadDashboard();
        }
    }, 30000);
});
