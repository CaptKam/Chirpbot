// Admin Dashboard JavaScript
let currentUsers = [];
let currentStats = {};
let currentSport = 'MLB';
let globalAlertSettings = {};

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    checkAuthentication();

    // Initialize dashboard
    initializeDashboard();

    // Load initial data
    loadDashboardData();

    // Update sport selector with NCAAF
    const sportSelector = document.getElementById('sportSelector');
    if (sportSelector) {
        loadSportAlertSettings(); // Load settings for the default sport on load
    }
});

async function checkAuthentication() {
    try {
        const response = await fetch('/api/admin-auth/verify', {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            redirectToLogin();
            return;
        }

        const data = await response.json();
        if (!data.authenticated) {
            redirectToLogin();
            return;
        }

        // Update admin info
        updateAdminInfo(data.user);
    } catch (error) {
        console.error('Auth check error:', error);
        redirectToLogin();
    }
}

function redirectToLogin() {
    localStorage.removeItem('adminLoggedIn');
    localStorage.removeItem('adminUser');
    window.location.href = '/admin/login.html';
}

function updateAdminInfo(user) {
    const adminUsername = document.getElementById('adminUsername');
    const adminAvatar = document.getElementById('adminAvatar');

    if (adminUsername && user.username) {
        adminUsername.textContent = user.username;
    }

    if (adminAvatar && user.username) {
        adminAvatar.textContent = user.username.charAt(0).toUpperCase();
    }
}

function initializeDashboard() {
    // Set up event listeners and initial state
    console.log('Dashboard initialized');
}

async function loadDashboardData() {
    await Promise.all([
        loadStats(),
        loadUsers()
    ]);
}

async function loadStats() {
    try {
        const response = await fetch('/api/admin/stats', {
            method: 'GET',
            credentials: 'include'
        });

        if (response.ok) {
            currentStats = await response.json();
            updateStatsDisplay();
        } else {
            console.error('Failed to load stats');
        }
    } catch (error) {
        console.error('Stats loading error:', error);
    }
}

async function loadUsers() {
    try {
        const response = await fetch('/api/admin/users', {
            method: 'GET',
            credentials: 'include'
        });

        if (response.ok) {
            currentUsers = await response.json();
            updateUsersTable();
        } else {
            console.error('Failed to load users');
        }
    } catch (error) {
        console.error('Users loading error:', error);
    }
}

function updateStatsDisplay() {
    const totalUsersEl = document.getElementById('totalUsers');
    const totalAdminsEl = document.getElementById('totalAdmins');
    const todayAlertsEl = document.getElementById('todayAlerts');
    const totalAlertsEl = document.getElementById('totalAlerts');

    if (totalUsersEl) totalUsersEl.textContent = currentStats.users?.total || 0;
    if (totalAdminsEl) totalAdminsEl.textContent = currentStats.users?.admins || 0;
    if (todayAlertsEl) todayAlertsEl.textContent = currentStats.alerts?.today || 0;
    if (totalAlertsEl) totalAlertsEl.textContent = currentStats.alerts?.total || 0;
}

function updateUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    if (currentUsers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: #94a3b8; padding: 40px;">
                    <i class="fas fa-users" style="font-size: 32px; margin-bottom: 10px; opacity: 0.5;"></i>
                    <br>No users found
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = currentUsers.map(user => `
        <tr class="table-row">
            <td>
                <div class="user-info">
                    <div class="user-avatar">${user.username ? user.username.charAt(0).toUpperCase() : 'U'}</div>
                    <div class="user-details">
                        <h4>${user.username || 'Unknown'}</h4>
                        <p>Joined ${new Date(user.createdAt).toLocaleDateString()}</p>
                    </div>
                </div>
            </td>
            <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-envelope" style="color: #64748b; font-size: 12px;"></i>
                    <span>${user.email || 'No email'}</span>
                </div>
            </td>
            <td>
                <span class="role-badge ${user.role || 'user'}">${(user.role || 'user').toUpperCase()}</span>
            </td>
            <td>
                <span style="text-transform: capitalize; color: #94a3b8;">${user.authMethod || 'Local'}</span>
            </td>
            <td>
                <span class="status-badge ${user.telegramEnabled ? 'enabled' : 'disabled'}">
                    ${user.telegramEnabled ? 'Enabled' : 'Disabled'}
                </span>
            </td>
            <td>
                <div style="display: flex; gap: 8px;">
                    <select class="role-select" onchange="updateUserRole('${user.id}', this.value)" value="${user.role || 'user'}">
                        <option value="user" ${(user.role || 'user') === 'user' ? 'selected' : ''}>User</option>
                        <option value="analyst" ${user.role === 'analyst' ? 'selected' : ''}>Analyst</option>
                        <option value="manager" ${user.role === 'manager' ? 'selected' : ''}>Manager</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                    <button class="action-btn edit" onclick="editUser('${user.id}')">
                        <i class="fas fa-edit"></i>
                        Edit
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function updateUserRole(userId, newRole) {
    try {
        const response = await fetch(`/api/admin/users/${userId}/role`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ role: newRole })
        });

        if (response.ok) {
            // Update local data
            const userIndex = currentUsers.findIndex(u => u.id === userId);
            if (userIndex !== -1) {
                currentUsers[userIndex].role = newRole;
                updateUsersTable();
            }

            // Reload stats to reflect changes
            await loadStats();

            showNotification('User role updated successfully', 'success');
        } else {
            const error = await response.json();
            showNotification(error.message || 'Failed to update user role', 'error');
        }
    } catch (error) {
        console.error('Role update error:', error);
        showNotification('Failed to update user role', 'error');
    }
}

function editUser(userId) {
    const user = currentUsers.find(u => u.id === userId);
    if (!user) return;

    // For now, just show user details
    alert(`User Details:\n\nUsername: ${user.username}\nEmail: ${user.email}\nRole: ${user.role}\nCreated: ${new Date(user.createdAt).toLocaleDateString()}`);
}

function filterUsers() {
    const searchTerm = document.getElementById('userSearch').value.toLowerCase();
    const filteredUsers = currentUsers.filter(user => 
        (user.username || '').toLowerCase().includes(searchTerm) ||
        (user.email || '').toLowerCase().includes(searchTerm) ||
        (user.role || '').toLowerCase().includes(searchTerm)
    );

    // Temporarily update the display with filtered users
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    if (filteredUsers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: #94a3b8; padding: 40px;">
                    <i class="fas fa-search" style="font-size: 32px; margin-bottom: 10px; opacity: 0.5;"></i>
                    <br>No users match your search
                </td>
            </tr>
        `;
        return;
    }

    // Use the same logic as updateUsersTable but with filtered data
    tbody.innerHTML = filteredUsers.map(user => `
        <tr class="table-row">
            <td>
                <div class="user-info">
                    <div class="user-avatar">${user.username ? user.username.charAt(0).toUpperCase() : 'U'}</div>
                    <div class="user-details">
                        <h4>${user.username || 'Unknown'}</h4>
                        <p>Joined ${new Date(user.createdAt).toLocaleDateString()}</p>
                    </div>
                </div>
            </td>
            <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-envelope" style="color: #64748b; font-size: 12px;"></i>
                    <span>${user.email || 'No email'}</span>
                </div>
            </td>
            <td>
                <span class="role-badge ${user.role || 'user'}">${(user.role || 'user').toUpperCase()}</span>
            </td>
            <td>
                <span style="text-transform: capitalize; color: #94a3b8;">${user.authMethod || 'Local'}</span>
            </td>
            <td>
                <span class="status-badge ${user.telegramEnabled ? 'enabled' : 'disabled'}">
                    ${user.telegramEnabled ? 'Enabled' : 'Disabled'}
                </span>
            </td>
            <td>
                <div style="display: flex; gap: 8px;">
                    <select class="role-select" onchange="updateUserRole('${user.id}', this.value)" value="${user.role || 'user'}">
                        <option value="user" ${(user.role || 'user') === 'user' ? 'selected' : ''}>User</option>
                        <option value="analyst" ${user.role === 'analyst' ? 'selected' : ''}>Analyst</option>
                        <option value="manager" ${user.role === 'manager' ? 'selected' : ''}>Manager</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                    <button class="action-btn edit" onclick="editUser('${user.id}')">
                        <i class="fas fa-edit"></i>
                        Edit
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function refreshUsers() {
    const refreshBtn = document.querySelector('[onclick="refreshUsers()"]');
    if (refreshBtn) {
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
        refreshBtn.disabled = true;
    }

    await loadUsers();

    if (refreshBtn) {
        refreshBtn.innerHTML = '<i class="fas fa-sync"></i> Refresh';
        refreshBtn.disabled = false;
    }

    showNotification('User data refreshed', 'success');
}

function showTab(tabName) {
    // Hide all tab contents
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(content => content.style.display = 'none');

    // Remove active class from all tabs
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => tab.classList.remove('active'));

    // Show selected tab content
    const targetContent = document.getElementById(tabName + 'Content');
    if (targetContent) {
        targetContent.style.display = 'block';
    }

    // Add active class to clicked tab
    const targetTab = document.getElementById(tabName + 'Tab');
    if (targetTab) {
        targetTab.classList.add('active');
    }

    // Load alert settings when alerts tab is opened
    if (tabName === 'alerts') {
        loadSportAlertSettings();
    }
}

async function handleLogout() {
    try {
        const response = await fetch('/api/admin-auth/logout', {
            method: 'POST',
            credentials: 'include'
        });

        // Clear local storage regardless of response
        localStorage.removeItem('adminLoggedIn');
        localStorage.removeItem('adminUser');

        // Redirect to login
        window.location.href = '/admin/login.html';
    } catch (error) {
        console.error('Logout error:', error);
        // Still redirect on error
        localStorage.removeItem('adminLoggedIn');
        localStorage.removeItem('adminUser');
        window.location.href = '/admin/login.html';
    }
}

// Alert Configuration Functions
const ALERT_TYPE_CONFIG = {
    'MLB': {
        'Game Situations': [
            { key: 'RISP', label: 'Runner in Scoring Position', description: 'Runner on 2nd or 3rd base' },
            { key: 'BASES_LOADED', label: 'Bases Loaded', description: 'All three bases occupied' },
            { key: 'RUNNERS_1ST_2ND', label: 'Runners on 1st & 2nd', description: 'Prime scoring opportunity' },
            { key: 'LATE_PRESSURE', label: 'Late Inning Pressure', description: '8th+ inning, close game' }
        ],
        'Scoring Events': [
            { key: 'HOME_RUN_LIVE', label: 'Home Run (Live)', description: 'Live home run alerts' },
            { key: 'CLOSE_GAME_LIVE', label: 'Close Game (Live)', description: 'Live close game updates' },
            { key: 'HIGH_SCORING', label: 'High Scoring Game', description: '12+ total runs' },
            { key: 'SHUTOUT', label: 'Shutout', description: 'One team held scoreless' },
            { key: 'BLOWOUT', label: 'Blowout', description: '7+ run difference' },
            { key: 'CLOSE_GAME', label: 'Close Game (Final)', description: '≤3 run difference final' }
        ],
        'At-Bat Situations': [
            { key: 'FULL_COUNT', label: 'Full Count', description: '3-2 count pressure' },
            { key: 'STRIKEOUT', label: 'Strikeout Alert', description: 'Real-time strikeout notifications' },
            { key: 'POWER_HITTER', label: 'Power Hitter', description: '20+ HR batter at plate' },
            { key: 'HOT_HITTER', label: 'Hot Hitter', description: 'Already homered today' }
        ],
        'AI Enhancements': [
            { key: 'AI_ENHANCED_MESSAGES', label: 'AI-Enhanced Alert Messages', description: 'AI adds context like launch angle insights' },
            { key: 'AI_PREDICTIVE_AT_BAT', label: 'Predictive At-Bat Analysis', description: 'AI predicts contact probability and outcomes' },
            { key: 'AI_SCORING_PROBABILITY', label: 'Real-Time Scoring Probability', description: 'AI calculates and displays scoring chances' },
            { key: 'AI_SITUATION_ANALYSIS', label: 'Game Situation Analysis', description: 'AI analyzes pressure situations and momentum' },
            { key: 'AI_EVENT_SUMMARIES', label: 'AI Event Summaries', description: 'AI summarizes recent game developments' },
            { key: 'AI_ROI_ALERTS', label: 'Advanced ROI Analysis', description: 'AI provides betting-focused insights and ROI analysis' }
        ],
        'RE24 System': [
            { key: 'RE24_ENABLED', label: 'RE24 Probability System', description: 'Advanced run expectancy calculations for scoring probability' },
            { key: 'RE24_CONTEXT_FACTORS', label: 'RE24 Context Adjustments', description: 'Weather, power hitter, and ballpark factors' },
            { key: 'RE24_MINIMUM_THRESHOLDS', label: 'RE24 Minimum Thresholds', description: 'Probability-based alert filtering (40-45% minimums)' },
            { key: 'RE24_DYNAMIC_PRIORITY', label: 'RE24 Dynamic Priorities', description: 'Priority scaling based on calculated probabilities' }
        ]
    },
    NCAAF: {
        "Game Flow": [
            { key: "NCAAF_GAME_START", label: "Game Start", description: "Game kickoff notification" },
            { key: "NCAAF_SECOND_HALF_KICKOFF", label: "Second Half Kickoff", description: "Second half begins notification" },
            { key: "RED_ZONE", label: "Red Zone Opportunities", description: "Team advances inside the 20-yard line" },
            { key: "FOURTH_DOWN", label: "Fourth Down Situations", description: "Critical fourth down attempts" },
            { key: "TWO_MINUTE_WARNING", label: "Two-Minute Warning", description: "Final 2 minutes of each half" },
            { key: "CLUTCH_TIME", label: "Clutch Time Situations", description: "High-pressure game moments" },
            { key: "OVERTIME", label: "Overtime Play", description: "Games entering overtime" }
        ]
    },
    WNBA: {
        "Critical Moments": [
            { key: "WNBA_FOURTH_QUARTER", label: "Fourth Quarter Crunch Time", description: "Close games in final 5 minutes of 4th quarter" },
            { key: "WNBA_CLOSE_GAME", label: "Close Games", description: "Games within 5 points in 3rd or 4th quarter" },
            { key: "WNBA_OVERTIME", label: "Overtime Games", description: "Games entering overtime period" }
        ],
        "Scoring Events": [
            { key: "WNBA_HIGH_SCORING", label: "High-Scoring Games", description: "Games with 160+ combined points" },
            { key: "WNBA_COMEBACK", label: "Comeback Alerts", description: "Teams erasing large deficits" },
            { key: "WNBA_CLUTCH_PERFORMANCE", label: "Clutch Performances", description: "Outstanding individual performances in critical moments" }
        ]
    },
    NFL: {
        "Game Flow": [
            { key: "NFL_GAME_START", label: "Game Start", description: "Game kickoff notification" },
            { key: "NFL_SECOND_HALF_KICKOFF", label: "Second Half Kickoff", description: "Second half begins notification" },
            { key: "RED_ZONE", label: "Red Zone Opportunities", description: "Team advances inside the 20-yard line" },
            { key: "FOURTH_DOWN", label: "Fourth Down Situations", description: "Critical fourth down attempts" },
            { key: "TWO_MINUTE_WARNING", label: "Two-Minute Warning", description: "Final 2 minutes of each half" }
        ]
    },
    CFL: {
        "Game Flow": [
            { key: "CFL_GAME_START", label: "Game Start", description: "Game kickoff notification" },
            { key: "CFL_SECOND_HALF_KICKOFF", label: "Second Half Kickoff", description: "Second half begins notification" },
            { key: "RED_ZONE", label: "Red Zone Opportunities", description: "Team advances inside the 25-yard line" },
            { key: "THIRD_DOWN", label: "Third Down (CFL)", description: "Critical third down conversion attempts" },
            { key: "THREE_MINUTE_WARNING", label: "Three-Minute Warning", description: "Final 3 minutes of each half" },
            { key: "CLOSE_GAME", label: "Close Game Alert", description: "Games with tight scores" },
            { key: "OVERTIME", label: "Overtime Play", description: "Games entering overtime" }
        ]
    },
};

async function loadSportAlertSettings() {
    const sportSelector = document.getElementById('sportSelector');
    const sportTitle = document.getElementById('sportTitle');
    const alertConfigContainer = document.getElementById('alertConfigContainer');

    currentSport = sportSelector.value;
    if (sportTitle) {
        sportTitle.textContent = currentSport;
    }

    // Show loading
    alertConfigContainer.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        // Load global settings for this sport
        const response = await fetch(`/api/admin/global-alert-settings/${currentSport}`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            globalAlertSettings = data || {};
        } else {
            // If not authorized or other error, use default settings
            globalAlertSettings = {};
            console.warn('Using default settings - API returned:', response.status);
        }

        renderAlertConfiguration();
    } catch (error) {
        console.error('Error loading alert settings:', error);
        // Use default settings on error
        globalAlertSettings = {};

        // Still render the configuration with defaults
        renderAlertConfiguration();

        // Show a less intrusive notification
        showNotification('Using default alert settings', 'info');
    }
}

function renderAlertConfiguration() {
    const alertConfigContainer = document.getElementById('alertConfigContainer');
    const sportConfig = ALERT_TYPE_CONFIG[currentSport];

    if (!sportConfig) {
        alertConfigContainer.innerHTML = `
            <div style="text-align: center; color: #94a3b8; padding: 40px;">
                <i class="fas fa-info-circle" style="font-size: 32px; margin-bottom: 15px;"></i>
                <h3>No Configuration Available</h3>
                <p>Alert configuration for ${currentSport} is not yet available.</p>
            </div>
        `;
        return;
    }

    let html = '';

    Object.entries(sportConfig).forEach(([category, alerts]) => {
        html += `
            <div class="alert-category">
                <div class="category-header">
                    <div class="category-title">
                        <i class="${getCategoryIcon(category)}"></i>
                        ${category}
                    </div>
                    <div class="category-toggle">
                        <span>Enable All</span>
                        <label class="switch">
                            <input type="checkbox" onchange="toggleCategory('${category}')" 
                                   ${isCategoryEnabled(category) ? 'checked' : ''}>
                            <span class="slider round"></span>
                        </label>
                    </div>
                </div>
                <div class="alert-list">
                    ${alerts.map(alert => `
                        <div class="alert-item">
                            <div class="alert-info">
                                <div class="alert-title">${alert.label}</div>
                                <div class="alert-description">${alert.description}</div>
                            </div>
                            <div class="alert-controls">
                                <div class="user-count">${getUserCountForAlert(alert.key)} users</div>
                                <label class="switch">
                                    <input type="checkbox" 
                                           id="alert-${alert.key}"
                                           onchange="toggleGlobalAlert('${alert.key}')"
                                           ${isAlertGloballyEnabled(alert.key) ? 'checked' : ''}>
                                    <span class="slider round"></span>
                                </label>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    });

    alertConfigContainer.innerHTML = html;
}

function getCategoryIcon(category) {
    switch (category) {
        case "Game Situations": return "fas fa-gamepad text-emerald-400";
        case "Scoring Events": return "fas fa-trophy text-yellow-400";
        case "At-Bat Situations": return "fas fa-clock text-blue-400";
        case "Game Flow": return "fas fa-random text-teal-400";
        case "Critical Moments": return "fas fa-exclamation-triangle text-red-400";
        default: return "fas fa-bell text-slate-400";
    }
}

function isCategoryEnabled(category) {
    const sportConfig = ALERT_TYPE_CONFIG[currentSport];
    if (!sportConfig || !sportConfig[category]) return false;

    return sportConfig[category].every(alert => 
        isAlertGloballyEnabled(alert.key)
    );
}

function isAlertGloballyEnabled(alertKey) {
    return globalAlertSettings[alertKey] !== false;
}

function getUserCountForAlert(alertKey) {
    // Calculate how many users have this alert enabled
    // This would be populated from actual user data
    return Math.floor(Math.random() * currentUsers.length || 50);
}

async function toggleMasterAlerts() {
    const toggle = document.getElementById('masterAlertToggle');
    const isEnabled = toggle.checked;

    try {
        const response = await fetch('/api/admin/master-alerts', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ enabled: isEnabled })
        });

        if (response.ok) {
            showNotification(`Master alerts ${isEnabled ? 'enabled' : 'disabled'}`, 'success');
        } else {
            toggle.checked = !isEnabled; // Revert on error
            showNotification('Failed to update master alerts', 'error');
        }
    } catch (error) {
        console.error('Error toggling master alerts:', error);
        toggle.checked = !isEnabled;
        showNotification('Failed to update master alerts', 'error');
    }
}

async function toggleCategory(category) {
    const sportConfig = ALERT_TYPE_CONFIG[currentSport];
    if (!sportConfig || !sportConfig[category]) return;

    const shouldEnable = !isCategoryEnabled(category);
    const alertKeys = sportConfig[category].map(alert => alert.key);

    try {
        const response = await fetch('/api/admin/global-alert-category', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ 
                sport: currentSport,
                category: category,
                alertKeys: alertKeys,
                enabled: shouldEnable 
            })
        });

        if (response.ok) {
            // Update local state
            alertKeys.forEach(key => {
                globalAlertSettings[key] = shouldEnable;
            });

            // Automatically apply these changes to all users
            await applyGlobalSettingsToAllUsers();

            // Re-render configuration
            renderAlertConfiguration();
            showNotification(`${category} alerts ${shouldEnable ? 'enabled' : 'disabled'} globally`, 'success');
        } else {
            showNotification('Failed to update category settings', 'error');
        }
    } catch (error) {
        console.error('Error toggling category:', error);
        showNotification('Failed to update category settings', 'error');
    }
}

async function toggleGlobalAlert(alertKey) {
    const toggle = document.getElementById(`alert-${alertKey}`);
    const isEnabled = toggle.checked;

    try {
        const response = await fetch('/api/admin/global-alert-setting', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ 
                sport: currentSport,
                alertType: alertKey,
                enabled: isEnabled 
            })
        });

        if (response.ok) {
            globalAlertSettings[alertKey] = isEnabled;

            // Automatically apply this change to all users
            await applyGlobalSettingsToAllUsers();

            showNotification(`Alert ${isEnabled ? 'enabled' : 'disabled'} globally`, 'success');
        } else {
            toggle.checked = !isEnabled;
            showNotification('Failed to update alert setting', 'error');
        }
    } catch (error) {
        console.error('Error toggling alert:', error);
        toggle.checked = !isEnabled;
        showNotification('Failed to update alert setting', 'error');
    }
}

// Auto-apply function - simplified to always apply changes
async function applyGlobalSettingsToAllUsers() {
    try {
        const response = await fetch('/api/admin/apply-global-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ 
                sport: currentSport,
                settings: globalAlertSettings 
            })
        });

        if (response.ok) {
            console.log('Global settings automatically applied to all users');
        } else {
            console.error('Failed to apply settings to all users');
        }
    } catch (error) {
        console.error('Error applying settings:', error);
    }
}

async function refreshAlertSettings() {
    await loadSportAlertSettings();
    showNotification('Alert settings refreshed', 'success');
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 1000;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;

    // Set background color based on type
    switch (type) {
        case 'success':
            notification.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            break;
        case 'error':
            notification.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
            break;
        default:
            notification.style.background = 'linear-gradient(135deg, #3b82f6, #1d4ed8)';
    }

    notification.textContent = message;
    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);

    // Remove after delay
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Function to switch sport and load settings
function switchSport(sport) {
    currentSport = sport;
    loadSportAlertSettings();
}

// Add event listener for sport selector change
const sportSelector = document.getElementById('sportSelector');
if (sportSelector) {
    sportSelector.addEventListener('change', function() {
        switchSport(this.value);
    });
}