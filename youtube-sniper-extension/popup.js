// Constants & State
// Key
import { validateKey, isPremiumUser } from "./KS.mjs";

// Other State Variables
let running = false;
let buttonCooldown = false;
let cooldownTimer = null;
let lastTabUrl = null;
let isTypingNote = false;
let pinCooldown = false;

// DOM Elements
// Main UI
const btn = document.getElementById("toggle");
const status = document.getElementById("status");
const linkList = document.getElementById("linkList");
const cooldownText = document.getElementById("cooldownText");

// Settings
const settingsIcon = document.getElementById("settingsIcon");
const settingsPanel = document.getElementById("settingsPanel");

const soundSetting = document.getElementById("soundSetting");
const soundSelect = document.getElementById("soundSelect");

const ignoreSameUser = document.getElementById("ignoreSameUser");
const autoStop = document.getElementById("autoStop");
const autoCopy = document.getElementById("autoCopy");
const bypassCooldown = document.getElementById("bypassCooldown");
const streamerOnly = document.getElementById("streamerOnly");

const resetLinksBtn = document.getElementById("resetLinksBtn");
const resetRecentLinksBtn = document.getElementById("resetRecentLinksBtn");
const resetStatsBtn = document.getElementById("resetStatsBtn");

// Stats
const statOpened = document.getElementById("statOpened");
const statDetected = document.getElementById("statDetected");
const statLastHit = document.getElementById("statLastHit");
const statFastest = document.getElementById("statFastest");

// Recent Links
const recentIcon = document.getElementById("recentIcon");
const recentPanel = document.getElementById("recentPanel");
const recentList = document.getElementById("recentList");

// Search
const linkSearch = document.getElementById("linkSearch");
const recentSearch = document.getElementById("recentSearch");
const pinnedSearch = document.getElementById("pinnedSearch");

// Tab Switching
const panelTitle = document.getElementById("panelTitle");
const panelTitleInfoPopup = document.getElementById("panelTitleInfoPopup");

document.querySelectorAll(".tabBtn").forEach(btn => {
    btn.addEventListener("click", () => {

        document.querySelectorAll(".tabBtn")
            .forEach(b => b.classList.remove("active"));

        btn.classList.add("active");

        const tab = btn.dataset.tab;

        document.querySelectorAll(".tabContent")
            .forEach(c => c.classList.remove("active"));

        document.querySelector(`.searchBar[data-tabgroup="${tab}"]`)
            ?.classList.add("active");

        if (tab === "recent") {

            document.getElementById("recentList")
                .classList.add("active");

            panelTitle.textContent = "Recent links";
            panelSubText.textContent = "All recent links";
            if (panelTitleInfoPopup) {
                panelTitleInfoPopup.textContent = "Shows links detected recently, newest first.";
            }

            loadRecentLinks();

        } else {

            document.getElementById("pinnedList")
                .classList.add("active");

            panelTitle.textContent = "Pinned links";
            panelSubText.textContent = "Links that you pinned";
            if (panelTitleInfoPopup) {
                panelTitleInfoPopup.textContent = "Links you've pinned so they don't get lost.";
            }

            loadPinnedLinks();
        }
    });
});

// Utility Functions
// isYouTube
function isYouTube(url = "") {
    return url.includes("youtube.com");
}

