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
        // loadSportAlertSettings(); // Load settings for the default sport on load - REMOVED
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
    // Alert displays disabled - always show 0
    if (todayAlertsEl) todayAlertsEl.textContent = '0';
    if (totalAlertsEl) totalAlertsEl.textContent = '0';
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
        // loadSportAlertSettings(); // REMOVED
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

// Alert configuration functions removed - now handled at user level

// Function to switch sport and load settings
function switchSport(sport) {
    // currentSport = sport; // REMOVED
    // loadSportAlertSettings(); // REMOVED
}

// Add event listener for sport selector change
const sportSelector = document.getElementById('sportSelector');
if (sportSelector) {
    sportSelector.addEventListener('change', function() {
        // switchSport(this.value); // REMOVED
    });
}

async function enableAllAlerts() {
    // REMOVED
}

async function disableAllAlerts() {
    // REMOVED
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