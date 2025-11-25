const API = window.API_URL;

document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "null");

    // ❌ If no token → user not logged in
    if (!token || !user) {
        window.location.href = "/login.html";
        return;
    }

    loadProfile();
    loadOrders();

    document.getElementById("logoutBtn").addEventListener("click", logout);
});

/* -----------------------------------------
   LOAD PROFILE
----------------------------------------- */
function loadProfile() {
    const user = JSON.parse(localStorage.getItem("user"));

    document.getElementById("accName").textContent = user.name;
    document.getElementById("accEmail").textContent = user.email;

    document.getElementById("editName").value = user.name;
    document.getElementById("editEmail").value = user.email;
}

/* -----------------------------------------
   CHANGE PAGE SECTIONS
----------------------------------------- */
function showSection(section) {
    document.getElementById("profileSection").style.display = "none";
    document.getElementById("editSection").style.display = "none";
    document.getElementById("ordersSection").style.display = "none";

    document.getElementById(section + "Section").style.display = "block";
}

/* -----------------------------------------
   LOAD ORDERS (SAFE)
----------------------------------------- */
async function loadOrders() {
    const token = localStorage.getItem("token");

    if (!token) {
        document.getElementById("ordersList").innerHTML = "<p>Please login to view orders.</p>";
        return;
    }

    try {
        const res = await fetch(`${API}/orders`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        const data = await res.json();
        const container = document.getElementById("ordersList");
        container.innerHTML = "";

        if (!data.orders || data.orders.length === 0) {
            container.innerHTML = "<p>No orders yet.</p>";
            return;
        }

        data.orders.forEach(order => {
            const div = document.createElement("div");
            div.classList.add("order-item");
            div.innerHTML = `
                <p><strong>Book:</strong> ${order.bookTitle}</p>
                <p><strong>Price:</strong> ₹${order.price}</p>
                <p><strong>Date:</strong> ${new Date(order.date).toDateString()}</p>
                <hr>
            `;
            container.appendChild(div);
        });
    } 
    catch (error) {
        console.error("Order load error:", error);
        document.getElementById("ordersList").innerHTML = "<p>Error loading orders.</p>";
    }
}

/* -----------------------------------------
   LOGOUT
----------------------------------------- */
function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/";
}

// ----------------------------
// EDIT PROFILE SUBMIT
// ----------------------------

document.getElementById("editForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const token = localStorage.getItem("token");
    if (!token) {
        alert("Login required");
        window.location.href = "/login.html";
        return;
    }

    const name = document.getElementById("editName").value.trim();
    const email = document.getElementById("editEmail").value.trim();

    try {
        const res = await fetch(`${API}/users/update`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ name, email })
        });

        const data = await res.json();
        console.log("Update response:", data);

        if (!res.ok) {
            alert(data.error || "Update failed");
            return;
        }

        // ✔ Save updated user to localStorage
        localStorage.setItem("user", JSON.stringify(data.user));

        // ✔ Refresh name & email inside account page
        loadProfile();

        // ✔ Update navbar username
        const navUser = document.getElementById("userName");
        if (navUser) navUser.textContent = `Hello, ${data.user.name}`;

        alert("Profile updated successfully!");
        showSection("profile");

    } catch (err) {
        console.error("Profile update error:", err);
        alert("Profile update error");
    }
});


order.timeline.forEach(step => {
    trackingHTML += `
        <div class="track-step">
            <strong>${step.status.toUpperCase()}</strong>
            <span>${new Date(step.date).toLocaleString()}</span>
        </div>
    `;
});
