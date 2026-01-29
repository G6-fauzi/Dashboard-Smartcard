// =================================================================
// PASTIKAN LINK INI BENAR
const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSGyZmd8oN7ZX__52lX-xQVI1u8MXqNpaEbVWtjVBUUc1E9mK4sl-AQ_4jtaf-qxdhrjP-HmW8ao2li/pub?output=csv";
// =================================================================

let rawData = [];
let todayData = [];

// DAFTAR KATA KUNCI TRANSAKSI (HURUF KAPITAL & TANPA SPASI)
const TRX_MASUK = ["TOP UP", "SETOR"];
const TRX_KELUAR = ["CASH OUT", "PENARIKAN", "TARIK"];

window.onload = function () {
    const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
    document.getElementById("currentDateDisplay").innerText = new Date().toLocaleDateString("id-ID", options);

    console.log("Memulai proses ambil data...");
    fetchData();
};

function fetchData() {
    Papa.parse(SHEET_URL, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function (results) {
            console.log("✅ Data berhasil ditarik dari Google Sheet!");
            
            rawData = results.data;

            if (rawData.length > 0) {
                const keys = Object.keys(rawData[0]);
                if (!keys.includes("WAKTU") || !keys.includes("TRANSAKSI")) {
                    alert("⚠️ Error: Kolom WAKTU atau TRANSAKSI tidak ditemukan!");
                }
            }

            filterTodayData();
            populateTellers();

            document.getElementById("loading").style.display = "none";
            document.getElementById("dashboardContent").style.display = "block";

            applyCalculation();
        },
        error: function (err) {
            alert("❌ Gagal mengambil data. Cek Link CSV atau Koneksi Internet.");
            console.error(err);
        },
    });
}

function parseUniversalDate(dateStr) {
    if (!dateStr) return null;
    dateStr = dateStr.trim();
    let datePart = dateStr.split(" ")[0];
    let timePart = dateStr.split(" ")[1] || "00:00:00";
    let day, month, year;

    if (datePart.includes("/")) {
        const parts = datePart.split("/");
        day = parseInt(parts[0]);
        month = parseInt(parts[1]) - 1;
        year = parseInt(parts[2]);
    } else if (datePart.includes("-")) {
        const parts = datePart.split("-");
        if (parts[0].length === 4) {
            year = parseInt(parts[0]);
            month = parseInt(parts[1]) - 1;
            day = parseInt(parts[2]);
        } else {
            day = parseInt(parts[0]);
            month = parseInt(parts[1]) - 1;
            year = parseInt(parts[2]);
        }
    } else {
        return new Date(dateStr);
    }

    const timeParts = timePart.split(":");
    const hour = parseInt(timeParts[0]) || 0;
    const minute = parseInt(timeParts[1]) || 0;
    const second = parseInt(timeParts[2]) || 0;

    const resultDate = new Date(year, month, day, hour, minute, second);
    if (isNaN(resultDate.getTime())) return null;
    return resultDate;
}

function filterTodayData() {
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = String(today.getMonth() + 1).padStart(2, "0");
    const todayDay = String(today.getDate()).padStart(2, "0");
    const todayStr = `${todayYear}-${todayMonth}-${todayDay}`;

    todayData = rawData.filter((row) => {
        if (!row.WAKTU) return false;
        const rowDateObj = parseUniversalDate(row.WAKTU);
        if (!rowDateObj) return false;

        const rowYear = rowDateObj.getFullYear();
        const rowMonth = String(rowDateObj.getMonth() + 1).padStart(2, "0");
        const rowDay = String(rowDateObj.getDate()).padStart(2, "0");
        const rowDateStr = `${rowYear}-${rowMonth}-${rowDay}`;

        return rowDateStr === todayStr;
    });
}

function populateTellers() {
    const tellers = new Set();
    todayData.forEach((row) => {
        if (row.PETUGAS) tellers.add(row.PETUGAS.trim());
    });
    const select = document.getElementById("filterTeller");
    select.innerHTML = '<option value="All">Semua Petugas</option>';
    Array.from(tellers).sort().forEach((teller) => {
        const option = document.createElement("option");
        option.value = teller;
        option.text = teller;
        select.appendChild(option);
    });
}