// Search Filter
function matchesSearch(item, query) {
    if (!query) return true;

    const q = query.trim().toLowerCase();
    if (!q) return true;

    const haystack = [
        item.url,
        item.user,
        item.streamer,
        item.note
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

    return haystack.includes(q);
}

// Recent Panel
function closeRecentPanel() {
    const panel = document.getElementById("recentPanel");
    const icon = document.getElementById("recentIcon");

    if (!panel || !icon) return;

    panel.classList.remove("open");
    icon.classList.remove("open");
}

// Resolver
async function resolveFinalUrl(url) {
    return new Promise((resolve) => {

        chrome.tabs.create({ url, active: false }, (tab) => {

            const tabId = tab.id;

            const checkComplete = (updatedTabId, changeInfo, tabInfo) => {

                if (updatedTabId !== tabId) return;

                // Wait for page to fully load
                if (changeInfo.status === "complete") {

                    chrome.tabs.get(tabId, (t) => {

                        const finalUrl = t?.url || url;

                        chrome.tabs.onUpdated.removeListener(checkComplete);
                        chrome.tabs.remove(tabId);

                        resolve(finalUrl);
                    });
                }
            };

            chrome.tabs.onUpdated.addListener(checkComplete);

            // Fallback timeout
            setTimeout(() => {
                chrome.tabs.onUpdated.removeListener(checkComplete);
                chrome.tabs.remove(tabId);
                resolve(url);
            }, 6000);
        });
    });
}

// Functions

// Key
function normalizeKey(str) {
    return (str || "")
        .toString()
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .trim();
}

// State
function loadState() {
    chrome.storage.local.get(["enabled"], (data) => {
        running = !!data.enabled;
        updateUI();
    });
}

// Settings Save
function saveSettings() {
    chrome.storage.local.set({
        settings: {
            sound: soundSetting.checked,
            soundFile: soundSelect.value,
            ignoreSameUser: ignoreSameUser.checked,
            autoStop: autoStop.checked,
            autoCopy: autoCopy.checked,
            bypassCooldown: bypassCooldown.checked,
            streamerOnly: streamerOnly.checked
        }
    });
}

//  UI State Update
function updateUI() {

    if (running) {
        status.textContent = "ON";
        status.style.color = "lime";
        btn.textContent = "Stop";

        btn.classList.add("on");
        btn.classList.remove("off");

    } else {
        status.textContent = "OFF";
        status.style.color = "red";
        btn.textContent = "Start";

        btn.classList.add("off");
        btn.classList.remove("on");
    }
}

// Cooldown
function startCooldown() {

    chrome.storage.local.get(["settings"], (data) => {

        const settings = data.settings || {};

        // Bypass Cooldown
        if (settings.bypassCooldown) {
            chrome.storage.local.set({ cooldownEnd: 0 });
            return;
        }

        const endTime = Date.now() + 10000;

        chrome.storage.local.set({ cooldownEnd: endTime });

        setTimeout(() => {
            chrome.storage.local.set({ cooldownEnd: 0 });
        }, 10000);
    });
}

function startCooldownFromStorage(endTime) {

    chrome.storage.local.get(["settings"], (data) => {

        // Hide cooldown when bypass is true
        if (data.settings?.bypassCooldown) {
            cooldownText.classList.add("cooldownHidden");
            return;
        }

        clearInterval(cooldownTimer);
        cooldownText.classList.remove("cooldownHidden");

        function update() {

            const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));

            // Cooldown finished
            if (remaining <= 0) {
                cooldownText.classList.add("cooldownHidden");
                clearInterval(cooldownTimer);
                return;
            }

            cooldownText.textContent = "COOLDOWN: " + remaining;
        }

        // Countdown
        update();
        cooldownTimer = setInterval(update, 1000);

    });
}

// Key System
function initKeySystem() {
    const overlay = document.getElementById("keyOverlay");
    const input = document.getElementById("keyInput");
    const btn = document.getElementById("keySubmit");

    const status =
        document.getElementById("keyStatus") ||
        document.getElementById("keyError");

    // Validate key UI
    if (!overlay || !input || !btn) {
        console.error("Key UI elements missing");
        return;
    }

    btn.addEventListener("click", async () => {
        // Normalize entered key
        const userKey = normalizeKey(input.value);

        if (status) status.textContent = "";

        if (!userKey) {
            if (status) status.textContent = "Please enter a key";
            return;
        }

        // Verify key
        const ok = await validateKey(userKey);

        if (ok) {
            overlay.style.display = "none";
            startApp();
        } else {
            if (status) {
                status.textContent = "Invalid Key";
                status.style.color = "#ff0000";
            }
        }
    });
}

