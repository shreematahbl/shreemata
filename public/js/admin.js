const API = window.API_URL;

let isEditMode = false;
let editingBookId = null;

document.addEventListener('DOMContentLoaded', () => {
    checkAdminAuth();
    loadCategoriesDropdown();
    loadCategoriesForAdminFilters();
    loadBooks();
    setupEventListeners();
});

/* AUTH CHECK */
function checkAdminAuth() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');

    if (!token || !user || user.role !== 'admin') {
        alert('Admin access required');
        window.location.href = '/login.html';
        return;
    }

    document.getElementById('userName').textContent = `Hello, ${user.name}`;
}

/* LOAD CATEGORIES (ADD BOOK FORM) */
async function loadCategoriesDropdown() {
    const res = await fetch(`${API}/categories`);
    const data = await res.json();

    const select = document.getElementById("category");
    select.innerHTML = `<option value="">Select category</option>`;

    data.categories.forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat.slug;
        opt.textContent = cat.name;
        select.appendChild(opt);
    });
}

/* ADD CATEGORY */
document.getElementById("addCategoryBtn").addEventListener("click", async (e) => {
    e.preventDefault();
    const name = prompt("Enter new category name:");
    if (!name) return;

    const token = localStorage.getItem("token");

    const res = await fetch(`${API}/categories`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ name })
    });

    const data = await res.json();

    if (res.ok) {
        alert("Category added!");
        loadCategoriesDropdown();
        loadCategoriesForAdminFilters();
    } else {
        alert(data.error);
    }
});

/* EVENT LISTENERS */
function setupEventListeners() {
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('toggleFormBtn').addEventListener('click', toggleForm);
    document.getElementById('bookForm').addEventListener('submit', handleFormSubmit);
    document.getElementById('cancelBtn').addEventListener('click', resetForm);

    document.getElementById("viewOrdersBtn").addEventListener("click", () => {
        document.getElementById("ordersSection").style.display = "block";
        loadOrders();
    });

    document.getElementById('previewImages').addEventListener('change', (e) => {
        if (e.target.files.length > 4) {
            alert('Maximum 4 preview images allowed');
            e.target.value = '';
        }
    });

    document.getElementById("adminApplyFilter").addEventListener("click", () => {
        const filters = {
            category: document.getElementById("adminFilterCategory").value,
            search: document.getElementById("adminFilterSearch").value,
            minPrice: document.getElementById("adminFilterMin").value,
            maxPrice: document.getElementById("adminFilterMax").value
        };
        loadBooks(filters);
    });

    document.getElementById('booksTableBody').addEventListener('click', (e) => {
        const edit = e.target.closest('.edit-btn');
        const del = e.target.closest('.delete-btn');

        if (edit) editBook(edit.dataset.id);
        if (del) deleteBook(del.dataset.id);
    });
}

/* LOGOUT */
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
}

/* TOGGLE FORM */
function toggleForm() {
    const form = document.getElementById('addBookForm');
    const toggleBtn = document.getElementById('toggleFormBtn');
    
    const isHidden = form.style.display === 'none' || form.style.display === '';
    form.style.display = isHidden ? 'block' : 'none';
    toggleBtn.textContent = isHidden ? 'Hide Form' : 'Show Form';

    if (!isHidden) resetForm();
}

/* LOAD BOOKS */
async function loadBooks(filters = {}) {
    let qs = new URLSearchParams(filters).toString();
    const loading = document.getElementById('loadingSpinner');
    const table = document.getElementById('booksTable');
    const empty = document.getElementById('emptyState');

    const res = await fetch(`${API}/books?${qs}`);
    const data = await res.json();

    loading.style.display = 'none';

    if (data.books.length) {
        displayBooks(data.books);
        table.style.display = 'block';
        empty.style.display = 'none';
    } else {
        table.style.display = 'none';
        empty.style.display = 'block';
    }
}

/* DISPLAY BOOKS */
function displayBooks(books) {
    const tbody = document.getElementById('booksTableBody');
    tbody.innerHTML = '';

    books.forEach(book => {
        const row = document.createElement('tr');

        row.innerHTML = `
            <td><img src="${book.cover_image}" width="50"/></td>
            <td>${book.title}</td>
            <td>${book.author}</td>
            <td>$${parseFloat(book.price).toFixed(2)}</td>
            <td>
                <button class="btn-secondary edit-btn" data-id="${book._id}">Edit</button>
                <button class="btn-danger delete-btn" data-id="${book._id}">Delete</button>
            </td>
        `;

        tbody.appendChild(row);
    });
}

