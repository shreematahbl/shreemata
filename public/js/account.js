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
    loadAddress();

    document.getElementById("logoutBtn").addEventListener("click", logout);
    document.getElementById("addressForm").addEventListener("submit", saveAddress);
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
    document.getElementById("addressSection").style.display = "none";
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
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #999;">
                    <div style="font-size: 48px; margin-bottom: 10px;">📦</div>
                    <p>No orders yet. Start shopping!</p>
                </div>
            `;
            return;
        }

        data.orders.forEach(order => {
            const div = document.createElement("div");
            div.classList.add("order-card");
            
            const itemsList = order.items.map(item => {
                const qty = item.quantity > 1 ? ` (x${item.quantity})` : '';
                return `${item.title}${qty}`;
            }).join(', ');
            
            const statusColor = order.status === 'completed' ? '#28a745' : 
                               order.status === 'pending' ? '#ffc107' : '#dc3545';
            
            const deliveryStatus = order.deliveryStatus || 'pending';
            const deliveryColor = deliveryStatus === 'delivered' ? '#28a745' : 
                                 deliveryStatus === 'shipped' ? '#2196F3' : '#ffc107';

            div.innerHTML = `
                <h3>Order #${order._id.slice(-8)}</h3>
                <p><strong>Items:</strong> ${itemsList}</p>
                <p><strong>Total Amount:</strong> ₹${order.totalAmount.toFixed(2)}</p>
                <p><strong>Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
                <p><strong>Payment Status:</strong> <span style="color: ${statusColor}; font-weight: 600;">${order.status}</span></p>
                <p><strong>Delivery Status:</strong> <span style="color: ${deliveryColor}; font-weight: 600;">${deliveryStatus}</span></p>
                ${order.deliveryAddress && order.deliveryAddress.street ? `
                    <p><strong>Delivery Address:</strong> ${order.deliveryAddress.street}, ${order.deliveryAddress.city}</p>
                ` : ''}
            `;
            container.appendChild(div);
        });
    } 
    catch (error) {
        console.error("Order load error:", error);
        document.getElementById("ordersList").innerHTML = "<p style='color: #dc3545;'>Error loading orders. Please try again.</p>";
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


/* -----------------------------------------
   LOAD ADDRESS
----------------------------------------- */
async function loadAddress() {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
        const res = await fetch(`${API}/users/profile`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        const data = await res.json();
        
        if (data.user && data.user.address) {
            const addr = data.user.address;
            
            document.getElementById("displayStreet").textContent = addr.street || "Not set";
            document.getElementById("displayCity").textContent = addr.city || "Not set";
            document.getElementById("displayState").textContent = addr.state || "Not set";
            document.getElementById("displayPincode").textContent = addr.pincode || "Not set";
            document.getElementById("displayPhone").textContent = addr.phone || "Not set";

            // Pre-fill form
            document.getElementById("street").value = addr.street || "";
            document.getElementById("city").value = addr.city || "";
            document.getElementById("state").value = addr.state || "";
            document.getElementById("pincode").value = addr.pincode || "";
            document.getElementById("phone").value = addr.phone || "";
        }
    } catch (err) {
        console.error("Error loading address:", err);
    }
}

/* -----------------------------------------
   TOGGLE ADDRESS EDIT FORM
----------------------------------------- */
function toggleAddressEdit() {
    const form = document.getElementById("addressForm");
    const display = document.getElementById("addressDisplay");
    
    if (form.style.display === "none") {
        form.style.display = "block";
        display.style.display = "none";
    } else {
        form.style.display = "none";
        display.style.display = "block";
    }
}

/* -----------------------------------------
   SAVE ADDRESS
----------------------------------------- */
async function saveAddress(e) {
    e.preventDefault();

    const token = localStorage.getItem("token");
    if (!token) {
        alert("Login required");
        return;
    }

    const address = {
        street: document.getElementById("street").value.trim(),
        city: document.getElementById("city").value.trim(),
        state: document.getElementById("state").value.trim(),
        pincode: document.getElementById("pincode").value.trim(),
        phone: document.getElementById("phone").value.trim()
    };

    try {
        const res = await fetch(`${API}/users/update-address`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ address })
        });

        const data = await res.json();

        if (!res.ok) {
            alert(data.error || "Failed to update address");
            return;
        }

        alert("Address updated successfully!");
        loadAddress();
        toggleAddressEdit();

    } catch (err) {
        console.error("Address update error:", err);
        alert("Error updating address");
    }
}
