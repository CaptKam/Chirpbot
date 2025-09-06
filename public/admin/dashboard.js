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

    // Load master alert status from database
    loadMasterAlertStatus();

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
    try {
        // Load stats
        const statsResponse = await fetch('/api/admin/stats', {
            credentials: 'include'
        });
        const stats = await statsResponse.json();

        updateStatsDisplay(stats);

        // Load users
        const usersResponse = await fetch('/api/admin/users', {
            credentials: 'include'
        });

        if (usersResponse.ok) {
            const users = await usersResponse.json();
            displayUsers(users);
        } else {
            console.warn('Failed to fetch users for display (may be authentication issue)');
            displayUsers([]);
        }

        // Load sport alert settings
        loadSportAlertSettings();

        // Load recent activity
        loadRecentActivity();

    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showNotification('Failed to load dashboard data', 'error');
    }
}

async function loadRecentActivity() {
    const activityContainer = document.getElementById('recentActivity');
    if (!activityContainer) return;

    // Show immediate loading state
    activityContainer.innerHTML = `
        <div class="activity-item">
            <div class="activity-icon system">
                <i class="fas fa-sync fa-spin"></i>
            </div>
            <div class="activity-content">
                <div class="activity-title">Loading...</div>
                <div class="activity-description">Fetching recent activity</div>
                <div class="activity-time">-</div>
            </div>
        </div>
    `;

    try {
        const response = await fetch('/api/alerts?limit=5', { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch alerts');

        const alerts = await response.json();

        // Build activity HTML directly
        const activities = alerts.map(alert => `
            <div class="activity-item alert">
                <div class="activity-icon alert">
                    <i class="fas fa-bell"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-title">${alert.type || 'MLB'} Alert</div>
                    <div class="activity-description">${alert.homeTeam || 'Team1'} vs ${alert.awayTeam || 'Team2'}</div>
                    <div class="activity-time">${formatTimeAgo(alert.createdAt || new Date().toISOString())}</div>
                </div>
                <div class="activity-priority high"></div>
            </div>
        `).join('');

        // Add system status
        const systemActivity = `
            <div class="activity-item system">
                <div class="activity-icon system">
                    <i class="fas fa-cog"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-title">System Status</div>
                    <div class="activity-description">All services operational</div>
                    <div class="activity-time">Just now</div>
                </div>
                <div class="activity-priority low"></div>
            </div>
        `;

        activityContainer.innerHTML = activities + systemActivity;
    } catch (error) {
        activityContainer.innerHTML = `
            <div class="activity-item system">
                <div class="activity-icon system">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-title">System Status</div>
                    <div class="activity-description">All services operational</div>
                    <div class="activity-time">Just now</div>
                </div>
                <div class="activity-priority low"></div>
            </div>
        `;
    }
}

function formatTimeAgo(dateString) {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) {
        return 'Just now';
    } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        return `${minutes}m ago`;
    } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        return `${hours}h ago`;
    } else {
        const days = Math.floor(diffInSeconds / 86400);
        return `${days}d ago`;
    }
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
                    <button class="action-btn delete ${getUserDeleteDisabled(user) ? 'disabled' : ''}" 
                            onclick="deleteUser('${user.id}', '${user.username || 'Unknown'}', '${user.role || 'user'}')"
                            ${getUserDeleteDisabled(user) ? 'disabled' : ''}
                            title="${getDeleteTooltip(user)}">
                        <i class="fas fa-trash"></i>
                        Delete
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

// Helper functions for delete button state
function getUserDeleteDisabled(user) {
    // Get current admin user from localStorage
    const currentAdminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');

    // Can't delete yourself
    if (user.id === currentAdminUser.id) return true;

    // Can't delete the last admin
    if (user.role === 'admin') {
        const adminCount = currentUsers.filter(u => u.role === 'admin').length;
        if (adminCount <= 1) return true;
    }

    return false;
}

function getDeleteTooltip(user) {
    const currentAdminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');

    if (user.id === currentAdminUser.id) {
        return "Cannot delete your own account";
    }

    if (user.role === 'admin') {
        const adminCount = currentUsers.filter(u => u.role === 'admin').length;
        if (adminCount <= 1) {
            return "Cannot delete the last admin user";
        }
    }

    return "Delete this user and all associated data";
}