// Data Loading
function loadSettings() {
    chrome.storage.local.get(["settings"], function (data) {

        let s = data.settings;

        if (!s) {
            // Default
            s = {
                sound: true,
                soundFile: "notifications/Notification1.mp3",
                ignoreSameUser: false,
                autoStop: false,
                autoCopy: true,
                bypassCooldown: false,
                streamerOnly: false
            };

            chrome.storage.local.set({ settings: s });
        }

        // Apply settings to UI
        soundSetting.checked = s.sound;
        ignoreSameUser.checked = s.ignoreSameUser;
        autoStop.checked = s.autoStop;
        autoCopy.checked = s.autoCopy;
        bypassCooldown.checked = s.bypassCooldown;
        streamerOnly.checked = s.streamerOnly;

        soundSelect.value = s.soundFile || "notifications/Notification1.mp3";
    });
}

function loadStats() {
    chrome.storage.local.get(["stats"], (data) => {

        const stats = data.stats || {
            opened: 0,
            detected: 0,
            lastHit: 0,
            fastestHit: 0
        };

        statOpened.textContent = stats.opened || 0;
        statDetected.textContent = stats.detected || 0;

        const fastest = Number(stats.fastestHit);

        if (Number.isFinite(fastest) && fastest > 0) {
            statFastest.textContent = fastest + " ms";
        } else {
            statFastest.textContent = "0 ms";
        }

        if (!stats.lastHit) {
            statLastHit.textContent = "0s ago";
            return;
        }

        const diff = Math.floor((Date.now() - stats.lastHit) / 1000);

        if (diff < 60) {
            statLastHit.textContent = diff + "s ago";
        }
        else if (diff < 3600) {
            statLastHit.textContent = Math.floor(diff / 60) + "m ago";
        }
        else if (diff < 86400) {
            statLastHit.textContent = Math.floor(diff / 3600) + "h ago";
        }
        else if (diff < 2592000) {
            statLastHit.textContent = Math.floor(diff / 86400) + "d ago";
        }
        else if (diff < 31536000) {
            statLastHit.textContent = Math.floor(diff / 2592000) + "mon ago";
        }
        else {
            statLastHit.textContent = Math.floor(diff / 31536000) + "y ago";
        }
    });
}

function loadPinnedLinks() {

    const pinnedList = document.getElementById("pinnedList");

    chrome.storage.local.get(["pinnedLinks"], (data) => {

        const query = pinnedSearch?.value || "";
        const links = (data.pinnedLinks || []).filter(item => matchesSearch(item, query));

        pinnedList.innerHTML = "";

        if (links.length === 0) {
            pinnedList.innerHTML = `<div class="emptyState">No pinned links found</div>`;
            return;
        }

        for (const item of links) {

            const div = document.createElement("div");
            div.className = "linkEntry";

            const noteText = item.note?.trim() || "";

            div.innerHTML = `
                <div class="linkTopBar">
                    <div class="topLeftBtns">

                        <div class="copyBtn" title="Copy link">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                        </div>

                        <div class="pinBtn active" title="Unpin link">
                            <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M4.146.146A.5.5 0 0 1 4.5 0h7a.5.5 0 0 1 .5.5c0 .68-.342 1.174-.646 1.479-.126.125-.25.224-.354.298v4.431l.078.048c.203.127.476.314.751.555C12.36 7.775 13 8.527 13 9.5a.5.5 0 0 1-.5.5h-4v4.5c0 .276-.224 1.5-.5 1.5s-.5-1.224-.5-1.5V10h-4a.5.5 0 0 1-.5-.5c0-.973.64-1.725 1.17-2.189A6 6 0 0 1 5 6.708V2.277a3 3 0 0 1-.354-.298C4.342 1.674 4 1.179 4 .5a.5.5 0 0 1 .146-.354m1.58 1.408-.002-.001zm-.002-.001.002.001A.5.5 0 0 1 6 2v5a.5.5 0 0 1-.276.447h-.002l-.012.007-.054.03a5 5 0 0 0-.827.58c-.318.278-.585.596-.725.936h7.792c-.14-.34-.407-.658-.725-.936a5 5 0 0 0-.881-.61l-.012-.006h-.002A.5.5 0 0 1 10 7V2a.5.5 0 0 1 .295-.458 1.8 1.8 0 0 0 .351-.271c.08-.08.155-.17.214-.271H5.14q.091.15.214.271a1.8 1.8 0 0 0 .37.282"/>
                            </svg>
                        </div>

                    </div>
                </div>

                <div class="linkMainInfo">
                    <div>
                        <a href="${item.url}" class="psLink" target="_blank">
                            ${item.url}
                        </a>
                    </div>
                </div>

                ${noteText ? `
                    <div class="noteContainer show">
                        <div class="pinnedNoteText">
                            ${noteText}
                        </div>
                    </div>
                ` : ""}
            `;

            // Elements
            const copyBtn = div.querySelector(".copyBtn");
            const pinBtn = div.querySelector(".pinBtn");

            let copyCooldown = false;

            // Copy
            copyBtn.addEventListener("click", async (e) => {
                e.preventDefault();
                e.stopPropagation();

                if (copyCooldown) return;
                copyCooldown = true;

                await navigator.clipboard.writeText(item.url);

                copyBtn.classList.add("success");

                setTimeout(() => {
                    copyBtn.classList.remove("success");
                    copyCooldown = false;
                }, 700);
            });

            // Pin
            pinBtn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();

                chrome.storage.local.get(["pinnedLinks"], (data) => {

                    let pinned = data.pinnedLinks || [];

                    pinned = pinned.filter(
                        l => !(l.url === item.url && l.time === item.time)
                    );

                    chrome.storage.local.set({ pinnedLinks: pinned }, () => {

                        pinBtn.classList.add("success-unpin");

                        setTimeout(() => {

                            pinBtn.classList.remove("success-unpin");

                            loadPinnedLinks();
                            loadLinks();

                        }, 600);
                    });
                });
            });

            pinnedList.appendChild(div);
        }
    });
}

