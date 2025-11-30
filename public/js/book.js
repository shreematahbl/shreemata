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
        
        // Store preview images globally for lightbox
        window.previewImages = book.preview_images;
        
        book.preview_images.forEach((imgURL, index) => {
            const img = document.createElement("img");
            img.src = imgURL;
            img.alt = `Preview ${index + 1}`;
            img.classList.add("preview-image");
            img.onerror = () => (img.src = "https://via.placeholder.com/400x600?text=Unavailable");
            
            // Add click event to open lightbox
            img.addEventListener("click", () => openLightbox(index));
            
            previewGrid.appendChild(img);
        });
    } else {
        noPreview.style.display = "block";
    }
}

/* -----------------------------------
   IMAGE LIGHTBOX FUNCTIONS
----------------------------------- */
let currentImageIndex = 0;

function openLightbox(index) {
    currentImageIndex = index;
    const lightbox = document.getElementById("imageLightbox");
    const lightboxImage = document.getElementById("lightboxImage");
    const lightboxCaption = document.getElementById("lightboxCaption");
    
    if (window.previewImages && window.previewImages.length > 0) {
        lightboxImage.src = window.previewImages[currentImageIndex];
        lightboxCaption.textContent = `Page ${currentImageIndex + 1} of ${window.previewImages.length}`;
        lightbox.style.display = "flex";
        
        // Prevent body scroll when lightbox is open
        document.body.style.overflow = "hidden";
    }
}

function closeLightbox() {
    const lightbox = document.getElementById("imageLightbox");
    lightbox.style.display = "none";
    
    // Restore body scroll
    document.body.style.overflow = "auto";
}

function nextImage() {
    if (window.previewImages && window.previewImages.length > 0) {
        currentImageIndex = (currentImageIndex + 1) % window.previewImages.length;
        const lightboxImage = document.getElementById("lightboxImage");
        const lightboxCaption = document.getElementById("lightboxCaption");
        
        lightboxImage.src = window.previewImages[currentImageIndex];
        lightboxCaption.textContent = `Page ${currentImageIndex + 1} of ${window.previewImages.length}`;
    }
}

function previousImage() {
    if (window.previewImages && window.previewImages.length > 0) {
        currentImageIndex = (currentImageIndex - 1 + window.previewImages.length) % window.previewImages.length;
        const lightboxImage = document.getElementById("lightboxImage");
        const lightboxCaption = document.getElementById("lightboxCaption");
        
        lightboxImage.src = window.previewImages[currentImageIndex];
        lightboxCaption.textContent = `Page ${currentImageIndex + 1} of ${window.previewImages.length}`;
    }
}

// Keyboard navigation for lightbox
document.addEventListener("keydown", (e) => {
    const lightbox = document.getElementById("imageLightbox");
    if (lightbox && lightbox.style.display === "flex") {
        if (e.key === "Escape") {
            closeLightbox();
        } else if (e.key === "ArrowRight") {
            nextImage();
        } else if (e.key === "ArrowLeft") {
            previousImage();
        }
    }
});

/* -----------------------------------
   BUY NOW → Show Address Modal
----------------------------------- */

/* -----------------------------------
   BUY NOW → Show Address Modal
----------------------------------- */
let userAddress = null;
let currentBook = null;

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
        currentBook = data.book;

        // Show address modal
        await showAddressModal();
    } catch (err) {
        console.error("Error:", err);
        alert("Error loading book details");
    }
}

async function showAddressModal() {
    const token = localStorage.getItem("token");

    try {
        // Fetch user address
        const res = await fetch(`${API}/users/profile`, {
            headers: { "Authorization": "Bearer " + token }
        });

        const data = await res.json();
        
        if (data.user && data.user.address) {
            userAddress = data.user.address;
            
            document.getElementById("modalStreet").textContent = userAddress.street || "Not set";
            document.getElementById("modalCity").textContent = userAddress.city || "Not set";
            document.getElementById("modalState").textContent = userAddress.state || "Not set";
            document.getElementById("modalPincode").textContent = userAddress.pincode || "Not set";
            document.getElementById("modalPhone").textContent = userAddress.phone || "Not set";

            // Pre-fill edit form
            document.getElementById("editStreet").value = userAddress.street || "";
            document.getElementById("editCity").value = userAddress.city || "";
            document.getElementById("editState").value = userAddress.state || "";
            document.getElementById("editPincode").value = userAddress.pincode || "";
            document.getElementById("editPhone").value = userAddress.phone || "";
        }

        // Show modal
        document.getElementById("addressModal").style.display = "block";

    } catch (err) {
        console.error("Error loading address:", err);
        alert("Error loading address. Please try again.");
    }
}

function closeAddressModal() {
    document.getElementById("addressModal").style.display = "none";
    document.getElementById("addressEditForm").style.display = "none";
    document.getElementById("addressDisplay").style.display = "block";
}

