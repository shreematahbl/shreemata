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
        document.getElementById("authLinks").style.display = "none";
        document.getElementById("userLinks").style.display = "flex";
        document.getElementById("userName").textContent = `Hello, ${user.name}`;
        document.getElementById("accountLink").style.display = "block";

        if (user.role === "admin") {
            document.getElementById("adminLink").style.display = "block";
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

    searchBtn.addEventListener("click", performSearch);
    searchInput.addEventListener("keyup", (e) => {
        if (e.key === "Enter") performSearch();
    });
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
        <p class="book-price">$${parseFloat(book.price).toFixed(2)}</p>
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
   ADD TO CART
--------------------------------*/
document.addEventListener("click", (e) => {
    if (e.target.classList.contains("cart-btn")) {
        const bookId = e.target.dataset.id;
        const card = e.target.closest(".book-card");

        const title = card.querySelector("h3").textContent;
        const author = card.querySelector(".book-author").textContent.replace("by ", "");
        const price = parseFloat(card.querySelector(".book-price").textContent.replace("$", ""));
        const coverImage = card.querySelector("img").src;

        let cart = JSON.parse(localStorage.getItem("cart") || "[]");

        if (cart.find((item) => item.id === bookId)) {
            return alert("Already in cart!");
        }

        cart.push({ id: bookId, title, author, price, coverImage, quantity: 1 });
        localStorage.setItem("cart", JSON.stringify(cart));
        alert("Book added to cart!");
    }
});
