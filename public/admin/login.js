// Admin Login JavaScript
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Login page JavaScript loaded');
    
    const loginForm = document.getElementById('adminLoginForm');
    const errorMessage = document.getElementById('errorMessage');
    const loginBtn = document.getElementById('loginBtn');
    
    console.log('🔍 Elements found:', {
        loginForm: !!loginForm,
        errorMessage: !!errorMessage,
        loginBtn: !!loginBtn
    });

    // Check if already authenticated
    checkExistingAuth();

    async function checkExistingAuth() {
        try {
            const response = await fetch('/api/admin-auth/verify', {
                credentials: 'include'
            });
            
            if (response.ok) {
                // Already authenticated, redirect to dashboard
                window.location.href = '/admin/dashboard.html';
            }
        } catch (error) {
            // Not authenticated, stay on login page
            console.log('Not authenticated, showing login form');
        }
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            console.log('📝 Form submitted');
            e.preventDefault();
            await handleLogin();
        });
        console.log('✅ Form submit listener attached');
    } else {
        console.error('❌ Login form not found!');
    }

    async function handleLogin() {
        console.log('🔐 handleLogin called');
        const username = document.getElementById('adminUsername').value;
        const password = document.getElementById('adminPassword').value;
        
        console.log('📊 Login attempt:', { 
            username: username ? 'provided' : 'missing',
            password: password ? 'provided' : 'missing'
        });

        if (!username || !password) {
            showError('Please enter both username and password');
            return;
        }

        setLoading(true);
        hideError();

        try {
            const response = await fetch('/api/admin-auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                // Store admin session
                localStorage.setItem('adminLoggedIn', 'true');
                localStorage.setItem('adminUser', JSON.stringify(data.user));

                // Redirect to dashboard
                window.location.href = '/admin/dashboard.html';
            } else {
                showError(data.message || 'Invalid credentials. Please try again.');
            }
        } catch (error) {
            console.error('Login error:', error);
            showError('Connection error. Please check your network and try again.');
        } finally {
            setLoading(false);
        }
    }

    // Function to show dashboard after login
    function showDashboard(user) {
        console.log('📊 Showing dashboard for user:', user);
        
        // Hide login form
        document.querySelector('.login-container').style.display = 'none';
        
        // Show dashboard
        const dashboard = document.getElementById('adminDashboard');
        if (dashboard) {
            dashboard.style.display = 'block';
            
            // Set admin username
            const adminUsernameEl = document.getElementById('adminUsername');
            if (adminUsernameEl) {
                adminUsernameEl.textContent = user.username;
            }
            
            // Trigger dashboard load
            if (typeof loadDashboardData === 'function') {
                loadDashboardData();
            }
            
            // Set up tab switching
            setupTabs();
        }
    }
    
    // Tab switching functionality
    function setupTabs() {
        console.log('🗂️ Setting up tabs');
        
        const tabs = document.querySelectorAll('.tab');
        const tabContents = document.querySelectorAll('.tab-content');
        
        console.log('📋 Found elements:', {
            tabs: tabs.length,
            tabContents: tabContents.length
        });
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.dataset.tab;
                console.log('🖱️ Tab clicked:', targetTab);
                
                // Remove active class from all tabs and contents
                tabs.forEach(t => t.classList.remove('active'));
                tabContents.forEach(tc => tc.classList.remove('active'));
                
                // Add active class to clicked tab and corresponding content
                tab.classList.add('active');
                const targetContent = document.getElementById(targetTab);
                if (targetContent) {
                    targetContent.classList.add('active');
                    console.log('✅ Tab switched to:', targetTab);
                    
                    // Load specific tab data
                    if (targetTab === 'users') {
                        if (typeof loadUsers === 'function') {
                            loadUsers();
                        }
                    } else if (targetTab === 'alerts') {
                        if (typeof loadSportAlertSettings === 'function') {
                            loadSportAlertSettings();
                        }
                    }
                } else {
                    console.error('❌ Tab content not found:', targetTab);
                }
            });
        });
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        errorMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function hideError() {
        errorMessage.style.display = 'none';
    }

    function setLoading(loading) {
        loginBtn.disabled = loading;
        if (loading) {
            loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In...';
        } else {
            loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In to Admin Panel';
        }
    }
});

function togglePassword() {
    console.log('👁️ Toggle password called');
    const passwordInput = document.getElementById('adminPassword');
    const toggleIcon = document.getElementById('toggleIcon');
    
    console.log('🔍 Toggle elements:', {
        passwordInput: !!passwordInput,
        toggleIcon: !!toggleIcon
    });

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleIcon.classList.remove('fa-eye');
        toggleIcon.classList.add('fa-eye-slash');
    } else {
        passwordInput.type = 'password';
        toggleIcon.classList.remove('fa-eye-slash');
        toggleIcon.classList.add('fa-eye');
    }
}

// Placeholder for loadDashboardData function, which would handle fetching and displaying dashboard content
function loadDashboardData() {
    console.log("Dashboard data loading...");
    // In a real application, you would fetch data here and update the DOM
    // For example:
    // fetch('/api/admin/dashboard')
    //   .then(response => response.json())
    //   .then(data => {
    //     document.getElementById('dashboardStats').innerText = `Users: ${data.userCount}, Posts: ${data.postCount}`;
    //   });
}