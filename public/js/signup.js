
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (token) {
        window.location.href = '/';
        return;
    }

    // Auto-fill referral code if present in URL
    const urlParams = new URLSearchParams(window.location.search);
    const refCodeFromURL = urlParams.get('ref');
    if (refCodeFromURL) {
        // Delay to ensure element exists when autofilling
        setTimeout(() => {
            const refInput = document.getElementById('referralInput');
            if (refInput) {
                refInput.value = refCodeFromURL;
            }
        }, 0);
    }

    setupSignupForm();
});

function setupSignupForm() {
    const signupForm = document.getElementById('signupForm');

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const referralInputEl = document.getElementById('referralInput');
        const referralCode = referralInputEl ? referralInputEl.value.trim() : null;

        const errorMessage = document.getElementById('errorMessage');
        const signupBtn = document.getElementById('signupBtn');

        errorMessage.style.display = 'none';

        if (password !== confirmPassword) {
            errorMessage.textContent = 'Passwords do not match';
            errorMessage.style.display = 'block';
            return;
        }

        if (password.length < 6) {
            errorMessage.textContent = 'Password must be at least 6 characters';
            errorMessage.style.display = 'block';
            return;
        }

        signupBtn.disabled = true;
        signupBtn.textContent = 'Creating account...';

        try {
            const response = await fetch(`${API_URL}/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    name, 
                    email, 
                    password,
                    referredBy: referralCode || null
                })
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));

                alert('Account created successfully!');
                window.location.href = '/';
            } else {
                errorMessage.textContent = data.error || 'Signup failed. Please try again.';
                errorMessage.style.display = 'block';
                signupBtn.disabled = false;
                signupBtn.textContent = 'Create Account';
            }
        } catch (error) {
            console.error('Signup error:', error);
            errorMessage.textContent = 'Network error. Please try again.';
            errorMessage.style.display = 'block';
            signupBtn.disabled = false;
            signupBtn.textContent = 'Create Account';
        }
    });
}
