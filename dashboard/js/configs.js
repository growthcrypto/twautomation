const API_URL = 'http://localhost:3000/api';

// Section navigation
function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('[id^="section-"]').forEach(section => {
        section.classList.remove('section-visible');
        section.classList.add('section-hidden');
    });

    // Show selected section
    document.getElementById(`section-${sectionName}`).classList.remove('section-hidden');
    document.getElementById(`section-${sectionName}`).classList.add('section-visible');

    // Update tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('bg-purple-600', 'text-white');
        btn.classList.add('bg-gray-700', 'text-gray-300');
    });
    document.getElementById(`tab-${sectionName}`).classList.remove('bg-gray-700', 'text-gray-300');
    document.getElementById(`tab-${sectionName}`).classList.add('bg-purple-600', 'text-white');
}

// ============================================
// ACCOUNT REGISTRATION
// ============================================

document.getElementById('accountForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {
        username: formData.get('username'),
        password: formData.get('password'),
        email: formData.get('email'),
        phoneNumber: formData.get('phoneNumber'),
        role: formData.get('role'),
        niche: formData.get('niche'),
        ofLink: formData.get('ofLink'),
        status: 'active'
    };

    try {
        const response = await fetch(`${API_URL}/accounts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            alert('✅ Account registered successfully!');
            e.target.reset();
            loadAccounts();
        } else {
            alert('❌ Error: ' + result.error);
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
});

async function loadAccounts() {
    try {
        const response = await fetch(`${API_URL}/accounts`);
        const data = await response.json();

        if (data.success) {
            const container = document.getElementById('accountsTableContainer');
            
            if (data.accounts.length === 0) {
                container.innerHTML = '<p class="text-gray-300">No accounts registered yet.</p>';
                return;
            }

            const html = `
                <table class="w-full text-white">
                    <thead>
                        <tr class="border-b border-white/20">
                            <th class="text-left py-3 px-4">Username</th>
                            <th class="text-left py-3 px-4">Role</th>
                            <th class="text-left py-3 px-4">Niche</th>
                            <th class="text-left py-3 px-4">Status</th>
                            <th class="text-left py-3 px-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.accounts.map(acc => `
                            <tr class="border-b border-white/10">
                                <td class="py-3 px-4">@${acc.username}</td>
                                <td class="py-3 px-4">
                                    <span class="px-2 py-1 rounded text-xs ${acc.role === 'traffic' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'}">
                                        ${acc.role.toUpperCase()}
                                    </span>
                                </td>
                                <td class="py-3 px-4">${acc.niche || 'general'}</td>
                                <td class="py-3 px-4">
                                    <span class="px-2 py-1 rounded text-xs ${getStatusColor(acc.status)}">
                                        ${acc.status.toUpperCase()}
                                    </span>
                                </td>
                                <td class="py-3 px-4">
                                    <button onclick="deleteAccount('${acc._id}')" class="text-red-400 hover:text-red-300">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

            container.innerHTML = html;
        }
    } catch (error) {
        console.error('Error loading accounts:', error);
    }
}

function getStatusColor(status) {
    const colors = {
        active: 'bg-green-500/20 text-green-300',
        warming_up: 'bg-yellow-500/20 text-yellow-300',
        banned: 'bg-red-500/20 text-red-300',
        rate_limited: 'bg-orange-500/20 text-orange-300'
    };
    return colors[status] || 'bg-gray-500/20 text-gray-300';
}

