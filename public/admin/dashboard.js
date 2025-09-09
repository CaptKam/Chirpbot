// Admin Dashboard

let globalUsers = [];
let globalAlertSettings = {};

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication status first
    checkAuthentication();
});

// Check authentication and load dashboard if authenticated
async function checkAuthentication() {
    try {
        const response = await fetch('/api/admin-auth/verify', {
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ Admin authenticated:', data.user?.username);

            // Load dashboard data
            loadDashboardData();
            loadStatistics();
            loadSystemStatus();

            // Set up sport selector if it exists
            const sportSelector = document.getElementById('sportSelector');
            if (sportSelector) {
                loadSportAlertSettings();
                sportSelector.addEventListener('change', () => {
                    loadSportAlertSettings();
                });
            }

            // Set up logout button
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', handleLogout);
            }
        } else {
            // Not authenticated, redirect to login
            console.log('🔒 Not authenticated, redirecting to login...');
            window.location.href = '/admin/login.html';
        }
    } catch (error) {
        console.error('Authentication check failed:', error);
        window.location.href = '/admin/login.html';
    }
}

// Tab switching functionality - make it globally available
window.showTab = function(tabName) {
    // Hide all tab contents
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => {
        content.style.display = 'none';
    });

    // Remove active class from all tabs
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
        tab.classList.remove('active');
    });

    // Show the selected tab content
    const selectedContent = document.getElementById(tabName + 'Content');
    if (selectedContent) {
        selectedContent.style.display = 'block';
    }

    // Add active class to the selected tab button
    const selectedTab = document.getElementById(tabName + 'Tab');
    if (selectedTab) {
        selectedTab.classList.add('active');
    }

    // Load data specific to the tab if needed
    if (tabName === 'users') {
        loadUsers();
    } else if (tabName === 'alerts') {
        loadAlertSettings();
    } else if (tabName === 'system') {
        loadSystemSettings();
    }
}

