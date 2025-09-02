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
    MLB: {
        "Game Situations": [
            { key: "RISP", label: "RISP (Runners in Scoring Position)", description: "Alert when runners are on 2nd or 3rd base" },
            { key: "BASES_LOADED", label: "Bases Loaded", description: "Alert when all three bases are occupied" },
            { key: "RUNNERS_1ST_2ND", label: "Runners on 1st & 2nd", description: "Prime scoring opportunity alert" },
            { key: "CLOSE_GAME", label: "Close Game", description: "Games with score difference ≤ 3 runs" },
            { key: "CLOSE_GAME_LIVE", label: "Live Close Game", description: "Real-time close game situations" },
            { key: "LATE_PRESSURE", label: "Late Inning Pressure", description: "8th inning or later with close score" },
        ],
        "Scoring Events": [
            { key: "HOME_RUN_LIVE", label: "Home Run (Live)", description: "Real-time home run alerts as they happen" },
            { key: "HIGH_SCORING", label: "High-Scoring Game", description: "Games with 12+ total runs" },
            { key: "SHUTOUT", label: "Shutout Alert", description: "When a team gets shut out (0 runs)" },
            { key: "BLOWOUT", label: "Blowout Game", description: "Games with 7+ run difference" },
        ],
        "At-Bat Situations": [
            { key: "FULL_COUNT", label: "Full Count (3-2)", description: "Maximum pressure at-bat situations" },
            { key: "STRIKEOUT", label: "Strikeout Alert", description: "Real-time strikeout notifications" },
        ]
    },
    NFL: {
        "Game Situations": [
            { key: "RED_ZONE", label: "Red Zone Situations", description: "Team inside the 20-yard line" },
            { key: "CLOSE_GAME", label: "Close Game Alert", description: "Games with tight scores" },
            { key: "FOURTH_DOWN", label: "Fourth Down", description: "Critical 4th down conversion attempts" },
            { key: "TWO_MINUTE_WARNING", label: "Two Minute Warning", description: "End-of-half pressure situations" },
        ]
    },
    NBA: {
        "Game Situations": [
            { key: "CLUTCH_TIME", label: "Clutch Time", description: "Final 5 minutes with close score" },
            { key: "CLOSE_GAME", label: "Close Game Alert", description: "Games with tight scores" },
            { key: "OVERTIME", label: "Overtime", description: "Games going to overtime" },
        ]
    },
    NHL: {
        "Game Situations": [
            { key: "POWER_PLAY", label: "Power Play", description: "Man advantage situations" },
            { key: "CLOSE_GAME", label: "Close Game Alert", description: "Games with tight scores" },
            { key: "EMPTY_NET", label: "Empty Net", description: "Goalie pulled situations" },
        ]
    },
    CFL: {
        "Game Situations": [
            { key: "CLOSE_GAME", label: "Close Game Alert", description: "Games with tight scores" },
            { key: "FOURTH_DOWN", label: "Third Down (CFL)", description: "Critical down conversion attempts" },
        ]
    },
    NCAAF: {
        "Game Situations": [
            { key: "CLOSE_GAME", label: "Close Game Alert", description: "Games with tight scores" },
            { key: "FOURTH_DOWN", label: "Fourth Down", description: "Critical conversion attempts" },
            { key: "TWO_MINUTE_WARNING", label: "Two Minute Warning", description: "End-of-quarter/half pressure situations" },
        ]
    }
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
            
            // Re-render configuration
            renderAlertConfiguration();
            showNotification(`${category} alerts ${shouldEnable ? 'enabled' : 'disabled'}`, 'success');
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

async function applyToAllUsers() {
    if (!confirm('This will apply the current global alert settings to ALL users. Are you sure?')) {
        return;
    }
    
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
            showNotification('Global settings applied to all users successfully', 'success');
        } else {
            showNotification('Failed to apply settings to all users', 'error');
        }
    } catch (error) {
        console.error('Error applying settings:', error);
        showNotification('Failed to apply settings to all users', 'error');
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

// System Configuration Functions
let systemConfig = {};

async function loadSystemConfiguration() {
    try {
        const response = await fetch('/api/admin/system-config', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });
        
        if (response.ok) {
            systemConfig = await response.json();
            populateSystemConfigUI();
            showNotification('System configuration loaded', 'success');
        } else {
            console.error('Failed to load system configuration');
            showNotification('Failed to load system configuration', 'error');
        }
    } catch (error) {
        console.error('Error loading system configuration:', error);
        showNotification('Failed to load system configuration', 'error');
    }
}