async function deleteAccount(accountId) {
    if (!confirm('Are you sure you want to delete this account?')) return;

    try {
        const response = await fetch(`${API_URL}/accounts/${accountId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            alert('✅ Account deleted');
            loadAccounts();
        } else {
            alert('❌ Error: ' + result.error);
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

// ============================================
// FOLLOW/UNFOLLOW CONFIG
// ============================================

document.getElementById('followConfigForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {
        name: formData.get('name'),
        enabled: true,
        maxFollowsPerDay: parseInt(formData.get('maxFollowsPerDay')),
        maxUnfollowsPerDay: parseInt(formData.get('maxUnfollowsPerDay')),
        delayBetweenFollows: {
            min: parseInt(formData.get('delayMin')),
            max: parseInt(formData.get('delayMax'))
        },
        breaks: {
            enabled: true,
            afterActions: parseInt(formData.get('breakAfterActions')),
            breakDuration: {
                min: parseInt(formData.get('breakMin')) * 60,
                max: 15 * 60
            }
        },
        activeHours: {
            start: formData.get('activeStart'),
            end: formData.get('activeEnd'),
            timezone: 'America/New_York'
        },
        followBackChecker: {
            enabled: true,
            checkAfterDays: 3,
            unfollowIfNoFollowBack: true
        },
        targetSources: [
            { type: 'hashtag', value: 'trending', weight: 100 }
        ],
        accountIds: [] // Will be assigned via dashboard
    };

    try {
        const response = await fetch(`${API_URL}/configs/follow-unfollow`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            alert('✅ Follow/Unfollow config saved!');
        } else {
            alert('❌ Error: ' + result.error);
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
});

// ============================================
// MASS DM CONFIG
// ============================================

document.getElementById('dmConfigForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    
    const messageTemplates = [];
    if (formData.get('template1')) {
        messageTemplates.push({
            template: formData.get('template1'),
            variables: ['topic', 'chat_account'],
            weight: 50
        });
    }
    if (formData.get('template2')) {
        messageTemplates.push({
            template: formData.get('template2'),
            variables: ['topic', 'chat_account'],
            weight: 50
        });
    }

    const data = {
        name: formData.get('name'),
        enabled: true,
        maxDMsPerDay: parseInt(formData.get('maxDMsPerDay')),
        delayBetweenDMs: {
            min: parseInt(formData.get('delayMin')),
            max: 180
        },
        breaks: {
            enabled: true,
            afterActions: 10,
            breakDuration: { min: 600, max: 1800 }
        },
        activeHours: {
            start: '09:00',
            end: '21:00',
            timezone: 'America/New_York'
        },
        targetSources: [
            { type: 'community_members', value: 'default', weight: 100 }
        ],
        messageTemplates,
        personalization: {
            extractTopicFromBio: true,
            extractTopicFromRecentTweets: true,
            maxTweetsToAnalyze: 3
        },
        accountIds: []
    };

    try {
        const response = await fetch(`${API_URL}/configs/mass-dm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            alert('✅ Mass DM config saved!');
        } else {
            alert('❌ Error: ' + result.error);
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
});

// ============================================
// AI CHAT CONFIG
// ============================================

document.getElementById('chatConfigForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {
        name: formData.get('name'),
        enabled: true,
        aiProvider: {
            type: 'custom_api',
            apiUrl: formData.get('apiUrl'),
            apiKey: formData.get('apiKey'),
            model: 'gpt-4'
        },
        responseDelay: {
            min: 10,
            max: 300
        },
        maxConversationsPerDay: 50,
        maxMessagesPerConversation: parseInt(formData.get('maxMessages')),
        activeHours: {
            start: '08:00',
            end: '23:00',
            timezone: 'America/New_York'
        },
        strategy: {
            messagesToEngageBefore: parseInt(formData.get('messagesBeforeLink')),
            messagesToEngageAfter: 15,
            sendLinkTriggers: [
                { type: 'message_count', value: parseInt(formData.get('messagesBeforeLink')) }
            ]
        },
        personality: {
            style: 'flirty_argumentative',
            tone: 'playful',
            customInstructions: formData.get('personality')
        },
        contextWindow: {
            maxMessages: 20,
            includeUserBio: true,
            includeRecentTweets: false
        },
        ofLinkMessage: {
            templates: [
                "Alright you got some good points 😂 Want to see more of me? Check my OF 👇\n{of_link}"
            ],
            randomize: false
        },
        typingSimulation: {
            enabled: true,
            wordsPerMinute: 60
        },
        accountIds: []
    };

    try {
        const response = await fetch(`${API_URL}/configs/ai-chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            alert('✅ AI Chat config saved!');
        } else {
            alert('❌ Error: ' + result.error);
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
});

// Load accounts on page load
document.addEventListener('DOMContentLoaded', () => {
    loadAccounts();
});