// Dashboard data loading functions
async function loadDashboardData() {
    try {
        loadRecentActivity();
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

window.loadRecentActivity = async function() {
    try {
        const activityEl = document.getElementById('recentActivity');
        if (activityEl) {
            // For now, show a simple message instead of spinner
            activityEl.innerHTML = `
                <div class="activity-item">
                    <div class="activity-icon system">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <div class="activity-content">
                        <div class="activity-title">System Running Normally</div>
                        <div class="activity-description">All systems operational</div>
                        <div class="activity-time">${new Date().toLocaleTimeString()}</div>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading recent activity:', error);
    }
}

async function loadUsers() {
    try {
        const response = await fetch('/api/admin/users', {
            credentials: 'include'
        });

        if (!response.ok) {
            console.error('Failed to load users');
            return;
        }

        const users = await response.json();
        globalUsers = users;

        // Update users table if it exists
        const usersTableBody = document.getElementById('usersTableBody');
        if (usersTableBody) {
            if (users.length === 0) {
                usersTableBody.innerHTML = '<tr><td colspan="6">No users found.</td></tr>';
            } else {
                usersTableBody.innerHTML = users.map(user => `
                    <tr>
                        <td>${user.username}</td>
                        <td><span class="role-badge">${user.role || 'user'}</span></td>
                        <td>${new Date(user.createdAt).toLocaleDateString()}</td>
                        <td>${user.monitoredTeamsCount || 0}</td>
                        <td>${user.telegramEnabled ? '✓' : '✗'}</td>
                        <td>
                            <button class="action-btn edit" onclick="editUser('${user.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="action-btn danger" onclick="deleteUser('${user.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `).join('');
            }
        }

        const usersList = document.getElementById('usersList');
        if (!usersList) return;

        usersList.innerHTML = users.map(user => `
            <div class="user-card" data-user-id="${user.id}">
                <div class="user-info">
                    <h3>${user.username} ${user.role === 'admin' ? '<span class="role-badge">Admin</span>' : ''}</h3>
                    <p>Created: ${new Date(user.createdAt).toLocaleDateString()}</p>
                    <p>Monitored Teams: ${user.monitoredTeamsCount || 0}</p>
                    <p>Telegram: ${user.telegramUsername || 'Not connected'}</p>
                </div>
                <div class="user-actions">
                    <button class="action-btn" onclick="editUser('${user.id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="action-btn danger" onclick="deleteUser('${user.id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                    <button class="action-btn secondary" onclick="viewUserAlerts('${user.id}')">
                        <i class="fas fa-bell"></i> Alert Settings
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

async function loadStatistics() {
    try {
        const response = await fetch('/api/admin/stats', {
            credentials: 'include'
        });

        if (!response.ok) {
            console.error('Failed to load statistics');
            return;
        }

        const stats = await response.json();

        // Map backend structure to frontend elements
        const totalUsersEl = document.getElementById('totalUsers');
        const totalAdminsEl = document.getElementById('totalAdmins');
        const todayAlertsEl = document.getElementById('todayAlerts');
        const totalAlertsEl = document.getElementById('totalAlerts');

        if (totalUsersEl) totalUsersEl.textContent = stats.users?.total || 0;
        if (totalAdminsEl) totalAdminsEl.textContent = stats.users?.admins || 0;
        if (todayAlertsEl) todayAlertsEl.textContent = stats.alerts?.today || 0;
        if (totalAlertsEl) totalAlertsEl.textContent = stats.alerts?.total || 0;

        // Also update monitored teams if the element exists
        const monitoredTeamsEl = document.getElementById('monitoredTeams');
        if (monitoredTeamsEl) monitoredTeamsEl.textContent = stats.monitoredTeams || 0;
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

async function loadSystemStatus() {
    try {
        const response = await fetch('/api/admin/system-status', {
            credentials: 'include'
        });

        if (!response.ok) {
            console.error('Failed to load system status');
            return;
        }

        const status = await response.json();

        const statusHtml = `
            <div class="status-item">
                <span>Alert Engine:</span>
                <span class="${status.alertEngine ? 'status-active' : 'status-inactive'}">
                    ${status.alertEngine ? 'Active' : 'Inactive'}
                </span>
            </div>
            <div class="status-item">
                <span>Database:</span>
                <span class="${status.database ? 'status-active' : 'status-inactive'}">
                    ${status.database ? 'Connected' : 'Disconnected'}
                </span>
            </div>
            <div class="status-item">
                <span>OpenAI Integration:</span>
                <span class="${status.openai ? 'status-active' : 'status-inactive'}">
                    ${status.openai ? 'Enabled' : 'Disabled'}
                </span>
            </div>
            <div class="status-item">
                <span>Telegram Bot:</span>
                <span class="${status.telegram ? 'status-active' : 'status-inactive'}">
                    ${status.telegram ? 'Connected' : 'Not configured'}
                </span>
            </div>
        `;

        const systemStatusEl = document.getElementById('systemStatus');
        if (systemStatusEl) {
            systemStatusEl.innerHTML = statusHtml;
        }
    } catch (error) {
        console.error('Error loading system status:', error);
    }
}

// Load alert settings when switching to alerts tab
async function loadAlertSettings() {
    loadSportAlertSettings();
}

// Load system settings when switching to system tab  
async function loadSystemSettings() {
    console.log('Loading system settings...');
    // System settings functionality can be expanded here
}

window.loadSportAlertSettings = async function() {
    const sport = document.getElementById('sportSelector')?.value || 'MLB';

    try {
        const response = await fetch(`/api/admin/global-alert-settings/${sport}`, {
            credentials: 'include'
        });

        if (!response.ok) {
            console.error('Failed to load alert settings');
            return;
        }

        const settings = await response.json();
        globalAlertSettings = settings;

        // Update the sport title
        const sportTitleEl = document.getElementById('sportTitle');
        if (sportTitleEl) {
            sportTitleEl.textContent = sport;
        }

        const alertsContainer = document.getElementById('alertSettingsList');
        if (!alertsContainer) {
            console.log('Alert settings container not found');
            return;
        }

        alertsContainer.innerHTML = settings.map(setting => `
            <div class="alert-setting-card">
                <div class="alert-info">
                    <h4>${setting.key}</h4>
                    <p>${setting.description || 'No description available'}</p>
                </div>
                <div class="alert-toggle">
                    <label class="switch">
                        <input type="checkbox" 
                               ${setting.enabled ? 'checked' : ''} 
                               onchange="toggleAlertSetting('${setting.key}', this.checked, '${sport}')">
                        <span class="slider round"></span>
                    </label>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading alert settings:', error);
    }
}

window.toggleAlertSetting = async function(alertKey, enabled, sport) {
    try {
        const response = await fetch('/api/admin/global-alert-settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                sport,
                alertType: alertKey,
                enabled
            })
        });

        if (response.ok) {
            showNotification(`${alertKey} ${enabled ? 'enabled' : 'disabled'} for ${sport}`, 'success');
        } else {
            showNotification('Failed to update alert setting', 'error');
        }
    } catch (error) {
        console.error('Error toggling alert setting:', error);
        showNotification('Error updating alert setting', 'error');
    }
}

window.editUser = async function(userId) {
    const user = globalUsers.find(u => u.id === userId);
    if (!user) return;

    const newUsername = prompt('Enter new username:', user.username);
    if (!newUsername) return;

    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ username: newUsername })
        });

        if (response.ok) {
            showNotification('User updated successfully', 'success');
            loadUsers();
        } else {
            showNotification('Failed to update user', 'error');
        }
    } catch (error) {
        console.error('Error updating user:', error);
        showNotification('Error updating user', 'error');
    }
}

window.deleteUser = async function(userId) {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (response.ok) {
            showNotification('User deleted successfully', 'success');
            loadUsers();
        } else {
            showNotification('Failed to delete user', 'error');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        showNotification('Error deleting user', 'error');
    }
}

