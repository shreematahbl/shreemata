document.addEventListener("DOMContentLoaded", loadReferralDetails);

async function loadReferralDetails() {
    const token = localStorage.getItem("token");

    if (!token) {
        alert("Login required");
        return window.location.href = "/login.html";
    }

    const res = await fetch("/api/referral/details", {
        headers: { "Authorization": "Bearer " + token }
    });

    const data = await res.json();

    document.getElementById("refCode").textContent = data.referralCode || "Not generated";
    document.getElementById("wallet").textContent = data.wallet;

    const link = `${window.location.origin}/signup.html?ref=${data.referralCode}`;
    document.getElementById("refLink").value = link;

    const tbody = document.getElementById("historyBody");

    if (data.history.length === 0) {
        document.getElementById("noHistory").style.display = "block";
        return;
    }

    data.history.forEach(r => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${r.name}</td>
            <td>${r.email}</td>
            <td>₹ ${r.reward}</td>
        `;
        tbody.appendChild(tr);
    });
}

function copyLink() {
    const box = document.getElementById("refLink");
    box.select();
    navigator.clipboard.writeText(box.value);
    alert("Referral link copied!");
}