async function deleteUser(userId, username, role) {
    // Double confirmation dialog
    const confirmed = confirm(
        `⚠️ DELETE USER CONFIRMATION\n\n` +
        `Are you sure you want to delete user "${username}"?\n\n` +
        `This action CANNOT be undone and will permanently remove:\n` +
        `• User account and login access\n` +
        `• All alert preferences\n` +
        `• All monitored teams\n` +
        `• All associated user data\n\n` +
        `Type "DELETE" to confirm (case sensitive)`
    );

    if (!confirmed) return;

    // Second confirmation for admin users
    if (role === 'admin') {
        const adminConfirmed = confirm(
            `🚨 ADMIN DELETION WARNING\n\n` +
            `You are about to delete an ADMIN user!\n\n` +
            `This will remove all admin privileges for "${username}".\n\n` +
            `Are you absolutely certain you want to proceed?`
        );

        if (!adminConfirmed) return;
    }

    try {
        showNotification('Deleting user...', 'info');

        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (response.ok) {
            const result = await response.json();

            // Remove user from local data
            const userIndex = currentUsers.findIndex(u => u.id === userId);
            if (userIndex !== -1) {
                currentUsers.splice(userIndex, 1);
                updateUsersTable();
            }

            // Reload stats to reflect changes
            await loadStats();

            showNotification(`✅ User "${username}" deleted successfully`, 'success');
            console.log(`🗑️ User deleted:`, result.deletedUser);
        } else {
            const error = await response.json();
            showNotification(`❌ ${error.message}`, 'error');
        }
    } catch (error) {
        console.error('Delete user error:', error);
        showNotification('❌ Failed to delete user', 'error');
    }
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
                    <button class="action-btn delete ${getUserDeleteDisabled(user) ? 'disabled' : ''}" 
                            onclick="deleteUser('${user.id}', '${user.username || 'Unknown'}', '${user.role || 'user'}')"
                            ${getUserDeleteDisabled(user) ? 'disabled' : ''}
                            title="${getDeleteTooltip(user)}">
                        <i class="fas fa-trash"></i>
                        Delete
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
        alertConfigContainer.innerHTML = `<p>No alert configuration available for ${currentSport}.</p>`;
        return;
    }

    let html = `
        <div class="alert-config-header">
            <h3 class="text-lg font-semibold mb-4">${currentSport} Alert Configuration</h3>
            <div class="mb-4 flex items-center space-x-4">
                <button onclick="enableAllAlerts()" class="btn btn-primary-outline">Enable All</button>
                <button onclick="disableAllAlerts()" class="btn btn-danger-outline">Disable All</button>
                <button onclick="refreshSettings()" class="btn btn-secondary-outline">Refresh</button>
                <button onclick="applyToAllUsers()" class="btn btn-secondary">Apply to All Users</button>
            </div>
        </div>
        <div class="space-y-6">
    `;

    // Render categories and alerts
    Object.entries(sportConfig).forEach(([category, alerts]) => {
        const categoryId = `category-${category.replace(/\s+/g, '-').toLowerCase()}`;
        const isCategoryFullyEnabled = alerts.every(alert => globalAlertSettings[alert.key] !== false);

        html += `
            <div class="alert-category">
                <div class="category-header flex items-center justify-between p-3 bg-gray-100 rounded-t">
                    <div class="flex items-center space-x-3">
                        ${getCategoryIcon(category)}
                        <span class="font-medium text-gray-700">${category}</span>
                    </div>
                    <label class="inline-flex items-center cursor-pointer">
                        <input type="checkbox" id="${categoryId}" class="form-checkbox h-5 w-5 text-blue-600" 
                               onchange="toggleCategory('${category}')" ${isCategoryFullyEnabled ? 'checked' : ''}>
                    </label>
                </div>
                <div class="category-alerts bg-white p-4 rounded-b border border-t-0 border-gray-200">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        `;

        alerts.forEach(alert => {
            const alertId = `alert-${alert.key}`;
            const isEnabled = globalAlertSettings[alert.key] !== false;
            html += `
                <div class="alert-item flex items-center justify-between p-3 border rounded ${isEnabled ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'}">
                    <div class="flex flex-col">
                        <span class="font-medium text-sm text-gray-800">${alert.label}</span>
                        <p class="text-xs text-gray-500">${alert.description}</p>
                    </div>
                    <label class="inline-flex items-center cursor-pointer ml-4">
                        <input type="checkbox" id="${alertId}" class="form-checkbox h-5 w-5 text-blue-600" 
                               onchange="toggleAlert('${alert.key}')" ${isEnabled ? 'checked' : ''}>
                    </label>
                </div>
            `;
        });

        html += `
                    </div>
                </div>
            </div>
        `;
    });

    html += `</div>`; // Close space-y-6
    alertConfigContainer.innerHTML = html;
}