function populateSystemConfigUI() {
    // Core System Controls
    if (systemConfig.core) {
        // Master Toggle
        if (systemConfig.core.master_toggle) {
            const toggle = document.getElementById('masterToggle');
            const label = document.getElementById('masterToggleLabel');
            if (toggle && label) {
                toggle.checked = systemConfig.core.master_toggle.value;
                label.textContent = systemConfig.core.master_toggle.value ? 'Enabled' : 'Disabled';
            }
        }
        
        // Maintenance Mode
        if (systemConfig.core.maintenance_mode) {
            const toggle = document.getElementById('maintenanceMode');
            const label = document.getElementById('maintenanceModeLabel');
            if (toggle && label) {
                toggle.checked = systemConfig.core.maintenance_mode.value;
                label.textContent = systemConfig.core.maintenance_mode.value ? 'Enabled' : 'Disabled';
            }
        }
        
        // Maintenance Message
        if (systemConfig.core.maintenance_message) {
            const input = document.getElementById('maintenanceMessage');
            if (input) {
                input.value = systemConfig.core.maintenance_message.value;
            }
        }
        
        // System Announcements
        if (systemConfig.core.announcement_enabled) {
            const toggle = document.getElementById('announcementEnabled');
            const label = document.getElementById('announcementEnabledLabel');
            if (toggle && label) {
                toggle.checked = systemConfig.core.announcement_enabled.value;
                label.textContent = systemConfig.core.announcement_enabled.value ? 'Enabled' : 'Disabled';
            }
        }
        
        if (systemConfig.core.system_announcement) {
            const textarea = document.getElementById('systemAnnouncement');
            if (textarea) {
                textarea.value = systemConfig.core.system_announcement.value;
            }
        }
        
        // Session Management
        if (systemConfig.core.session_timeout) {
            const input = document.getElementById('sessionTimeout');
            if (input) {
                input.value = systemConfig.core.session_timeout.value;
            }
        }
        
        if (systemConfig.core.max_concurrent_sessions) {
            const input = document.getElementById('maxConcurrentSessions');
            if (input) {
                input.value = systemConfig.core.max_concurrent_sessions.value;
            }
        }
    }
    
    // Alert System Configuration
    if (systemConfig.alerts) {
        // Alert Generation Frequency
        if (systemConfig.alerts.generation_frequency) {
            const select = document.getElementById('alertFrequency');
            if (select) {
                select.value = systemConfig.alerts.generation_frequency.value;
            }
        }
        
        // Game Monitoring Windows
        if (systemConfig.alerts.monitoring_start_hour) {
            const input = document.getElementById('monitoringStartHour');
            if (input) {
                input.value = systemConfig.alerts.monitoring_start_hour.value;
            }
        }
        
        if (systemConfig.alerts.monitoring_end_hour) {
            const input = document.getElementById('monitoringEndHour');
            if (input) {
                input.value = systemConfig.alerts.monitoring_end_hour.value;
            }
        }
        
        // Alert Priority Thresholds
        if (systemConfig.alerts.minimum_confidence_score) {
            const input = document.getElementById('minimumConfidence');
            if (input) {
                input.value = systemConfig.alerts.minimum_confidence_score.value;
            }
        }
        
        if (systemConfig.alerts.high_priority_threshold) {
            const input = document.getElementById('highPriorityThreshold');
            if (input) {
                input.value = systemConfig.alerts.high_priority_threshold.value;
            }
        }
        
        // Cooldown Settings
        if (systemConfig.alerts.global_cooldown_seconds) {
            const input = document.getElementById('globalCooldown');
            if (input) {
                input.value = systemConfig.alerts.global_cooldown_seconds.value;
            }
        }
        
        if (systemConfig.alerts.risp_cooldown_seconds) {
            const input = document.getElementById('rispCooldown');
            if (input) {
                input.value = systemConfig.alerts.risp_cooldown_seconds.value;
            }
        }
    }
}

