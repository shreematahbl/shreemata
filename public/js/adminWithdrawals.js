document.addEventListener("DOMContentLoaded", loadWithdrawals);

async function loadWithdrawals() {
    const token = localStorage.getItem("token");

    const res = await fetch("/api/admin/withdrawals", {
        headers: { "Authorization": "Bearer " + token }
    });

    const data = await res.json();
    const tbody = document.getElementById("withdrawTableBody");
    tbody.innerHTML = "";

    data.forEach(item => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${item.name}</td>
            <td>${item.email}</td>
            <td>₹${item.amount}</td>
            <td>${new Date(item.date).toLocaleString()}</td>
            <td>${item.status}</td>

            <td>
                ${item.status === "pending" ? `
                    <button onclick="approve('${item.userId}','${item.withdrawId}')">Approve</button>
                    <button onclick="rejectWithdraw('${item.userId}','${item.withdrawId}')">Reject</button>
                ` : "—"}
            </td>
        `;

        tbody.appendChild(tr);
    });
}

async function approve(userId, withdrawId) {
    const token = localStorage.getItem("token");

    await fetch("/api/admin/withdrawals/approve", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
        },
        body: JSON.stringify({ userId, withdrawId })
    });

    alert("Withdrawal approved!");
    loadWithdrawals();
}

async function rejectWithdraw(userId, withdrawId) {
    const token = localStorage.getItem("token");

    await fetch("/api/admin/withdrawals/reject", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
        },
        body: JSON.stringify({ userId, withdrawId })
    });

    alert("Withdrawal rejected & refunded!");
    loadWithdrawals();
}
