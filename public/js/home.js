// ------------------------------
// FIX: Use ONLY window.API_URL
// ------------------------------


// If for any reason API_URL is empty, fallback
if (!API_URL || API_URL === "undefined") {
    API_URL = window.location.origin + "/api";
    console.log("API_URL fallback applied:", API_URL);
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("HOME USING API:", API_URL);
    checkAuth();
    loadNotifications(); // Load notifications/offers
    loadBundles(); // Load combo offers
    loadCategoriesForFilter();
    loadBooksWithFilters();
    setupEventListeners();
});

/* ------------------------------
   LOAD CATEGORIES (FILTER BAR)
--------------------------------*/
async function loadCategoriesForFilter() {
    try {
        const res = await fetch(`${API_URL}/categories`);
        const data = await res.json();

        const container = document.createElement('div');
        container.className = 'filter-row';
        container.innerHTML = `
            <label>Category</label>
            <select id="filterCategory"><option value="">All</option></select>
            <label>Min</label><input id="filterMin" type="number" placeholder="min" />
            <label>Max</label><input id="filterMax" type="number" placeholder="max" />
            <button id="applyFilters" class="btn-secondary">Apply</button>
        `;

        document.querySelector('.books-section')
                .insertBefore(container, document.getElementById('loadingSpinner'));

        const sel = container.querySelector('#filterCategory');

        if (data.categories) {
            data.categories.forEach(c => {
                const o = document.createElement('option');
                o.value = c.slug;
                o.textContent = c.name;
                sel.appendChild(o);
            });
        }

        container.querySelector('#applyFilters').addEventListener('click', () => {
            const category = sel.value;
            const minPrice = container.querySelector('#filterMin').value;
            const maxPrice = container.querySelector('#filterMax').value;

            loadBooksWithFilters({ category, minPrice, maxPrice });
        });

    } catch (err) {
        console.error("Error loading filter categories:", err);
    }
}

/* ------------------------------
   LOAD NOTIFICATIONS
--------------------------------*/
async function loadNotifications() {
    try {
        const res = await fetch(`${API_URL}/notifications`);
        const data = await res.json();

        if (data.notifications && data.notifications.length > 0) {
            displayNotifications(data.notifications);
        }
    } catch (err) {
        console.error("Error loading notifications:", err);
    }
}

function displayNotifications(notifications) {
    const section = document.getElementById('notificationsSection');
    
    section.innerHTML = notifications.map(notif => `
        <div class="notification-banner ${notif.type}">
            <div class="notification-header">
                <div class="notification-title">📢 ${notif.title}</div>
                <span class="notification-type-badge badge-${notif.type}">${notif.type}</span>
            </div>
            <div class="notification-message">${notif.message}</div>
        </div>
    `).join('');
    
    section.style.display = 'block';
}

/* ------------------------------
   LOAD BOOKS WITH FILTERS
--------------------------------*/
async function loadBooksWithFilters({ page = 1, limit = 12, category, minPrice, maxPrice, search } = {}) {

    const qs = new URLSearchParams();
    qs.set("page", page);
    qs.set("limit", limit);
    if (category) qs.set("category", category);
    if (minPrice) qs.set("minPrice", minPrice);
    if (maxPrice) qs.set("maxPrice", maxPrice);
    if (search) qs.set("search", search);

    const loadingSpinner = document.getElementById("loadingSpinner");

    try {
        const res = await fetch(`${API_URL}/books?${qs.toString()}`);
        const data = await res.json();

        loadingSpinner.style.display = "none";

        if (data.books && data.books.length > 0) {
            displayBooks(data.books);
            document.getElementById("booksGrid").style.display = "grid";
        } else {
            document.getElementById("booksGrid").style.display = "none";
            document.getElementById("emptyState").style.display = "block";
        }

    } catch (err) {
        console.error("Error loading books:", err);
        loadingSpinner.textContent = "Error loading books.";
    }
}

/* ------------------------------
   AUTH CHECK
--------------------------------*/
function checkAuth() {
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "null");

    if (token && user) {
        const authLinks = document.getElementById("authLinks");
        const userLinks = document.getElementById("userLinks");
        const userName = document.getElementById("userName");
        const accountLink = document.getElementById("accountLink");
        const ordersLink = document.getElementById("ordersLink");
        const referralLink = document.getElementById("referralLink");
        const adminLink = document.getElementById("adminLink");

        if (authLinks) authLinks.style.display = "none";
        if (userLinks) userLinks.style.display = "flex";
        if (userName) userName.textContent = `Hello, ${user.name}`;
        if (accountLink) accountLink.style.display = "block";
        if (ordersLink) ordersLink.style.display = "block";
        if (referralLink) referralLink.style.display = "block";

        if (user.role === "admin" && adminLink) {
            adminLink.style.display = "block";
        }
    }
}