window.viewUserAlerts = async function(userId) {
    window.location.href = `/user-settings.html?userId=${userId}`;
}

window.handleLogout = function() {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/admin/login.html';
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// System settings functions
window.loadSystemSettings = async function() {
    try {
        // Load AI settings
        const aiResponse = await fetch('/api/admin/ai-settings', {
            credentials: 'include'
        });

        if (aiResponse.ok) {
            const aiSettings = await aiResponse.json();
            const aiSettingsList = document.getElementById('aiSettingsList');
            if (aiSettingsList) {
                aiSettingsList.innerHTML = `
                    <div class="settings-section">
                        <h3>AI Configuration</h3>
                        <div class="setting-item">
                            <label>OpenAI API Status</label>
                            <span class="${aiSettings.openAiEnabled ? 'status-active' : 'status-inactive'}">
                                ${aiSettings.openAiEnabled ? 'Enabled' : 'Disabled'}
                            </span>
                        </div>
                        <div class="setting-item">
                            <label>Weather API Status</label>
                            <span class="${aiSettings.weatherEnabled ? 'status-active' : 'status-inactive'}">
                                ${aiSettings.weatherEnabled ? 'Enabled' : 'Disabled'}
                            </span>
                        </div>
                        <div class="setting-item">
                            <label>Telegram Integration</label>
                            <span class="${aiSettings.telegramEnabled ? 'status-active' : 'status-inactive'}">
                                ${aiSettings.telegramEnabled ? 'Enabled' : 'Disabled'}
                            </span>
                        </div>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Error loading system settings:', error);
    }
}

// Make showNotification globally accessible
window.showNotification = showNotification;

// Functions for HTML onclick handlers
window.toggleMasterAlerts = async function() {
    const toggle = document.getElementById('masterAlertToggle');
    if (!toggle) return;

    try {
        const response = await fetch('/api/admin/master-alerts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ enabled: toggle.checked })
        });

        if (response.ok) {
            showNotification(`Master alerts ${toggle.checked ? 'enabled' : 'disabled'}`, 'success');
        } else {
            showNotification('Failed to update master alerts', 'error');
            toggle.checked = !toggle.checked;
        }
    } catch (error) {
        console.error('Error toggling master alerts:', error);
        showNotification('Error updating master alerts', 'error');
        toggle.checked = !toggle.checked;
    }
}

window.refreshAlertSettings = function() {
    loadSportAlertSettings();
    showNotification('Alert settings refreshed', 'success');
}

// Helper function to display status messages
function showStatus(message, type = 'info') {
    const statusEl = document.getElementById('cleanupStats');
    if (!statusEl) return;
    statusEl.innerHTML = `<p class="status-message ${type}">${message}</p>`;
}

// Cleanup functions
async function getCleanupStats() {
  try {
    showStatus('Getting cleanup stats...', 'info');
    const response = await fetch('/api/admin/cleanup-stats', {
      credentials: 'include'
    });
    
    if (response.status === 401) {
      console.log('🔒 Not authenticated for cleanup stats, redirecting to login...');
      window.location.href = '/admin/login.html';
      return;
    }
    
    const data = await response.json();

    if (data.success) {
      const statsHtml = `
        <div class="stats-grid">
          <div class="stat-item">
            <strong>Total Alerts:</strong> ${data.stats.total}
          </div>
          <div class="stat-item">
            <strong>Recent (< 24h):</strong> ${data.stats.recent}
          </div>
          <div class="stat-item">
            <strong>Old (> 24h):</strong> ${data.stats.old}
          </div>
        </div>
        <p><em>Automatic cleanup runs every hour</em></p>
      `;
      document.getElementById('cleanupStats').innerHTML = statsHtml;
      showStatus(data.message, 'success');
    } else {
      showStatus('Failed to get cleanup stats', 'error');
    }
  } catch (error) {
    console.error('Error getting cleanup stats:', error);
    showStatus('Authentication required for cleanup stats', 'error');
  }
}

async function manualCleanup() {
  if (!confirm('Are you sure you want to manually cleanup alerts older than 24 hours?')) {
    return;
  }

  try {
    showStatus('Running manual cleanup...', 'info');
    const response = await fetch('/api/admin/cleanup-alerts', {
      method: 'POST'
    });
    const data = await response.json();

    if (data.success) {
      showStatus(`Manual cleanup complete: Removed ${data.deletedCount} old alerts`, 'success');
      // Refresh stats
      setTimeout(getCleanupStats, 1000);
    } else {
      showStatus('Manual cleanup failed', 'error');
    }
  } catch (error) {
    console.error('Error during manual cleanup:', error);
    showStatus('Error during manual cleanup', 'error');
  }
}

// Only load cleanup stats if we're authenticated and on the system tab
document.addEventListener('DOMContentLoaded', () => {
    // Don't automatically load cleanup stats to prevent auth polling
    console.log('Dashboard loaded - cleanup stats available on System tab');
});