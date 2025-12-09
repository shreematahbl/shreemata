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
    const mobileContainer = document.getElementById('mobileBooksContainer');
    tbody.innerHTML = '';
    mobileContainer.innerHTML = '';

    books.forEach(book => {
        // Desktop table row
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><img src="${book.cover_image}" width="50"/></td>
            <td>${book.title}</td>
            <td>${book.author}</td>
            <td>₹${parseFloat(book.price).toFixed(2)}</td>
            <td>
                <button class="btn-secondary edit-btn" data-id="${book._id}">Edit</button>
                <button class="btn-danger delete-btn" data-id="${book._id}">Delete</button>
            </td>
        `;
        tbody.appendChild(row);

        // Mobile card
        const card = document.createElement('div');
        card.className = 'mobile-book-card';
        card.innerHTML = `
            <div class="mobile-book-header">
                <img src="${book.cover_image}" class="mobile-book-cover" alt="${book.title}">
                <div class="mobile-book-info">
                    <h3>${book.title}</h3>
                    <p><strong>Author:</strong> ${book.author}</p>
                    <p><strong>Category:</strong> ${book.category || 'N/A'}</p>
                    <div class="mobile-book-price">₹${parseFloat(book.price).toFixed(2)}</div>
                </div>
            </div>
            <div class="mobile-book-actions">
                <button class="btn btn-secondary edit-btn" data-id="${book._id}">✏️ Edit</button>
                <button class="btn btn-danger delete-btn" data-id="${book._id}">🗑️ Delete</button>
            </div>
        `;
        mobileContainer.appendChild(card);
    });

    // Add event listeners for mobile cards
    mobileContainer.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => editBook(btn.dataset.id));
    });
    mobileContainer.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteBook(btn.dataset.id));
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
    document.getElementById('weight').value = book.weight || 0.5;
    document.getElementById('rewardPoints').value = book.rewardPoints || 0;
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

    const submitBtn = document.getElementById('submitBtn');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;

    try {
        // Get form data
        const title = document.getElementById('title').value;
        const author = document.getElementById('author').value;
        const price = document.getElementById('price').value;
        const description = document.getElementById('description').value;
        const category = document.getElementById('category').value;
        const weight = document.getElementById('weight').value;
        const rewardPoints = document.getElementById('rewardPoints').value;

        const coverFile = document.getElementById('coverImage').files[0];
        const previewFiles = document.getElementById('previewImages').files;

        // Check if cover image is required
        if (!coverFile && !isEditMode) {
            alert('Cover image is required');
            return;
        }

        // TEMPORARILY DISABLED: Direct Cloudinary upload
        // Using server upload for all requests until upload preset is configured
        let useDirectUpload = false;
        let coverImageUrl = '';
        let previewImageUrls = [];

        // Uncomment below when bookstore_preset is properly configured in Cloudinary
        /*
        if (window.cloudinaryUpload && coverFile) {
            try {
                submitBtn.textContent = 'Uploading cover image to Cloudinary...';
                coverImageUrl = await window.cloudinaryUpload.uploadToCloudinary(coverFile);
                
                if (previewFiles.length > 0) {
                    submitBtn.textContent = `Uploading preview images (${previewFiles.length})...`;
                    previewImageUrls = await window.cloudinaryUpload.uploadMultipleToCloudinary(previewFiles);
                }
                useDirectUpload = true;
            } catch (cloudinaryError) {
                console.warn('⚠️ Direct Cloudinary upload failed, falling back to server upload:', cloudinaryError);
                useDirectUpload = false;
            }
        }
        */

        const token = localStorage.getItem('token');
        const url = isEditMode ? `${API}/books/${editingBookId}` : `${API}/books`;
        const method = isEditMode ? "PUT" : "POST";

        let res;

        if (useDirectUpload && coverImageUrl) {
            // Send JSON with image URLs
            submitBtn.textContent = 'Saving book...';
            const bookData = {
                title,
                author,
                price,
                description,
                category,
                weight,
                rewardPoints,
                cover_image: coverImageUrl,
                preview_images: previewImageUrls
            };

            res = await fetch(url, {
                method,
                headers: { 
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(bookData)
            });
        } else {
            // Fallback: Send multipart form data (server will upload to Cloudinary)
            submitBtn.textContent = 'Uploading via server...';
            const formData = new FormData();
            formData.append('title', title);
            formData.append('author', author);
            formData.append('price', price);
            formData.append('description', description);
            formData.append('category', category);
            formData.append('weight', weight);
            formData.append('rewardPoints', rewardPoints);

            if (coverFile) formData.append('coverImage', coverFile);
            for (let i = 0; i < previewFiles.length; i++) {
                formData.append('previewImages', previewFiles[i]);
            }

            res = await fetch(url, {
                method,
                headers: { "Authorization": `Bearer ${token}` },
                body: formData
            });
        }

        // Check if response is JSON
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await res.text();
            console.error('Non-JSON response:', text.substring(0, 200));
            alert('Server error: Received invalid response. Check console for details.');
            return;
        }

        const data = await res.json();

        if (res.ok) {
            alert(data.message);
            resetForm();
            loadBooks();
        } else {
            alert(`Error: ${data.error || 'Failed to save book'}\n${data.details || ''}`);
        }
    } catch (err) {
        console.error('Error submitting form:', err);
        alert(`Error: ${err.message}`);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
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
