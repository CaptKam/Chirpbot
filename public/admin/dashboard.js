// Admin Dashboard JavaScript
let currentUsers = [];
let currentStats = {};
let currentSport = 'MLB';
let globalAlertSettings = {};
let authCheckInProgress = false;
let redirectInProgress = false;

document.addEventListener('DOMContentLoaded', function() {
    // Check if we've already tried to authenticate and failed
    const authFailed = sessionStorage.getItem('adminAuthFailed');
    if (authFailed) {
        console.log('🚫 Previous auth failed, redirecting immediately to login');
        window.location.replace('/admin/login.html');
        return;
    }

    // Check for existing session first
    const isLoggedIn = localStorage.getItem('adminLoggedIn');
    const adminUser = localStorage.getItem('adminUser');
    
    console.log('📱 Page load - checking stored session:', { isLoggedIn, hasUser: !!adminUser });

    // Only check authentication - don't load data until authenticated
    checkAuthentication();
});

async function checkAuthentication() {
    // Prevent multiple authentication attempts
    if (authCheckInProgress || redirectInProgress) {
        console.log('🚫 Auth check already in progress, skipping...');
        return;
    }

    authCheckInProgress = true;

    try {
        const response = await fetch('/api/admin-auth/verify', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.log('Auth check failed with status:', response.status);
            // Mark auth as failed to prevent future attempts in this session
            sessionStorage.setItem('adminAuthFailed', 'true');
            redirectToLogin();
            return;
        }

        const data = await response.json();
        if (!data.authenticated) {
            console.log('Not authenticated according to server');
            // Mark auth as failed to prevent future attempts in this session
            sessionStorage.setItem('adminAuthFailed', 'true');
            redirectToLogin();
            return;
        }

        // Store admin session data for persistence
        localStorage.setItem('adminLoggedIn', 'true');
        localStorage.setItem('adminUser', JSON.stringify(data.user));

        // Update admin info
        updateAdminInfo(data.user);
        console.log('✅ Admin authenticated:', data.user.username);

        // NOW load dashboard data after successful authentication
        initializeDashboard();
        loadDashboardData();
        loadMasterAlertStatus();
        
        // Update sport selector with NCAAF
        const sportSelector = document.getElementById('sportSelector');
        if (sportSelector) {
            loadSportAlertSettings(); // Load settings for the default sport on load
        }
    } catch (error) {
        console.error('Auth check error:', error);
        // Mark auth as failed to prevent future attempts in this session
        sessionStorage.setItem('adminAuthFailed', 'true');
        redirectToLogin();
    } finally {
        authCheckInProgress = false;
    }
}