// Recent Links
function loadRecentLinks() {

    chrome.storage.local.get(["recentLinks", "pinnedLinks"], (data) => {

        const query = recentSearch?.value || "";

        const links = (data.recentLinks || [])
            .filter(item => matchesSearch(item, query))
            .slice(0, 20);

        const pinnedLinks = data.pinnedLinks || [];

        recentList.innerHTML = "";

        if (links.length === 0) {
            recentList.innerHTML = `<div class="emptyState">No recent links found</div>`;
            return;
        }

        for (const item of links) {

            const isPinned = pinnedLinks.some(
                l => l.url === item.url && l.time === item.time
            );

            const div = document.createElement("div");
            div.className = "recentItem";

            div.innerHTML = `
                <div class="linkTopBar">

                    <div class="recentNoteBtn" title="Add note">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M4 4h16v16H4z"></path>
                            <path d="M8 8h8"></path>
                            <path d="M8 12h8"></path>
                            <path d="M8 16h5"></path>
                        </svg>
                    </div>

                    <span class="copyBtn recentTopCopyBtn" title="Copy link">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </span>

                    <span class="pinBtn recentPinBtn ${isPinned ? "active" : ""}" title="Pin link">
                        <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M4.146.146A.5.5 0 0 1 4.5 0h7a.5.5 0 0 1 .5.5c0 .68-.342 1.174-.646 1.479-.126.125-.25.224-.354.298v4.431l.078.048c.203.127.476.314.751.555C12.36 7.775 13 8.527 13 9.5a.5.5 0 0 1-.5.5h-4v4.5c0 .276-.224 1.5-.5 1.5s-.5-1.224-.5-1.5V10h-4a.5.5 0 0 1-.5-.5c0-.973.64-1.725 1.17-2.189A6 6 0 0 1 5 6.708V2.277a3 3 0 0 1-.354-.298C4.342 1.674 4 1.179 4 .5a.5.5 0 0 1 .146-.354m1.58 1.408-.002-.001zm-.002-.001.002.001A.5.5 0 0 1 6 2v5a.5.5 0 0 1-.276.447h-.002l-.012.007-.054.03a5 5 0 0 0-.827.58c-.318.278-.585.596-.725.936h7.792c-.14-.34-.407-.658-.725-.936a5 5 0 0 0-.881-.61l-.012-.006h-.002A.5.5 0 0 1 10 7V2a.5.5 0 0 1 .295-.458 1.8 1.8 0 0 0 .351-.271c.08-.08.155-.17.214-.271H5.14q.091.15.214.271a1.8 1.8 0 0 0 .37.282"/>
                        </svg>
                    </span>

                    <span class="deleteBtn recentDeleteBtn" title="Delete">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 6h18"></path>
                            <path d="M8 6V4h8v2"></path>
                            <path d="M19 6l-1 16H6L5 6"></path>
                        </svg>
                    </span>

                </div>

                <div class="linkMainInfo">

                    <div><b>${item.user || "user"}</b></div>

                    <div>
                        <a href="${item.url}" target="_blank" class="recentLink">
                            ${item.url}
                        </a>
                    </div>

                </div>

                <div class="recentNoteContainer ${item.note ? "show" : ""}">
                    <textarea class="recentNoteInput" placeholder="Write a note...">${item.note || ""}</textarea>
                </div>
            `;

            const copyBtn = div.querySelector(".copyBtn");
            const pinBtn = div.querySelector(".recentPinBtn");
            const noteBtn = div.querySelector(".recentNoteBtn");
            const deleteBtn = div.querySelector(".recentDeleteBtn");
            const noteContainer = div.querySelector(".recentNoteContainer");
            const noteInput = div.querySelector(".recentNoteInput");

            noteInput.addEventListener("focus", () => isTypingNote = true);
            noteInput.addEventListener("blur", () => isTypingNote = false);

            // Note Saving
            noteInput.addEventListener("input", () => {

                isTypingNote = true;
                clearTimeout(noteInput._saveTimer);

                noteInput._saveTimer = setTimeout(() => {

                    isTypingNote = false;

                    chrome.storage.local.get(["recentLinks"], (data) => {

                        const arr = data.recentLinks || [];

                        const index = arr.findIndex(
                            l => l.url === item.url && l.time === item.time
                        );

                        if (index === -1) return;

                        arr[index].note = noteInput.value;
                        chrome.storage.local.set({ recentLinks: arr });
                    });

                }, 800);
            });

            let copyCooldown = false;

            // Copy
            copyBtn.addEventListener("click", async (e) => {
                e.preventDefault();
                e.stopPropagation();

                if (copyCooldown) return;
                copyCooldown = true;

                try {
                    await navigator.clipboard.writeText(item.url);

                    copyBtn.classList.add("success");

                    setTimeout(() => {
                        copyBtn.classList.remove("success");
                        copyCooldown = false;
                    }, 700);

                } catch (err) {
                    console.error("Copy failed:", err);
                    copyCooldown = false;
                }
            });

            let pinCooldown = false;

            // Pin
            pinBtn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();

                if (pinCooldown) return;
                pinCooldown = true;

                chrome.storage.local.get(["pinnedLinks"], (data) => {

                    let pinned = data.pinnedLinks || [];

                    const exists = pinned.some(
                        l => l.url === item.url && l.time === item.time
                    );

                    let successClass;

                    if (exists) {
                        pinned = pinned.filter(
                            l => !(l.url === item.url && l.time === item.time)
                        );
                        pinBtn.classList.remove("active");
                        successClass = "success-unpin";
                    } else {
                        pinned.unshift(item);
                        pinBtn.classList.add("active");
                        successClass = "success";
                    }

                    chrome.storage.local.set({ pinnedLinks: pinned }, () => {

                        pinBtn.classList.add(successClass);

                        setTimeout(() => {
                            pinBtn.classList.remove(successClass);

                            loadRecentLinks();
                            loadPinnedLinks();

                            pinCooldown = false;

                        }, 600);
                    });
                });
            });

            // Delete
            deleteBtn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();

                chrome.storage.local.get(["recentLinks", "pinnedLinks"], (data) => {

                    const recentLinks = (data.recentLinks || []).filter(
                        l => !(l.url === item.url && l.time === item.time)
                    );

                    const pinnedLinks = (data.pinnedLinks || []).filter(
                        l => !(l.url === item.url && l.time === item.time)
                    );

                    chrome.storage.local.set({
                        recentLinks,
                        pinnedLinks
                    }, () => {
                        loadRecentLinks();
                        loadPinnedLinks();
                    });
                });
            });

            // Note Toggle
            noteBtn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();

                noteContainer.classList.toggle("show");
                setTimeout(() => noteInput.focus(), 50);
            });

            recentList.appendChild(div);
        }
    });
}

