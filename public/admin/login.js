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

    // Removed auto-check to prevent redirect loops
    // Clear any stuck session data
    sessionStorage.removeItem('adminAuthFailed');
    localStorage.removeItem('adminLoggedIn');
    localStorage.removeItem('adminUser');

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

    // Removed checkExistingSession to prevent redirect loops

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