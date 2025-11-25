// cart.js - full working version with Razorpay checkout integration

document.addEventListener("DOMContentLoaded", () => {
    loadCart();
    setupCartActions();
    checkAuth();
});

/* ------------------------------
    Load Cart Items
------------------------------ */
function loadCart() {
    let cart = JSON.parse(localStorage.getItem("cart") || "[]");

    const container = document.getElementById("cartContainer");
    const summary = document.getElementById("cartSummary");
    const empty = document.getElementById("emptyCart");

    if (!container || !summary || !empty) return;

    container.innerHTML = "";

    if (cart.length === 0) {
        empty.style.display = "block";
        summary.style.display = "none";
        return;
    }

    empty.style.display = "none";
    summary.style.display = "block";

    let total = 0;

    cart.forEach(item => {
        total += item.price * item.quantity;

        const row = document.createElement("div");
        row.className = "cart-item";

        row.innerHTML = `
            <img src="${item.coverImage}" class="cart-img">

            <div class="cart-info">
                <h3>${item.title}</h3>
                <p>by ${item.author}</p>
                <p class="cart-price">$${item.price.toFixed(2)}</p>
                
                <div class="cart-qty">
                    <button class="qty-btn" data-id="${item.id}" data-action="minus">-</button>
                    <span>${item.quantity}</span>
                    <button class="qty-btn" data-id="${item.id}" data-action="plus">+</button>
                </div>

                <button class="btn-danger remove-btn" data-id="${item.id}">
                    Remove
                </button>
            </div>
        `;

        container.appendChild(row);
    });

    document.getElementById("cartTotal").textContent = total.toFixed(2);
}

/* ------------------------------
    Cart Button Actions
------------------------------ */
function setupCartActions() {
    document.addEventListener("click", function (e) {

        // Quantity buttons
        if (e.target.classList.contains("qty-btn")) {
            const id = e.target.dataset.id;
            const action = e.target.dataset.action;
            updateQuantity(id, action);
        }

        // Remove button
        if (e.target.classList.contains("remove-btn")) {
            const id = e.target.dataset.id;
            removeFromCart(id);
        }

        // Checkout button
        if (e.target.id === "checkoutBtn") {
            checkout();
        }
    });
}

/* ------------------------------
    Update Quantity
------------------------------ */
function updateQuantity(bookId, action) {
    let cart = JSON.parse(localStorage.getItem("cart") || "[]");

    const item = cart.find(i => i.id === bookId);
    if (!item) return;

    if (action === "plus") item.quantity++;
    if (action === "minus" && item.quantity > 1) item.quantity--;

    localStorage.setItem("cart", JSON.stringify(cart));
    loadCart();
}

/* ------------------------------
    Remove Item
------------------------------ */
function removeFromCart(bookId) {
    let cart = JSON.parse(localStorage.getItem("cart") || "[]");

    cart = cart.filter(item => item.id !== bookId);

    localStorage.setItem("cart", JSON.stringify(cart));
    loadCart();
}

/* ------------------------------
    Checkout Button (Razorpay flow)
------------------------------ */
async function checkout() {
    const token = localStorage.getItem("token");
    const API = (typeof API_URL !== "undefined") ? API_URL : "";

    // If not logged in → redirect to login page
    if (!token) {
        localStorage.setItem("redirectAfterLogin", "/cart.html");
        window.location.href = "/login.html";
        return;
    }

    const cart = JSON.parse(localStorage.getItem("cart") || "[]");
    if (cart.length === 0) {
        alert("Your cart is empty.");
        return;
    }

    // calculate total (in rupees)
    let total = 0;
    cart.forEach(item => total += item.price * item.quantity);
    // Round to 2 decimals to avoid floating issues
    total = Math.round((total + Number.EPSILON) * 100) / 100;

    // UI feedback
    const checkoutBtn = document.getElementById("checkoutBtn");
    if (checkoutBtn) {
        checkoutBtn.disabled = true;
        checkoutBtn.textContent = "Processing...";
    }

    try {
        // 1) Create order on backend
        const createRes = await fetch(`${API}/api/payments/create-order`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({ amount: total, items: cart })
        });

        const createData = await createRes.json();

        if (!createRes.ok || !createData.order) {
            throw new Error(createData.error || "Failed to create payment order");
        }

        const rzpOrder = createData.order; // contains id and amount (in paise)
        // Some Razorpay SDK fields expect amount in paise - rzpOrder.amount is already in paise

        // 2) Open Razorpay checkout
        // Fallback key - replace with your test key or expose via config
        const RZP_KEY = window.RAZORPAY_KEY || "rzp_test_RjA5o7ViCyygdZ";

        const options = {
            key: RZP_KEY,
            amount: rzpOrder.amount, // amount in paise
            currency: rzpOrder.currency || "INR",
            name: "BookStore",
            description: "Purchase from BookStore",
            order_id: rzpOrder.id,
            handler: async function (response) {
                try {
                    // 3) Verify payment on backend
                    const verifyRes = await fetch(`${API}/api/payments/verify`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": "Bearer " + token
                        },
                        body: JSON.stringify({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            items: cart,
                            totalAmount: total
                        })
                    });

                    const verifyData = await verifyRes.json();

                    if (!verifyRes.ok) {
                        const msg = verifyData.error || "Payment verification failed";
                        alert(msg);
                        console.error("Verify failed:", verifyData);
                        if (checkoutBtn) {
                            checkoutBtn.disabled = false;
                            checkoutBtn.textContent = "Checkout";
                        }
                        return;
                    }

                    // Payment verified and order updated
                    alert("Payment successful! Thank you for your purchase.");
                    // Clear cart
                    localStorage.removeItem("cart");
                    // Redirect to orders or show success
                    window.location.href = "/orders.html";

                } catch (err) {
                    console.error("Error during payment verification:", err);
                    alert("Payment succeeded but verification failed. We'll investigate.");
                    if (checkoutBtn) {
                        checkoutBtn.disabled = false;
                        checkoutBtn.textContent = "Checkout";
                    }
                }
            },
            // if the user closes the popup without paying
            modal: {
                ondismiss: function () {
                    if (checkoutBtn) {
                        checkoutBtn.disabled = false;
                        checkoutBtn.textContent = "Checkout";
                    }
                    console.log("Checkout popup closed by user");
                }
            },
            prefill: {
                // You can prefill with logged-in user details if you store them
                name: (JSON.parse(localStorage.getItem("user") || "null") || {}).name || "",
                email: (JSON.parse(localStorage.getItem("user") || "null") || {}).email || ""
            },
            theme: {
                color: "#1e90ff"
            }
        };

        // open checkout
        const rzp = new Razorpay(options);
        rzp.open();

    } catch (err) {
        console.error("Checkout error:", err);
        alert(err.message || "Error initiating payment");
        if (checkoutBtn) {
            checkoutBtn.disabled = false;
            checkoutBtn.textContent = "Checkout";
        }
    }
}

/* ------------------------------
    Auth Check for Navbar
------------------------------ */
function checkAuth() {
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "null");

    if (token && user) {
        const authLinks = document.getElementById("authLinks");
        const userLinks = document.getElementById("userLinks");

        if (authLinks) authLinks.style.display = "none";
        if (userLinks) userLinks.style.display = "flex";

        const userNameEl = document.getElementById("userName");
        if (userNameEl) userNameEl.textContent = `Hello, ${user.name}`;

        const accountLink = document.getElementById('accountLink');
        if (accountLink) accountLink.style.display = 'block';
    }
    
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            window.location.reload();
        });
    }
}