/* EDIT BOOK */
async function editBook(bookId) {
    const res = await fetch(`${API}/books/${bookId}`);
    const data = await res.json();

    const book = data.book;

    isEditMode = true;
    editingBookId = bookId;

    document.getElementById('title').value = book.title;
    document.getElementById('author').value = book.author;
    document.getElementById('price').value = book.price;
    document.getElementById('description').value = book.description;
    document.getElementById('category').value = book.category;

    document.getElementById('addBookForm').style.display = "block";
    document.getElementById('toggleFormBtn').textContent = "Hide Form";
    document.getElementById('submitBtn').textContent = "Update Book";
}

/* DELETE BOOK */
async function deleteBook(bookId) {
    if (!confirm("Are you sure?")) return;

    const token = localStorage.getItem('token');

    const res = await fetch(`${API}/books/${bookId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
    });

    if (res.ok) {
        alert("Deleted");
        loadBooks();
    }
}

/* SUBMIT FORM */
async function handleFormSubmit(e) {
    e.preventDefault();

    const formData = new FormData();
    formData.append('title', document.getElementById('title').value);
    formData.append('author', document.getElementById('author').value);
    formData.append('price', document.getElementById('price').value);
    formData.append('description', document.getElementById('description').value);
    formData.append('category', document.getElementById('category').value);

    const cover = document.getElementById('coverImage').files[0];
    if (cover) formData.append('coverImage', cover);

    const previews = document.getElementById('previewImages').files;
    for (let i = 0; i < previews.length; i++) {
        formData.append('previewImages', previews[i]);
    }

    const token = localStorage.getItem('token');
    const url = isEditMode ? `${API}/books/${editingBookId}` : `${API}/books`;
    const method = isEditMode ? "PUT" : "POST";

    const res = await fetch(url, {
        method,
        headers: { "Authorization": `Bearer ${token}` },
        body: formData
    });

    const data = await res.json();

    if (res.ok) {
        alert(data.message);
        resetForm();
        loadBooks();
    }
}

/* RESET FORM */
function resetForm() {
    isEditMode = false;
    editingBookId = null;
    document.getElementById('bookForm').reset();
    document.getElementById('submitBtn').textContent = "Add Book";
}

/* LOAD CATEGORY FILTER */
async function loadCategoriesForAdminFilters() {
    const res = await fetch(`${API}/categories`);
    const data = await res.json();

    const select = document.getElementById("adminFilterCategory");
    select.innerHTML = `<option value="">All</option>`;

    data.categories.forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat.slug;
        opt.textContent = cat.name;
        select.appendChild(opt);
    });
}

/* LOAD ORDERS */
async function loadOrders() {
    const token = localStorage.getItem("token");

    document.getElementById("ordersLoading").style.display = "block";
    document.getElementById("ordersTable").style.display = "none";
    document.getElementById("ordersEmpty").style.display = "none";

    const res = await fetch(`${API}/orders/admin/all`, {
        headers: { "Authorization": "Bearer " + token }
    });

    const data = await res.json();
    const tbody = document.getElementById("ordersTableBody");
    tbody.innerHTML = "";

    document.getElementById("ordersLoading").style.display = "none";

    if (!data.orders || data.orders.length === 0) {
        document.getElementById("ordersEmpty").style.display = "block";
        return;
    }

    document.getElementById("ordersTable").style.display = "table";

    data.orders.forEach(order => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>
                ${order.user_id?.name || "Unknown"}<br>
                <small>${order.user_id?.email || ""}</small>
            </td>
            <td>${order.items[0].title}</td>
            <td>$${order.totalAmount}</td>
            <td>${order.status}</td>
            <td>${new Date(order.createdAt).toLocaleString()}</td>
        `;

        tbody.appendChild(tr);
    });
}

document.querySelectorAll(".updateStatusBtn").forEach(btn => {
    btn.addEventListener("click", async function() {
        const orderId = this.dataset.id;
        const newStatus = document.querySelector(`.statusSelect[data-id="${orderId}"]`).value;

        const token = localStorage.getItem("token");

        const res = await fetch(`${API_URL}/orders/admin/update-status/${orderId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({ status: newStatus })
        });

        const data = await res.json();

        if (res.ok) {
            alert("Order status updated");
        } else {
            alert("Error updating order");
        }
    });
});