async function updateSystemConfig(category, key, value) {
    try {
        const response = await fetch('/api/admin/system-config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                category,
                key,
                value
            })
        });
        
        if (response.ok) {
            // Update local config
            if (!systemConfig[category]) {
                systemConfig[category] = {};
            }
            systemConfig[category][key] = { value };
            
            // Update UI labels for toggles
            updateToggleLabels();
            
            showNotification(`${key.replace(/_/g, ' ')} updated successfully`, 'success');
        } else {
            console.error('Failed to update system configuration');
            showNotification('Failed to update configuration', 'error');
        }
    } catch (error) {
        console.error('Error updating system configuration:', error);
        showNotification('Failed to update configuration', 'error');
    }
}

function updateToggleLabels() {
    // Update all toggle labels based on current state
    const toggleMappings = [
        { toggleId: 'masterToggle', labelId: 'masterToggleLabel' },
        { toggleId: 'maintenanceMode', labelId: 'maintenanceModeLabel' },
        { toggleId: 'announcementEnabled', labelId: 'announcementEnabledLabel' }
    ];
    
    toggleMappings.forEach(({ toggleId, labelId }) => {
        const toggle = document.getElementById(toggleId);
        const label = document.getElementById(labelId);
        if (toggle && label) {
            label.textContent = toggle.checked ? 'Enabled' : 'Disabled';
        }
    });
}

async function saveAllConfigurations() {
    try {
        // Collect all current form values
        const configurations = [];
        
        // Core configurations
        const coreConfigs = [
            { key: 'master_toggle', elementId: 'masterToggle', type: 'checkbox' },
            { key: 'maintenance_mode', elementId: 'maintenanceMode', type: 'checkbox' },
            { key: 'maintenance_message', elementId: 'maintenanceMessage', type: 'text' },
            { key: 'announcement_enabled', elementId: 'announcementEnabled', type: 'checkbox' },
            { key: 'system_announcement', elementId: 'systemAnnouncement', type: 'text' },
            { key: 'session_timeout', elementId: 'sessionTimeout', type: 'number' },
            { key: 'max_concurrent_sessions', elementId: 'maxConcurrentSessions', type: 'number' }
        ];
        
        coreConfigs.forEach(config => {
            const element = document.getElementById(config.elementId);
            if (element) {
                let value;
                if (config.type === 'checkbox') {
                    value = element.checked;
                } else if (config.type === 'number') {
                    value = parseInt(element.value) || 0;
                } else {
                    value = element.value;
                }
                
                configurations.push({
                    category: 'core',
                    key: config.key,
                    value: value
                });
            }
        });
        
        // Alert configurations
        const alertConfigs = [
            { key: 'generation_frequency', elementId: 'alertFrequency', type: 'number' },
            { key: 'monitoring_start_hour', elementId: 'monitoringStartHour', type: 'number' },
            { key: 'monitoring_end_hour', elementId: 'monitoringEndHour', type: 'number' },
            { key: 'minimum_confidence_score', elementId: 'minimumConfidence', type: 'number' },
            { key: 'high_priority_threshold', elementId: 'highPriorityThreshold', type: 'number' },
            { key: 'global_cooldown_seconds', elementId: 'globalCooldown', type: 'number' },
            { key: 'risp_cooldown_seconds', elementId: 'rispCooldown', type: 'number' }
        ];
        
        alertConfigs.forEach(config => {
            const element = document.getElementById(config.elementId);
            if (element) {
                let value;
                if (config.type === 'number') {
                    value = parseInt(element.value) || 0;
                } else {
                    value = element.value;
                }
                
                configurations.push({
                    category: 'alerts',
                    key: config.key,
                    value: value
                });
            }
        });
        
        const response = await fetch('/api/admin/system-config/bulk', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ configurations })
        });
        
        if (response.ok) {
            showNotification('All configurations saved successfully', 'success');
            await loadSystemConfiguration(); // Refresh to get latest values
        } else {
            showNotification('Failed to save configurations', 'error');
        }
    } catch (error) {
        console.error('Error saving configurations:', error);
        showNotification('Failed to save configurations', 'error');
    }
}

