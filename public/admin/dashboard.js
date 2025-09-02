// Admin Dashboard JavaScript
let currentUsers = [];
let currentStats = {};
let selectedUserForAlerts = null;
let userAlertPreferences = {};

// Alert configuration matching the main app
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

async function editUser(userId) {
    const user = currentUsers.find(u => u.id === userId);
    if (!user) return;

    selectedUserForAlerts = user;
    await loadUserAlertPreferences(userId);
    showUserEditModal(user);
}

async function loadUserAlertPreferences(userId) {
    try {
        const response = await fetch(`/api/admin/users/${userId}/alert-preferences`, {
            method: 'GET',
            credentials: 'include'
        });

        if (response.ok) {
            userAlertPreferences = await response.json();
        } else {
            userAlertPreferences = {};
        }
    } catch (error) {
        console.error('Failed to load user alert preferences:', error);
        userAlertPreferences = {};
    }
}

function showUserEditModal(user) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2><i class="fas fa-user-edit"></i> Manage User: ${user.username}</h2>
                <button class="close-btn" onclick="closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="user-info-section">
                    <h3><i class="fas fa-info-circle"></i> User Information</h3>
                    <div class="user-details-grid">
                        <div><strong>Username:</strong> ${user.username || 'N/A'}</div>
                        <div><strong>Email:</strong> ${user.email || 'N/A'}</div>
                        <div><strong>Role:</strong> <span class="role-badge ${user.role}">${(user.role || 'user').toUpperCase()}</span></div>
                        <div><strong>Auth Method:</strong> ${user.authMethod || 'Local'}</div>
                        <div><strong>Telegram:</strong> 
                            <span class="status-badge ${user.telegramEnabled ? 'enabled' : 'disabled'}">
                                ${user.telegramEnabled ? 'Enabled' : 'Disabled'}
                            </span>
                        </div>
                        <div><strong>Joined:</strong> ${new Date(user.createdAt).toLocaleDateString()}</div>
                    </div>
                </div>
                
                <div class="alert-preferences-section">
                    <h3><i class="fas fa-bell"></i> Alert Preferences Management</h3>
                    <div class="sport-tabs">
                        <button class="sport-tab active" onclick="showSportAlerts('MLB')" data-sport="MLB">MLB</button>
                        <button class="sport-tab" onclick="showSportAlerts('NFL')" data-sport="NFL">NFL</button>
                        <button class="sport-tab" onclick="showSportAlerts('NBA')" data-sport="NBA">NBA</button>
                        <button class="sport-tab" onclick="showSportAlerts('NHL')" data-sport="NHL">NHL</button>
                        <button class="sport-tab" onclick="showSportAlerts('CFL')" data-sport="CFL">CFL</button>
                        <button class="sport-tab" onclick="showSportAlerts('NCAAF')" data-sport="NCAAF">NCAAF</button>
                    </div>
                    <div id="alertPreferencesContent">
                        <!-- Alert preferences will be loaded here -->
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal()">Close</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Show MLB alerts by default
    showSportAlerts('MLB');
}

function showSportAlerts(sport) {
    // Update active tab
    document.querySelectorAll('.sport-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.sport === sport) {
            tab.classList.add('active');
        }
    });
    
    const content = document.getElementById('alertPreferencesContent');
    if (!content) return;
    
    const alertConfig = ALERT_TYPE_CONFIG[sport];
    if (!alertConfig) {
        content.innerHTML = '<p style="color: #94a3b8; text-align: center; padding: 20px;">No alert configuration available for this sport.</p>';
        return;
    }
    
    let html = '';
    Object.entries(alertConfig).forEach(([category, alerts]) => {
        html += `
            <div class="alert-category">
                <h4 class="category-title">
                    <i class="fas fa-${getCategoryIconClass(category)}"></i>
                    ${category}
                </h4>
                <div class="alert-list">
                    ${alerts.map(alert => {
                        const preferences = userAlertPreferences[sport] || {};
                        const preference = preferences.find(p => p.alertType === alert.key);
                        const isEnabled = preference ? preference.enabled : true;
                        
                        return `
                            <div class="alert-item">
                                <div class="alert-info">
                                    <div class="alert-label">${alert.label}</div>
                                    <div class="alert-description">${alert.description}</div>
                                </div>
                                <label class="toggle-switch">
                                    <input type="checkbox" ${isEnabled ? 'checked' : ''} 
                                           onchange="updateUserAlertPreference('${sport}', '${alert.key}', this.checked)">
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    });
    
    content.innerHTML = html;
}

function getCategoryIconClass(category) {
    switch (category) {
        case "Game Situations": return "target";
        case "Scoring Events": return "trophy";
        case "At-Bat Situations": return "clock";
        default: return "bell";
    }
}

async function updateUserAlertPreference(sport, alertType, enabled) {
    if (!selectedUserForAlerts) return;
    
    try {
        const response = await fetch(`/api/admin/users/${selectedUserForAlerts.id}/alert-preferences`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                sport,
                alertType,
                enabled
            })
        });

        if (response.ok) {
            // Update local cache
            if (!userAlertPreferences[sport]) {
                userAlertPreferences[sport] = [];
            }
            
            const existingPrefIndex = userAlertPreferences[sport].findIndex(p => p.alertType === alertType);
            if (existingPrefIndex >= 0) {
                userAlertPreferences[sport][existingPrefIndex].enabled = enabled;
            } else {
                userAlertPreferences[sport].push({ alertType, enabled, sport });
            }
            
            showNotification(`Alert preference updated: ${alertType} ${enabled ? 'enabled' : 'disabled'}`, 'success');
        } else {
            const error = await response.json();
            showNotification(error.message || 'Failed to update alert preference', 'error');
        }
    } catch (error) {
        console.error('Error updating alert preference:', error);
        showNotification('Failed to update alert preference', 'error');
    }
}

function closeModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.remove();
    }
    selectedUserForAlerts = null;
    userAlertPreferences = {};
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