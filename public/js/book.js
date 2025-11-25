// Load dynamic API URL
const API = window.API_URL;

document.addEventListener("DOMContentLoaded", () => {
    checkAuth();
    loadBookDetails();
    setupEventListeners();
});

/* -----------------------------------
   AUTH CHECK
----------------------------------- */
function checkAuth() {
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "null");

    if (token && user) {
        document.getElementById("authLinks").style.display = "none";
        document.getElementById("userLinks").style.display = "flex";
        document.getElementById("userName").textContent = `Hello, ${user.name}`;

        if (user.role === "admin") {
            document.getElementById("adminLink").style.display = "block";
        }
    }
}

/* -----------------------------------
   EVENT LISTENERS
----------------------------------- */
function setupEventListeners() {
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) logoutBtn.addEventListener("click", logout);

    const buyBtn = document.getElementById("buyBtn");
    if (buyBtn) buyBtn.addEventListener("click", handlePurchase);

    const cartBtn = document.getElementById("cartBtn");
    if (cartBtn) cartBtn.addEventListener("click", addToCart);

    const searchBtn = document.getElementById("searchBtn");
    const searchInput = document.getElementById("searchInput");

    searchBtn.addEventListener("click", () => {
        const term = searchInput.value.trim();
        if (term) window.location.href = `/?search=${encodeURIComponent(term)}`;
    });

    searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            const term = searchInput.value.trim();
            if (term) window.location.href = `/?search=${encodeURIComponent(term)}`;
        }
    });
}

/* -----------------------------------
   LOGOUT
----------------------------------- */
function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/";
}

/* -----------------------------------
   LOAD BOOK DETAILS
----------------------------------- */
async function loadBookDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const bookId = urlParams.get("id");

    if (!bookId) return showError();

    try {
        const res = await fetch(`${API}/books/${bookId}`);
        const data = await res.json();

        if (!res.ok) throw new Error("Book not found");

        document.getElementById("loadingSpinner").style.display = "none";
        document.getElementById("bookDetails").style.display = "block";

        displayBookDetails(data.book);

    } catch (err) {
        console.error("Error loading book:", err);
        showError();
    }
}

/* -----------------------------------
   DISPLAY BOOK DETAILS
----------------------------------- */
function displayBookDetails(book) {
    document.getElementById("bookTitle").textContent = book.title;
    document.getElementById("bookAuthor").textContent = book.author;
    document.getElementById("bookPrice").textContent = `$${parseFloat(book.price).toFixed(2)}`;
    document.getElementById("bookDescription").textContent =
        book.description || "No description available.";

    const cover = document.getElementById("bookCover");
    cover.src = book.cover_image || "https://via.placeholder.com/400x600?text=No+Cover";
    cover.onerror = () => (cover.src = "https://via.placeholder.com/400x600?text=No+Cover");

    const previewGrid = document.getElementById("previewImages");
    const noPreview = document.getElementById("noPreview");

    if (book.preview_images?.length) {
        previewGrid.innerHTML = "";
        book.preview_images.forEach((imgURL, index) => {
            const img = document.createElement("img");
            img.src = imgURL;
            img.alt = `Preview ${index + 1}`;
            img.classList.add("preview-image");
            img.onerror = () => (img.src = "https://via.placeholder.com/400x600?text=Unavailable");
            previewGrid.appendChild(img);
        });
    } else {
        noPreview.style.display = "block";
    }
}

/* -----------------------------------
   BUY NOW → Razorpay Checkout
----------------------------------- */
async function handlePurchase() {
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "null");

    if (!token || !user) {
        const id = new URLSearchParams(window.location.search).get("id");
        localStorage.setItem("redirectAfterLogin", `/book.html?id=${id}`);
        return window.location.href = "/login.html";
    }

    const bookId = new URLSearchParams(window.location.search).get("id");

    try {
        // Fetch book details
        const res = await fetch(`${API}/books/${bookId}`);
        const data = await res.json();
        const book = data.book;

        // 1️⃣ Create backend Razorpay order
        const orderRes = await fetch(`${API}/payments/create-order`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                amount: book.price,
                user_id: user._id,
                items: [{
                    id: book._id,
                    title: book.title,
                    author: book.author,
                    price: book.price,
                    quantity: 1,
                    coverImage: book.cover_image
                }]
            })
        });

        const orderData = await orderRes.json();

        // 2️⃣ Razorpay Checkout
        const options = {
            key: "rzp_test_RjA5o7ViCyygdZ", // your test key
            amount: orderData.order.amount,
            currency: "INR",
            name: "BookStore",
            description: book.title,
            order_id: orderData.order.id,

            handler: function (response) {
                alert("Payment completed! Webhook will update order status.");
            },

            theme: { color: "#3399cc" }
        };

        const rzp = new Razorpay(options);
        rzp.open();

    } catch (err) {
        console.error("Payment Error:", err);
        alert("Payment failed. Try again.");
    }
}

/* -----------------------------------
   ADD TO CART
----------------------------------- */
function addToCart() {
    const bookId = new URLSearchParams(window.location.search).get("id");

    const cart = JSON.parse(localStorage.getItem("cart") || "[]");

    if (cart.some((item) => item.id === bookId)) {
        return alert("Already in cart!");
    }

    cart.push({
        id: bookId,
        title: document.getElementById("bookTitle").textContent,
        author: document.getElementById("bookAuthor").textContent,
        price: parseFloat(document.getElementById("bookPrice").textContent.replace("$", "")),
        coverImage: document.getElementById("bookCover").src,
        quantity: 1
    });

    localStorage.setItem("cart", JSON.stringify(cart));
    alert("Book added to cart!");
}

/* -----------------------------------
   SHOW ERROR 
----------------------------------- */
function showError() {
    document.getElementById("loadingSpinner").style.display = "none";
    document.getElementById("errorState").style.display = "block";
}