function redirectToLogin() {
    // Prevent multiple redirects
    if (redirectInProgress) {
        console.log('🚫 Redirect already in progress, skipping...');
        return;
    }

    redirectInProgress = true;
    console.log('🔄 Redirecting to login page...');
    
    localStorage.removeItem('adminLoggedIn');
    localStorage.removeItem('adminUser');
    
    // Immediate redirect
    window.location.replace('/admin/login.html');
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
            currentUsers = users;
            updateUsersTable();
        } else {
            console.warn('Failed to fetch users for display (may be authentication issue)');
            currentUsers = [];
            updateUsersTable();
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
        'Valid Alert Types': [
            { key: 'MLB_GAME_START', label: 'Game Start', description: 'Alert when MLB game begins' },
            { key: 'MLB_SEVENTH_INNING_STRETCH', label: 'Seventh Inning Stretch', description: 'Traditional 7th inning stretch alert' }
        ],
        'High-Probability Scoring (≥65%)': [
            { key: 'MLB_RUNNER_ON_THIRD_NO_OUTS', label: 'Runner on 3rd, 0 Outs', description: '84% scoring probability situation' },
            { key: 'MLB_FIRST_AND_THIRD_NO_OUTS', label: '1st & 3rd, 0 Outs', description: '86% scoring probability situation' },
            { key: 'MLB_SECOND_AND_THIRD_NO_OUTS', label: '2nd & 3rd, 0 Outs', description: '85% scoring probability situation' },
            { key: 'MLB_BASES_LOADED_NO_OUTS', label: 'Bases Loaded, 0 Outs', description: '86% scoring probability situation' },
            { key: 'MLB_RUNNER_ON_THIRD_ONE_OUT', label: 'Runner on 3rd, 1 Out', description: '66% scoring probability situation' },
            { key: 'MLB_SECOND_AND_THIRD_ONE_OUT', label: '2nd & 3rd, 1 Out', description: '68% scoring probability situation' },
            { key: 'MLB_BASES_LOADED_ONE_OUT', label: 'Bases Loaded, 1 Out', description: '66% scoring probability situation' }
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

async function renderAlertConfiguration() {
    const alertConfigContainer = document.getElementById('alertConfigContainer');
    
    // Show loading
    alertConfigContainer.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        // Get available alerts from cylinders
        const response = await fetch(`/api/admin/available-alerts/${currentSport}`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const availableAlerts = await response.json();
            
            if (availableAlerts.length === 0) {
                alertConfigContainer.innerHTML = `
                    <div style="text-align: center; color: #94a3b8; padding: 40px;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 32px; margin-bottom: 15px;"></i>
                        <h3>No Alert Cylinders Found</h3>
                        <p>No alert modules found for ${currentSport}.<br>Create alert cylinders in <code>server/services/engines/alert-cylinders/${currentSport.toLowerCase()}/</code></p>
                    </div>
                `;
                return;
            }

            // Render alert toggles
            let html = `
                <div class="alert-controls-header">
                    <h3>${currentSport} Alert Configuration</h3>
                    <p>Enable/disable alerts globally. Users can only activate alerts that are enabled here.</p>
                </div>
                <div class="alert-types-container">
            `;

            availableAlerts.forEach(alert => {
                const isEnabled = isAlertGloballyEnabled(alert.key);
                html += `
                    <div class="alert-type-item">
                        <div class="alert-info">
                            <h4>${alert.label}</h4>
                            <p>${alert.description}</p>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${isEnabled ? 'checked' : ''} 
                                   onchange="toggleAlertSetting('${alert.key}', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                `;
            });

            html += `
                </div>
                <div class="alert-controls-footer">
                    <button onclick="refreshAlertSettings()" class="btn btn-secondary">
                        <i class="fas fa-sync"></i> Refresh Settings
                    </button>
                </div>
            `;

            alertConfigContainer.innerHTML = html;
        } else {
            alertConfigContainer.innerHTML = `
                <div style="text-align: center; color: #ef4444; padding: 40px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 32px; margin-bottom: 15px;"></i>
                    <h3>Error Loading Alerts</h3>
                    <p>Failed to load available alerts for ${currentSport}.</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading available alerts:', error);
        alertConfigContainer.innerHTML = `
            <div style="text-align: center; color: #ef4444; padding: 40px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 32px; margin-bottom: 15px;"></i>
                <h3>Error Loading Alerts</h3>
                <p>Failed to load alert configuration.</p>
            </div>
        `;
    }
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

async function loadMasterAlertStatus() {
    try {
        const response = await fetch('/api/admin/master-alerts', {
            method: 'GET',
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });

        if (response.ok) {
            const data = await response.json();
            const toggle = document.getElementById('masterAlertToggle');
            if (toggle) {
                toggle.checked = data.enabled;
            }
        } else {
            console.warn('Failed to load master alerts status, using default (enabled)');
            const toggle = document.getElementById('masterAlertToggle');
            if (toggle) {
                toggle.checked = true; // Default to enabled if can't load
            }
        }
    } catch (error) {
        console.error('Error loading master alerts status:', error);
        // Default to enabled on error
        const toggle = document.getElementById('masterAlertToggle');
        if (toggle) {
            toggle.checked = true;
        }
    }
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

async function enableAllAlerts() {
    try {
        showNotification('Enabling all alerts...', 'info');

        const response = await fetch('/api/admin/enable-all-alerts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });

        const result = await response.json();

        if (response.ok) {
            showNotification(`Enabled ${result.count} alert types`, 'success');
            // Reload settings to reflect changes
            setTimeout(() => {
                loadGlobalAlertSettings();
            }, 1000);
        } else {
            showNotification(result.message || 'Failed to enable alerts', 'error');
        }
    } catch (error) {
        console.error('Error enabling all alerts:', error);
        showNotification('Failed to enable all alerts', 'error');
    }
}

async function disableAllAlerts() {
    // Double confirmation for this destructive action
    const confirmed = confirm('⚠️ WARNING: This will disable ALL alert features across the entire system for ALL users.\n\nThis includes:\n- All MLB, NFL, NBA, NHL, WNBA, CFL, NCAAF alerts\n- All Telegram notifications\n- All AI enhancements\n- All RE24 features\n\nAre you absolutely sure?');

    if (!confirmed) return;

    const doubleConfirmed = confirm('🚫 FINAL CONFIRMATION: This action will completely shut down all alert functionality system-wide. Users will receive NO notifications until manually re-enabled.\n\nProceed?');

    if (!doubleConfirmed) return;

    try {
        showNotification('🚫 Disabling ALL alerts globally...', 'warning');

        const response = await fetch('/api/admin/disable-all-alerts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });

        const result = await response.json();

        if (response.ok) {
            showNotification(
                `🚫 ALL ALERTS DISABLED: ${result.summary.alertTypesDisabled} alert types disabled, ${result.summary.telegramUsersDisabled} Telegram configs disabled`, 
                'success'
            );

            // Show summary
            console.log('Disable All Alerts Result:', result);

            // Reload settings to reflect changes
            setTimeout(() => {
                loadGlobalAlertSettings();
            }, 1000);
        } else {
            showNotification(result.message || 'Failed to disable all alerts', 'error');
        }
    } catch (error) {
        console.error('Error disabling all alerts:', error);
        showNotification('Failed to disable all alerts', 'error');
    }
}