function toggleAddressForm() {
    const form = document.getElementById("addressEditForm");
    const display = document.getElementById("addressDisplay");
    
    if (form.style.display === "none") {
        form.style.display = "block";
        display.style.display = "none";
    } else {
        form.style.display = "none";
        display.style.display = "block";
    }
}

// Handle address form submission
document.addEventListener("DOMContentLoaded", () => {
    const addressForm = document.getElementById("addressEditForm");
    if (addressForm) {
        addressForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            await saveAddressFromModal();
        });
    }
});

async function saveAddressFromModal() {
    const token = localStorage.getItem("token");

    const address = {
        street: document.getElementById("editStreet").value.trim(),
        city: document.getElementById("editCity").value.trim(),
        state: document.getElementById("editState").value.trim(),
        pincode: document.getElementById("editPincode").value.trim(),
        phone: document.getElementById("editPhone").value.trim()
    };

    try {
        const res = await fetch(`${API}/users/update-address`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({ address })
        });

        const data = await res.json();

        if (!res.ok) {
            alert(data.error || "Failed to update address");
            return;
        }

        userAddress = address;
        
        // Update display
        document.getElementById("modalStreet").textContent = address.street;
        document.getElementById("modalCity").textContent = address.city;
        document.getElementById("modalState").textContent = address.state;
        document.getElementById("modalPincode").textContent = address.pincode;
        document.getElementById("modalPhone").textContent = address.phone;

        alert("Address updated successfully!");
        toggleAddressForm();

    } catch (err) {
        console.error("Address update error:", err);
        alert("Error updating address");
    }
}

/* -----------------------------------
   Proceed to Payment with Address
----------------------------------- */
async function proceedToPayment() {
    const token = localStorage.getItem("token");

    // Validate address
    if (!userAddress || !userAddress.street || !userAddress.city || !userAddress.state || !userAddress.pincode || !userAddress.phone) {
        const proceed = confirm("You haven't set a delivery address. Do you want to proceed anyway?");
        if (!proceed) {
            return;
        }
        userAddress = null;
    }

    if (!currentBook) {
        alert("Book details not loaded");
        return;
    }

    // Close modal
    closeAddressModal();

    const buyBtn = document.getElementById("buyBtn");
    const items = [{
        id: currentBook._id,
        title: currentBook.title,
        author: currentBook.author,
        price: currentBook.price,
        quantity: 1,
        coverImage: currentBook.cover_image,
        type: 'book'
    }];

    try {
        if (buyBtn) {
            buyBtn.disabled = true;
            buyBtn.textContent = "Processing...";
        }

        // 1️⃣ Create backend Razorpay order with address
        const orderRes = await fetch(`${API}/payments/create-order`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                amount: currentBook.price,
                items: items,
                deliveryAddress: userAddress
            })
        });

        const orderData = await orderRes.json();

        if (!orderRes.ok || !orderData.order) {
            throw new Error(orderData.error || "Failed to create order");
        }

        // 2️⃣ Razorpay Checkout
        const RZP_KEY = window.RAZORPAY_KEY || "rzp_test_RjA5o7ViCyygdZ";

        const options = {
            key: RZP_KEY,
            amount: orderData.order.amount,
            currency: "INR",
            name: "BookStore",
            description: currentBook.title,
            order_id: orderData.order.id,

            handler: async function (response) {
                try {
                    // 3️⃣ Verify payment on backend
                    const verifyRes = await fetch(`${API}/payments/verify`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            items: items,
                            totalAmount: currentBook.price,
                            deliveryAddress: userAddress
                        })
                    });

                    const verifyData = await verifyRes.json();

                    if (!verifyRes.ok) {
                        alert(verifyData.error || "Payment verification failed");
                        if (buyBtn) {
                            buyBtn.disabled = false;
                            buyBtn.textContent = "Buy Now";
                        }
                        return;
                    }

                    alert("Payment successful! Thank you for your purchase. Check your email for order confirmation.");
                    window.location.href = "/orders.html";

                } catch (err) {
                    console.error("Verification error:", err);
                    alert("Payment succeeded but verification failed. Contact support.");
                    if (buyBtn) {
                        buyBtn.disabled = false;
                        buyBtn.textContent = "Buy Now";
                    }
                }
            },

            modal: {
                ondismiss: function () {
                    if (buyBtn) {
                        buyBtn.disabled = false;
                        buyBtn.textContent = "Buy Now";
                    }
                }
            },

            prefill: {
                name: (JSON.parse(localStorage.getItem("user") || "{}")).name || "",
                email: (JSON.parse(localStorage.getItem("user") || "{}")).email || ""
            },

            theme: { color: "#3399cc" }
        };

        const rzp = new Razorpay(options);
        rzp.open();

    } catch (err) {
        console.error("Payment Error:", err);
        alert(err.message || "Payment failed. Try again.");
        if (buyBtn) {
            buyBtn.disabled = false;
            buyBtn.textContent = "Buy Now";
        }
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