// Load Links
function loadLinks() {

    chrome.storage.local.get(["links", "pinnedLinks"], (data) => {

        const query = linkSearch?.value || "";
        const links = (data.links || []).filter(item => matchesSearch(item, query));
        const pinnedLinks = data.pinnedLinks || [];

        linkList.innerHTML = "";

        if (links.length === 0) {
            linkList.innerHTML = `<div class="emptyState">No links found</div>`;
            return;
        }

        for (const item of links) {

            const isPinned = pinnedLinks.some(p => p.id === item.id);

            const div = document.createElement("div");
            div.className = "linkEntry";

            const streamer = (item.streamer || "").replace(/^@+/, "");
            const user = (item.user || "").replace(/^@+/, "");

            div.innerHTML = `
                <div class="linkTopBar">
                    <div class="topLeftBtns">

                        <div class="noteBtn" title="Add note">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M4 4h16v16H4z"></path>
                                <path d="M8 8h8"></path>
                                <path d="M8 12h8"></path>
                                <path d="M8 16h5"></path>
                            </svg>
                        </div>

                        <div class="copyBtn" title="Copy link">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                        </div>

                        <div class="pinBtn ${isPinned ? "active" : ""}" title="Pin link">
                            <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M4.146.146A.5.5 0 0 1 4.5 0h7a.5.5 0 0 1 .5.5c0 .68-.342 1.174-.646 1.479-.126.125-.25.224-.354.298v4.431l.078.048c.203.127.476.314.751.555C12.36 7.775 13 8.527 13 9.5a.5.5 0 0 1-.5.5h-4v4.5c0 .276-.224 1.5-.5 1.5s-.5-1.224-.5-1.5V10h-4a.5.5 0 0 1-.5-.5c0-.973.64-1.725 1.17-2.189A6 6 0 0 1 5 6.708V2.277a3 3 0 0 1-.354-.298C4.342 1.674 4 1.179 4 .5a.5.5 0 0 1 .146-.354m1.58 1.408-.002-.001zm-.002-.001.002.001A.5.5 0 0 1 6 2v5a.5.5 0 0 1-.276.447h-.002l-.012.007-.054.03a5 5 0 0 0-.827.58c-.318.278-.585.596-.725.936h7.792c-.14-.34-.407-.658-.725-.936a5 5 0 0 0-.881-.61l-.012-.006h-.002A.5.5 0 0 1 10 7V2a.5.5 0 0 1 .295-.458 1.8 1.8 0 0 0 .351-.271c.08-.08.155-.17.214-.271H5.14q.091.15.214.271a1.8 1.8 0 0 0 .37.282"/>
                            </svg>
                        </div>

                        <div class="deleteBtn" title="Delete">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M3 6h18"></path>
                                <path d="M8 6V4h8v2"></path>
                                <path d="M19 6l-1 16H6L5 6"></path>
                            </svg>
                        </div>

                    </div>
                </div>

                <div class="linkMainInfo">

                    <div>
                        <span class="label">Streamer:</span>
                        <a href="https://www.youtube.com/@${streamer}" target="_blank">
                            @${streamer}
                        </a>
                    </div>

                    <div>
                        <span class="label">Message sent by:</span>
                        <a href="https://www.youtube.com/@${user}" target="_blank">
                            @${user}
                        </a>
                    </div>

                    <div>
                        <span class="label">Link:</span>
                        <a href="${item.url}" class="psLink">
                            ${item.url}
                        </a>
                    </div>

                </div>

                <div class="noteContainer ${item.note ? "show" : ""}">
                    <textarea class="noteInput" placeholder="Write a note...">${item.note || ""}</textarea>
                </div>
            `;

            const copyBtn = div.querySelector(".copyBtn");
            const noteBtn = div.querySelector(".noteBtn");
            const deleteBtn = div.querySelector(".deleteBtn");
            const pinBtn = div.querySelector(".pinBtn");
            const noteContainer = div.querySelector(".noteContainer");
            const noteInput = div.querySelector(".noteInput");
            const psLink = div.querySelector(".psLink");

            noteInput.addEventListener("input", () => {
                clearTimeout(noteInput._saveTimer);

                noteInput._saveTimer = setTimeout(() => {

                    chrome.storage.local.get(["links"], (data) => {

                        const arr = data.links || [];
                        const index = arr.findIndex(l => l.id === item.id);

                        if (index === -1) return;

                        arr[index].note = noteInput.value;
                        chrome.storage.local.set({ links: arr });
                    });

                }, 800);
            });

            let copyCooldown = false;

            // Copy
            copyBtn.addEventListener("click", async (e) => {
                e.preventDefault();
                e.stopPropagation();

                if (copyCooldown) return;
                copyCooldown = true;

                await navigator.clipboard.writeText(item.url);

                copyBtn.classList.add("success");

                setTimeout(() => {
                    copyBtn.classList.remove("success");
                    copyCooldown = false;
                }, 700);
            });

            let pinCooldown = false;

            pinBtn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();

                chrome.storage.local.get(["pinnedLinks"], (data) => {

                    let pinned = data.pinnedLinks || [];

                    const exists = pinned.some(l => l.id === item.id);

                    let successClass;

                    if (exists) {
                        pinned = pinned.filter(l => l.id !== item.id);
                        pinBtn.classList.remove("active");
                        successClass = "success-unpin";
                    } else {
                        pinned.unshift(item);
                        pinBtn.classList.add("active");
                        successClass = "success";
                    }

                    chrome.storage.local.set({ pinnedLinks: pinned }, () => {

                        pinBtn.classList.add(successClass);

                        setTimeout(() => {

                            pinBtn.classList.remove(successClass);

                            loadLinks();
                            loadPinnedLinks();

                        }, 600);
                    });
                });
            });

            // Delete
            deleteBtn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();

                chrome.storage.local.get(["links", "pinnedLinks"], (data) => {

                    const links = (data.links || []).filter(l => l.id !== item.id);
                    const pinned = (data.pinnedLinks || []).filter(l => l.id !== item.id);

                    chrome.storage.local.set({ links, pinnedLinks: pinned }, () => {
                        loadLinks();
                        loadPinnedLinks();
                    });
                });
            });


            // Toggle Notes
            noteBtn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();

                noteContainer.classList.toggle("show");
                setTimeout(() => noteInput.focus(), 50);
            });

            psLink.addEventListener("click", async (e) => {
                e.preventDefault();

                chrome.tabs.create({
                    url: item.url,
                    active: true
                });
            });

            linkList.appendChild(div);
        }
    });
}