async function resetToDefaults() {
    if (!confirm('This will reset ALL system configuration to default values. Are you sure?')) {
        return;
    }
    
    try {
        // Define default configurations
        const defaultConfigurations = [
            { category: 'core', key: 'master_toggle', value: true },
            { category: 'core', key: 'maintenance_mode', value: false },
            { category: 'core', key: 'maintenance_message', value: 'System is under maintenance. Please check back later.' },
            { category: 'core', key: 'announcement_enabled', value: false },
            { category: 'core', key: 'system_announcement', value: '' },
            { category: 'core', key: 'session_timeout', value: 24 },
            { category: 'core', key: 'max_concurrent_sessions', value: 5 },
            { category: 'alerts', key: 'generation_frequency', value: 30 },
            { category: 'alerts', key: 'monitoring_start_hour', value: 12 },
            { category: 'alerts', key: 'monitoring_end_hour', value: 24 },
            { category: 'alerts', key: 'minimum_confidence_score', value: 70 },
            { category: 'alerts', key: 'high_priority_threshold', value: 90 },
            { category: 'alerts', key: 'global_cooldown_seconds', value: 30 },
            { category: 'alerts', key: 'risp_cooldown_seconds', value: 60 }
        ];
        
        const response = await fetch('/api/admin/system-config/bulk', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ configurations: defaultConfigurations })
        });
        
        if (response.ok) {
            showNotification('Configuration reset to defaults', 'success');
            await loadSystemConfiguration(); // Refresh to get latest values
        } else {
            showNotification('Failed to reset configuration', 'error');
        }
    } catch (error) {
        console.error('Error resetting configuration:', error);
        showNotification('Failed to reset configuration', 'error');
    }
}

// Load system configuration when system tab is shown
function showTab(tabName) {
    // Hide all tab content
    const allTabs = document.querySelectorAll('.tab-content');
    allTabs.forEach(tab => tab.style.display = 'none');
    
    // Show selected tab
    const selectedTab = document.getElementById(tabName + 'Content');
    if (selectedTab) {
        selectedTab.style.display = 'block';
    }
    
    // Update nav button states
    const allNavButtons = document.querySelectorAll('.nav-tab');
    allNavButtons.forEach(button => button.classList.remove('active'));
    
    const selectedNavButton = document.getElementById(tabName + 'Tab');
    if (selectedNavButton) {
        selectedNavButton.classList.add('active');
    }
    
    // Load data based on tab
    if (tabName === 'overview') {
        loadStats();
    } else if (tabName === 'users') {
        loadUsers();
    } else if (tabName === 'alerts') {
        loadSportAlertSettings();
    } else if (tabName === 'system') {
        loadSystemConfiguration();
    } else if (tabName === 'live') {
        loadLiveGames();
    }
}

// Live Games Functionality
let liveGamesData = [];
let autoRefreshInterval = null;
let isAutoRefreshEnabled = false;

