// API_URL is already defined in config.js

document.addEventListener("DOMContentLoaded", () => {
    checkAuth();
    loadReferralDetails();
});

function checkAuth() {
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "null");

    if (!token || !user) {
        alert("Please login to view referral dashboard");
        window.location.href = "/login.html";
        return;
    }

    document.getElementById("userName").textContent = `Hello, ${user.name}`;

    if (user.role === "admin") {
        const adminLink = document.getElementById("adminLink");
        if (adminLink) adminLink.style.display = "block";
    }

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            window.location.href = "/";
        });
    }

    updateCartCount();
}

function updateCartCount() {
    const cart = JSON.parse(localStorage.getItem("cart") || "[]");
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    const cartCountEl = document.getElementById("cartCount");
    if (cartCountEl) cartCountEl.textContent = count;
}

async function loadReferralDetails() {
    const token = localStorage.getItem("token");

    try {
        const res = await fetch(`${window.API_URL}/referral/details`, {
            headers: { "Authorization": "Bearer " + token }
        });

        if (!res.ok) {
            throw new Error("Failed to load referral details");
        }

        const data = await res.json();

        // Update referral code
        document.getElementById("refCode").textContent = data.referralCode || "Not generated";
        
        // Update wallet balance with proper formatting
        const walletAmount = parseFloat(data.wallet || 0).toFixed(2);
        document.getElementById("wallet").textContent = walletAmount;

        // Update referral count
        const referralCount = data.referrals || 0;
        document.getElementById("referralCount").textContent = referralCount;

        // Generate referral link
        const link = `${window.location.origin}/signup.html?ref=${data.referralCode}`;
        document.getElementById("refLink").value = link;

    } catch (err) {
        console.error("Error loading referral details:", err);
        alert("Error loading referral details. Please try again.");
    }
}

function copyLink() {
    const box = document.getElementById("refLink");
    box.select();
    box.setSelectionRange(0, 99999); // For mobile devices

    try {
        navigator.clipboard.writeText(box.value);
        alert("✅ Referral link copied to clipboard!");
    } catch (err) {
        // Fallback for older browsers
        document.execCommand("copy");
        alert("✅ Referral link copied!");
    }
}

async function requestWithdraw(event) {
    event.preventDefault();

    const token = localStorage.getItem("token");
    const msg = document.getElementById("withdrawMsg");

    const amount = Number(document.getElementById("withdrawAmount").value);
    const upi = document.getElementById("withdrawUpi").value.trim();
    const bank = document.getElementById("withdrawBank").value.trim();
    const ifsc = document.getElementById("withdrawIfsc").value.trim();

    // Hide previous message
    msg.style.display = "none";
    msg.className = "message";

    // Validation
    if (!amount || amount < 50) {
        msg.textContent = "❌ Minimum withdrawal amount is ₹50";
        msg.className = "message error";
        msg.style.display = "block";
        return;
    }

    if (!upi && (!bank || !ifsc)) {
        msg.textContent = "❌ Provide either UPI ID or Bank Account + IFSC";
        msg.className = "message error";
        msg.style.display = "block";
        return;
    }

    try {
        const res = await fetch(`${window.API_URL}/referral/withdraw`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({ amount, upi, bank, ifsc })
        });

        const data = await res.json();

        if (!res.ok) {
            msg.textContent = "❌ " + (data.error || "Withdrawal failed");
            msg.className = "message error";
            msg.style.display = "block";
            return;
        }

        // Success
        msg.textContent = "✅ Withdrawal request submitted successfully! We'll process it within 2-3 business days.";
        msg.className = "message success";
        msg.style.display = "block";

        // Clear form
        document.getElementById("withdrawAmount").value = "";
        document.getElementById("withdrawUpi").value = "";
        document.getElementById("withdrawBank").value = "";
        document.getElementById("withdrawIfsc").value = "";

        // Reload details to update wallet balance
        setTimeout(() => {
            loadReferralDetails();
        }, 1000);

    } catch (err) {
        console.error("Withdrawal error:", err);
        msg.textContent = "❌ Error submitting withdrawal request. Please try again.";
        msg.className = "message error";
        msg.style.display = "block";
    }
}


// Load referral history - using existing details endpoint
async function loadReferralHistory() {
    const token = localStorage.getItem("token");
    const loading = document.getElementById("historyLoading");
    const content = document.getElementById("historyContent");
    const noHistory = document.getElementById("noHistory");
    const tableBody = document.getElementById("historyTableBody");

    try {
        const res = await fetch(`${window.API_URL}/referral/details`, {
            headers: { "Authorization": "Bearer " + token }
        });

        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }

        const data = await res.json();

        loading.style.display = "none";
        content.style.display = "block";

        if (!data.history || data.history.length === 0) {
            noHistory.style.display = "block";
            tableBody.parentElement.parentElement.style.display = "none";
            document.getElementById("totalReferrals").textContent = "0";
            document.getElementById("totalCommission").textContent = "₹0";
            return;
        }

        // Calculate totals
        const totalReferrals = data.history.length;
        // Commission calculation would need actual purchase data
        const totalCommission = 0; // Placeholder

        document.getElementById("totalReferrals").textContent = totalReferrals;
        document.getElementById("totalCommission").textContent = `₹${data.wallet.toFixed(2)}`;

        // Calculate total commission from individual referrals
        const calculatedCommission = data.history.reduce((sum, ref) => sum + (ref.commission || 0), 0);
        document.getElementById("totalCommission").textContent = `₹${calculatedCommission.toFixed(2)}`;

        // Populate table
        tableBody.innerHTML = "";
        data.history.forEach(ref => {
            const row = document.createElement("tr");
            row.style.borderBottom = "1px solid #f0f0f0";
            
            const status = ref.reward === "Reward Added" ? "Active" : "Pending";
            const statusColor = ref.reward === "Reward Added" ? "#28a745" : "#ffc107";
            const commission = ref.commission || 0;
            const commissionText = commission > 0 ? `₹${commission.toFixed(2)}` : "-";
            const level = ref.level || 1;
            const levelColor = level === 1 ? "#667eea" : level === 2 ? "#28a745" : "#ffc107";

            row.innerHTML = `
                <td style="padding: 12px; font-size: 14px;">${ref.name || "User"}</td>
                <td style="padding: 12px; font-size: 14px; color: #666;">${ref.email}</td>
                <td style="padding: 12px; text-align: center;">
                    <span style="background: ${levelColor}; color: white; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;">
                        L${level}
                    </span>
                </td>
                <td style="padding: 12px; font-size: 14px; text-align: right; font-weight: 600; color: #28a745;">${commissionText}</td>
                <td style="padding: 12px; text-align: center;">
                    <span style="background: ${statusColor}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">
                        ${status}
                    </span>
                </td>
            `;
            tableBody.appendChild(row);
        });

    } catch (err) {
        console.error("Error loading referral history:", err);
        loading.innerHTML = "Error loading history";
    }
}

// Call it on page load
document.addEventListener("DOMContentLoaded", () => {
    loadReferralHistory();
});