// Startup Validation
isPremiumUser().then((verified) => {
    if (!verified) {
        initKeySystem();
    } else {
        document.getElementById("keyOverlay").style.display = "none";
        startApp();
    }
});

// Reset Buttons
if (resetLinksBtn) {
    resetLinksBtn.addEventListener("click", () => {
        chrome.storage.local.set({ links: [] }, () => {
            loadLinks();
        });
    });
}

if (resetRecentLinksBtn) {
    resetRecentLinksBtn.addEventListener("click", () => {
        chrome.storage.local.set({ recentLinks: [] }, () => {
            loadRecentLinks();
        });
    });
}

if (resetStatsBtn) {
    resetStatsBtn.addEventListener("click", () => {
        chrome.storage.local.set({
            stats: {
                opened: 0,
                detected: 0,
                lastHit: 0,
                fastestHit: null
            }
        }, () => {
            loadStats();
        });
    });
}

// Setting Events
settingsIcon.addEventListener("click", (e) => {
    e.stopPropagation();

    closeRecentPanel();

    settingsPanel.classList.toggle("open");
});

document.addEventListener("click", (e) => {
    if (
        settingsPanel.classList.contains("open") &&
        !settingsPanel.contains(e.target) &&
        !settingsIcon.contains(e.target)
    ) {
        settingsPanel.classList.remove("open");
    }
});

