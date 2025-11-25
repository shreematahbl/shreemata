

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("loginForm");
    const errorMessage = document.getElementById("errorMessage");
    const loginBtn = document.getElementById("loginBtn");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        errorMessage.style.display = "none";

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value.trim();

        loginBtn.disabled = true;
        loginBtn.textContent = "Logging in...";

        try {
            const response = await fetch(`${API_URL}/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                errorMessage.textContent = data.error || "Login failed.";
                errorMessage.style.display = "block";

                loginBtn.disabled = false;
                loginBtn.textContent = "Login";
                return;
            }

            // Save JWT + User Info
            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));

            window.location.href = "/";
        } catch (err) {
            console.error("Login error:", err);
            errorMessage.textContent = "Network error. Please try again.";
            errorMessage.style.display = "block";
        }

        loginBtn.disabled = false;
        loginBtn.textContent = "Login";
    });
});