async function loadLiveGames() {
    const container = document.getElementById('liveGamesContainer');
    if (!container) return;
    
    try {
        // Show loading state
        container.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p>Loading today's MLB schedule...</p>
            </div>
        `;
        
        // Fetch both today's games and detailed live data
        const [scheduleResponse, liveResponse] = await Promise.all([
            fetch('/api/games/today?sport=MLB'),
            fetch('/api/games/live-detailed?sport=MLB')
        ]);
        
        if (!scheduleResponse.ok) {
            throw new Error('Failed to load today\'s schedule');
        }
        
        const scheduleData = await scheduleResponse.json();
        const liveData = liveResponse.ok ? await liveResponse.json() : { liveGames: [] };
        
        // Merge schedule with live data
        const allGames = scheduleData.games || [];
        const liveGamesMap = new Map();
        
        // Create a map of live game details
        (liveData.liveGames || []).forEach(liveGame => {
            liveGamesMap.set(liveGame.gameId, liveGame);
        });
        
        // Enhance all games with live data where available
        liveGamesData = allGames.map(game => {
            const liveDetails = liveGamesMap.get(game.gameId);
            if (liveDetails) {
                return { ...game, ...liveDetails };
            }
            return game;
        });
        
        renderLiveGames();
    } catch (error) {
        console.error('Error loading games:', error);
        container.innerHTML = `
            <div class="loading">
                <i class="fas fa-exclamation-triangle" style="color: #EF4444; font-size: 2rem; margin-bottom: 1rem;"></i>
                <p>Error loading today's schedule</p>
                <button class="action-btn refresh" onclick="loadLiveGames()" style="margin-top: 1rem;">
                    <i class="fas fa-refresh"></i>
                    Retry
                </button>
            </div>
        `;
    }
}

function renderLiveGames() {
    const container = document.getElementById('liveGamesContainer');
    if (!container) return;
    
    if (liveGamesData.length === 0) {
        container.innerHTML = `
            <div class="loading">
                <i class="fas fa-baseball-ball" style="color: #94A3B8; font-size: 2rem; margin-bottom: 1rem;"></i>
                <p>No MLB games scheduled for today</p>
                <small style="color: #64748B;">Check back tomorrow for the next day's schedule</small>
            </div>
        `;
        return;
    }
    
    // Sort games by status (live first, then scheduled, then final)
    const sortedGames = [...liveGamesData].sort((a, b) => {
        const statusOrder = { 'live': 0, 'scheduled': 1, 'final': 2, 'delayed': 1 };
        return (statusOrder[a.status] || 3) - (statusOrder[b.status] || 3);
    });
    
    // Group games by status for better organization
    const liveGames = sortedGames.filter(game => game.status === 'live');
    const scheduledGames = sortedGames.filter(game => game.status === 'scheduled');
    const completedGames = sortedGames.filter(game => game.status === 'final');
    const delayedGames = sortedGames.filter(game => game.status === 'delayed');
    
    let html = '';
    
    // Add status section headers
    if (liveGames.length > 0) {
        html += `<div class="games-section-header live">
            <i class="fas fa-circle"></i>
            Live Games (${liveGames.length})
        </div>`;
        html += liveGames.map(game => createGameCard(game)).join('');
    }
    
    if (scheduledGames.length > 0) {
        html += `<div class="games-section-header scheduled">
            <i class="fas fa-clock"></i>
            Scheduled Games (${scheduledGames.length})
        </div>`;
        html += scheduledGames.map(game => createGameCard(game)).join('');
    }
    
    if (delayedGames.length > 0) {
        html += `<div class="games-section-header delayed">
            <i class="fas fa-pause"></i>
            Delayed Games (${delayedGames.length})
        </div>`;
        html += delayedGames.map(game => createGameCard(game)).join('');
    }
    
    if (completedGames.length > 0) {
        html += `<div class="games-section-header completed">
            <i class="fas fa-check"></i>
            Completed Games (${completedGames.length})
        </div>`;
        html += completedGames.map(game => createGameCard(game)).join('');
    }
    
    container.innerHTML = html;
}

function createGameCard(game) {
    const runners = game.runners || { first: false, second: false, third: false };
    const weather = game.weather || {};
    const currentBatter = game.currentBatter || { name: 'Loading...' };
    const currentPitcher = game.currentPitcher || { name: 'Loading...' };
    
    // Format inning display
    let inningDisplay = 'Scheduled';
    if (game.status === 'live') {
        inningDisplay = game.inning && game.inningState ? 
            `${game.inningState} ${game.inning}${getInningOrdinal(game.inning)}` : 'In Progress';
    } else if (game.status === 'final') {
        inningDisplay = 'Final';
    } else if (game.status === 'delayed') {
        inningDisplay = 'Delayed';
    } else if (game.gameDate) {
        // Format scheduled time
        const gameTime = new Date(game.gameDate);
        inningDisplay = gameTime.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            timeZone: 'America/Los_Angeles' 
        }) + ' PT';
    }
    
    return `
        <div class="game-card ${game.isLive || game.status === 'live' ? 'live' : ''}">
            <div class="game-header">
                <div class="game-teams">
                    <div class="team-info">
                        <span class="team-name">${game.awayTeam}</span>
                        <span class="team-score">${game.awayScore || 0}</span>
                    </div>
                    <div class="team-info">
                        <span class="team-name">${game.homeTeam}</span>
                        <span class="team-score">${game.homeScore || 0}</span>
                    </div>
                </div>
                <div class="game-status">
                    <div class="status-badge ${game.status}">${game.status.toUpperCase()}</div>
                    <div class="game-inning">${inningDisplay}</div>
                    ${game.venue ? `<div class="venue-name">${game.venue}</div>` : ''}
                </div>
            </div>
            
            <div class="game-body">
                <div class="game-details">
                    ${game.status === 'live' ? `
                        <div class="count-display">
                            <div class="count-item">
                                <div class="count-label">Balls</div>
                                <div class="count-value balls">${game.balls || 0}</div>
                            </div>
                            <div class="count-item">
                                <div class="count-label">Strikes</div>
                                <div class="count-value strikes">${game.strikes || 0}</div>
                            </div>
                            <div class="count-item">
                                <div class="count-label">Outs</div>
                                <div class="count-value outs">${game.outs || 0}</div>
                            </div>
                        </div>
                        
                        <div class="batter-info">
                            <div class="batter-current">
                                <span class="batter-label">Batter:</span>
                                <span class="batter-name">${currentBatter.name}</span>
                            </div>
                            <div class="batter-current">
                                <span class="batter-label">Pitcher:</span>
                                <span class="batter-name">${currentPitcher.name}</span>
                            </div>
                        </div>
                    ` : `
                        <div class="game-info">
                            <div class="info-item">
                                <span class="info-label">Venue:</span>
                                <span class="info-value">${game.venue || 'TBD'}</span>
                            </div>
                            ${game.status === 'scheduled' ? `
                                <div class="info-item">
                                    <span class="info-label">Start Time:</span>
                                    <span class="info-value">${inningDisplay}</span>
                                </div>
                            ` : ''}
                        </div>
                    `}
                    
                    ${weather.temp || weather.condition ? `
                        <div class="weather-info">
                            <i class="fas fa-cloud weather-icon"></i>
                            <span>${formatWeather(weather)}</span>
                        </div>
                    ` : ''}
                </div>
                
                <div class="baseball-diamond">
                    ${createBaseballDiamond(runners)}
                </div>
            </div>
        </div>
    `;
}

function createBaseballDiamond(runners) {
    return `
        <div class="diamond-field">
            <div class="diamond-infield"></div>
            <div class="base home"></div>
            <div class="base first ${runners.first ? 'occupied' : ''}"></div>
            <div class="base second ${runners.second ? 'occupied' : ''}"></div>
            <div class="base third ${runners.third ? 'occupied' : ''}"></div>
            <div class="diamond-label home">H</div>
            <div class="diamond-label first">1B</div>
            <div class="diamond-label second">2B</div>
            <div class="diamond-label third">3B</div>
        </div>
    `;
}

function getInningOrdinal(inning) {
    if (!inning) return '';
    const num = parseInt(inning);
    if (num === 1) return 'st';
    if (num === 2) return 'nd';
    if (num === 3) return 'rd';
    return 'th';
}

function formatWeather(weather) {
    const parts = [];
    if (weather.temp) parts.push(`${weather.temp}°F`);
    if (weather.condition) parts.push(weather.condition);
    if (weather.wind) parts.push(`Wind: ${weather.wind}`);
    return parts.join(' • ') || 'Weather data unavailable';
}

function switchSport(sport) {
    // Update active sport tab
    document.querySelectorAll('.sport-tab').forEach(tab => tab.classList.remove('active'));
    document.getElementById(sport.toLowerCase() + 'SportTab').classList.add('active');
    
    // Load data for selected sport
    loadLiveGames();
}

function refreshLiveGames() {
    loadLiveGames();
}

function toggleAutoRefresh() {
    const btn = document.getElementById('autoRefreshBtn');
    const indicator = document.getElementById('refreshIndicator');
    
    if (isAutoRefreshEnabled) {
        // Disable auto-refresh
        clearInterval(autoRefreshInterval);
        isAutoRefreshEnabled = false;
        btn.innerHTML = '<i class="fas fa-play"></i> Enable Auto-Refresh';
        btn.classList.remove('active');
        indicator.style.display = 'none';
    } else {
        // Enable auto-refresh
        autoRefreshInterval = setInterval(() => {
            loadLiveGames();
        }, 15000); // Refresh every 15 seconds
        
        isAutoRefreshEnabled = true;
        btn.innerHTML = '<i class="fas fa-pause"></i> Disable Auto-Refresh';
        btn.classList.add('active');
        indicator.style.display = 'flex';
    }
}