/* ------------------------------
   EVENT LISTENERS
--------------------------------*/
function setupEventListeners() {
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) logoutBtn.addEventListener("click", logout);

    const searchBtn = document.getElementById("searchBtn");
    const searchInput = document.getElementById("searchInput");

    if (searchBtn) {
        searchBtn.addEventListener("click", performSearch);
    }
    
    if (searchInput) {
        searchInput.addEventListener("keyup", (e) => {
            if (e.key === "Enter") performSearch();
        });
    }
}

/* ------------------------------
   LOGOUT
--------------------------------*/
function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/";
}

/* ------------------------------
   DISPLAY BOOKS
--------------------------------*/
function displayBooks(books) {
    const grid = document.getElementById("booksGrid");
    grid.innerHTML = "";

    books.forEach((book) => {
        grid.appendChild(createBookCard(book));
    });
}

function createBookCard(book) {
    const card = document.createElement("div");
    card.className = "book-card";

    const coverImage = book.cover_image || "https://via.placeholder.com/250x300?text=No+Cover";

    card.innerHTML = `
        <img src="${coverImage}" class="book-cover" />
        <h3>${book.title}</h3>
        <p class="book-author">by ${book.author}</p>
        <p class="book-price">₹${parseFloat(book.price).toFixed(2)} ${book.rewardPoints && book.rewardPoints > 0 ? `<span style="background: #28a745; color: white; padding: 3px 8px; border-radius: 12px; font-size: 11px; margin-left: 5px; font-weight: 600;">🎁 +${book.rewardPoints}</span>` : ''}</p>
        <div class="book-actions">
            <button class="btn-secondary" onclick="previewBook('${book._id}')">Preview</button>
            <button class="btn-primary" onclick="handleBuyClick('${book._id}')">Buy</button>
            <button class="btn-secondary cart-btn" data-id="${book._id}">Add to Cart</button>
        </div>
    `;
    return card;
}

/* ------------------------------
   SEARCH
--------------------------------*/
function performSearch() {
    const term = document.getElementById("searchInput").value.trim().toLowerCase();
    if (!term) return loadBooksWithFilters();
    loadBooksWithFilters({ search: term });
}

/* ------------------------------
   PREVIEW & BUY
--------------------------------*/
function previewBook(id) {
    window.location.href = `/book.html?id=${id}`;
}

function handleBuyClick(id) {
    const token = localStorage.getItem("token");
    if (!token) {
        localStorage.setItem("redirectAfterLogin", `/book.html?id=${id}`);
        return (window.location.href = "/login.html");
    }
    window.location.href = `/book.html?id=${id}`;
}

/* ------------------------------
   LOAD BUNDLES (COMBO OFFERS)
--------------------------------*/
async function loadBundles() {
    try {
        const res = await fetch(`${API_URL}/bundles`);
        const data = await res.json();

        if (data.bundles && data.bundles.length > 0) {
            // Show 5 bundles on desktop, 3 on mobile
            const isMobile = window.innerWidth <= 768;
            const limit = isMobile ? 3 : 5;
            const limitedBundles = data.bundles.slice(0, limit);
            displayBundles(limitedBundles, data.bundles.length, limit);
            document.getElementById("bundlesSection").style.display = "block";
        }
    } catch (err) {
        console.error("Error loading bundles:", err);
    }
}

