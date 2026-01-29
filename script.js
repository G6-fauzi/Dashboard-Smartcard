// =================================================================
// PASTIKAN LINK INI BENAR
const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSGyZmd8oN7ZX__52lX-xQVI1u8MXqNpaEbVWtjVBUUc1E9mK4sl-AQ_4jtaf-qxdhrjP-HmW8ao2li/pub?output=csv";
// =================================================================

let rawData = [];
let todayData = [];

window.onload = function () {
    // Tampilkan tanggal hari ini di UI
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

            // Cek nama kolom
            if (rawData.length > 0) {
                const keys = Object.keys(rawData[0]);
                if (!keys.includes("WAKTU") || !keys.includes("TRANSAKSI")) {
                    alert(
                        "⚠️ Error: Nama kolom di Sheet tidak sesuai! Script mencari: WAKTU, TRANSAKSI, PETUGAS, NOMINAL. \nYang ditemukan: " +
                            keys.join(", ")
                    );
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

// --- PARSING TANGGAL LEBIH KUAT (UNIVERSAL) ---
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

    console.log(`🔎 Memfilter data untuk: ${todayStr}`);

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
    Array.from(tellers)
        .sort()
        .forEach((teller) => {
            const option = document.createElement("option");
            option.value = teller;
            option.text = teller;
            select.appendChild(option);
        });
}

// FUNGSI BARU: Handle tampilan Custom Time
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

// Helper untuk konversi HH:MM ke total menit
function timeToMinutes(timeStr) {
    if (!timeStr) return -1;
    const parts = timeStr.split(":");
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

function applyCalculation() {
    const modalAwal = parseFloat(document.getElementById("inputModal").value) || 0;
    const selectedShift = document.getElementById("filterShift").value;
    const selectedTeller = document.getElementById("filterTeller").value;

    // Logic Custom Time
    const customStart = document.getElementById("customStart").value;
    const customEnd = document.getElementById("customEnd").value;
    const customStartMin = timeToMinutes(customStart);
    const customEndMin = timeToMinutes(customEnd);

    const finalData = todayData.filter((row) => {
        const rowDateObj = parseUniversalDate(row.WAKTU);
        
        // 1. Filter Teller
        if (selectedTeller !== "All" && row.PETUGAS !== selectedTeller) return false;

        // 2. Filter Shift
        const currentMinutes = rowDateObj.getHours() * 60 + rowDateObj.getMinutes();
        
        if (selectedShift === "Pagi") return currentMinutes >= 0 && currentMinutes <= 720;
        if (selectedShift === "Siang") return currentMinutes >= 721 && currentMinutes <= 1080;
        if (selectedShift === "Malam") return currentMinutes >= 1081 && currentMinutes <= 1439;
        
        if (selectedShift === "Custom") {
            // Pastikan input jam sudah diisi dua-duanya
            if (customStartMin !== -1 && customEndMin !== -1) {
                return currentMinutes >= customStartMin && currentMinutes <= customEndMin;
            }
            return true; // Jika belum diisi, tampilkan semua (atau return false jika ingin kosong)
        }

        return true;
    });

    updateUI(finalData, modalAwal);
}

function updateUI(data, modal) {
    let totalMasuk = 0;
    let totalKeluar = 0;
    const tbody = document.getElementById("tableBody");
    tbody.innerHTML = "";

    // REVISI 1: Tampilkan data urut dari Awal ke Akhir (Hapus .reverse())
    // REVISI 1: Tambah kolom Nomor
    data.slice().forEach((row, index) => {
            let cleanNominal = row.NOMINAL.toString().replace(/[^0-9]/g, "");
            let amount = parseFloat(cleanNominal) || 0;

            const jenis = row.TRANSAKSI.toUpperCase();
            let isMasuk = false;
            let labelClass = "";

            const cleanJenis = jenis.trim(); 
            
            // Daftar kata kunci EXACT MATCH (Sama Persis)
            // Jika ada "REVERSAL TOP UP", dia tidak akan dianggap masuk sini.
            if (["TOP UP", "SETOR"].includes(cleanJenis)) {
                totalMasuk += amount;
                isMasuk = true;
                labelClass = "tag-in";
            } 
            else if (["CASH OUT", "PENARIKAN", "TARIK"].includes(cleanJenis)) {
                totalKeluar += amount;
                isMasuk = false;
                labelClass = "tag-out";
            }

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${index + 1}</td> <td>${row.WAKTU.split(" ")[1]}</td> 
                <td>${row.PETUGAS}</td>
                <td><span class="tag ${labelClass}">${row.TRANSAKSI}</span></td>
                <td style="font-weight:bold; color: ${isMasuk ? "var(--success)" : "var(--danger)"}">
                    ${formatRupiah(amount)}
                </td>
            `;
            tbody.appendChild(tr);
        });

    const saldoAkhir = modal + totalMasuk - totalKeluar;

    document.getElementById("finalBalance").innerText = formatRupiah(saldoAkhir);
    document.getElementById("totalIn").innerText = formatRupiah(totalMasuk);
    document.getElementById("totalOut").innerText = formatRupiah(totalKeluar);
    document.getElementById("totalCount").innerText = data.length + " Trx";

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">Belum ada data di filter ini.</td></tr>';
    }
}

function formatRupiah(angka) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(angka);
}

// =================================================================
// LOGIKA TAMBAHAN: MODE KOREKSI (REVISED)
// =================================================================

let correctionData = []; 

function openCorrectionMode() {
    // 1. Ambil data hari ini (source of truth)
    correctionData = todayData.map((row, index) => ({
        ...row,
        originalIndex: index,
        isChecked: false 
    }));

    // 2. Reset Input Pencarian Nama User (Filter Shift & Petugas tidak direset karena ikut Dashboard)
    document.getElementById("searchCorrection").value = "";
    
    // 3. Tampilkan Modal
    document.getElementById("correctionModal").style.display = "flex";
    
    // 4. Render dengan filter yang sedang aktif di Dashboard
    renderCorrectionList();
}

function closeCorrectionMode() {
    document.getElementById("correctionModal").style.display = "none";
}

function renderCorrectionList() {
    const tbody = document.getElementById("correctionBody");
    
    // REVISI 3: Mengambil nilai filter DARI DASHBOARD UTAMA (Sync)
    const searchVal = document.getElementById("searchCorrection").value.toLowerCase();
    
    const shiftVal = document.getElementById("filterShift").value;
    const tellerVal = document.getElementById("filterTeller").value;

    const customStart = document.getElementById("customStart").value;
    const customEnd = document.getElementById("customEnd").value;
    const customStartMin = timeToMinutes(customStart);
    const customEndMin = timeToMinutes(customEnd);

    tbody.innerHTML = "";

    // 1. FILTERING DATA (Duplikasi logic applyCalculation + Search User)
    let filtered = correctionData.filter(item => {
        // A. Filter Search (Berdasarkan Nama USER)
        const userName = item.USER ? item.USER.toLowerCase() : "";
        if (!userName.includes(searchVal)) return false;

        // B. Filter Petugas (Ambil dari Dashboard)
        if (tellerVal !== "All" && item.PETUGAS !== tellerVal) return false;

        // C. Filter Shift (Ambil dari Dashboard)
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

    // 2. SORTING (Pastikan urutan sama: Terlama ke Terbaru)
    // Logika sort isChecked tetap ada agar yang diceklis pindah ke bawah/pudar
    filtered.sort((a, b) => {
        if (a.isChecked === b.isChecked) {
            // Jika status check sama, urutkan berdasarkan waktu (original index roughly corresponds to time)
            return a.originalIndex - b.originalIndex;
        }
        return a.isChecked ? 1 : -1;
    });

    // 3. UPDATE COUNTER
    const checkedCount = filtered.filter(x => x.isChecked).length;
    document.getElementById("checkedCount").innerText = checkedCount;
    document.getElementById("totalCorrectionCount").innerText = filtered.length;

    // 4. RENDER HTML
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
        
        const jenis = item.TRANSAKSI.toUpperCase();
        let color = "inherit";
        if (!item.isChecked) {
            if (jenis.includes("TOP UP") || jenis.includes("SETOR")) color = "var(--success)";
            else if (jenis.includes("CASH OUT") || jenis.includes("TARIK")) color = "var(--danger)";
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
        // 1. Ubah status Check/Uncheck
        targetItem.isChecked = !targetItem.isChecked;

        // 2. FITUR BARU: Auto-Clear Search
        // Jika ada isi di kolom pencarian, kosongkan agar siap untuk nama berikutnya
        const searchInput = document.getElementById("searchCorrection");
        if (searchInput.value !== "") {
            searchInput.value = ""; // Hapus teks
            searchInput.focus();    // Kembalikan kursor ke kolom input otomatis
        }

        // 3. Render ulang (List akan kembali menampilkan semua data sesuai filter Shift/Petugas)
        renderCorrectionList();
    }
}