function handleShiftChange() {
    const shiftVal = document.getElementById("filterShift").value;
    const customWrapper = document.getElementById("customTimeWrapper");
    if (shiftVal === "Custom") {
        customWrapper.style.display = "flex";
    } else {
        customWrapper.style.display = "none";
    }
    applyCalculation();
}

function timeToMinutes(timeStr) {
    if (!timeStr) return -1;
    const parts = timeStr.split(":");
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

function applyCalculation() {
    const modalAwal = parseFloat(document.getElementById("inputModal").value) || 0;
    const selectedShift = document.getElementById("filterShift").value;
    const selectedTeller = document.getElementById("filterTeller").value;

    const customStart = document.getElementById("customStart").value;
    const customEnd = document.getElementById("customEnd").value;
    const customStartMin = timeToMinutes(customStart);
    const customEndMin = timeToMinutes(customEnd);

    const finalData = todayData.filter((row) => {
        const rowDateObj = parseUniversalDate(row.WAKTU);
        if (selectedTeller !== "All" && row.PETUGAS !== selectedTeller) return false;

        const currentMinutes = rowDateObj.getHours() * 60 + rowDateObj.getMinutes();
        if (selectedShift === "Pagi") return currentMinutes >= 0 && currentMinutes <= 720;
        if (selectedShift === "Siang") return currentMinutes >= 721 && currentMinutes <= 1080;
        if (selectedShift === "Malam") return currentMinutes >= 1081 && currentMinutes <= 1439;
        if (selectedShift === "Custom") {
            if (customStartMin !== -1 && customEndMin !== -1) {
                return currentMinutes >= customStartMin && currentMinutes <= customEndMin;
            }
            return true;
        }
        return true;
    });

    updateUI(finalData, modalAwal);
}

function updateUI(data, modal) {
    let totalMasuk = 0;
    let totalKeluar = 0;
    let totalLain = 0; // Variabel baru untuk menampung transaksi lain

    const tbody = document.getElementById("tableBody");
    tbody.innerHTML = "";

    data.slice().forEach((row, index) => {
        let cleanNominal = row.NOMINAL.toString().replace(/[^0-9]/g, "");
        let amount = parseFloat(cleanNominal) || 0;

        // LOGIKA PENENTUAN TIPE (STRICT MATCH)
        const jenis = row.TRANSAKSI.toUpperCase().trim();
        let labelClass = "";
        let nominalColor = "";

        if (TRX_MASUK.includes(jenis)) {
            // Masuk (Top Up/Setor)
            totalMasuk += amount;
            labelClass = "tag-in";
            nominalColor = "var(--success)"; // Hijau
        } 
        else if (TRX_KELUAR.includes(jenis)) {
            // Keluar (Cash Out/Tarik)
            totalKeluar += amount;
            labelClass = "tag-out";
            nominalColor = "var(--danger)"; // Merah
        } 
        else {
            // Lain-lain (Reversal, Admin, dll)
            totalLain += amount;
            labelClass = "tag-other"; // Class baru (Abu-abu)
            nominalColor = "#64748b"; // Warna teks Abu-abu
        }

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${index + 1}</td> 
            <td>${row.WAKTU.split(" ")[1]}</td> 
            <td>${row.PETUGAS}</td>
            <td><span class="tag ${labelClass}">${row.TRANSAKSI}</span></td>
            <td style="font-weight:bold; color: ${nominalColor}">
                ${formatRupiah(amount)}
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Perhitungan Saldo Akhir (Biasanya hanya Modal + Masuk - Keluar)
    // Transaksi 'Lain' dipisahkan agar tidak merusak hitungan laci kasir
    const saldoAkhir = modal + totalMasuk - totalKeluar;

    document.getElementById("finalBalance").innerText = formatRupiah(saldoAkhir);
    document.getElementById("totalIn").innerText = formatRupiah(totalMasuk);
    document.getElementById("totalOut").innerText = formatRupiah(totalKeluar);
    
    // Update Total Lain (Jika elemen ada di HTML)
    const elTotalOther = document.getElementById("totalOther");
    if (elTotalOther) {
        elTotalOther.innerText = formatRupiah(totalLain);
    }

    document.getElementById("totalCount").innerText = data.length + " Trx";

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">Belum ada data di filter ini.</td></tr>';
    }
}

function formatRupiah(angka) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(angka);
}

// =================================================================
// LOGIKA MODE KOREKSI (UPDATED)
// =================================================================

let correctionData = []; 

function openCorrectionMode() {
    correctionData = todayData.map((row, index) => ({
        ...row,
        originalIndex: index,
        isChecked: false 
    }));
    document.getElementById("searchCorrection").value = "";
    document.getElementById("correctionModal").style.display = "flex";
    renderCorrectionList();
}

function closeCorrectionMode() {
    document.getElementById("correctionModal").style.display = "none";
}

function renderCorrectionList() {
    const tbody = document.getElementById("correctionBody");
    const searchVal = document.getElementById("searchCorrection").value.toLowerCase();
    
    // Ambil Filter Dashboard
    const shiftVal = document.getElementById("filterShift").value;
    const tellerVal = document.getElementById("filterTeller").value;
    const customStart = document.getElementById("customStart").value;
    const customEnd = document.getElementById("customEnd").value;
    const customStartMin = timeToMinutes(customStart);
    const customEndMin = timeToMinutes(customEnd);

    tbody.innerHTML = "";

    let filtered = correctionData.filter(item => {
        const userName = item.USER ? item.USER.toLowerCase() : "";
        if (!userName.includes(searchVal)) return false;

        if (tellerVal !== "All" && item.PETUGAS !== tellerVal) return false;

        const dateObj = parseUniversalDate(item.WAKTU);
        if (!dateObj) return false;
        const minutes = dateObj.getHours() * 60 + dateObj.getMinutes();

        if (shiftVal === "Pagi" && (minutes < 0 || minutes > 720)) return false;
        if (shiftVal === "Siang" && (minutes < 721 || minutes > 1080)) return false;
        if (shiftVal === "Malam" && (minutes < 1081 || minutes > 1439)) return false;
        if (shiftVal === "Custom") {
             if (customStartMin !== -1 && customEndMin !== -1) {
                if (minutes < customStartMin || minutes > customEndMin) return false;
            }
        }
        return true;
    });

    filtered.sort((a, b) => {
        if (a.isChecked === b.isChecked) return a.originalIndex - b.originalIndex;
        return a.isChecked ? 1 : -1;
    });

    document.getElementById("checkedCount").innerText = filtered.filter(x => x.isChecked).length;
    document.getElementById("totalCorrectionCount").innerText = filtered.length;

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px;">Data tidak ditemukan</td></tr>';
        return;
    }

    filtered.forEach(item => {
        const tr = document.createElement("tr");
        if (item.isChecked) tr.classList.add("row-checked");

        tr.onclick = function() {
            toggleCorrectionItem(item.originalIndex);
        };

        let cleanNominal = item.NOMINAL.toString().replace(/[^0-9]/g, "");
        let amount = parseFloat(cleanNominal) || 0;
        
        // PEWARNAAN STRICT MATCH DI MODE KOREKSI
        const jenis = item.TRANSAKSI.toUpperCase().trim();
        let color = "inherit"; // Default Hitam

        if (!item.isChecked) {
            if (TRX_MASUK.includes(jenis)) {
                color = "var(--success)"; // Hijau
            } else if (TRX_KELUAR.includes(jenis)) {
                color = "var(--danger)"; // Merah
            } else {
                color = "#94a3b8"; // Abu-abu (Lainnya)
            }
        }

        const displayName = item.USER || "-"; 

        tr.innerHTML = `
            <td>
                <div style="font-weight:600">${displayName}</div>
                <div style="font-size:0.75rem; color:#94a3b8;">${item.WAKTU.split(" ")[1]}</div>
            </td>
            <td>${item.TRANSAKSI}</td>
            <td style="font-weight:bold; color: ${color}">${formatRupiah(amount)}</td>
        `;

        tbody.appendChild(tr);
    });
}

function toggleCorrectionItem(originalIndex) {
    const targetItem = correctionData.find(x => x.originalIndex === originalIndex);
    if (targetItem) {
        targetItem.isChecked = !targetItem.isChecked;
        const searchInput = document.getElementById("searchCorrection");
        if (searchInput.value !== "") {
            searchInput.value = ""; 
            searchInput.focus();    
        }
        renderCorrectionList();
    }
}