function displayBundles(bundles, totalCount, limit) {
    const grid = document.getElementById("bundlesGrid");
    grid.innerHTML = "";

    bundles.forEach((bundle) => {
        const card = document.createElement("div");
        card.className = "book-card bundle-card";
        card.style.border = "2px solid #ff4444";
        card.style.position = "relative";

        const discount = bundle.discount || Math.round(((bundle.originalPrice - bundle.bundlePrice) / bundle.originalPrice) * 100);

        card.innerHTML = `
            <div style="position: absolute; top: 10px; right: 10px; background: #ff4444; color: white; padding: 5px 10px; border-radius: 4px; font-weight: bold; font-size: 12px;">
                ${discount}% OFF
            </div>
            <img src="${bundle.image || 'data:image/svg+xml,%3Csvg xmlns=\"http://www.w3.org/2000/svg\" width=\"250\" height=\"300\"%3E%3Crect fill=\"%23ddd\" width=\"250\" height=\"300\"/%3E%3Ctext fill=\"%23999\" font-family=\"Arial\" font-size=\"20\" x=\"50%25\" y=\"50%25\" text-anchor=\"middle\" dy=\".3em\"%3EBundle%3C/text%3E%3C/svg%3E'}" class="book-cover" style="height: 200px; object-fit: cover;" />
            <h3 style="font-size: 16px; margin: 10px 0 5px 0;">🎁 ${bundle.name}</h3>
            <p style="font-size: 12px; color: #666; margin: 3px 0;">${bundle.books.length} Books Included</p>
            <p style="text-decoration: line-through; color: #999; font-size: 13px; margin: 3px 0;">₹${bundle.originalPrice}</p>
            <p class="book-price" style="font-size: 20px; color: #ff4444; margin: 5px 0;">₹${bundle.bundlePrice}</p>
            <div class="book-actions" style="margin-top: 10px;">
                <button class="btn-primary" onclick="viewBundle('${bundle._id}')" style="padding: 8px 12px; font-size: 13px;">View Bundle</button>
                <button class="btn-secondary" onclick="addBundleToCart('${bundle._id}')" style="padding: 8px 12px; font-size: 13px;">Add to Cart</button>
            </div>
        `;
        grid.appendChild(card);
    });

    // Add "View All Offers" button if there are more bundles than the limit
    if (totalCount > limit) {
        const viewAllCard = document.createElement("div");
        viewAllCard.className = "book-card";
        viewAllCard.style.background = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
        viewAllCard.style.display = "flex";
        viewAllCard.style.alignItems = "center";
        viewAllCard.style.justifyContent = "center";
        viewAllCard.style.cursor = "pointer";
        viewAllCard.style.minHeight = "280px";
        
        viewAllCard.innerHTML = `
            <div style="text-align: center; color: white;">
                <div style="font-size: 40px; margin-bottom: 10px;">🎁</div>
                <h3 style="color: white; font-size: 18px; margin-bottom: 8px;">View All Offers</h3>
                <p style="color: rgba(255,255,255,0.9); font-size: 13px; margin-bottom: 12px;">${totalCount - limit} more bundles available</p>
                <button class="btn-primary" style="background: white; color: #667eea; padding: 8px 16px; font-size: 13px;">Explore All</button>
            </div>
        `;
        
        viewAllCard.onclick = () => {
            window.location.href = "/bundles.html";
        };
        
        grid.appendChild(viewAllCard);
    }
}

function viewBundle(bundleId) {
    window.location.href = `/bundle.html?id=${bundleId}`;
}

async function addBundleToCart(bundleId) {
    try {
        const res = await fetch(`${API_URL}/bundles/${bundleId}`);
        const data = await res.json();
        const bundle = data.bundle;

        let cart = getCart();

        // Check if bundle already in cart
        if (cart.find(item => item.bundleId === bundleId)) {
            return alert("This bundle is already in your cart!");
        }

        // Add bundle as a special cart item
        cart.push({
            bundleId: bundleId,
            isBundle: true,
            title: bundle.name,
            price: bundle.bundlePrice,
            originalPrice: bundle.originalPrice,
            books: bundle.books,
            quantity: 1,
            coverImage: bundle.image || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="250" height="300"%3E%3Crect fill="%23ddd" width="250" height="300"/%3E%3Ctext fill="%23999" font-family="Arial" font-size="20" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EBundle%3C/text%3E%3C/svg%3E'
        });

        saveCart(cart);
        alert(`Bundle "${bundle.name}" added to cart!`);
        
        // Update cart count if exists
        updateCartCount();
    } catch (err) {
        console.error("Error adding bundle to cart:", err);
        alert("Error adding bundle to cart");
    }
}

function updateCartCount() {
    const cart = getCart();
    const cartCount = document.getElementById("cartCount");
    if (cartCount) {
        cartCount.textContent = cart.length;
    }
}

/* ------------------------------
   ADD TO CART
--------------------------------*/
document.addEventListener("click", (e) => {
    if (e.target.classList.contains("cart-btn")) {
        const bookId = e.target.dataset.id;
        const card = e.target.closest(".book-card");

        const title = card.querySelector("h3").textContent;
        const author = card.querySelector(".book-author").textContent.replace("by ", "");
        const price = parseFloat(card.querySelector(".book-price").textContent.replace("₹", "").split("🎁")[0].trim());
        const coverImage = card.querySelector("img").src;

        let cart = getCart();

        if (cart.find((item) => item.id === bookId)) {
            return alert("Already in cart!");
        }

        cart.push({ id: bookId, title, author, price, coverImage, quantity: 1 });
        saveCart(cart);
        alert("Book added to cart!");
        updateCartCount();
    }
});