soundSelect.addEventListener("change", () => {
    const file = soundSelect.value;

    const preview = new Audio(chrome.runtime.getURL(file));
    preview.volume = 0.6;

    try {
        preview.play();
    } catch (e) {
        console.log("Sound preview blocked:", e);
    }

    saveSettings();
});

[soundSetting, ignoreSameUser, autoStop, autoCopy, bypassCooldown, streamerOnly, soundSelect].forEach(el => {
    el.addEventListener("change", saveSettings);
});

// Storage Sync
chrome.storage.onChanged.addListener((changes, area) => {

    if (area !== "local") return;

    if (changes.cooldownEnd) {

        chrome.storage.local.get(["settings"], (data) => {

            // ignore cooldown if bypass is true
            if (data.settings?.bypassCooldown) {
                cooldownText.classList.add("cooldownHidden");
                return;
            }

            const endTime = changes.cooldownEnd.newValue;

            if (endTime > Date.now()) {
                startCooldownFromStorage(endTime);
            }

        });
    }

    // Toggle
    if (changes.enabled) {
        running = !!changes.enabled.newValue;
        updateUI();
    }

    if (changes.stats) {
        loadStats();
    }

    if (changes.links) {

        const active = document.activeElement;

        const isTyping =
            active?.classList?.contains("noteInput") ||
            active?.classList?.contains("recentNoteInput");

        if (isTyping) return;

        loadLinks();
    }
});