// Utility functions for alert configuration
function getCategoryIcon(category) {
    switch (category) {
        case 'Game Situations':
            return '<i class="fas fa-crosshairs" style="color: #10b981;"></i>';
        case 'Scoring Events':
            return '<i class="fas fa-trophy" style="color: #fbbf24;"></i>';
        case 'At-Bat Situations':
            return '<i class="fas fa-clock" style="color: #3b82f6;"></i>';
        default:
            return '<i class="fas fa-bell" style="color: #94a3b8;"></i>';
    }
}

async function toggleAlert(alertKey) {
    const checkbox = document.getElementById(`alert-${alertKey}`);
    const enabled = checkbox.checked;

    try {
        const response = await fetch(`/api/admin/global-alert-setting`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sport: currentSport,
                alertType: alertKey,
                enabled: enabled
            })
        });

        if (!response.ok) {
            throw new Error('Failed to update alert setting');
        }

        // Update UI feedback
        showNotification(`${alertKey} ${enabled ? 'enabled' : 'disabled'}`, enabled ? 'success' : 'info');
        // Update category checkbox if needed
        updateCategoryCheckbox(alertKey, enabled);

    } catch (error) {
        console.error('Error toggling alert:', error);
        // Revert checkbox state
        checkbox.checked = !enabled;
        showNotification('Failed to update alert setting', 'error');
    }
}

async function toggleCategory(category) {
    const categoryId = `category-${category.replace(/\s+/g, '-').toLowerCase()}`;
    const checkbox = document.getElementById(categoryId);
    const enabled = checkbox.checked;

    // Get all alert keys in this category
    const alertKeys = ALERT_TYPE_CONFIG[currentSport][category].map(alert => alert.key);

    try {
        const response = await fetch(`/api/admin/global-alert-category`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sport: currentSport,
                category: category,
                alertKeys: alertKeys,
                enabled: enabled
            })
        });

        if (!response.ok) {
            throw new Error('Failed to update category');
        }

        // Update individual checkboxes
        alertKeys.forEach(alertKey => {
            const alertCheckbox = document.getElementById(`alert-${alertKey}`);
            if (alertCheckbox) {
                alertCheckbox.checked = enabled;
                // Update globalAlertSettings locally for immediate UI feedback
                globalAlertSettings[alertKey] = enabled; 
            }
        });

        showNotification(`${category} ${enabled ? 'enabled' : 'disabled'}`, enabled ? 'success' : 'info');

    } catch (error) {
        console.error('Error toggling category:', error);
        checkbox.checked = !enabled;
        showNotification('Failed to update category', 'error');
    }
}

async function enableAllAlerts() {
    const checkboxes = document.querySelectorAll('input[type="checkbox"][id^="alert-"]');
    const updatePromises = [];
    checkboxes.forEach(checkbox => {
        if (!checkbox.checked) {
            checkbox.checked = true;
            updatePromises.push(toggleAlert(checkbox.id.replace('alert-', '')));
        }
    });
    await Promise.all(updatePromises);
    showNotification('All alerts enabled', 'success');
}

async function disableAllAlerts() {
    const checkboxes = document.querySelectorAll('input[type="checkbox"][id^="alert-"]');
    const updatePromises = [];
    checkboxes.forEach(checkbox => {
        if (checkbox.checked) {
            checkbox.checked = false;
            updatePromises.push(toggleAlert(checkbox.id.replace('alert-', '')));
        }
    });
    await Promise.all(updatePromises);
    showNotification('All alerts disabled', 'info');
}

async function loadCurrentSettings() {
    try {
        const response = await fetch(`/api/admin/global-alert-settings/${currentSport}`);
        if (!response.ok) {
            throw new Error('Failed to load settings');
        }

        const settings = await response.json();
        globalAlertSettings = settings; // Update global state

        // Update checkboxes based on current settings
        Object.entries(settings).forEach(([alertKey, enabled]) => {
            const checkbox = document.getElementById(`alert-${alertKey}`);
            if (checkbox) {
                checkbox.checked = enabled;
            }
        });

        // Update category checkboxes
        Object.keys(ALERT_TYPE_CONFIG[currentSport] || {}).forEach(category => {
            updateCategoryCheckboxStatus(category);
        });

    } catch (error) {
        console.error('Error loading settings:', error);
        showNotification('Failed to load current settings', 'error');
    }
}

