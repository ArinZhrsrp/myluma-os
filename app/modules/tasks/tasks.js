// LUMA — module: tasks
      // ---------------- TASKS ----------------
    MODULES.tasks = function () {
        return head('Tasks & Work', '<span id="tasksSub">Loading…</span>', '<button class="create-btn" id="addTaskBtn"><i class="fa-solid fa-plus"></i> Add task</button>') +
          '<div class="kanban" id="taskBoard"></div>';
    };


    // ---------- per-module interactions ----------

    // ---------- Tasks (Supabase-backed) ----------
    const TASK_COLS = [
      { status: 'todo', name: 'To do', dot: '#94a3b8' },
      { status: 'in_progress', name: 'In progress', dot: '#3b82f6' },
      { status: 'done', name: 'Done', dot: '#22c55e' },
    ];

    let TASKS = [], taskRender = null; // shared with the task popup (defined after docEl) so it can refresh the board
    const taskStatusInfo = st => TASK_COLS.find(c => c.status === st) || TASK_COLS[0];
    // "Today" / "Tomorrow" / "12 Oct"; past due dates are flagged overdue instead of just saying "Overdue"
    function taskDue(t) {
      if (!t.due_date) return '';
      const today = mytDayKey(Date.now()), d = Math.round((Date.parse(t.due_date) - Date.parse(today)) / 864e5);
      const dl = new Date(t.due_date + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
      return d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d < 0 && t.status !== 'done' ? `Overdue · ${dl}` : dl;
    }

    async function loadTasks(pg) {
      const board = pg.querySelector('#taskBoard');
      const sub = pg.querySelector('#tasksSub');

      const render = taskRender = () => {
        const today = mytDayKey(Date.now()), oldTops = {};
        board.querySelectorAll('[data-status]').forEach(c => { oldTops[c.dataset.status] = (c.querySelector('.kcol-body') || {}).scrollTop || 0; }); // keep each column where it was
        const open = TASKS.filter(t => t.status !== 'done');
        const dueToday = open.filter(t => t.due_date === today).length, overdue = open.filter(t => t.due_date && t.due_date < today).length;
        sub.textContent = `${open.length} open · ${dueToday} due today` + (overdue ? ` · ${overdue} overdue` : '');
        board.innerHTML = TASK_COLS.map(col => {
          const items = TASKS.filter(t => t.status === col.status).sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999')); // soonest due first
          return `<div data-status="${col.status}"><div class="kcol-head"><span class="dot" style="background:${col.dot}"></span><span class="t">${col.name}</span><span class="c">${items.length}</span></div><div class="kcol-body h-list">
            ${items.map(t => `<div class="card kcard" data-id="${t.id}">
              <div class="kt" style="${t.status === 'done' ? 'text-decoration:line-through;opacity:.55' : ''}">${escapeHtml(t.title)}</div>
              ${t.notes ? `<div class="knote"><i class="fa-regular fa-note-sticky"></i>${escapeHtml(t.notes)}</div>` : ''}
              <div class="kmeta"><span class="pill pill-${t.priority}">${t.priority === 'high' ? 'High' : t.priority === 'med' ? 'Medium' : 'Low'}</span><span>${escapeHtml(t.tag)}</span>
                <span class="t-status" title="Change status"><span class="d" style="background:${col.dot}"></span>${col.name}<i class="fa-solid fa-chevron-down" style="font-size:0.5rem"></i></span>
              </div>
              <div class="kfoot">${t.due_date ? `<span class="kdue ${t.status !== 'done' && t.due_date < today ? 't-due-over' : ''}"><i class="fa-regular fa-clock"></i> ${taskDue(t)}</span>` : '<span class="kdue" style="opacity:.5"><i class="fa-regular fa-clock"></i> No due date</span>'}
                <span class="kact"><i class="fa-solid ${t.status === 'done' ? 'fa-rotate-left' : 'fa-arrow-right'} task-advance" title="${t.status === 'done' ? 'Reopen' : 'Move forward'}" style="cursor:pointer"></i>
                <i class="fa-regular fa-trash-can task-delete" title="Delete" style="cursor:pointer"></i></span></div></div>`).join('')}
            <div class="add-card task-add" title="Add a task to ${col.name}"><i class="fa-solid fa-plus"></i> Add task</div></div></div>`;
        }).join('');
        board.querySelectorAll('.kcol-body').forEach(body => {
          body.scrollTop = oldTops[body.parentElement.dataset.status] || 0;
          const fade = () => body.classList.toggle('more', body.scrollTop + body.clientHeight < body.scrollHeight - 4); // soft fade = more tasks below
          body.addEventListener('scroll', fade); requestAnimationFrame(fade);
        });
      };

      const setStatus = async (t, status) => {
        if (t.status === status) return;
        const { data, error } = await LumaTasks.update(t.id, { status });
        if (error) return luAlert('Could not update task: ' + error.message);
        Object.assign(t, data); render();
      };

      board.addEventListener('click', async e => {
        const addBtn = e.target.closest('.task-add'); if (addBtn) return openTaskModal(null, addBtn.closest('[data-status]').dataset.status); // opens with this column's status already chosen
        const el = e.target.closest('.kcard'); if (!el) return;
        const t = TASKS.find(x => x.id === el.dataset.id); if (!t) return;
        if (e.target.closest('.task-advance')) {
          setStatus(t, t.status === 'done' ? 'todo' : t.status === 'todo' ? 'in_progress' : 'done');
        } else if (e.target.closest('.task-delete')) {
          if (!await luConfirm({ title: `Delete “${t.title}”?`, message: 'This task is removed. This can\'t be undone.' })) return;
          const { error } = await LumaTasks.remove(t.id);
          if (error) return luAlert('Could not delete task: ' + error.message);
          TASKS = TASKS.filter(x => x !== t); render();
        } else if (e.target.closest('.t-status')) { // jump straight to any status
          openTaskStatusMenu(e.target.closest('.t-status'), t, st => setStatus(t, st));
        } else openTaskModal(t); // click anywhere else on the card to open it
      });
      pg.querySelector('#addTaskBtn').addEventListener('click', () => openTaskModal(null, 'todo'));

      const { data, error } = await LumaTasks.list();
      if (error) {
        sub.textContent = 'Could not load tasks — has supabase/migrations/002_tasks.sql been run?';
        return;
      }
      TASKS = data; render();
    }


    // ---------- Task popup (add / edit) + quick status menu ----------
    const T_PRIO = [['low', 'Low'], ['med', 'Medium'], ['high', 'High']];
    const T_TAGS = ['Personal', 'Work', 'Study', 'Errand'];
    const tkForm = { id: null, status: 'todo', priority: 'med' };
    const tkErr = m => { docEl('tkError').textContent = m; docEl('tkError').style.display = m ? 'flex' : 'none'; };
    function paintTaskForm() {
      docEl('tkStatus').innerHTML = TASK_COLS.map(c => `<button type="button" data-s="${c.status}" class="${c.status === tkForm.status ? 'on' : ''}">${c.name}</button>`).join('');
      docEl('tkPriority').innerHTML = T_PRIO.map(([v, l]) => `<button type="button" data-p="${v}" class="${v === tkForm.priority ? 'on' : ''}">${l}</button>`).join('');
      docEl('tkTags').innerHTML = T_TAGS.map(t => `<button type="button" class="h-chip sm ${docEl('tkTag').value.trim().toLowerCase() === t.toLowerCase() ? 'on' : ''}" data-t="${t}">${t}</button>`).join('');
    }
    function openTaskModal(t, status) {
      tkForm.id = t ? t.id : null; tkForm.status = t ? t.status : status || 'todo'; tkForm.priority = t ? t.priority : 'med';
      docEl('tkModalTitle').textContent = t ? 'Edit task' : 'New task'; docEl('tkSave').textContent = t ? 'Save changes' : 'Add task';
      docEl('tkTitle').value = t ? t.title : ''; docEl('tkTag').value = t ? t.tag : 'Personal'; docEl('tkNotes').value = t ? t.notes || '' : '';
      docEl('tkDue').value = t && t.due_date ? t.due_date : ''; if (docEl('tkDue')._luDateRefresh) docEl('tkDue')._luDateRefresh();
      docEl('tkDelete').style.display = t ? '' : 'none'; tkErr(''); paintTaskForm();
      docEl('taskOverlay').classList.add('open'); setTimeout(() => docEl('tkTitle').focus(), 50);
    }
    const closeTaskModal = () => docEl('taskOverlay').classList.remove('open');
    docEl('tkClose').onclick = closeTaskModal;
    docEl('taskOverlay').onclick = e => { if (e.target === docEl('taskOverlay')) closeTaskModal(); };
    docEl('tkStatus').onclick = e => { const b = e.target.closest('button'); if (b) { tkForm.status = b.dataset.s; paintTaskForm(); } };
    docEl('tkPriority').onclick = e => { const b = e.target.closest('button'); if (b) { tkForm.priority = b.dataset.p; paintTaskForm(); } };
    docEl('tkTags').onclick = e => { const b = e.target.closest('button'); if (b) { docEl('tkTag').value = b.dataset.t; paintTaskForm(); } };
    docEl('tkTag').addEventListener('input', paintTaskForm);
    docEl('tkDue').addEventListener('change', paintTaskForm);
    docEl('tkTitle').addEventListener('keydown', e => { if (e.key === 'Enter') docEl('tkSave').click(); });
    docEl('tkSave').onclick = async () => {
      const title = docEl('tkTitle').value.trim();
      if (!title) return tkErr('Give the task a name.');
      if (!docEl('tkDue').value) return tkErr('Pick a due date.');
      const fields = { title, status: tkForm.status, priority: tkForm.priority, tag: docEl('tkTag').value.trim() || 'Personal', due_date: docEl('tkDue').value || null, notes: docEl('tkNotes').value.trim() };
      const btn = docEl('tkSave'), label = btn.textContent; btn.disabled = true; btn.textContent = 'Saving…';
      const { data, error } = tkForm.id ? await LumaTasks.update(tkForm.id, fields) : await LumaTasks.add({ title, status: fields.status, priority: fields.priority, tag: fields.tag, dueDate: fields.due_date, notes: fields.notes });
      btn.disabled = false; btn.textContent = label;
      if (error) return tkErr(/notes|schema cache/i.test(error.message) ? 'Notes need one more database step — run supabase/migrations/026_task_notes.sql in the SQL Editor (or clear the notes to save).' : error.message);
      const i = TASKS.findIndex(x => x.id === data.id); if (i >= 0) TASKS[i] = data; else TASKS.push(data);
      closeTaskModal(); if (taskRender) taskRender();
    };
    docEl('tkDelete').onclick = async () => {
      const t = TASKS.find(x => x.id === tkForm.id); if (!t) return;
      if (!await luConfirm({ title: `Delete “${t.title}”?`, message: 'This task is removed. This can\'t be undone.' })) return;
      const { error } = await LumaTasks.remove(t.id);
      if (error) return tkErr(error.message);
      TASKS = TASKS.filter(x => x !== t); closeTaskModal(); if (taskRender) taskRender();
    };

    // small menu to move a task to any status in one click
    function openTaskStatusMenu(anchor, task, onPick) {
      document.querySelectorAll('.t-menu').forEach(m => m.remove());
      const menu = document.createElement('div'); menu.className = 't-menu';
      menu.innerHTML = TASK_COLS.map(c => `<button type="button" data-s="${c.status}" class="${c.status === task.status ? 'cur' : ''}"><span class="d" style="background:${c.dot}"></span>${c.name}${c.status === task.status ? '<i class="fa-solid fa-check" style="margin-left:auto;font-size:0.65rem"></i>' : ''}</button>`).join('');
      document.body.appendChild(menu);
      const r = anchor.getBoundingClientRect(), mh = menu.offsetHeight, mw = menu.offsetWidth;
      menu.style.left = Math.max(8, Math.min(window.innerWidth - mw - 8, r.left)) + 'px';
      menu.style.top = (window.innerHeight - r.bottom < mh + 12 && r.top > mh + 12 ? r.top - mh - 6 : r.bottom + 6) + 'px';
      const close = () => { menu.remove(); document.removeEventListener('mousedown', outside, true); document.removeEventListener('keydown', onKey, true); document.removeEventListener('scroll', close, true); };
      const outside = e => { if (!menu.contains(e.target)) close(); };
      const onKey = e => { if (e.key === 'Escape') close(); };
      menu.onclick = e => { const b = e.target.closest('button'); if (b) { close(); onPick(b.dataset.s); } };
      document.addEventListener('mousedown', outside, true); document.addEventListener('keydown', onKey, true); document.addEventListener('scroll', close, true);
    }

    WIRE.tasks = function (pg) { return loadTasks(pg); };