// Main Toggle
btn.addEventListener("click", async () => {

    // Cooldown Lock
    if (buttonCooldown) return;

    buttonCooldown = true;
    setTimeout(() => {
        buttonCooldown = false;
    }, 1000);

    const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
    });

    if (!tab?.id) return;

    // Ensure user is on youtube
    if (!tab.url.includes("youtube.com")) {

        status.textContent = "Open YouTube first";
        status.style.color = "orange";

        setTimeout(() => {
            updateUI();
        }, 1000);

        return;
    }

    const action = running ? "stop" : "start";

    // Sync
    chrome.tabs.sendMessage(tab.id, { action }, () => {

        if (chrome.runtime.lastError) return;

        chrome.storage.local.get(["enabled"], (data) => {
            running = !!data.enabled;
            updateUI();
        });
    });
});

// Cooldown Restore
chrome.storage.local.get(["cooldownEnd"], (data) => {
    const endTime = data.cooldownEnd || 0;

    if (endTime > Date.now()) {
        startCooldownFromStorage(endTime);
    }
});

// Tab Detection
chrome.tabs.onActivated.addListener(async () => {
    const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
    });

    if (!tab?.url) return;

    if (tab.url.includes("youtube.com")) {

        chrome.storage.local.get(["enabled"], (data) => {
            if (data.enabled) {
                running = true;
                updateUI();
            }
        });
    }
});

// Recent Panel
recentIcon.addEventListener("click", () => {

    settingsPanel.classList.remove("open");

    const open = recentPanel.classList.toggle("open");
    recentIcon.classList.toggle("open", open);

    if (open) loadRecentLinks();
});


// Global Click Events
document.addEventListener("click", (e) => {

    const panel = document.getElementById("recentPanel");
    const icon = document.getElementById("recentIcon");

    if (!panel || !icon) return;

    const isOpen = panel.classList.contains("open");
    if (!isOpen) return;

    const clickedInsidePanel = panel.contains(e.target);
    const clickedButton = icon.contains(e.target);

    if (!clickedInsidePanel && !clickedButton) {
        panel.classList.remove("open");
        icon.classList.remove("open");
    }
});

// Search Events
if (linkSearch) {
    linkSearch.addEventListener("input", () => loadLinks());
}

if (recentSearch) {
    recentSearch.addEventListener("input", () => loadRecentLinks());
}

if (pinnedSearch) {
    pinnedSearch.addEventListener("input", () => loadPinnedLinks());
}

// Startup
function startApp() {
    loadState();
    loadLinks();
    loadPinnedLinks();
    loadSettings();
    loadStats();

    setInterval(() => {
        loadStats();
    }, 1000);
}