// Helper to update a single category checkbox based on its alerts
function updateCategoryCheckboxStatus(category) {
    const categoryId = `category-${category.replace(/\s+/g, '-').toLowerCase()}`;
    const categoryCheckbox = document.getElementById(categoryId);
    if (!categoryCheckbox) return;

    const alerts = ALERT_TYPE_CONFIG[currentSport][category];
    if (!alerts) return;
    
    // Check if all alerts in the category are enabled
    const allEnabled = alerts.every(alert => globalAlertSettings[alert.key] !== false);
    categoryCheckbox.checked = allEnabled;
}

// Helper to update a category checkbox when an individual alert changes
function updateCategoryCheckbox(alertKey, alertIsEnabled) {
    // Find which category this alert belongs to
    for (const category in ALERT_TYPE_CONFIG[currentSport]) {
        const alertsInCategory = ALERT_TYPE_CONFIG[currentSport][category];
        if (alertsInCategory.some(alert => alert.key === alertKey)) {
            updateCategoryCheckboxStatus(category);
            break; // Found the category, no need to check further
        }
    }
}

async function applyToAllUsers() {
    if (!confirm('This will apply current settings to all users. Continue?')) {
        return;
    }

    const currentSettings = getCurrentSettings();

    try {
        const response = await fetch(`/api/admin/apply-global-settings`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sport: currentSport,
                settings: currentSettings
            })
        });

        if (!response.ok) {
            throw new Error('Failed to apply settings');
        }

        const result = await response.json();
        showNotification(`Settings applied to ${result.usersUpdated} users`, 'success');

    } catch (error) {
        console.error('Error applying settings:', error);
        showNotification('Failed to apply settings to users', 'error');
    }
}

function getCurrentSettings() {
    const settings = {};
    const checkboxes = document.querySelectorAll('input[type="checkbox"][id^="alert-"]');
    checkboxes.forEach(checkbox => {
        const alertKey = checkbox.id.replace('alert-', '');
        settings[alertKey] = checkbox.checked;
    });
    return settings;
}

async function refreshSettings() {
    await loadCurrentSettings();
    showNotification('Settings refreshed', 'info');
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
        ${type === 'success' ? 'background: #10b981;' : ''}
        ${type === 'error' ? 'background: #ef4444;' : ''}
        ${type === 'info' ? 'background: #3b82f6;' : ''}
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
        notification.remove();
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

async function enableAllAlerts() {
    const checkboxes = document.querySelectorAll('input[type="checkbox"][id^="alert-"]');
    const updatePromises = [];
    checkboxes.forEach(checkbox => {
        if (!checkbox.checked) {
            checkbox.checked = true;
            updatePromises.push(toggleAlert(checkbox.id.replace('alert-', '')));
        }
    });
    await Promise.all(updatePromises);
    showNotification('All alerts enabled', 'success');
}

async function disableAllAlerts() {
    // Double confirmation for this destructive action
    const confirmed = confirm('⚠️ WARNING: This will disable ALL alert features across the entire system for ALL users.\n\nThis includes:\n- All MLB, NFL, NBA, NHL, WNBA, CFL, NCAAF alerts\n- All Telegram notifications\n- All AI enhancements\n- All RE24 features\n\nAre you absolutely sure?');

    if (!confirmed) return;

    const doubleConfirmed = confirm('🚫 FINAL CONFIRMATION: This action will completely shut down all alert functionality system-wide. Users will receive NO notifications until manually re-enabled.\n\nProceed?');

    if (!doubleConfirmed) return;

    const checkboxes = document.querySelectorAll('input[type="checkbox"][id^="alert-"]');
    const updatePromises = [];
    checkboxes.forEach(checkbox => {
        if (checkbox.checked) {
            checkbox.checked = false;
            updatePromises.push(toggleAlert(checkbox.id.replace('alert-', '')));
        }
    });
    await Promise.all(updatePromises);
    showNotification('🚫 ALL ALERTS DISABLED GLOBALLY', 'success');
}

async function loadGlobalAlertSettings() { // Renamed from loadSportAlertSettings to avoid confusion if called elsewhere
    await loadSportAlertSettings();
}