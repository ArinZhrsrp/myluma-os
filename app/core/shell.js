// LUMA — core: shell
    // ---------- Live clock: keeps the greeting, date and time current without a refresh ----------
    function setText(id, text) {
      const el = document.getElementById(id);
      if (el && el.textContent !== text) el.textContent = text;
    }
    function tickClock() {
      setText("topbarDate", mytTopbarDate());
      setText("greetDate", mytGreetingLine());
      if (typeof LUMA_USER !== "undefined" && LUMA_USER) { // greeting needs the user's name
        const h = mytHour();
        setText("greetName", (h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening") + ", " + lumaName());
      }
    }
    setInterval(tickClock, 1000);
    // timers are throttled in background tabs — catch up the moment the tab is visible again
    document.addEventListener("visibilitychange", () => { if (!document.hidden) tickClock(); });


    // ---------- Sidebar toggle for mobile ----------
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const hamburger = document.getElementById('hamburgerBtn');

    function toggleSidebar() {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('active');
      document.body.style.overflow = sidebar.classList.contains('open') ? 'hidden' : '';
    }
    hamburger.addEventListener('click', toggleSidebar);
    overlay.addEventListener('click', toggleSidebar);

    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
      }
    });

    // ---------- Logout confirmation ----------
    const logoutOverlay = document.getElementById('logoutOverlay');
    const logoutConfirmBtn = document.getElementById('logoutConfirmBtn');
    function openLogoutConfirm() { logoutOverlay.classList.add('open'); }
    function closeLogoutConfirm() { logoutOverlay.classList.remove('open'); }
    document.getElementById('logoutCancelBtn').addEventListener('click', closeLogoutConfirm);
    logoutOverlay.addEventListener('click', (e) => { if (e.target === logoutOverlay) closeLogoutConfirm(); });
    logoutConfirmBtn.addEventListener('click', async () => {
      logoutConfirmBtn.disabled = true;
      logoutConfirmBtn.textContent = 'Logging out…';
      await LumaAuth.signOut();
      window.location.href = '/login/';
    });
    document.getElementById('topbarLogoutBtn').addEventListener('click', openLogoutConfirm);
